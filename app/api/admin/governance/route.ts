export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const [epochStats, ghiSnapshots, decentralization, tierDistribution, proposalTypes] =
      await Promise.all([
        // Epoch stats — last 20 epochs
        supabase
          .from('governance_epoch_stats')
          .select('*')
          .order('epoch_no', { ascending: false })
          .limit(20),

        // GHI snapshots — last 20
        supabase
          .from('ghi_snapshots')
          .select('epoch_no, score, band, computed_at')
          .order('epoch_no', { ascending: false })
          .limit(20),

        // Decentralization — last 20
        supabase
          .from('decentralization_snapshots')
          .select(
            'epoch_no, composite_score, nakamoto_coefficient, gini, shannon_entropy, hhi, active_drep_count',
          )
          .order('epoch_no', { ascending: false })
          .limit(20),

        // DRep tier distribution
        supabase
          .from('dreps')
          .select('current_tier')
          .not('current_tier', 'is', null)
          .not('score', 'is', null),

        // Proposal type distribution
        supabase.from('proposals').select('proposal_type, proposed_epoch'),
      ]);

    // Compute tier counts
    const tiers: Record<string, number> = {};
    for (const d of tierDistribution.data || []) {
      const tier = d.current_tier || 'Unknown';
      tiers[tier] = (tiers[tier] || 0) + 1;
    }

    // Compute proposal type counts
    const types: Record<string, number> = {};
    for (const p of proposalTypes.data || []) {
      const t = p.proposal_type || 'Unknown';
      types[t] = (types[t] || 0) + 1;
    }

    return NextResponse.json({
      epoch_stats: (epochStats.data || []).reverse(),
      ghi_snapshots: (ghiSnapshots.data || []).reverse(),
      decentralization: (decentralization.data || []).reverse(),
      tier_distribution: Object.entries(tiers)
        .map(([tier, count]) => ({ tier, count }))
        .sort((a, b) => b.count - a.count),
      proposal_types: Object.entries(types)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
