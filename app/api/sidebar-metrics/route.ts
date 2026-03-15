/**
 * Sidebar Metrics API — lightweight endpoint for Living Sidebar sub-labels.
 *
 * Returns all metrics as formatted display strings keyed by sublabelKey.
 * Queries cached data from Supabase — no expensive computations.
 *
 * Auth-optional: anonymous users get governance-level metrics only.
 * Authenticated users get persona-specific metrics (scores, pending votes, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getOpenProposalsForDRep, getDRepById } from '@/lib/data';
import { getTreasuryBalance } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B ₳`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(0)}M ₳`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K ₳`;
  return `${Math.round(ada)} ₳`;
}

function formatAdaFromAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B ₳`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(0)}M ₳`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K ₳`;
  return `${Math.round(ada)} ₳`;
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const supabase = getSupabaseAdmin();
  const metrics: Record<string, string> = {};

  // Parse optional auth context from query params
  const drepId = request.nextUrl.searchParams.get('drepId');
  const poolId = request.nextUrl.searchParams.get('poolId');
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');

  // ── Governance metrics (everyone gets these) ──────────────────────────

  const [activeProposalCount, drepCount, ghiSnapshot, treasury] = await Promise.all([
    supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
    supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .eq('info->>isActive', 'true'),
    supabase
      .from('ghi_snapshots')
      .select('ghi_score')
      .order('epoch_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getTreasuryBalance(),
  ]);

  metrics['gov.activeProposals'] = `${activeProposalCount.count ?? 0} active`;
  metrics['gov.activeDreps'] = `${drepCount.count ?? 0} DReps`;

  const ghiScore = ghiSnapshot.data?.ghi_score;
  if (ghiScore != null) {
    metrics['gov.ghiScore'] = `GHI ${Number(ghiScore).toFixed(1)}`;
  }

  if (treasury) {
    metrics['gov.treasuryBalance'] = formatAdaFromAda(treasury.balanceAda);
  }

  // ── DRep-specific metrics ─────────────────────────────────────────────

  if (drepId) {
    const [drep, pendingProposals] = await Promise.all([
      getDRepById(drepId),
      getOpenProposalsForDRep(drepId),
    ]);

    if (drep) {
      const pending = pendingProposals.length;
      metrics['home.pendingVotes'] = pending > 0 ? `${pending} pending` : 'All voted';
      metrics['home.totalVotes'] = `${drep.totalVotes ?? 0} votes`;
      metrics['you.drepScore'] = `${Math.round(drep.drepScore ?? 0)}`;

      if (drep.votingPowerLovelace) {
        metrics['home.delegatedAda'] = formatAda(Number(drep.votingPowerLovelace));
      }
    }
  }

  // ── SPO-specific metrics ──────────────────────────────────────────────

  if (poolId) {
    const { data: pool } = await supabase
      .from('pools')
      .select('governance_score, active_stake')
      .eq('pool_id', poolId)
      .maybeSingle();

    if (pool) {
      if (pool.governance_score != null) {
        metrics['home.govScore'] = `${Math.round(pool.governance_score)}`;
        metrics['you.spoScore'] = `${Math.round(pool.governance_score)}`;
      }
      if (pool.active_stake) {
        metrics['home.delegatedAda'] = formatAda(Number(pool.active_stake));
      }
    }
  }

  // ── Unread notifications ──────────────────────────────────────────────

  if (stakeAddress) {
    const { count: unreadCount } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('stake_address', stakeAddress)
      .eq('read', false);

    if (unreadCount && unreadCount > 0) {
      metrics['you.unread'] = `${unreadCount} new`;
    }
  }

  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
});
