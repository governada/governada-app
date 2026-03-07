/**
 * DRep metadata update transaction builder.
 * Constructs a CIP-1694 DRep update certificate with a CIP-100 metadata anchor,
 * using MeshJS for transaction building, signing, and submission.
 *
 * Follows the same pattern as lib/voting.ts.
 */

import { MeshTxBuilder, KoiosProvider, BrowserWallet } from '@meshsdk/core';

const provider = new KoiosProvider('api');

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export type DRepUpdateErrorCode =
  | 'no_wallet'
  | 'no_drep_credential'
  | 'user_rejected'
  | 'insufficient_funds'
  | 'tx_build_failed'
  | 'tx_submit_failed'
  | 'wallet_unsupported'
  | 'unknown';

export class DRepUpdateError extends Error {
  code: DRepUpdateErrorCode;
  hint: string;

  constructor(code: DRepUpdateErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'DRepUpdateError';
    this.code = code;
    this.hint = hint;
  }
}

function classifyError(err: unknown): DRepUpdateError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes('user') &&
    (lower.includes('reject') || lower.includes('cancel') || lower.includes('declined'))
  ) {
    return new DRepUpdateError('user_rejected', msg, 'No worries — you can publish anytime.');
  }
  if (lower.includes('insufficient') || lower.includes('not enough') || lower.includes('utxo')) {
    return new DRepUpdateError(
      'insufficient_funds',
      msg,
      'You need ADA to cover the transaction fee (~0.2 ADA).',
    );
  }
  if (
    lower.includes('not supported') ||
    lower.includes('not implemented') ||
    lower.includes('api.get')
  ) {
    return new DRepUpdateError(
      'wallet_unsupported',
      msg,
      'Your wallet may not support governance transactions. Try Eternl or Lace.',
    );
  }
  return new DRepUpdateError('unknown', msg, 'Something went wrong. Please try again.');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DRepUpdateResult {
  txHash: string;
  anchorUrl: string;
  anchorHash: string;
}

export type DRepUpdatePhaseCallback = (phase: 'building' | 'signing' | 'submitting') => void;

// ---------------------------------------------------------------------------
// Transaction builder
// ---------------------------------------------------------------------------

/**
 * Build, sign, and submit a DRep metadata update transaction.
 * This updates the DRep's on-chain metadata anchor to point to
 * a CIP-100 governance statement document.
 */
export async function updateDRepMetadata(
  wallet: BrowserWallet,
  drepId: string,
  anchorUrl: string,
  anchorHash: string,
  options?: {
    onPhase?: DRepUpdatePhaseCallback;
  },
): Promise<DRepUpdateResult> {
  try {
    options?.onPhase?.('building');

    const utxos = await wallet.getUtxos();
    const changeAddress = await wallet.getChangeAddress();

    if (!utxos || utxos.length === 0) {
      throw new DRepUpdateError(
        'insufficient_funds',
        'No UTXOs found in wallet.',
        'Your wallet needs ADA to pay for the transaction fee.',
      );
    }

    const anchor = {
      anchorUrl,
      anchorDataHash: anchorHash,
    };

    const txBuilder = new MeshTxBuilder({ fetcher: provider });

    txBuilder
      .drepUpdateCertificate(drepId, anchor)
      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos);

    const unsignedTx = await txBuilder.complete();

    options?.onPhase?.('signing');
    const signedTx = await wallet.signTx(unsignedTx);

    options?.onPhase?.('submitting');
    const txHash = await wallet.submitTx(signedTx);

    return { txHash, anchorUrl, anchorHash };
  } catch (err) {
    if (err instanceof DRepUpdateError) throw err;
    throw classifyError(err);
  }
}
