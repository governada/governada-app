/**
 * Sidebar Metrics API — lightweight endpoint for Living Sidebar sub-labels.
 *
 * Returns all metrics as formatted display strings keyed by sublabelKey.
 * Enriched with trend indicators (↑↓), tier names, and urgency counts.
 *
 * Auth-optional: anonymous users get governance-level metrics only.
 * Authenticated users get persona-specific metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getOpenProposalsForDRep, getDRepById, getVotedThisEpoch } from '@/lib/data';
import { getTreasuryBalance } from '@/lib/treasury';
import { computeTier } from '@/lib/scoring/tiers';
import { blockTimeToEpoch } from '@/lib/koios';
import { getDRepPrimaryName } from '@/utils/display';

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

function trendArrow(current: number, previous: number): string {
  if (current > previous + 0.5) return ' ↑';
  if (current < previous - 0.5) return ' ↓';
  return '';
}

/** Critical proposal types that warrant urgency */
const CRITICAL_TYPES = [
  'HardForkInitiation',
  'NoConfidence',
  'NewConstitution',
  'UpdateConstitution',
];

export const GET = withRouteHandler(async (request: NextRequest) => {
  const supabase = getSupabaseAdmin();
  const metrics: Record<string, string> = {};
  const epoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  const drepId = request.nextUrl.searchParams.get('drepId');
  const poolId = request.nextUrl.searchParams.get('poolId');
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');
  const delegatedDrepId = request.nextUrl.searchParams.get('delegatedDrepId');

  // ── Governance metrics (everyone) ─────────────────────────────────────

  const [
    activeProposals,
    totalProposals,
    drepCount,
    poolCount,
    ghiSnapshots,
    treasury,
    criticalCount,
  ] = await Promise.all([
    supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
    supabase.from('proposals').select('tx_hash', { count: 'exact', head: true }),
    supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .gt('info->>votingPower', '0'),
    supabase.from('pools').select('pool_id', { count: 'exact', head: true }).gt('vote_count', 0),
    supabase
      .from('ghi_snapshots')
      .select('ghi_score')
      .order('epoch_no', { ascending: false })
      .limit(2),
    getTreasuryBalance(),
    supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .in('proposal_type', CRITICAL_TYPES)
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
  ]);

  // Show total proposals with active count highlight
  const totalActive = activeProposals.count ?? 0;
  const total = totalProposals.count ?? 0;
  const critical = criticalCount.count ?? 0;
  metrics['gov.activeProposals'] =
    critical > 0
      ? `${totalActive} active · ${total} total`
      : totalActive > 0
        ? `${totalActive} active · ${total} total`
        : `${total} proposals`;

  metrics['gov.activeDreps'] = `${drepCount.count ?? 0} DReps`;
  metrics['gov.activePools'] = `${poolCount.count ?? 0} pools`;

  // GHI with trend
  const ghiData = ghiSnapshots.data ?? [];
  if (ghiData.length >= 1) {
    const current = Number(ghiData[0].ghi_score);
    const trend = ghiData.length >= 2 ? trendArrow(current, Number(ghiData[1].ghi_score)) : '';
    metrics['gov.ghiScore'] = `GHI ${current.toFixed(1)}${trend}`;
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
      // Pending votes with urgency count
      const pending = pendingProposals.length;
      const urgent = pendingProposals.filter(
        (p) => p.expirationEpoch && p.expirationEpoch - epoch <= 2,
      ).length;
      if (pending > 0) {
        metrics['home.pendingVotes'] =
          urgent > 0 ? `${pending} pending · ${urgent} urgent` : `${pending} pending`;
      } else {
        metrics['home.pendingVotes'] = 'All voted';
      }

      metrics['home.totalVotes'] = `${drep.totalVotes ?? 0} votes`;

      // Score with trend + tier
      const score = Math.round(drep.drepScore ?? 0);
      const tier = computeTier(drep.drepScore ?? 0);
      const momentum = drep.scoreMomentum ?? 0;
      const arrow = momentum > 1 ? ' ↑' : momentum < -1 ? ' ↓' : '';
      metrics['you.drepScore'] = `${score}${arrow} · ${tier}`;

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
        const score = Math.round(pool.governance_score);
        const tier = computeTier(pool.governance_score);
        metrics['home.govScore'] = `${score} · ${tier}`;
        metrics['you.spoScore'] = `${score} · ${tier}`;
      }
      if (pool.active_stake) {
        metrics['home.delegatedAda'] = formatAda(Number(pool.active_stake));
      }
    }
  }

  // ── Citizen delegation metrics ─────────────────────────────────────────

  if (delegatedDrepId && !drepId) {
    // Citizen with delegation — show their DRep's activity
    const [delegatedDrep, votedThisEpoch] = await Promise.all([
      getDRepById(delegatedDrepId),
      getVotedThisEpoch(delegatedDrepId, epoch),
    ]);

    if (delegatedDrep) {
      const drepName = getDRepPrimaryName(delegatedDrep);
      const score = Math.round(delegatedDrep.drepScore ?? 0);
      const momentum = delegatedDrep.scoreMomentum ?? 0;
      const arrow = momentum > 1 ? ' ↑' : momentum < -1 ? ' ↓' : '';

      // Delegation sublabel: DRep name + score
      metrics['you.coverage'] = `${drepName} · ${score}${arrow}`;

      // Citizen epoch context: DRep name + epoch votes
      metrics['citizen.drepName'] = drepName;
      metrics['citizen.drepEpochVotes'] = String(votedThisEpoch);
      metrics['citizen.drepScore'] = `${score}${arrow}`;
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
