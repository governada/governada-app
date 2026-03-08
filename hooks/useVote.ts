'use client';

import { useState, useCallback, useRef } from 'react';
import { useWallet } from '@/utils/wallet';
import { checkGovernanceSupport } from '@/lib/delegation';
import {
  castVote,
  preflightVote,
  waitForTxConfirmation,
  VoteError,
  type VoteChoice,
  type VoterRole,
  type VoteTarget,
  type VotePreflight,
  type VoteResult,
} from '@/lib/voting';

export type VotePhase =
  | { status: 'idle' }
  | { status: 'preflight' }
  | { status: 'confirming'; preflight: VotePreflight }
  | { status: 'building' }
  | { status: 'signing' }
  | { status: 'submitting' }
  | { status: 'success'; txHash: string; vote: VoteChoice; confirmed: boolean }
  | { status: 'error'; code: string; message: string; hint: string };

export function useVote() {
  const { wallet, walletName, connected } = useWallet();
  const [phase, setPhase] = useState<VotePhase>({ status: 'idle' });
  const preflightRef = useRef<VotePreflight | null>(null);
  const targetRef = useRef<VoteTarget | null>(null);

  /**
   * Step 1: Run preflight checks and move to confirmation state.
   * @param credentialId - DRep bech32 ID or SPO bech32 pool ID
   */
  const startVote = useCallback(
    async (target: VoteTarget, role: VoterRole = 'drep', credentialId?: string | null) => {
      if (!wallet || !connected) {
        setPhase({
          status: 'error',
          code: 'no_wallet',
          message: 'Wallet not connected',
          hint: 'Connect your wallet to vote.',
        });
        return;
      }

      if (!credentialId) {
        setPhase({
          status: 'error',
          code: 'no_drep_credential',
          message: role === 'drep' ? 'Not registered as a DRep' : 'Not registered as an SPO',
          hint:
            role === 'drep'
              ? 'You must be a registered DRep to cast governance votes.'
              : 'You must be a registered SPO to cast governance votes.',
        });
        return;
      }

      if (walletName) {
        const govCheck = checkGovernanceSupport(walletName);
        if (!govCheck.supported) {
          setPhase({
            status: 'error',
            code: 'wallet_unsupported',
            message: 'Wallet does not support governance voting.',
            hint: govCheck.hint || 'Try Eternl or Lace.',
          });
          return;
        }
      }

      setPhase({ status: 'preflight' });
      targetRef.current = target;

      try {
        const preflight = await preflightVote(wallet, target, role, credentialId);
        preflightRef.current = preflight;
        setPhase({ status: 'confirming', preflight });
      } catch (err) {
        if (err instanceof VoteError) {
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
   * Step 2: User confirmed — build, sign, and submit the vote transaction.
   */
  const confirmVote = useCallback(
    async (
      vote: VoteChoice,
      anchorUrl?: string,
      anchorHash?: string,
    ): Promise<VoteResult | null> => {
      if (!wallet || !connected) return null;

      const preflight = preflightRef.current;
      const target = targetRef.current;
      if (!preflight || !target) return null;

      try {
        const result = await castVote(
          wallet,
          target,
          vote,
          preflight.voterRole,
          preflight.voterId,
          {
            anchorUrl,
            anchorHash,
            onPhase: (p) => setPhase({ status: p }),
          },
        );

        setPhase({ status: 'success', txHash: result.txHash, vote, confirmed: false });

        import('@/lib/posthog')
          .then(({ posthog }) => {
            posthog.capture('governance_vote_cast', {
              gov_action_tx_hash: target.txHash,
              gov_action_index: target.txIndex,
              vote,
              voter_role: preflight.voterRole,
              tx_hash: result.txHash,
              had_existing_vote: preflight.hasExistingVote,
            });
          })
          .catch(() => {});

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

        return result;
      } catch (err) {
        if (err instanceof VoteError) {
          setPhase({ status: 'error', code: err.code, message: err.message, hint: err.hint });
          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('governance_vote_failed', {
                gov_action_tx_hash: target.txHash,
                vote,
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
    phase.status === 'building' ||
    phase.status === 'signing' ||
    phase.status === 'submitting';

  const canVote = connected && !isProcessing;

  return {
    phase,
    startVote,
    confirmVote,
    reset,
    isProcessing,
    canVote,
  };
}
