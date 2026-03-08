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

interface EngagementOutcome {
  proposalTitle: string | null;
  proposalTxHash: string;
  proposalIndex: number;
  userSentiment: string;
  communityAgreePct: number;
  drepVote: string | null; // 'Yes' | 'No' | 'Abstain' | null
  outcome: string | null; // 'ratified' | 'dropped' | 'expired' | null (still active)
}

interface BriefingResponse {
  epoch: number;

  status: {
    health: HealthStatus;
    headline: string;
    delegatedTo: { name: string; id: string; score: number; tier: string } | null;
    drepDeregistered?: boolean;
  };

  headlines: Headline[];

  drepPerformance: DRepPerformance | null;

  treasury: {
    balanceAda: number;
    trend: TreasuryTrend;
    withdrawnThisEpoch: number;
    pendingProposals: number;
    drepDelegatedAda: number | null;
    proportionalShareAda: number | null;
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

  /** Citizen's engagement outcomes — "Your voice this epoch" section */
  engagementOutcomes: EngagementOutcome[] | null;
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
  if (participationRate >= 0.8) return 'Active voter, could explain decisions more';
  if (participationRate >= 0.5) return 'Moderately active this epoch';
  if (participationRate > 0) return 'Voted on few proposals \u2014 worth keeping an eye on';
  return 'Hasn\u2019t voted this epoch \u2014 consider reviewing alternatives';
}

function computeHealth(
  drepId: string | null,
  score: number | null,
  votedThisEpoch: boolean,
  scoreMomentum: number | null,
  drepDeregistered: boolean,
): { health: HealthStatus; headline: string } {
  if (!drepId) {
    return {
      health: 'yellow',
      headline: 'Your ADA is unrepresented \u2014 delegate to have a voice',
    };
  }
  if (drepDeregistered) {
    return {
      health: 'red',
      headline: 'Your DRep has deregistered \u2014 your delegation is no longer active',
    };
  }
  const s = score ?? 0;
  if (s >= 70 && votedThisEpoch) {
    return {
      health: 'green',
      headline: 'All good. Your representative is active and scoring well.',
    };
  }
  if (s >= 40) {
    if (!votedThisEpoch) {
      return {
        health: 'yellow',
        headline: 'Your DRep sat this one out \u2014 no votes cast this epoch',
      };
    }
    if ((scoreMomentum ?? 0) < 0) {
      return {
        health: 'yellow',
        headline: 'Your DRep\u2019s score has been slipping \u2014 worth a look',
      };
    }
    return { health: 'yellow', headline: 'Your DRep is active but could be doing more' };
  }
  return { health: 'red', headline: 'Your DRep is underperforming \u2014 consider your options' };
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
      title: `Governance approved ${recap.proposals_ratified} proposal${recap.proposals_ratified > 1 ? 's' : ''}`,
      description: recap.proposals_submitted
        ? `${recap.proposals_submitted} were submitted this epoch — ${recap.proposals_ratified} made it through`
        : 'Ratified on-chain and moving to enactment',
      type: 'proposal',
    });
  }

  if (recap.treasury_withdrawn_ada && recap.treasury_withdrawn_ada > 0) {
    const ada = recap.treasury_withdrawn_ada;
    const formatted =
      ada >= 1_000_000
        ? `${(ada / 1_000_000).toFixed(1)}M`
        : ada >= 1_000
          ? `${Math.round(ada / 1_000)}K`
          : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(ada);
    headlines.push({
      title: `Treasury paid out ${formatted} ADA`,
      description: 'Approved withdrawal proposals were executed from the community treasury',
      type: 'treasury',
    });
  }

  if (recap.drep_participation_pct != null) {
    const pct = Math.round(recap.drep_participation_pct);
    if (pct >= 70) {
      headlines.push({
        title: `Strong turnout: ${pct}% of DReps voted`,
        description: 'Well above average — your representatives are actively engaged in governance',
        type: 'governance',
      });
    } else if (pct < 50) {
      headlines.push({
        title: `Low turnout: only ${pct}% of DReps voted`,
        description:
          'Less than half of representatives participated — governance engagement needs attention',
        type: 'governance',
      });
    }
  }

  if (recap.proposals_expired && recap.proposals_expired > 0 && headlines.length < 4) {
    headlines.push({
      title: `${recap.proposals_expired} proposal${recap.proposals_expired > 1 ? 's ran' : ' ran'} out of time`,
      description: 'Did not reach the required voting threshold before the deadline',
      type: 'proposal',
    });
  }

  if (recap.proposals_dropped && recap.proposals_dropped > 0 && headlines.length < 4) {
    headlines.push({
      title: `${recap.proposals_dropped} proposal${recap.proposals_dropped > 1 ? 's' : ''} withdrawn`,
      description: 'Removed from consideration by their authors',
      type: 'proposal',
    });
  }

  // Quiet epoch — nothing notable happened
  if (headlines.length === 0) {
    headlines.push({
      title: 'A quiet epoch for governance',
      description: 'No proposals were ratified, expired, or withdrawn this epoch',
      type: 'governance',
    });
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
      .select('current_epoch, circulating_supply_lovelace')
      .eq('id', 1)
      .single();

    const currentEpoch = stats?.current_epoch ?? 0;
    const circulatingSupplyLovelace = stats?.circulating_supply_lovelace ?? 0;

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
    // 4a. DRep deregistration check
    // -----------------------------------------------------------------------
    let drepDeregistered = false;

    if (drepId) {
      const { data: latestLifecycle } = await supabase
        .from('drep_lifecycle_events')
        .select('action')
        .eq('drep_id', drepId)
        .order('epoch_no', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestLifecycle?.action === 'deregistration') {
        drepDeregistered = true;
      }
    }

    // -----------------------------------------------------------------------
    // 4b. DRep delegated stake (for proportional treasury share)
    // -----------------------------------------------------------------------
    let drepDelegatedAda: number | null = null;
    if (drepId) {
      const { data: powerSnapshot } = await supabase
        .from('drep_power_snapshots')
        .select('live_stake_lovelace')
        .eq('drep_id', drepId)
        .order('epoch_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (powerSnapshot?.live_stake_lovelace) {
        drepDelegatedAda = Math.round(powerSnapshot.live_stake_lovelace / 1_000_000);
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
    // 7. Engagement outcomes — "Your voice this epoch" (authenticated only)
    // -----------------------------------------------------------------------
    let engagementOutcomes: EngagementOutcome[] | null = null;

    if (ctx.userId) {
      const { data: userSentiments } = await supabase
        .from('citizen_sentiment')
        .select('proposal_tx_hash, proposal_index, sentiment')
        .eq('user_id', ctx.userId)
        .limit(10);

      if (userSentiments && userSentiments.length > 0) {
        // Fetch proposal details + aggregated sentiment + DRep vote in parallel
        const proposalKeys = userSentiments.map((s) => `${s.proposal_tx_hash}:${s.proposal_index}`);

        const [proposalResult, aggregationResult, drepVoteResult] = await Promise.all([
          supabase
            .from('proposals')
            .select('tx_hash, proposal_index, title, ratified_epoch, dropped_epoch, expired_epoch')
            .in(
              'tx_hash',
              userSentiments.map((s) => s.proposal_tx_hash),
            ),
          supabase
            .from('engagement_signal_aggregations')
            .select('entity_id, data')
            .eq('entity_type', 'proposal')
            .eq('signal_type', 'sentiment')
            .in('entity_id', proposalKeys),
          drepId
            ? supabase
                .from('drep_votes')
                .select('proposal_tx_hash, proposal_index, vote')
                .eq('drep_id', drepId)
                .in(
                  'proposal_tx_hash',
                  userSentiments.map((s) => s.proposal_tx_hash),
                )
            : Promise.resolve({ data: null }),
        ]);

        const proposals = proposalResult.data || [];
        const aggregations = aggregationResult.data || [];
        const drepVotes = drepVoteResult.data || [];

        engagementOutcomes = userSentiments.slice(0, 5).map((s) => {
          const proposal = proposals.find(
            (p) => p.tx_hash === s.proposal_tx_hash && p.proposal_index === s.proposal_index,
          );
          const aggKey = `${s.proposal_tx_hash}:${s.proposal_index}`;
          const agg = aggregations.find((a) => a.entity_id === aggKey);
          const aggData = agg?.data as {
            support?: number;
            oppose?: number;
            unsure?: number;
            total?: number;
          } | null;

          // Compute community agreement with user's sentiment
          let communityAgreePct = 0;
          if (aggData && aggData.total && aggData.total > 0) {
            const agreeCount =
              s.sentiment === 'support'
                ? (aggData.support ?? 0)
                : s.sentiment === 'oppose'
                  ? (aggData.oppose ?? 0)
                  : (aggData.unsure ?? 0);
            communityAgreePct = Math.round((agreeCount / aggData.total) * 100);
          }

          const drepVote = drepVotes.find(
            (v) =>
              v.proposal_tx_hash === s.proposal_tx_hash && v.proposal_index === s.proposal_index,
          );

          let outcome: string | null = null;
          if (proposal?.ratified_epoch) outcome = 'ratified';
          else if (proposal?.dropped_epoch) outcome = 'dropped';
          else if (proposal?.expired_epoch) outcome = 'expired';

          return {
            proposalTitle: proposal?.title ?? null,
            proposalTxHash: s.proposal_tx_hash,
            proposalIndex: s.proposal_index,
            userSentiment: s.sentiment,
            communityAgreePct,
            drepVote: drepVote?.vote ?? null,
            outcome,
          };
        });
      }
    }

    // -----------------------------------------------------------------------
    // 8. Build response
    // -----------------------------------------------------------------------
    const { health, headline } = computeHealth(
      drepId,
      drepScore,
      votedThisEpoch,
      drepScoreMomentum,
      drepDeregistered,
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
        drepDeregistered: drepDeregistered || undefined,
      },

      headlines: buildHeadlines(recap),

      drepPerformance,

      treasury: {
        balanceAda: Math.round(balanceAda),
        trend,
        withdrawnThisEpoch: recap?.treasury_withdrawn_ada ?? 0,
        pendingProposals,
        drepDelegatedAda,
        proportionalShareAda:
          drepDelegatedAda && circulatingSupplyLovelace > 0
            ? Math.round(balanceAda * (drepDelegatedAda / (circulatingSupplyLovelace / 1_000_000)))
            : null,
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

      engagementOutcomes,
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  },
  { auth: 'optional' },
);
