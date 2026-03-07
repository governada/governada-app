'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@/utils/wallet';
import { checkGovernanceSupport } from '@/lib/delegation';
import { updateDRepMetadata, DRepUpdateError, type DRepUpdateResult } from '@/lib/drepUpdate';

export type DRepUpdatePhase =
  | { status: 'idle' }
  | { status: 'building' }
  | { status: 'signing' }
  | { status: 'submitting' }
  | { status: 'success'; txHash: string }
  | { status: 'error'; code: string; message: string; hint: string };

export function useDRepUpdate() {
  const { wallet, walletName, connected, ownDRepId } = useWallet();
  const [phase, setPhase] = useState<DRepUpdatePhase>({ status: 'idle' });

  const publishOnChain = useCallback(
    async (anchorUrl: string, anchorHash: string): Promise<DRepUpdateResult | null> => {
      if (!wallet || !connected) {
        setPhase({
          status: 'error',
          code: 'no_wallet',
          message: 'Wallet not connected',
          hint: 'Connect your wallet to publish on-chain.',
        });
        return null;
      }

      if (!ownDRepId) {
        setPhase({
          status: 'error',
          code: 'no_drep_credential',
          message: 'Not registered as a DRep',
          hint: 'You must be a registered DRep to update your metadata anchor.',
        });
        return null;
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
          return null;
        }
      }

      try {
        const result = await updateDRepMetadata(wallet, ownDRepId, anchorUrl, anchorHash, {
          onPhase: (p) => setPhase({ status: p }),
        });

        setPhase({ status: 'success', txHash: result.txHash });

        import('@/lib/posthog')
          .then(({ posthog }) => {
            posthog.capture('drep_metadata_updated', {
              drep_id: ownDRepId,
              anchor_url: anchorUrl,
              tx_hash: result.txHash,
            });
          })
          .catch(() => {});

        return result;
      } catch (err) {
        if (err instanceof DRepUpdateError) {
          setPhase({ status: 'error', code: err.code, message: err.message, hint: err.hint });
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
    [wallet, walletName, connected, ownDRepId],
  );

  const reset = useCallback(() => {
    setPhase({ status: 'idle' });
  }, []);

  const isProcessing =
    phase.status === 'building' || phase.status === 'signing' || phase.status === 'submitting';

  return {
    phase,
    publishOnChain,
    reset,
    isProcessing,
    canPublish: connected && !!wallet && !!ownDRepId,
  };
}
