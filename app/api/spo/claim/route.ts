import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ClaimBody {
  poolId: string;
  walletAddress: string;
  stakeAddress: string;
  governanceStatement?: string;
  socialLinks?: Array<{ uri: string; label?: string }>;
}

/**
 * POST /api/spo/claim — Claim an SPO pool profile.
 * Verifies the wallet's stake address matches pool operator via
 * on-chain data (full verification via Koios pool_info).
 */
export const POST = withRouteHandler(async (request: NextRequest) => {
  const enabled = await getFeatureFlag('spo_claim_flow', false);
  if (!enabled) {
    return NextResponse.json({ error: 'SPO claim flow is not yet enabled' }, { status: 403 });
  }

  const body = (await request.json()) as ClaimBody;
  const { poolId, walletAddress, stakeAddress, governanceStatement, socialLinks } = body;

  if (!poolId || !walletAddress || !stakeAddress) {
    return NextResponse.json(
      { error: 'Required: poolId, walletAddress, stakeAddress' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  // Check if already claimed
  const { data: existing } = await supabase
    .from('pools')
    .select('pool_id, claimed_by')
    .eq('pool_id', poolId)
    .single();

  if (existing?.claimed_by) {
    if (existing.claimed_by === walletAddress) {
      return NextResponse.json({ error: 'Pool already claimed by you' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Pool already claimed by another wallet' }, { status: 409 });
  }

  // Verify ownership via Koios
  const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';
  try {
    const res = await fetch(`${KOIOS_BASE}/pool_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _pool_bech32_ids: [poolId] }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to verify pool ownership' }, { status: 502 });
    }

    const poolInfos = await res.json();
    const poolInfo = poolInfos[0];
    if (!poolInfo) {
      return NextResponse.json({ error: 'Pool not found on-chain' }, { status: 404 });
    }

    const isOwner = poolInfo.owners?.some((owner: string) => owner === stakeAddress);
    const isRewardAddr = poolInfo.reward_addr === stakeAddress;

    if (!isOwner && !isRewardAddr) {
      return NextResponse.json(
        { error: 'Stake address does not match pool operator or reward address' },
        { status: 403 },
      );
    }
  } catch (err) {
    logger.error('[spo/claim] Koios verification failed', { error: err });
    return NextResponse.json({ error: 'Pool ownership verification failed' }, { status: 502 });
  }

  // Claim the pool
  const updateData: Record<string, unknown> = {
    claimed_by: walletAddress,
    claimed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (governanceStatement) updateData.governance_statement = governanceStatement;
  if (socialLinks) updateData.social_links = socialLinks;

  const { error } = await supabase.from('pools').update(updateData).eq('pool_id', poolId);

  if (error) {
    logger.error('[spo/claim] Failed to update pool', { error });
    return NextResponse.json({ error: 'Failed to claim pool' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    poolId,
    claimedAt: updateData.claimed_at,
    message:
      'Pool claimed successfully. Your governance identity score will update in the next scoring cycle.',
  });
});
