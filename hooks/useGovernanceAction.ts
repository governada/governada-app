'use client';

/**
 * React hook for governance action submission flow.
 * Manages a phase machine: idle -> preflight -> confirming -> publishing -> building -> signing -> submitting -> success
 *
 * Mirrors the pattern in hooks/useVote.ts.
 */

import { useState, useCallback, useRef } from 'react';
import { useWallet } from '@/utils/wallet';
import { checkGovernanceSupport } from '@/lib/delegation';
import {
  preflightGovernanceAction,
  submitGovernanceAction,
  GovernanceActionError,
} from '@/lib/governanceAction';
import type {
  GovernanceActionTarget,
  GovernanceActionPreflight,
  GovernanceActionResult,
} from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Phase machine
// ---------------------------------------------------------------------------

export type GovernanceActionPhase =
  | { status: 'idle' }
  | { status: 'preflight' }
  | { status: 'confirming'; preflight: GovernanceActionPreflight }
  | { status: 'publishing' }
  | { status: 'building' }
  | { status: 'signing' }
  | { status: 'submitting' }
  | { status: 'published'; anchorUrl: string; anchorHash: string }
  | { status: 'success'; txHash: string; anchorUrl: string; anchorHash: string; confirmed: boolean }
  | { status: 'error'; code: string; message: string; hint: string };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGovernanceAction() {
  const { wallet, walletName, connected } = useWallet();
  const [phase, setPhase] = useState<GovernanceActionPhase>({ status: 'idle' });
  const preflightRef = useRef<GovernanceActionPreflight | null>(null);
  const targetRef = useRef<GovernanceActionTarget | null>(null);

  /**
   * Step 1: Run preflight checks (balance validation) and move to confirming state.
   */
  const startSubmission = useCallback(
    async (target: GovernanceActionTarget) => {
      if (!wallet || !connected) {
        setPhase({
          status: 'error',
          code: 'no_wallet',
          message: 'Wallet not connected',
          hint: 'Connect your wallet to submit a governance action.',
        });
        return;
      }

      if (walletName) {
        const govCheck = checkGovernanceSupport(walletName);
        if (!govCheck.supported) {
          setPhase({
            status: 'error',
            code: 'wallet_unsupported',
            message: 'Wallet does not support governance transactions.',
            hint: govCheck.hint || 'Try Eternl or Lace.',
          });
          return;
        }
      }

      setPhase({ status: 'preflight' });
      targetRef.current = target;

      try {
        const preflight = await preflightGovernanceAction(wallet, target);
        preflightRef.current = preflight;

        import('@/lib/posthog')
          .then(({ posthog }) => {
            posthog.capture('governance_action_preflight', {
              action_type: target.type,
              can_afford: preflight.canAfford,
              current_balance: preflight.currentBalance,
            });
          })
          .catch(() => {});

        setPhase({ status: 'confirming', preflight });
      } catch (err) {
        if (err instanceof GovernanceActionError) {
          setPhase({ status: 'error', code: err.code, message: err.message, hint: err.hint });
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
   * Step 2: User confirmed. Publish CIP-108 metadata, then attempt tx building.
   * The publishFn callback handles the API call to publish the CIP-108 document.
   */
  const confirmSubmission = useCallback(
    async (
      publishFn: () => Promise<{ anchorUrl: string; anchorHash: string }>,
    ): Promise<GovernanceActionResult | null> => {
      if (!wallet || !connected) return null;

      const target = targetRef.current;
      if (!target) return null;

      try {
        // Phase 1: Publish CIP-108 metadata
        setPhase({ status: 'publishing' });
        const { anchorUrl, anchorHash } = await publishFn();

        import('@/lib/posthog')
          .then(({ posthog }) => {
            posthog.capture('governance_action_published', {
              action_type: target.type,
              anchor_url: anchorUrl,
            });
          })
          .catch(() => {});

        // Update target with anchor info
        const fullTarget: GovernanceActionTarget = {
          ...target,
          anchorUrl,
          anchorHash,
        };

        // Phase 2: Build and submit transaction (or mock)
        const result = await submitGovernanceAction(wallet, fullTarget, {
          onPhase: (p) => setPhase({ status: p }),
        });

        setPhase({
          status: 'success',
          txHash: result.txHash,
          anchorUrl: result.anchorUrl,
          anchorHash: result.anchorHash,
          confirmed: false,
        });

        import('@/lib/posthog')
          .then(({ posthog }) => {
            posthog.capture('governance_action_submitted', {
              action_type: target.type,
              tx_hash: result.txHash,
              anchor_url: result.anchorUrl,
            });
          })
          .catch(() => {});

        return result;
      } catch (err) {
        if (err instanceof GovernanceActionError) {
          // Special case: if metadata was published but tx failed,
          // show a "published" state so the user knows the metadata is live
          if (err.code === 'not_implemented') {
            setPhase({
              status: 'published',
              anchorUrl: target.anchorUrl,
              anchorHash: target.anchorHash,
            });
          } else {
            setPhase({ status: 'error', code: err.code, message: err.message, hint: err.hint });
          }
          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('governance_action_failed', {
                action_type: target.type,
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
        return null;
      }
    },
    [wallet, connected],
  );

  const reset = useCallback(() => {
    preflightRef.current = null;
    targetRef.current = null;
    setPhase({ status: 'idle' });
  }, []);

  const isProcessing =
    phase.status === 'preflight' ||
    phase.status === 'publishing' ||
    phase.status === 'building' ||
    phase.status === 'signing' ||
    phase.status === 'submitting';

  const canSubmit = connected && !isProcessing;

  return {
    phase,
    startSubmission,
    confirmSubmission,
    reset,
    isProcessing,
    canSubmit,
  };
}
