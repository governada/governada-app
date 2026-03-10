/**
 * Wallet-to-Pool Detection.
 * Determines if a connected wallet operates a stake pool by checking
 * if the wallet's stake key matches pool operator/reward addresses via Koios.
 */

import { logger } from '@/lib/logger';

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

export type UserSegment = 'anonymous' | 'citizen' | 'spo' | 'drep' | 'cc';

export interface SegmentDetectionResult {
  segment: UserSegment;
  poolId: string | null;
  drepId: string | null;
  delegatedPool: string | null;
  delegatedDrep: string | null;
}

interface KoiosAccountInfo {
  stake_address?: string;
  delegated_pool?: string;
  delegated_drep?: string;
  status?: string;
}

interface KoiosPoolInfo {
  pool_id_bech32?: string;
  owners?: string[];
  reward_addr?: string;
}

/**
 * Detect user segment from their wallet's stake address.
 * Checks: is SPO (pool operator), is DRep (registered), or citizen.
 *
 * When a user is both an SPO and a DRep, the primary segment is 'drep'
 * (DRep action queue is the default workspace landing) but both poolId
 * and drepId are populated so the UI can show both workspace groups.
 */
export async function detectUserSegment(stakeAddress: string): Promise<SegmentDetectionResult> {
  const result: SegmentDetectionResult = {
    segment: 'citizen',
    poolId: null,
    drepId: null,
    delegatedPool: null,
    delegatedDrep: null,
  };

  try {
    const accountRes = await fetch(`${KOIOS_BASE}/account_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _stake_addresses: [stakeAddress] }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!accountRes.ok) {
      logger.warn('[walletDetection] Koios account_info failed', {
        status: accountRes.status,
      });
      return result;
    }

    const accounts = (await accountRes.json()) as KoiosAccountInfo[];
    const account = accounts[0];
    if (!account) return result;

    result.delegatedPool = account.delegated_pool ?? null;
    result.delegatedDrep = account.delegated_drep ?? null;

    // Check both roles — a user can be both an SPO and a DRep
    const poolId = await detectPoolOwnership(stakeAddress);
    if (poolId) {
      result.poolId = poolId;
    }

    const isDrep = !!(account.delegated_drep && account.delegated_drep === stakeAddress);
    if (isDrep) {
      result.drepId = account.delegated_drep!;
    }

    // Determine primary segment. DRep takes priority for dual-role users
    // because the DRep action queue is the default workspace landing.
    if (isDrep) {
      result.segment = 'drep';
    } else if (poolId) {
      result.segment = 'spo';
    }

    return result;
  } catch (err) {
    logger.warn('[walletDetection] Detection failed', { error: err });
    return result;
  }
}

/**
 * Check if a stake address is the owner/operator of any pool.
 * Returns pool_id if match found, null otherwise.
 */
async function detectPoolOwnership(stakeAddress: string): Promise<string | null> {
  try {
    const res = await fetch(`${KOIOS_BASE}/pool_list?limit=500`, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const pools = (await res.json()) as Array<{ pool_id_bech32: string }>;

    const batchSize = 50;
    for (let i = 0; i < pools.length; i += batchSize) {
      const batch = pools.slice(i, i + batchSize).map((p) => p.pool_id_bech32);

      const infoRes = await fetch(`${KOIOS_BASE}/pool_info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _pool_bech32_ids: batch }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!infoRes.ok) continue;

      const poolInfos = (await infoRes.json()) as KoiosPoolInfo[];
      for (const pool of poolInfos) {
        if (!pool.pool_id_bech32) continue;

        const isOwner = pool.owners?.some((owner) => owner === stakeAddress);
        const isRewardAddr = pool.reward_addr === stakeAddress;

        if (isOwner || isRewardAddr) {
          return pool.pool_id_bech32;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
