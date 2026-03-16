/**
 * Governance action transaction builder.
 * Handles CIP-1694 governance action submission: preflight checks,
 * deposit validation, and transaction construction.
 *
 * Mirrors the pattern in lib/voting.ts and lib/delegation.ts.
 *
 * IMPORTANT: Governance action submission requires a 100,000 ADA refundable
 * deposit. This is the highest-stakes transaction in the app.
 *
 * NOTE: The actual transaction building is a PLACEHOLDER. MeshJS v1.9.0-beta
 * may not have full governance action (proposalProcedure) support yet.
 * The preflight, UX flow, and safety checks are fully implemented.
 */

import type { BrowserWallet } from '@meshsdk/core';
import type {
  GovernanceActionTarget,
  GovernanceActionPreflight,
  GovernanceActionResult,
} from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 100,000 ADA in lovelace — the governance action deposit */
const DEPOSIT_LOVELACE = 100_000_000_000;

/** Estimated transaction fee in lovelace (~0.2 ADA) */
const ESTIMATED_FEE_LOVELACE = 200_000;

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export type GovernanceActionErrorCode =
  | 'no_wallet'
  | 'user_rejected'
  | 'insufficient_funds'
  | 'tx_build_failed'
  | 'tx_submit_failed'
  | 'wallet_unsupported'
  | 'not_implemented'
  | 'unknown';

export class GovernanceActionError extends Error {
  code: GovernanceActionErrorCode;
  hint: string;

  constructor(code: GovernanceActionErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'GovernanceActionError';
    this.code = code;
    this.hint = hint;
  }
}

function classifyError(err: unknown): GovernanceActionError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes('user') &&
    (lower.includes('reject') || lower.includes('cancel') || lower.includes('declined'))
  ) {
    return new GovernanceActionError('user_rejected', msg, 'No worries — you can submit anytime.');
  }
  if (lower.includes('insufficient') || lower.includes('not enough') || lower.includes('utxo')) {
    return new GovernanceActionError(
      'insufficient_funds',
      msg,
      'You need at least 100,000 ADA to cover the deposit plus transaction fee.',
    );
  }
  if (
    lower.includes('not supported') ||
    lower.includes('not implemented') ||
    lower.includes('api.get')
  ) {
    return new GovernanceActionError(
      'wallet_unsupported',
      msg,
      'Your wallet may not support governance action submission. Try Eternl or Lace.',
    );
  }
  return new GovernanceActionError('unknown', msg, 'Something went wrong. Please try again.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  return ada.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export type GovernanceActionPhaseCallback = (
  phase: 'publishing' | 'building' | 'signing' | 'submitting',
) => void;

/**
 * Run preflight checks for governance action submission.
 * Validates wallet balance against the 100K ADA deposit + fee.
 */
export async function preflightGovernanceAction(
  wallet: BrowserWallet,
  _target: GovernanceActionTarget,
): Promise<GovernanceActionPreflight> {
  const lovelaceStr = await wallet.getLovelace();
  const currentBalance = Number(lovelaceStr);

  const totalRequired = DEPOSIT_LOVELACE + ESTIMATED_FEE_LOVELACE;
  const canAfford = currentBalance >= totalRequired;
  const balanceAfter = canAfford ? currentBalance - totalRequired : 0;

  return {
    estimatedDeposit: '100,000 ADA',
    estimatedFee: '~0.2 ADA',
    currentBalance: `${formatAda(currentBalance)} ADA`,
    balanceAfter: `${formatAda(balanceAfter)} ADA`,
    canAfford,
    depositLovelace: DEPOSIT_LOVELACE.toString(),
  };
}

// ---------------------------------------------------------------------------
// Transaction builder (PLACEHOLDER)
// ---------------------------------------------------------------------------

/**
 * Submit a governance action on-chain.
 *
 * TODO: Replace with actual MeshTxBuilder.proposalProcedure() when MeshJS
 * supports governance action construction. Currently returns a mock result
 * for UI testing and flow validation.
 *
 * The actual transaction would:
 * 1. Build a proposalProcedure certificate with the anchor URL/hash
 * 2. Attach the 100,000 ADA deposit
 * 3. Set the return address for the deposit
 * 4. Include type-specific parameters (withdrawals, parameter changes, etc.)
 * 5. Sign and submit via the connected wallet
 */
export async function submitGovernanceAction(
  wallet: BrowserWallet,
  target: GovernanceActionTarget,
  options?: {
    onPhase?: GovernanceActionPhaseCallback;
  },
): Promise<GovernanceActionResult> {
  try {
    // Preflight: verify balance
    const preflight = await preflightGovernanceAction(wallet, target);
    if (!preflight.canAfford) {
      throw new GovernanceActionError(
        'insufficient_funds',
        `Wallet balance (${preflight.currentBalance}) is insufficient for the 100,000 ADA deposit plus fees.`,
        'You need at least 100,000 ADA in your wallet to submit a governance action. The deposit is refunded when the proposal expires or is ratified.',
      );
    }

    options?.onPhase?.('building');

    // ---------------------------------------------------------------------------
    // PLACEHOLDER: MeshJS governance action support pending
    // ---------------------------------------------------------------------------
    // When MeshJS adds proposalProcedure support, the implementation would be:
    //
    // const utxos = await wallet.getUtxos();
    // const changeAddress = await wallet.getChangeAddress();
    // const rewardAddresses = await wallet.getRewardAddresses();
    //
    // const txBuilder = new MeshTxBuilder({ fetcher: provider });
    // txBuilder
    //   .proposalProcedure({
    //     type: target.type,
    //     anchor: { anchorUrl: target.anchorUrl, anchorDataHash: target.anchorHash },
    //     deposit: DEPOSIT_LOVELACE.toString(),
    //     returnAddress: rewardAddresses[0],
    //     ...(target.type === 'TreasuryWithdrawals' ? {
    //       withdrawals: [{ address: target.receivingAddress, amount: target.withdrawalAmount }],
    //     } : {}),
    //   })
    //   .changeAddress(changeAddress)
    //   .selectUtxosFrom(utxos);
    //
    // const unsignedTx = await txBuilder.complete();
    // options?.onPhase?.('signing');
    // const signedTx = await wallet.signTx(unsignedTx);
    // options?.onPhase?.('submitting');
    // const txHash = await wallet.submitTx(signedTx);
    // ---------------------------------------------------------------------------

    // For now, throw a clear error that this is not yet wired
    throw new GovernanceActionError(
      'not_implemented',
      'Governance action transaction building is not yet available.',
      'The on-chain submission requires MeshJS governance action support which is still in development. Your proposal metadata has been published and is ready for submission via cardano-cli or when wallet support is available.',
    );
  } catch (err) {
    if (err instanceof GovernanceActionError) throw err;
    throw classifyError(err);
  }
}

// ---------------------------------------------------------------------------
// Re-export confirmation polling from delegation module
// ---------------------------------------------------------------------------

export { waitForTxConfirmation } from './delegation';
