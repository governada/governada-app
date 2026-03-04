import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalPriority } from '@/utils/proposalPriority';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (_request, { requestId }) => {
    const supabase = createClient();
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const oneWeekAgoBlockTime = Math.floor(Date.now() / 1000) - 604800;

    const [drepsResult, proposalsResult, votesThisWeekResult, claimedResult, pollsResult] =
      await Promise.all([
        supabase
          .from('dreps')
          .select(
            'score, participation_rate, rationale_rate, effective_participation, info, size_tier',
          ),
        supabase
          .from('proposals')
          .select(
            'tx_hash, proposal_index, proposal_type, title, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, created_at',
          ),
        supabase
          .from('drep_votes')
          .select('id', { count: 'exact', head: true })
          .gt('block_time', oneWeekAgoBlockTime),
        supabase
          .from('users')
          .select('wallet_address', { count: 'exact', head: true })
          .not('claimed_drep_id', 'is', null),
        supabase
          .from('poll_responses')
          .select('proposal_tx_hash, proposal_index, vote')
          .limit(5000),
      ]);

    const dreps = drepsResult.data || [];
    const proposals = proposalsResult.data || [];

    const activeDReps = dreps.filter((d) => (d.info as Record<string, unknown> | null)?.isActive);
    const totalAdaGovernedLovelace = activeDReps.reduce((sum, d) => {
      const lovelace = parseInt(String((d.info as Record<string, unknown> | null)?.votingPowerLovelace || '0'), 10);
      return sum + (isNaN(lovelace) ? 0 : lovelace);
    }, 0);

    const totalAdaGoverned = totalAdaGovernedLovelace / 1_000_000;
    let formattedAda: string;
    if (totalAdaGoverned >= 1_000_000_000) {
      formattedAda = `${(totalAdaGoverned / 1_000_000_000).toFixed(1)}B`;
    } else if (totalAdaGoverned >= 1_000_000) {
      formattedAda = `${(totalAdaGoverned / 1_000_000).toFixed(1)}M`;
    } else {
      formattedAda = `${Math.round(totalAdaGoverned).toLocaleString()}`;
    }

    const participationRates = dreps
      .map((d) => (d.effective_participation as number) || 0)
      .filter((r) => r > 0);
    const rationaleRates = dreps
      .map((d) => (d.rationale_rate as number) || 0)
      .filter((r) => r > 0);
    const avgParticipation =
      participationRates.length > 0
        ? Math.round(
            participationRates.reduce((a, b) => a + b, 0) /
              participationRates.length,
          )
        : 0;
    const avgRationale =
      rationaleRates.length > 0
        ? Math.round(
            rationaleRates.reduce((a, b) => a + b, 0) / rationaleRates.length,
          )
        : 0;

    const openProposals = proposals.filter(
      (p) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
    );
    const criticalCount = openProposals.filter(
      (p) => getProposalPriority(p.proposal_type) === 'critical',
    ).length;

    const spotlight =
      openProposals
        .filter((p) => p.title)
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        })[0] || null;

    let spotlightVoteCoverage: number | null = null;
    if (spotlight && activeDReps.length > 0) {
      const { count } = await supabase
        .from('drep_votes')
        .select('drep_id', { count: 'exact', head: true })
        .eq('proposal_tx_hash', spotlight.tx_hash)
        .eq('proposal_index', spotlight.proposal_index);
      spotlightVoteCoverage = count ? Math.round((count / activeDReps.length) * 100) : 0;
    }

    // Community vs DRep gap: aggregate poll votes per open proposal
    const pollVotes = pollsResult.data || [];
    const pollAgg = new Map<string, { yes: number; no: number; abstain: number }>();
    for (const pv of pollVotes) {
      const key = `${pv.proposal_tx_hash}:${pv.proposal_index}`;
      const agg = pollAgg.get(key) || { yes: 0, no: 0, abstain: 0 };
      if (pv.vote === 'Yes') agg.yes++;
      else if (pv.vote === 'No') agg.no++;
      else agg.abstain++;
      pollAgg.set(key, agg);
    }

    const topOpenForGap = openProposals.slice(0, 5);
    let drepVoteCounts = new Map<string, number>();
    if (topOpenForGap.length > 0) {
      const txHashes = topOpenForGap.map((p) => p.tx_hash);
      const { data: drepVotesForGap } = await supabase
        .from('drep_votes')
        .select('proposal_tx_hash, proposal_index')
        .in('proposal_tx_hash', txHashes);
      if (drepVotesForGap) {
        for (const dv of drepVotesForGap) {
          const key = `${dv.proposal_tx_hash}:${dv.proposal_index}`;
          drepVoteCounts.set(key, (drepVoteCounts.get(key) || 0) + 1);
        }
      }
    }

    const communityGap = topOpenForGap
      .map((p) => {
        const key = `${p.tx_hash}:${p.proposal_index}`;
        const agg = pollAgg.get(key);
        const drepVoteCount = drepVoteCounts.get(key) || 0;
        const drepVotePct =
          activeDReps.length > 0 ? Math.round((drepVoteCount / activeDReps.length) * 100) : 0;
        return {
          txHash: p.tx_hash,
          index: p.proposal_index,
          title: p.title || 'Untitled',
          pollYes: agg?.yes || 0,
          pollNo: agg?.no || 0,
          pollAbstain: agg?.abstain || 0,
          pollTotal: (agg?.yes || 0) + (agg?.no || 0) + (agg?.abstain || 0),
          drepVotePct,
        };
      })
      .filter((g) => g.pollTotal > 0);

    return NextResponse.json(
      {
        totalAdaGoverned: formattedAda,
        totalAdaGovernedRaw: totalAdaGovernedLovelace,
        activeProposals: openProposals.length,
        criticalProposals: criticalCount,
        avgParticipationRate: avgParticipation,
        avgRationaleRate: avgRationale,
        totalDReps: dreps.length,
        activeDReps: activeDReps.length,
        votesThisWeek: votesThisWeekResult.count || 0,
        claimedDReps: claimedResult.count || 0,
        spotlightProposal: spotlight
          ? {
              txHash: spotlight.tx_hash,
              index: spotlight.proposal_index,
              title: spotlight.title,
              proposalType: spotlight.proposal_type,
              priority: getProposalPriority(spotlight.proposal_type),
              voteCoverage: spotlightVoteCoverage,
            }
          : null,
        currentEpoch,
        communityGap,
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
      },
    );
});
