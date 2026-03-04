/**
 * Cross-Proposal Insights — computed governance patterns from existing data.
 * 2-3 genuinely surprising insights that surface macro-level patterns.
 */

import { createClient } from './supabase';
import { logger } from '@/lib/logger';

export interface GovernanceInsight {
  id: string;
  headline: string;
  description: string;
  stat: string;
  category: 'voting' | 'treasury' | 'behavior';
}

export async function computeInsights(): Promise<GovernanceInsight[]> {
  const supabase = createClient();
  const insights: GovernanceInsight[] = [];

  try {
    // Insight 1: Rationale correlates with dissent
    const [votesWithRat, votesWithoutRat] = await Promise.all([
      supabase.rpc('count_votes_with_rationale_by_vote', {}).then((r) => r.data),
      supabase
        .from('drep_votes')
        .select('vote', { count: 'exact', head: false })
        .then((r) => r.data),
    ]);

    // Fallback: compute from raw data
    const { data: allVotes } = await supabase.from('drep_votes').select('vote_tx_hash, vote');
    const { data: allRationales } = await supabase.from('vote_rationales').select('vote_tx_hash');

    if (allVotes && allRationales) {
      const rationaleSet = new Set(allRationales.map((r) => r.vote_tx_hash));
      const withRationale = allVotes.filter((v) => rationaleSet.has(v.vote_tx_hash));
      const withoutRationale = allVotes.filter((v) => !rationaleSet.has(v.vote_tx_hash));

      const noWithRat = withRationale.filter((v) => v.vote === 'No').length;
      const noWithoutRat = withoutRationale.filter((v) => v.vote === 'No').length;
      const noRateWith = withRationale.length > 0 ? noWithRat / withRationale.length : 0;
      const noRateWithout =
        withoutRationale.length > 0 ? noWithoutRat / withoutRationale.length : 0;

      if (noRateWithout > 0) {
        const ratio = noRateWith / noRateWithout;
        if (ratio > 1.2) {
          insights.push({
            id: 'rationale-dissent',
            headline: 'Rationale correlates with dissent',
            description: `DReps who provide reasoning are ${ratio.toFixed(1)}x more likely to vote No. Explanation often accompanies opposition.`,
            stat: `${ratio.toFixed(1)}x`,
            category: 'behavior',
          });
        }
      }
    }

    // Insight 2: Treasury proposals pass rate vs others
    const { data: proposals } = await supabase
      .from('proposals')
      .select('proposal_type, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch');

    if (proposals && proposals.length > 0) {
      const treasury = proposals.filter((p) => p.proposal_type === 'TreasuryWithdrawals');
      const resolved = (ps: typeof proposals) =>
        ps.filter((p) => p.ratified_epoch || p.enacted_epoch || p.dropped_epoch || p.expired_epoch);
      const passed = (ps: typeof proposals) =>
        ps.filter((p) => p.ratified_epoch || p.enacted_epoch);

      const treasuryResolved = resolved(treasury);
      const otherResolved = resolved(
        proposals.filter((p) => p.proposal_type !== 'TreasuryWithdrawals'),
      );

      const treasuryPassRate =
        treasuryResolved.length > 0
          ? Math.round((passed(treasury).length / treasuryResolved.length) * 100)
          : null;
      const otherPassRate =
        otherResolved.length > 0
          ? Math.round(
              (passed(proposals.filter((p) => p.proposal_type !== 'TreasuryWithdrawals')).length /
                otherResolved.length) *
                100,
            )
          : null;

      if (treasuryPassRate !== null && otherPassRate !== null && treasuryResolved.length >= 3) {
        insights.push({
          id: 'treasury-contested',
          headline: 'Treasury proposals face more scrutiny',
          description: `Treasury withdrawals pass at ${treasuryPassRate}% vs ${otherPassRate}% for other proposal types. Money decisions get the most debate.`,
          stat: `${treasuryPassRate}%`,
          category: 'treasury',
        });
      }
    }

    // Insight 3: Top DRep agreement rate
    const { data: topDreps } = await supabase
      .from('dreps')
      .select('id')
      .eq('info->>isActive', 'true')
      .order('score', { ascending: false })
      .limit(10);

    if (topDreps && topDreps.length >= 5) {
      const topIds = topDreps.map((d) => d.id);
      const { data: topVotes } = await supabase
        .from('drep_votes')
        .select('drep_id, proposal_tx_hash, proposal_index, vote')
        .in('drep_id', topIds);

      if (topVotes && topVotes.length > 0) {
        const proposalVoteMap = new Map<string, Map<string, string>>();
        for (const v of topVotes) {
          const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
          if (!proposalVoteMap.has(key)) proposalVoteMap.set(key, new Map());
          proposalVoteMap.get(key)!.set(v.drep_id, v.vote);
        }

        let agreements = 0;
        let comparisons = 0;

        for (const [, voters] of proposalVoteMap) {
          const entries = [...voters.entries()];
          for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
              comparisons++;
              if (entries[i][1] === entries[j][1]) agreements++;
            }
          }
        }

        const agreementRate = comparisons > 0 ? Math.round((agreements / comparisons) * 100) : 0;

        if (comparisons > 10) {
          const descriptor =
            agreementRate > 80
              ? 'form a strong consensus'
              : agreementRate > 60
                ? 'mostly agree'
                : 'show real ideological diversity';

          insights.push({
            id: 'top-agreement',
            headline: `Top DReps ${descriptor}`,
            description: `The 10 highest-scoring DReps agree on ${agreementRate}% of votes. ${
              agreementRate > 70
                ? 'Quality governance is converging around shared principles.'
                : 'The best DReps bring genuinely different perspectives.'
            }`,
            stat: `${agreementRate}%`,
            category: 'voting',
          });
        }
      }
    }
  } catch (err) {
    logger.error('[Insights] Computation error', { error: err });
  }

  return insights;
}
