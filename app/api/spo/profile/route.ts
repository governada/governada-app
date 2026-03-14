import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ProfileUpdateBody {
  poolId: string;
  walletAddress: string;
  governanceStatement?: string;
  socialLinks?: Array<{ uri: string; label?: string }>;
}

/**
 * PATCH /api/spo/profile — Update governance statement and social links
 * for a claimed pool. Verifies the wallet matches the pool's claimed_by.
 */
export const PATCH = withRouteHandler(async (request: NextRequest) => {
  const enabled = await getFeatureFlag('spo_claim_flow', false);
  if (!enabled) {
    return NextResponse.json({ error: 'SPO profile editing is not yet enabled' }, { status: 403 });
  }

  const body = (await request.json()) as ProfileUpdateBody;
  const { poolId, walletAddress, governanceStatement, socialLinks } = body;

  if (!poolId || !walletAddress) {
    return NextResponse.json({ error: 'Required: poolId, walletAddress' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify the wallet owns this pool
  const { data: pool } = await supabase
    .from('pools')
    .select('pool_id, claimed_by')
    .eq('pool_id', poolId)
    .single();

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  if (pool.claimed_by !== walletAddress) {
    return NextResponse.json(
      { error: 'Only the pool claimer can update this profile' },
      { status: 403 },
    );
  }

  // Validate governance statement length
  if (governanceStatement != null && governanceStatement.length > 500) {
    return NextResponse.json(
      { error: 'Governance statement must be 500 characters or fewer' },
      { status: 400 },
    );
  }

  // Validate social links
  if (socialLinks != null) {
    if (!Array.isArray(socialLinks) || socialLinks.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 social links allowed' }, { status: 400 });
    }
    for (const link of socialLinks) {
      if (!link.uri || typeof link.uri !== 'string') {
        return NextResponse.json({ error: 'Each social link must have a uri' }, { status: 400 });
      }
    }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (governanceStatement !== undefined) {
    updateData.governance_statement = governanceStatement || null;
  }
  if (socialLinks !== undefined) {
    updateData.social_links = socialLinks;
  }

  const { error } = await supabase.from('pools').update(updateData).eq('pool_id', poolId);

  if (error) {
    logger.error('[spo/profile] Failed to update pool profile', { error });
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    poolId,
    message: 'Profile updated successfully.',
  });
});
