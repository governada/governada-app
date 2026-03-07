/**
 * GET /api/briefing/citizen
 *
 * Assembles a structured epoch briefing for a citizen (ADA holder).
 * Aggregates governance stats, epoch recap, DRep performance, treasury,
 * and active proposals into a single response.
 *
 * Optional query params:
 *   - drepId: override DRep lookup (useful for unauthenticated preview)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthStatus = 'green' | 'yellow' | 'red';
type TreasuryTrend = 'growing' | 'shrinking' | 'stable';
type HeadlineType = 'proposal' | 'treasury' | 'governance';

interface Headline {
  title: string;
  description: string;
  type: HeadlineType;
}

interface DRepPerformance {
  name: string;
  id: string;
  votesCast: number;
  rationalesProvided: number;
  scoreChange: number;
  score: number;
  tier: string;
  participationRate: number;
  verdict: string;
}

interface BriefingResponse {
  epoch: number;

  status: {
    health: HealthStatus;
    headline: string;
    delegatedTo: { name: string; id: string; score: number; tier: string } | null;
  };

  headlines: Headline[];

  drepPerformance: DRepPerformance | null;

  treasury: {
    balanceAda: number;
    trend: TreasuryTrend;
    withdrawnThisEpoch: number;
    pendingProposals: number;
  };

  upcoming: {
    activeProposals: number;
    criticalProposals: number;
  };

  recap: {
    proposalsSubmitted: number;
    proposalsRatified: number;
    drepParticipationPct: number;
    narrative: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRITICAL_PROPOSAL_TYPES = [
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitution',
];

function extractDRepName(info: Record<string, unknown> | null, drepId: string): string {
  if (info && typeof info === 'object') {
    const given = (info as Record<string, unknown>).givenName;
    if (typeof given === 'string' && given.length > 0) return given;
  }
  // Truncate bech32 ID for display
  return drepId.length > 20 ? `${drepId.slice(0, 12)}...${drepId.slice(-6)}` : drepId;
}

function computeVerdict(participationRate: number, rationaleRate: number): string {
  if (participationRate >= 0.8 && rationaleRate >= 0.5) return 'Representing you well';
  if (participationRate >= 0.5) return 'Moderately active';
  return 'Low activity \u2014 consider reviewing alternatives';
}

function computeHealth(
  drepId: string | null,
  score: number | null,
  votedThisEpoch: boolean,
  scoreMomentum: number | null,
): { health: HealthStatus; headline: string } {
  if (!drepId) {
    return { health: 'yellow', headline: "You're not represented in governance yet" };
  }
  const s = score ?? 0;
  if (s >= 70 && votedThisEpoch) {
    return { health: 'green', headline: "Everything's fine. Your DRep is active." };
  }
  if (s >= 40) {
    if (!votedThisEpoch) {
      return { health: 'yellow', headline: "Your DRep hasn't voted on proposals this epoch" };
    }
    if ((scoreMomentum ?? 0) < 0) {
      return { health: 'yellow', headline: "Your DRep's score is trending down" };
    }
    return { health: 'yellow', headline: 'Your DRep could be more active' };
  }
  return { health: 'red', headline: 'Your DRep needs attention' };
}

function buildHeadlines(
  recap: {
    proposals_submitted: number | null;
    proposals_ratified: number | null;
    proposals_expired: number | null;
    proposals_dropped: number | null;
    drep_participation_pct: number | null;
    treasury_withdrawn_ada: number | null;
    ai_narrative: string | null;
  } | null,
): Headline[] {
  const headlines: Headline[] = [];
  if (!recap) return headlines;

  if (recap.proposals_ratified && recap.proposals_ratified > 0) {
    headlines.push({
      title: `${recap.proposals_ratified} proposal${recap.proposals_ratified > 1 ? 's were' : ' was'} approved this epoch`,
      description: recap.proposals_submitted
        ? `Out of ${recap.proposals_submitted} submitted proposals`
        : 'Governance proposals were ratified on-chain',
      type: 'proposal',
    });
  }

  if (recap.treasury_withdrawn_ada && recap.treasury_withdrawn_ada > 0) {
    const formattedAda = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
      recap.treasury_withdrawn_ada,
    );
    headlines.push({
      title: `${formattedAda} ADA withdrawn from treasury`,
      description: 'Approved treasury withdrawal proposals were executed',
      type: 'treasury',
    });
  }

  if (recap.drep_participation_pct != null) {
    const pct = Math.round(recap.drep_participation_pct);
    if (pct >= 70) {
      headlines.push({
        title: `DRep participation reached ${pct}%`,
        description: 'A strong majority of DReps voted on governance proposals',
        type: 'governance',
      });
    } else if (pct < 50) {
      headlines.push({
        title: `DRep participation was only ${pct}%`,
        description: 'Less than half of DReps voted — governance engagement is low',
        type: 'governance',
      });
    }
  }

  if (recap.ai_narrative && headlines.length < 4) {
    headlines.push({
      title: 'Epoch summary',
      description: recap.ai_narrative,
      type: 'governance',
    });
  }

  // If we somehow have nothing, add a generic headline from expired/dropped
  if (headlines.length === 0) {
    if (recap.proposals_expired && recap.proposals_expired > 0) {
      headlines.push({
        title: `${recap.proposals_expired} proposal${recap.proposals_expired > 1 ? 's' : ''} expired`,
        description: 'These proposals did not receive enough support before their deadline',
        type: 'proposal',
      });
    }
    if (recap.proposals_dropped && recap.proposals_dropped > 0) {
      headlines.push({
        title: `${recap.proposals_dropped} proposal${recap.proposals_dropped > 1 ? 's were' : ' was'} dropped`,
        description: 'These proposals were withdrawn or removed from consideration',
        type: 'proposal',
      });
    }
  }

  return headlines;
}

function determineTreasuryTrend(
  currentBalance: number,
  previousBalance: number | null,
): TreasuryTrend {
  if (previousBalance == null) return 'stable';
  const delta = currentBalance - previousBalance;
  const pctChange = previousBalance > 0 ? Math.abs(delta / previousBalance) : 0;
  // Consider < 1% change as stable
  if (pctChange < 0.01) return 'stable';
  return delta > 0 ? 'growing' : 'shrinking';
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    const supabase = createClient();
    const drepIdOverride = request.nextUrl.searchParams.get('drepId');

    // -----------------------------------------------------------------------
    // 1. Current epoch
    // -----------------------------------------------------------------------
    const { data: stats } = await supabase
      .from('governance_stats')
      .select('current_epoch')
      .eq('id', 1)
      .single();

    const currentEpoch = stats?.current_epoch ?? 0;

    // -----------------------------------------------------------------------
    // 2. Epoch recap
    // -----------------------------------------------------------------------
    const { data: recap } = await supabase
      .from('epoch_recaps')
      .select(
        'proposals_submitted, proposals_ratified, proposals_expired, proposals_dropped, drep_participation_pct, treasury_withdrawn_ada, ai_narrative',
      )
      .eq('epoch', currentEpoch)
      .maybeSingle();

    // -----------------------------------------------------------------------
    // 3. Resolve DRep ID (authenticated user or query param override)
    // -----------------------------------------------------------------------
    let drepId: string | null = drepIdOverride;

    if (!drepId && ctx.wallet) {
      // Try user_wallets first (has on-chain drep_id from stake address)
      const { data: walletRow } = await supabase
        .from('user_wallets')
        .select('drep_id')
        .eq('payment_address', ctx.wallet)
        .maybeSingle();

      if (walletRow?.drep_id) {
        drepId = walletRow.drep_id;
      } else if (ctx.userId) {
        // Fall back to users table: claimed_drep_id or delegation_history
        const { data: user } = await supabase
          .from('users')
          .select('claimed_drep_id, delegation_history')
          .eq('id', ctx.userId)
          .single();

        if (user?.claimed_drep_id) {
          drepId = user.claimed_drep_id;
        } else if (Array.isArray(user?.delegation_history) && user.delegation_history.length > 0) {
          const last = user.delegation_history[user.delegation_history.length - 1] as {
            drepId?: string;
          };
          drepId = last?.drepId ?? null;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. DRep performance (if DRep found)
    // -----------------------------------------------------------------------
    let drepPerformance: DRepPerformance | null = null;
    let drepScore: number | null = null;
    let drepScoreMomentum: number | null = null;
    let votedThisEpoch = false;

    if (drepId) {
      // Fetch DRep profile
      const { data: drep } = await supabase
        .from('dreps')
        .select('id, score, current_tier, score_momentum, info, participation_rate, rationale_rate')
        .eq('id', drepId)
        .maybeSingle();

      if (drep) {
        drepScore = drep.score;
        drepScoreMomentum = drep.score_momentum;

        // Count votes this epoch
        const { count: voteCount } = await supabase
          .from('drep_votes')
          .select('vote_tx_hash', { count: 'exact', head: true })
          .eq('drep_id', drepId)
          .eq('epoch_no', currentEpoch);

        const votesCast = voteCount ?? 0;
        votedThisEpoch = votesCast > 0;

        // Count rationales for this epoch's votes
        let rationalesProvided = 0;
        if (votesCast > 0) {
          const { data: epochVotes } = await supabase
            .from('drep_votes')
            .select('vote_tx_hash')
            .eq('drep_id', drepId)
            .eq('epoch_no', currentEpoch);

          if (epochVotes && epochVotes.length > 0) {
            const voteTxHashes = epochVotes.map((v) => v.vote_tx_hash);
            const { count: rationaleCount } = await supabase
              .from('vote_rationales')
              .select('vote_tx_hash', { count: 'exact', head: true })
              .in('vote_tx_hash', voteTxHashes);
            rationalesProvided = rationaleCount ?? 0;
          }
        }

        // Score delta from last 2 history entries
        const { data: scoreHistory } = await supabase
          .from('drep_score_history')
          .select('score')
          .eq('drep_id', drepId)
          .order('snapshot_date', { ascending: false })
          .limit(2);

        let scoreChange = 0;
        if (scoreHistory && scoreHistory.length >= 2) {
          scoreChange = (scoreHistory[0].score ?? 0) - (scoreHistory[1].score ?? 0);
        }

        const info = drep.info as Record<string, unknown> | null;
        const name = extractDRepName(info, drepId);
        const participationRate = drep.participation_rate ?? 0;
        const rationaleRate = drep.rationale_rate ?? 0;

        drepPerformance = {
          name,
          id: drepId,
          votesCast,
          rationalesProvided,
          scoreChange: Math.round(scoreChange * 100) / 100,
          score: drep.score ?? 0,
          tier: drep.current_tier ?? 'Unknown',
          participationRate,
          verdict: computeVerdict(participationRate, rationaleRate),
        };
      }
    }

    // -----------------------------------------------------------------------
    // 5. Treasury data
    // -----------------------------------------------------------------------
    const [treasuryResult, previousTreasuryResult, pendingTreasuryResult] = await Promise.all([
      // Latest treasury snapshot
      supabase
        .from('treasury_snapshots')
        .select('epoch_no, balance_lovelace')
        .order('epoch_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Previous treasury snapshot (for trend)
      supabase
        .from('treasury_snapshots')
        .select('balance_lovelace')
        .order('epoch_no', { ascending: false })
        .range(1, 1)
        .maybeSingle(),
      // Count pending treasury withdrawal proposals
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .like('proposal_type', '%TreasuryWithdrawals%')
        .is('ratified_epoch', null)
        .is('expired_epoch', null)
        .is('dropped_epoch', null),
    ]);

    const latestBalance = treasuryResult.data?.balance_lovelace ?? 0;
    const previousBalance = previousTreasuryResult.data?.balance_lovelace ?? null;
    const balanceAda = latestBalance / 1_000_000;
    const trend = determineTreasuryTrend(latestBalance, previousBalance);
    const pendingProposals = pendingTreasuryResult.count ?? 0;

    // -----------------------------------------------------------------------
    // 6. Active & critical proposals
    // -----------------------------------------------------------------------
    const { data: activeProposals } = await supabase
      .from('proposals')
      .select('proposal_type')
      .is('ratified_epoch', null)
      .is('expired_epoch', null)
      .is('dropped_epoch', null);

    const activeCount = activeProposals?.length ?? 0;
    const criticalCount =
      activeProposals?.filter((p) =>
        CRITICAL_PROPOSAL_TYPES.some((ct) => p.proposal_type?.includes(ct)),
      ).length ?? 0;

    // -----------------------------------------------------------------------
    // 7. Build response
    // -----------------------------------------------------------------------
    const { health, headline } = computeHealth(
      drepId,
      drepScore,
      votedThisEpoch,
      drepScoreMomentum,
    );

    const delegatedTo = drepPerformance
      ? {
          name: drepPerformance.name,
          id: drepPerformance.id,
          score: drepPerformance.score,
          tier: drepPerformance.tier,
        }
      : null;

    const response: BriefingResponse = {
      epoch: currentEpoch,

      status: {
        health,
        headline,
        delegatedTo,
      },

      headlines: buildHeadlines(recap),

      drepPerformance,

      treasury: {
        balanceAda: Math.round(balanceAda),
        trend,
        withdrawnThisEpoch: recap?.treasury_withdrawn_ada ?? 0,
        pendingProposals,
      },

      upcoming: {
        activeProposals: activeCount,
        criticalProposals: criticalCount,
      },

      recap: recap
        ? {
            proposalsSubmitted: recap.proposals_submitted ?? 0,
            proposalsRatified: recap.proposals_ratified ?? 0,
            drepParticipationPct: recap.drep_participation_pct ?? 0,
            narrative: recap.ai_narrative ?? null,
          }
        : null,
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  },
  { auth: 'optional' },
);
