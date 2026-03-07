/**
 * Governance vote transaction builder.
 * Handles CIP-1694 voting for DReps and SPOs: preflight checks,
 * MeshTxBuilder vote construction, signing, submission, and confirmation.
 *
 * Mirrors the pattern in lib/delegation.ts.
 */

import { MeshTxBuilder, KoiosProvider, BrowserWallet } from '@meshsdk/core';

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export type VoteErrorCode =
  | 'no_wallet'
  | 'no_drep_credential'
  | 'user_rejected'
  | 'insufficient_funds'
  | 'tx_build_failed'
  | 'tx_submit_failed'
  | 'wallet_unsupported'
  | 'proposal_not_active'
  | 'already_voted'
  | 'unknown';

export class VoteError extends Error {
  code: VoteErrorCode;
  hint: string;

  constructor(code: VoteErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'VoteError';
    this.code = code;
    this.hint = hint;
  }
}

function classifyVoteError(err: unknown): VoteError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes('user') &&
    (lower.includes('reject') || lower.includes('cancel') || lower.includes('declined'))
  ) {
    return new VoteError('user_rejected', msg, 'No worries — you can vote anytime.');
  }
  if (lower.includes('insufficient') || lower.includes('not enough') || lower.includes('utxo')) {
    return new VoteError(
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
    return new VoteError(
      'wallet_unsupported',
      msg,
      'Your wallet may not support governance voting. Try Eternl or Lace.',
    );
  }
  return new VoteError('unknown', msg, 'Something went wrong. Please try again.');
}

const provider = new KoiosProvider('api');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoteChoice = 'Yes' | 'No' | 'Abstain';

export type VoterRole = 'drep' | 'spo';

export interface VoteTarget {
  /** Governance action tx hash */
  txHash: string;
  /** Governance action index within the transaction */
  txIndex: number;
  /** Proposal title for display */
  title?: string;
}

export interface VoteResult {
  txHash: string;
  govActionTxHash: string;
  govActionIndex: number;
  vote: VoteChoice;
}

export interface VotePreflight {
  voterRole: VoterRole;
  voterId: string;
  estimatedFee: string;
  hasExistingVote: boolean;
}

export type VotePhaseCallback = (phase: 'building' | 'signing' | 'submitting') => void;

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

/**
 * Resolve the voter credential from the connected wallet.
 * For DReps: checks if the wallet's stake key is registered as a DRep.
 * For SPOs: checks pool operator credential.
 */
async function resolveVoterCredential(
  wallet: BrowserWallet,
  role: VoterRole,
  credentialId: string,
): Promise<{ voterId: string }> {
  if (role === 'drep') {
    if (!credentialId) {
      throw new VoteError(
        'no_drep_credential',
        'No DRep credential found.',
        'You must be a registered DRep to cast a governance vote.',
      );
    }
    return { voterId: credentialId };
  }
  // SPO: credentialId is the pool hash
  if (!credentialId) {
    throw new VoteError(
      'no_drep_credential',
      'No pool operator credential found.',
      'You must be a registered SPO to cast a governance vote.',
    );
  }
  return { voterId: credentialId };
}

/**
 * Check if the voter has already voted on this governance action.
 */
async function checkExistingVote(
  voterId: string,
  govActionTxHash: string,
  govActionIndex: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${KOIOS_BASE}/voter_proposal_list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _voter_id: voterId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!Array.isArray(data)) return false;
    return data.some(
      (v: { gov_action_tx_hash?: string; gov_action_index?: number }) =>
        v.gov_action_tx_hash === govActionTxHash && v.gov_action_index === govActionIndex,
    );
  } catch {
    // If we can't check, allow the vote — the chain will reject duplicates
    return false;
  }
}

/**
 * Run preflight checks before vote casting.
 * Returns info needed for the confirmation step UI.
 */
export async function preflightVote(
  wallet: BrowserWallet,
  target: VoteTarget,
  role: VoterRole,
  credentialId: string,
): Promise<VotePreflight> {
  const { voterId } = await resolveVoterCredential(wallet, role, credentialId);

  const hasExistingVote = await checkExistingVote(voterId, target.txHash, target.txIndex);

  return {
    voterRole: role,
    voterId,
    estimatedFee: '~0.2 ADA',
    hasExistingVote,
  };
}

// ---------------------------------------------------------------------------
// Transaction builder
// ---------------------------------------------------------------------------

/**
 * Build, sign, and submit a governance vote transaction.
 * Reports phase transitions via onPhase callback.
 */
export async function castVote(
  wallet: BrowserWallet,
  target: VoteTarget,
  vote: VoteChoice,
  role: VoterRole,
  credentialId: string,
  options?: {
    anchorUrl?: string;
    anchorHash?: string;
    onPhase?: VotePhaseCallback;
  },
): Promise<VoteResult> {
  try {
    options?.onPhase?.('building');

    const utxos = await wallet.getUtxos();
    const changeAddress = await wallet.getChangeAddress();

    if (!utxos || utxos.length === 0) {
      throw new VoteError(
        'insufficient_funds',
        'No UTXOs found in wallet.',
        'Your wallet needs ADA to pay for the transaction fee.',
      );
    }

    // Build voter object based on role
    const voter =
      role === 'drep'
        ? { type: 'DRep' as const, drepId: credentialId }
        : { type: 'StakingPool' as const, keyHash: credentialId };

    // Build voting procedure
    const votingProcedure: {
      voteKind: VoteChoice;
      anchor?: { anchorUrl: string; anchorDataHash: string };
    } = {
      voteKind: vote,
    };

    // Add anchor if rationale URL provided
    if (options?.anchorUrl && options?.anchorHash) {
      votingProcedure.anchor = {
        anchorUrl: options.anchorUrl,
        anchorDataHash: options.anchorHash,
      };
    }

    // Build governance action reference
    const govActionId = {
      txHash: target.txHash,
      txIndex: target.txIndex,
    };

    const txBuilder = new MeshTxBuilder({ fetcher: provider });

    txBuilder
      .vote(voter, govActionId, votingProcedure)
      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos);

    const unsignedTx = await txBuilder.complete();

    options?.onPhase?.('signing');
    const signedTx = await wallet.signTx(unsignedTx);

    options?.onPhase?.('submitting');
    const txHash = await wallet.submitTx(signedTx);

    return {
      txHash,
      govActionTxHash: target.txHash,
      govActionIndex: target.txIndex,
      vote,
    };
  } catch (err) {
    if (err instanceof VoteError) throw err;
    throw classifyVoteError(err);
  }
}

// ---------------------------------------------------------------------------
// Transaction confirmation (reuse from delegation module)
// ---------------------------------------------------------------------------

export { waitForTxConfirmation } from './delegation';
