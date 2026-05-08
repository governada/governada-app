/**
 * Cockpit Aggregate API — single endpoint for the DRep Governance Cockpit.
 *
 * Merges data from urgent, competitive, delegator-trends, and score-change
 * into one response to eliminate the waterfall of 4+ client requests.
 *
 * Phase 2: adds per-proposal intelligence (AI summary, citizen sentiment,
 * DRep vote tally) and per-pillar Score Story data.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getOpenProposalsForDRep } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalDisplayTitle } from '@/utils/display';
import { createClient, getSupabaseAdmin } from '@/lib/supabase';
import { computeTier, computeTierProgress, type PillarBreakdown } from '@/lib/scoring/tiers';
import { getScoreNarrative } from '@/lib/scoring/scoreNarratives';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // ── Parallel data fetches ──────────────────────────────────────────
  const [
    pendingProposals,
    drepResult,
    allDrepsResult,
    scoreHistoryResult,
    snapshotsResult,
    voteActivityResult,
    questionsResult,
  ] = await Promise.all([
    // 1. Open proposals for this DRep
    getOpenProposalsForDRep(drepId),

    // 2. Current DRep record (score, pillars, info)
    admin
      .from('dreps')
      .select(
        'id, score, info, participation_rate, rationale_rate, reliability_score, profile_completeness, effective_participation, metadata',
      )
      .eq('id', drepId)
      .single(),

    // 3. All active DReps for ranking
    admin
      .from('dreps')
      .select('id, score')
      .eq('is_active', true)
      .order('score', { ascending: false }),

    // 4. Score history (last 14 snapshots)
    supabase
      .from('drep_score_history')
      .select('score, snapshot_date')
      .eq('drep_id', drepId)
      .order('snapshot_date', { ascending: false })
      .limit(14),

    // 5. Delegator power snapshots
    admin
      .from('drep_power_snapshots')
      .select('epoch_no, amount_lovelace, delegator_count')
      .eq('drep_id', drepId)
      .order('epoch_no', { ascending: true })
      .limit(50),

    // 6. Vote activity by epoch (for heatmap)
    admin
      .from('drep_votes')
      .select('epoch_no, vote_tx_hash')
      .eq('drep_id', drepId)
      .gte('epoch_no', currentEpoch - 24)
      .order('epoch_no', { ascending: true }),

    // 7. Unanswered questions count
    admin
      .from('drep_questions')
      .select('id', { count: 'exact', head: true })
      .eq('drep_id', drepId)
      .eq('status', 'open'),
  ]);

  // ── DRep core data ─────────────────────────────────────────────────
  const drep = drepResult.data;
  if (!drep) {
    return NextResponse.json({ error: 'DRep not found' }, { status: 404 });
  }

  // ── Score & Tier ───────────────────────────────────────────────────
  const score = drep.score ?? 0;
  const tier = computeTier(score);

  const allDreps = allDrepsResult.data ?? [];
  const rankIndex = allDreps.findIndex((d) => d.id === drepId);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const totalDReps = allDreps.length;
  const percentile =
    rank && totalDReps > 0 ? Math.round(((totalDReps - rank) / totalDReps) * 100) : 0;

  const pillars: PillarBreakdown = {
    engagementQuality: drep.rationale_rate ?? 0,
    effectiveParticipation: drep.effective_participation ?? 0,
    reliability: drep.reliability_score ?? 0,
    governanceIdentity: drep.profile_completeness ?? 0,
  };

  const tierProgress = computeTierProgress(score, pillars);
  const narrative = getScoreNarrative({ score, percentile });

  // ── Score trend ────────────────────────────────────────────────────
  const history = scoreHistoryResult.data ?? [];
  let scoreDelta = 0;
  let scoreTrendDate: string | null = null;
  if (history.length >= 2) {
    const weekAgo = history.length >= 7 ? history[6] : history[history.length - 1];
    scoreDelta = history[0].score - weekAgo.score;
    scoreTrendDate = weekAgo.snapshot_date;
  }

  // ── Citizen sentiment for open proposals (batch) ──────────────────
  let sentimentMap = new Map<
    string,
    { support: number; oppose: number; abstain: number; total: number }
  >();
  try {
    const openTxHashes = pendingProposals.map((p) => p.txHash);
    if (openTxHashes.length > 0) {
      const { data: sentiments } = await supabase
        .from('citizen_sentiment')
        .select('proposal_tx_hash, proposal_index, sentiment')
        .in('proposal_tx_hash', openTxHashes);

      if (sentiments) {
        for (const s of sentiments) {
          const key = `${s.proposal_tx_hash}-${s.proposal_index}`;
          const entry = sentimentMap.get(key) ?? {
            support: 0,
            oppose: 0,
            abstain: 0,
            total: 0,
          };
          const val = (s.sentiment ?? '').toLowerCase();
          if (val === 'support' || val === 'yes') entry.support++;
          else if (val === 'oppose' || val === 'no') entry.oppose++;
          else entry.abstain++;
          entry.total++;
          sentimentMap.set(key, entry);
        }
      }
    }
  } catch (err) {
    logger.error('Cockpit: citizen sentiment fetch failed', { error: err });
    sentimentMap = new Map();
  }

  // ── Action Feed: Pending proposals (with intelligence) ────────────
  const pendingList = pendingProposals
    .map((p) => {
      const expiryEpoch = p.expirationEpoch ?? 0;
      const sentimentKey = `${p.txHash}-${p.proposalIndex}`;
      const sentiment = sentimentMap.get(sentimentKey) ?? null;
      return {
        txHash: p.txHash,
        index: p.proposalIndex,
        title: getProposalDisplayTitle(p.title, p.txHash, p.proposalIndex),
        proposalType: p.proposalType || 'Proposal',
        epochsRemaining: expiryEpoch > 0 ? Math.max(0, expiryEpoch - currentEpoch) : null,
        isUrgent: expiryEpoch > 0 && expiryEpoch - currentEpoch <= 2,
        aiSummary: p.aiSummary ?? null,
        abstract: p.abstract ?? null,
        drepVoteTally: { yes: p.yesCount, no: p.noCount, abstain: p.abstainCount },
        citizenSentiment: sentiment,
      };
    })
    .sort((a, b) => (a.epochsRemaining ?? 999) - (b.epochsRemaining ?? 999));

  // ── Action Feed: Unexplained votes ─────────────────────────────────
  let unexplainedVotes: { txHash: string; index: number; title: string }[] = [];
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data: recentVotes } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index')
      .eq('drep_id', drepId)
      .gte('created_at', twoDaysAgo)
      .limit(10);

    if (recentVotes && recentVotes.length > 0) {
      const { data: explanations } = await supabase
        .from('vote_explanations')
        .select('proposal_tx_hash, proposal_index')
        .eq('drep_id', drepId);

      const explainedSet = new Set(
        (explanations ?? []).map((e) => `${e.proposal_tx_hash}-${e.proposal_index}`),
      );

      const unexplained = recentVotes.filter(
        (v) => !explainedSet.has(`${v.proposal_tx_hash}-${v.proposal_index}`),
      );

      if (unexplained.length > 0) {
        const proposalKeys = unexplained.map((v) => v.proposal_tx_hash);
        const { data: proposals } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title')
          .in('tx_hash', proposalKeys);

        const titleMap = new Map(
          (proposals ?? []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p.title]),
        );

        unexplainedVotes = unexplained.map((v) => ({
          txHash: v.proposal_tx_hash,
          index: v.proposal_index,
          title: titleMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`) || 'Untitled Proposal',
        }));
      }
    }
  } catch (err) {
    logger.error('Cockpit: unexplained votes check failed', { error: err });
  }

  // ── Delegation health ──────────────────────────────────────────────
  const snapshots = (snapshotsResult.data ?? []).map((s) => ({
    epoch: s.epoch_no,
    votingPowerAda: Math.round(Number(s.amount_lovelace) / 1_000_000),
    delegatorCount: s.delegator_count,
  }));

  const currentDelegators = drep.info?.delegatorCount ?? null;
  let delegatorDelta = 0;
  if (snapshots.length >= 2) {
    const latest = snapshots[snapshots.length - 1];
    const previous = snapshots.length >= 5 ? snapshots[snapshots.length - 5] : snapshots[0];
    delegatorDelta = (latest.delegatorCount ?? 0) - (previous.delegatorCount ?? 0);
  }

  // ── Activity heatmap (votes per epoch, last ~24 epochs) ────────────
  const votesByEpoch = new Map<number, { votes: number; withRationale: number }>();
  for (const v of voteActivityResult.data ?? []) {
    const entry = votesByEpoch.get(v.epoch_no) ?? { votes: 0, withRationale: 0 };
    entry.votes++;
    votesByEpoch.set(v.epoch_no, entry);
  }

  const activityEpochs: { epoch: number; votes: number }[] = [];
  for (let e = currentEpoch - 23; e <= currentEpoch; e++) {
    const entry = votesByEpoch.get(e);
    activityEpochs.push({ epoch: e, votes: entry?.votes ?? 0 });
  }

  // Streak: consecutive epochs with at least 1 vote, counting back from current
  let streak = 0;
  for (let e = currentEpoch; e >= currentEpoch - 23; e--) {
    if ((votesByEpoch.get(e)?.votes ?? 0) > 0) {
      streak++;
    } else {
      break;
    }
  }

  // ── Score Story: per-pillar breakdown with specific actions ────────
  const pillarMeta = [
    {
      key: 'engagementQuality' as const,
      label: 'Engagement Quality',
      weight: 0.35,
      action: (v: number) =>
        v >= 80
          ? 'Strong — keep explaining your votes'
          : `Submit rationales with your next ${Math.max(1, Math.ceil((70 - v) / 15))} votes`,
    },
    {
      key: 'effectiveParticipation' as const,
      label: 'Effective Participation',
      weight: 0.3,
      action: (v: number) =>
        v >= 80
          ? 'Strong — stay active on new proposals'
          : `Vote on ${Math.max(1, Math.min(pendingProposals.length, Math.ceil((70 - v) / 10)))} open proposals`,
    },
    {
      key: 'reliability' as const,
      label: 'Reliability',
      weight: 0.2,
      action: (v: number) =>
        v >= 80
          ? 'Strong — maintain your voting streak'
          : `Vote this epoch to ${streak > 0 ? 'extend' : 'start'} your streak`,
    },
    {
      key: 'governanceIdentity' as const,
      label: 'Governance Identity',
      weight: 0.15,
      action: (v: number) =>
        v >= 80
          ? 'Strong — profile is well-established'
          : 'Complete your profile bio and add social links',
    },
  ];

  const pillarValues: Record<string, number> = {
    engagementQuality: drep.rationale_rate ?? 0,
    effectiveParticipation: drep.effective_participation ?? 0,
    reliability: drep.reliability_score ?? 0,
    governanceIdentity: drep.profile_completeness ?? 0,
  };

  let lowestWeighted = Infinity;
  let biggestWin = 'engagementQuality';
  const scoreStoryPillars = pillarMeta.map((m) => {
    const value = Math.round(pillarValues[m.key] ?? 0);
    const weighted = value * m.weight;
    if (weighted < lowestWeighted) {
      lowestWeighted = weighted;
      biggestWin = m.key;
    }
    return {
      key: m.key,
      label: m.label,
      value,
      weight: m.weight,
      scoreImpact: Math.round((100 - value) * m.weight * 0.5),
      action: m.action(value),
    };
  });

  // ── Assemble response ──────────────────────────────────────────────
  return NextResponse.json({
    score: {
      current: Math.round(score),
      trend: scoreDelta,
      trendSince: scoreTrendDate,
      tier,
      tierProgress,
      narrative,
      percentile,
      rank,
      totalDReps,
      pillars: {
        engagementQuality: Math.round(drep.rationale_rate ?? 0),
        effectiveParticipation: Math.round(drep.effective_participation ?? 0),
        reliability: Math.round(drep.reliability_score ?? 0),
        governanceIdentity: Math.round(drep.profile_completeness ?? 0),
      },
    },
    actionFeed: {
      pendingProposals: pendingList,
      pendingCount: pendingProposals.length,
      unexplainedVotes,
      unansweredQuestions: questionsResult.count ?? 0,
      delegatorAlerts: {
        change: delegatorDelta,
        currentCount: currentDelegators,
      },
      scoreAlerts: {
        delta: scoreDelta,
        recommendation: tierProgress.recommendedAction,
      },
    },
    delegation: {
      currentDelegators,
      delegatorDelta,
      snapshots,
    },
    activityHeatmap: {
      epochs: activityEpochs,
      streak,
    },
    scoreStory: {
      pillars: scoreStoryPillars,
      biggestWin,
    },
  });
});
