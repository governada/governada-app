export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const GET = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const address = new URL(request.url).searchParams.get('address')?.trim();
    if (!address) {
      return NextResponse.json({ error: 'Required: address query param' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // --- 1. Find user record ---
    // Try wallet_address first, then check user_wallets by stake_address / payment_address
    let userId: string | null = null;
    let userRow: {
      id: string;
      wallet_address: string;
      last_active: string | null;
      created_at?: string;
      claimed_drep_id: string | null;
      display_name: string | null;
      governance_depth: string;
    } | null = null;

    // Direct match on users.wallet_address
    const { data: directUser } = await supabase
      .from('users')
      .select('id, wallet_address, last_active, claimed_drep_id, display_name, governance_depth')
      .eq('wallet_address', address)
      .maybeSingle();

    if (directUser) {
      userRow = directUser;
      userId = directUser.id;
    }

    // If not found, try user_wallets (stake address, payment address, drep_id, pool_id)
    if (!userId) {
      const { data: walletMatch } = await supabase
        .from('user_wallets')
        .select('user_id, stake_address, payment_address, drep_id, pool_id, segments')
        .or(
          `stake_address.eq.${address},payment_address.eq.${address},drep_id.eq.${address},pool_id.eq.${address}`,
        )
        .limit(1)
        .maybeSingle();

      if (walletMatch) {
        userId = walletMatch.user_id;
        const { data: linkedUser } = await supabase
          .from('users')
          .select(
            'id, wallet_address, last_active, claimed_drep_id, display_name, governance_depth',
          )
          .eq('id', userId)
          .single();
        if (linkedUser) userRow = linkedUser;
      }
    }

    // --- 2. Gather wallet info (all wallets for this user) ---
    let wallets: Array<{
      stake_address: string;
      payment_address: string;
      drep_id: string | null;
      pool_id: string | null;
      segments: string[] | null;
    }> = [];

    if (userId) {
      const { data: userWallets } = await supabase
        .from('user_wallets')
        .select('stake_address, payment_address, drep_id, pool_id, segments')
        .eq('user_id', userId);
      wallets = userWallets ?? [];
    }

    // Derive segment info from wallet data
    const primaryWallet = wallets[0] ?? null;
    const drepId = wallets.find((w) => w.drep_id)?.drep_id ?? userRow?.claimed_drep_id ?? null;
    const poolId = wallets.find((w) => w.pool_id)?.pool_id ?? null;
    const stakeAddress = primaryWallet?.stake_address ?? null;

    // --- 3. DRep profile from dreps table ---
    let drepProfile: {
      id: string;
      info: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
      score: number | null;
      current_tier: string | null;
    } | null = null;

    if (drepId) {
      const { data: drep } = await supabase
        .from('dreps')
        .select('id, info, metadata, score, current_tier')
        .eq('id', drepId)
        .maybeSingle();
      if (drep) {
        drepProfile = {
          ...drep,
          info: drep.info as Record<string, unknown> | null,
          metadata: drep.metadata as Record<string, unknown> | null,
        };
      }
    }

    // --- 4. Segment detection ---
    const segments = primaryWallet?.segments ?? [];
    const detectedSegment = segments.includes('drep')
      ? 'drep'
      : segments.includes('spo')
        ? 'spo'
        : segments.includes('cc')
          ? 'cc'
          : userId
            ? 'citizen'
            : 'unknown';

    // Look up delegation info from dreps table if we have a DRep match
    // and from user's wallet data for delegation targets
    let delegatedDrep: string | null = null;
    const delegatedPool: string | null = null;

    if (stakeAddress) {
      // Check if there's delegation info in poll_responses
      const { data: recentPoll } = await supabase
        .from('poll_responses')
        .select('delegated_drep_id')
        .eq('stake_address', stakeAddress)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentPoll?.delegated_drep_id) {
        delegatedDrep = recentPoll.delegated_drep_id;
      }
    }

    // --- 5. Activity counts ---
    const activityQueries = await Promise.all([
      // Poll responses count
      stakeAddress
        ? supabase
            .from('poll_responses')
            .select('id', { count: 'exact', head: true })
            .eq('stake_address', stakeAddress)
        : Promise.resolve({ count: 0 }),

      // Proposal drafts count
      stakeAddress
        ? supabase
            .from('proposal_drafts')
            .select('id', { count: 'exact', head: true })
            .eq('owner_stake_address', stakeAddress)
        : Promise.resolve({ count: 0 }),

      // Draft reviews count
      stakeAddress
        ? supabase
            .from('draft_reviews')
            .select('id', { count: 'exact', head: true })
            .eq('reviewer_stake_address', stakeAddress)
        : Promise.resolve({ count: 0 }),
    ]);

    return NextResponse.json({
      user: userRow
        ? {
            id: userRow.id,
            wallet_address: userRow.wallet_address,
            display_name: userRow.display_name,
            last_active: userRow.last_active,
            governance_depth: userRow.governance_depth,
          }
        : null,
      segment: {
        detected: detectedSegment,
        segments,
        drepId,
        poolId,
        stakeAddress,
        delegatedDrep,
        delegatedPool,
        tier: drepProfile?.current_tier ?? null,
      },
      drepProfile: drepProfile
        ? {
            id: drepProfile.id,
            name:
              (drepProfile.info as Record<string, unknown> | null)?.givenName ??
              (drepProfile.metadata as Record<string, unknown> | null)?.name ??
              null,
            bio:
              (drepProfile.metadata as Record<string, unknown> | null)?.bio ??
              (drepProfile.info as Record<string, unknown> | null)?.motivations ??
              null,
            score: drepProfile.score,
            tier: drepProfile.current_tier,
            claimed: userRow?.claimed_drep_id === drepProfile.id,
          }
        : null,
      wallets: wallets.map((w) => ({
        stake_address: w.stake_address,
        payment_address: w.payment_address,
        drep_id: w.drep_id,
        pool_id: w.pool_id,
      })),
      activity: {
        pollVotes: activityQueries[0].count ?? 0,
        proposalDrafts: activityQueries[1].count ?? 0,
        draftReviews: activityQueries[2].count ?? 0,
      },
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
