'use client';

import { useState, useCallback, useRef } from 'react';
import { useWallet } from '@/utils/wallet';
import {
  delegateToDRep,
  preflightDelegation,
  checkGovernanceSupport,
  waitForTxConfirmation,
  DelegationError,
  type DelegationResult,
  type DelegationPreflight,
} from '@/lib/delegation';
import { getStoredSession } from '@/lib/supabaseAuth';

export type DelegationPhase =
  | { status: 'idle' }
  | { status: 'preflight' }
  | { status: 'confirming'; preflight: DelegationPreflight }
  | { status: 'building' }
  | { status: 'signing' }
  | { status: 'submitting' }
  | { status: 'success'; txHash: string; confirmed: boolean }
  | { status: 'error'; code: string; message: string; hint: string };

interface DelegationAnalyticsPayload {
  drep_id: string;
  previous_drep_id: string | null;
  tx_hash: string;
  stake_registered: boolean;
}

function captureDelegationSuccess(
  payload: DelegationAnalyticsPayload,
  preflight: DelegationPreflight,
  result: DelegationResult,
) {
  fetch('/api/delegation/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stakeAddress: preflight.rewardAddress,
      drepId: payload.drep_id,
      previousDrepId: payload.previous_drep_id,
      txHash: payload.tx_hash,
      stakeRegistered: payload.stake_registered,
      mode: result.mode,
      currentUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Delegation analytics relay failed: ${response.status}`);
    })
    .catch(() => {
      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('delegation_completed', payload);
          // Phase 0: dual-emit during delegated naming transition
          posthog.capture('delegated', payload);
        })
        .catch(() => {});
    });
}

export function useDelegation() {
  const { wallet, walletName, connected, isAuthenticated, delegatedDrepId, refreshDelegation } =
    useWallet();
  const [phase, setPhase] = useState<DelegationPhase>({ status: 'idle' });
  const preflightRef = useRef<DelegationPreflight | null>(null);

  /**
   * Step 1: Check governance support, run preflight checks (network, stake
   * registration), and move to the confirmation state.
   */
  const startDelegation = useCallback(
    async (drepId: string) => {
      if (!wallet || !connected) {
        setPhase({
          status: 'error',
          code: 'no_wallet',
          message: 'Wallet not connected',
          hint: 'Connect your wallet first.',
        });
        return;
      }

      if (walletName) {
        const govCheck = checkGovernanceSupport(walletName);
        if (!govCheck.supported) {
          setPhase({
            status: 'error',
            code: 'wallet_unsupported',
            message: 'Wallet does not support governance delegation.',
            hint: govCheck.hint || 'Try Eternl or Lace.',
          });
          return;
        }
      }

      setPhase({ status: 'preflight' });

      try {
        const preflight = await preflightDelegation(wallet);
        preflightRef.current = preflight;
        setPhase({ status: 'confirming', preflight });
      } catch (err) {
        if (err instanceof DelegationError) {
          setPhase({ status: 'error', code: err.code, message: err.message, hint: err.hint });
          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('delegation_preflight_failed', {
                drep_id: drepId,
                error_code: err.code,
              });
            })
            .catch(() => {});
        } else {
          setPhase({
            status: 'error',
            code: 'unknown',
            message: String(err),
            hint: 'Something went wrong. Please try again.',
          });
        }
      }
    },
    [wallet, walletName, connected],
  );

  /**
   * Step 2: User confirmed -- build, sign, and submit the transaction.
   * Requires preflight to have been run first (reads from ref).
   */
  const confirmDelegation = useCallback(
    async (drepId: string): Promise<DelegationResult | null> => {
      if (!wallet || !connected) return null;

      const preflight = preflightRef.current;
      if (!preflight) return null;

      try {
        const result = await delegateToDRep(wallet, drepId, {
          registerStake: !preflight.stakeRegistered,
          onPhase: (p) => setPhase({ status: p }),
        });

        if (isAuthenticated) {
          const token = getStoredSession();
          if (token) {
            fetch('/api/user', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                delegation_history: [
                  {
                    drepId,
                    timestamp: new Date().toISOString(),
                    txHash: result.txHash,
                  },
                ],
              }),
            }).catch(() => {});
          }
        }

        if (refreshDelegation) {
          refreshDelegation();
        }

        setPhase({ status: 'success', txHash: result.txHash, confirmed: false });

        captureDelegationSuccess(
          {
            drep_id: drepId,
            previous_drep_id: delegatedDrepId || null,
            tx_hash: result.txHash,
            stake_registered: preflight.stakeRegistered,
          },
          preflight,
          result,
        );

        if (result.mode !== 'sandbox') {
          waitForTxConfirmation(result.txHash, {
            maxAttempts: 30,
            intervalMs: 10_000,
            onConfirmed: () => {
              setPhase((prev) =>
                prev.status === 'success' && prev.txHash === result.txHash
                  ? { ...prev, confirmed: true }
                  : prev,
              );
            },
          }).catch(() => {});
        }

        return result;
      } catch (err) {
        if (err instanceof DelegationError) {
          setPhase({ status: 'error', code: err.code, message: err.message, hint: err.hint });
          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('delegation_failed', { drep_id: drepId, error_code: err.code });
            })
            .catch(() => {});
        } else {
          setPhase({
            status: 'error',
            code: 'unknown',
            message: String(err),
            hint: 'Something went wrong. Please try again.',
          });
        }
        return null;
      }
    },
    [wallet, connected, isAuthenticated, refreshDelegation, delegatedDrepId],
  );

  const reset = useCallback(() => {
    preflightRef.current = null;
    setPhase({ status: 'idle' });
  }, []);

  const isProcessing =
    phase.status === 'preflight' ||
    phase.status === 'building' ||
    phase.status === 'signing' ||
    phase.status === 'submitting';

  return {
    phase,
    startDelegation,
    confirmDelegation,
    reset,
    isProcessing,
    delegatedDrepId,
    canDelegate: connected && !!wallet,
  };
}
