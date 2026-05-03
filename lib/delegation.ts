/**
 * DRep vote delegation transaction builder.
 * Handles preflight checks (stake registration, network validation),
 * CIP-1694 voteDelegationCertificate with optional stake registration,
 * and phase callbacks for accurate UI state tracking.
 */

import { MeshTxBuilder, KoiosProvider, BrowserWallet } from '@meshsdk/core';
import { resolveDelegationMode, type DelegationMode } from '@/lib/delegation/mode';

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

export type DelegationErrorCode =
  | 'no_wallet'
  | 'no_reward_address'
  | 'user_rejected'
  | 'insufficient_funds'
  | 'tx_build_failed'
  | 'tx_submit_failed'
  | 'wallet_unsupported'
  | 'wrong_network'
  | 'unknown';

export class DelegationError extends Error {
  code: DelegationErrorCode;
  hint: string;

  constructor(code: DelegationErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'DelegationError';
    this.code = code;
    this.hint = hint;
  }
}

function classifyError(err: unknown): DelegationError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes('user') &&
    (lower.includes('reject') || lower.includes('cancel') || lower.includes('declined'))
  ) {
    return new DelegationError('user_rejected', msg, 'No worries -- you can delegate anytime.');
  }
  if (lower.includes('insufficient') || lower.includes('not enough') || lower.includes('utxo')) {
    return new DelegationError(
      'insufficient_funds',
      msg,
      'You need at least 2 ADA to cover the transaction fee and deposit.',
    );
  }
  if (lower.includes('already registered')) {
    return new DelegationError(
      'tx_build_failed',
      msg,
      'Stake key registration conflict. Please try again.',
    );
  }
  if (
    lower.includes('not supported') ||
    lower.includes('not implemented') ||
    lower.includes('api.get')
  ) {
    return new DelegationError(
      'wallet_unsupported',
      msg,
      'Your wallet may not support governance transactions. Try Eternl or Lace.',
    );
  }
  return new DelegationError('unknown', msg, 'Something went wrong. Please try again.');
}

const provider = new KoiosProvider('api');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DelegationResult {
  txHash: string;
  drepId: string;
  mode: DelegationMode;
}

export interface DelegationPreflight {
  rewardAddress: string;
  stakeRegistered: boolean;
  estimatedFee: string;
  needsDeposit: boolean;
}

export type DelegationPhaseCallback = (phase: 'building' | 'signing' | 'submitting') => void;

// ---------------------------------------------------------------------------
// Wallet governance capability detection
// ---------------------------------------------------------------------------

export interface GovernanceCheck {
  supported: boolean;
  hint?: string;
}

/**
 * Check if a wallet extension declares CIP-95 governance support.
 * For known-unsupported wallets (standalone Nami), returns a targeted message.
 */
export function checkGovernanceSupport(walletName: string): GovernanceCheck {
  if (typeof window === 'undefined') return { supported: true };

  const cardanoWindow = window as unknown as Record<
    string,
    Record<string, { supportedExtensions?: Array<{ cip: number }> }>
  >;
  const cardanoApi = cardanoWindow.cardano?.[walletName.toLowerCase()];
  if (!cardanoApi) return { supported: false, hint: 'Wallet extension not found.' };

  const extensions = cardanoApi.supportedExtensions;
  if (Array.isArray(extensions)) {
    const hasCip95 = extensions.some((ext: { cip: number }) => ext.cip === 95);
    if (hasCip95) return { supported: true };
  }

  const name = walletName.toLowerCase();
  if (name === 'nami') {
    return {
      supported: false,
      hint: "Nami doesn't support governance delegation. Migrate to Lace (includes Nami mode) at lace.io for a one-click switch.",
    };
  }

  // Wallets without CIP-95 might still work -- allow with caveat
  return { supported: true };
}

// ---------------------------------------------------------------------------
// Preflight helpers
// ---------------------------------------------------------------------------

async function checkStakeRegistration(rewardAddress: string): Promise<boolean> {
  try {
    const res = await fetch(`${KOIOS_BASE}/account_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _stake_addresses: [rewardAddress] }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return false;
    return data[0].status === 'registered';
  } catch {
    return false;
  }
}

function validateMainnet(rewardAddress: string): void {
  if (!rewardAddress.startsWith('stake1')) {
    throw new DelegationError(
      'wrong_network',
      'Wallet is not on Cardano mainnet.',
      'Switch your wallet to mainnet to delegate on Governada.',
    );
  }
}

async function submitSandboxDelegation(
  rewardAddress: string,
  drepId: string,
): Promise<DelegationResult> {
  const response = await fetch('/api/delegation/sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ stakeAddress: rewardAddress, targetDrepId: drepId }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    txHash?: string;
  };

  if (!response.ok || !body.txHash) {
    throw new DelegationError(
      'tx_submit_failed',
      body.error ?? 'Sandbox delegation submission failed.',
      'The preview environment could not record the sandbox delegation. Please try again.',
    );
  }

  return { txHash: body.txHash, drepId, mode: 'sandbox' };
}

/**
 * Run preflight checks: resolve reward address, validate network, check
 * stake registration. Returns info needed for the confirmation step UI.
 */
export async function preflightDelegation(wallet: BrowserWallet): Promise<DelegationPreflight> {
  const rewardAddresses = await wallet.getRewardAddresses();
  const rewardAddress = rewardAddresses?.[0];

  if (!rewardAddress) {
    throw new DelegationError(
      'no_reward_address',
      'Could not resolve your stake address.',
      'Your wallet may not have a stake address. Make sure you have ADA in your wallet.',
    );
  }

  validateMainnet(rewardAddress);

  const stakeRegistered = await checkStakeRegistration(rewardAddress);

  return {
    rewardAddress,
    stakeRegistered,
    estimatedFee: stakeRegistered ? '~0.2 ADA' : '~2.2 ADA',
    needsDeposit: !stakeRegistered,
  };
}

// ---------------------------------------------------------------------------
// Transaction confirmation polling
// ---------------------------------------------------------------------------

/**
 * Poll Koios for a submitted tx hash until it appears on-chain or times out.
 * Returns true if confirmed, false if timed out.
 */
export async function waitForTxConfirmation(
  txHash: string,
  opts?: { maxAttempts?: number; intervalMs?: number; onConfirmed?: () => void },
): Promise<boolean> {
  const maxAttempts = opts?.maxAttempts ?? 30;
  const intervalMs = opts?.intervalMs ?? 10_000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await fetch(`${KOIOS_BASE}/tx_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _tx_hashes: [txHash] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].num_confirmations > 0) {
        opts?.onConfirmed?.();
        return true;
      }
    } catch {
      // Retry on network error
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Transaction builder
// ---------------------------------------------------------------------------

/**
 * Build, sign, and submit a vote delegation transaction.
 * Optionally chains registerStakeCertificate for first-time delegators.
 * Reports phase transitions via onPhase callback for accurate UI tracking.
 */
export async function delegateToDRep(
  wallet: BrowserWallet,
  drepId: string,
  options?: {
    registerStake?: boolean;
    onPhase?: DelegationPhaseCallback;
  },
): Promise<DelegationResult> {
  try {
    options?.onPhase?.('building');

    const rewardAddresses = await wallet.getRewardAddresses();
    const rewardAddress = rewardAddresses?.[0];

    if (!rewardAddress) {
      throw new DelegationError(
        'no_reward_address',
        'Could not resolve your stake address.',
        'Your wallet may not have a registered stake address.',
      );
    }

    // delegateToDRep can run without preflight; reject non-mainnet reward addresses here too.
    validateMainnet(rewardAddress);

    const mode = await resolveDelegationMode();
    if (mode === 'sandbox') {
      options?.onPhase?.('submitting');
      return await submitSandboxDelegation(rewardAddress, drepId);
    }

    const utxos = await wallet.getUtxos();
    const changeAddress = await wallet.getChangeAddress();

    if (!utxos || utxos.length === 0) {
      throw new DelegationError(
        'insufficient_funds',
        'No UTXOs found in wallet.',
        'Your wallet needs ADA to pay for the transaction fee.',
      );
    }

    const txBuilder = new MeshTxBuilder({ fetcher: provider });

    if (options?.registerStake) {
      txBuilder.registerStakeCertificate(rewardAddress);
    }

    txBuilder
      .voteDelegationCertificate({ dRepId: drepId }, rewardAddress)
      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos);

    const unsignedTx = await txBuilder.complete();

    options?.onPhase?.('signing');
    const signedTx = await wallet.signTx(unsignedTx);

    options?.onPhase?.('submitting');
    const txHash = await wallet.submitTx(signedTx);

    return { txHash, drepId, mode: 'mainnet' };
  } catch (err) {
    if (err instanceof DelegationError) throw err;
    throw classifyError(err);
  }
}
