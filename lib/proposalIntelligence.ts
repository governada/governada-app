/**
 * Cross-Proposal Intelligence Engine — macro-level governance pattern analysis.
 *
 * Computes 8-10 insights from existing tables: drep_votes, vote_rationales,
 * proposals, drep_score_history, drep_power_snapshots. Each insight includes
 * a trend field (current vs prior epoch) and transparent methodology.
 */

import { createClient } from './supabase';

export type InsightCategory = 'voting' | 'treasury' | 'behavior' | 'participation';
export type TrendDirection = 'up' | 'down' | 'flat' | 'new';

export interface GovernanceInsight {
  id: string;
  headline: string;
  description: string;
  stat: string;
  category: InsightCategory;
  trend?: string;
  trendDirection?: TrendDirection;
  methodology?: string;
  shareText?: string;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

export async function computeInsights(): Promise<GovernanceInsight[]> {
  const supabase = createClient();
  const insights: GovernanceInsight[] = [];

  try {
    const [allVotesRes, allRationalesRes, proposalsRes, topDrepsRes, allDrepsRes] =
      await Promise.all([
        supabase.from('drep_votes').select('vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, vote, epoch_no, block_time, voting_power_lovelace'),
        supabase.from('vote_rationales').select('vote_tx_hash, rationale_text'),
        supabase.from('proposals').select('tx_hash, proposal_index, proposal_type, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, expiration_epoch, block_time'),
        supabase.from('dreps').select('id, score, info').order('score', { ascending: false }).limit(50),
        supabase.from('dreps').select('id, score, effective_participation, rationale_rate, info'),
      ]);

    const allVotes = allVotesRes.data ?? [];
    const allRationales = allRationalesRes.data ?? [];
    const proposals = proposalsRes.data ?? [];
    const topDreps = topDrepsRes.data ?? [];
    const allDreps = allDrepsRes.data ?? [];

    if (allVotes.length === 0) return insights;

    const rationaleSet = new Set(allRationales.map(r => r.vote_tx_hash));
    const rationaleTextMap = new Map(allRationales.map(r => [r.vote_tx_hash, r.rationale_text ?? '']));

    // --- Insight 1: Rationale correlates with dissent ---
    {
      const withRationale = allVotes.filter(v => rationaleSet.has(v.vote_tx_hash));
      const withoutRationale = allVotes.filter(v => !rationaleSet.has(v.vote_tx_hash));

      const noRateWith = withRationale.length > 0
        ? withRationale.filter(v => v.vote === 'No').length / withRationale.length : 0;
      const noRateWithout = withoutRationale.length > 0
        ? withoutRationale.filter(v => v.vote === 'No').length / withoutRationale.length : 0;

      if (noRateWithout > 0) {
        const ratio = noRateWith / noRateWithout;
        if (ratio > 1.2) {
          insights.push({
            id: 'rationale-dissent',
            headline: 'Rationale correlates with dissent',
            description: `DReps who provide reasoning are ${ratio.toFixed(1)}x more likely to vote No. Explanation often accompanies opposition.`,
            stat: `${ratio.toFixed(1)}x`,
            category: 'behavior',
            methodology: 'Compares the No-vote rate among votes with published rationale vs votes without.',
            shareText: `On @DRepScore: DReps who explain their votes are ${ratio.toFixed(1)}x more likely to vote No. Accountability breeds independence.`,
          });
        }
      }
    }

    // --- Insight 2: Treasury proposals face more scrutiny ---
    {
      const treasury = proposals.filter(p => p.proposal_type === 'TreasuryWithdrawals');
      const resolved = (ps: typeof proposals) => ps.filter(
        p => p.ratified_epoch || p.enacted_epoch || p.dropped_epoch || p.expired_epoch
      );
      const passed = (ps: typeof proposals) => ps.filter(
        p => p.ratified_epoch || p.enacted_epoch
      );

      const treasuryResolved = resolved(treasury);
      const otherResolved = resolved(proposals.filter(p => p.proposal_type !== 'TreasuryWithdrawals'));

      const treasuryPassRate = treasuryResolved.length > 0
        ? (passed(treasury).length / treasuryResolved.length) * 100 : null;
      const otherPassRate = otherResolved.length > 0
        ? (passed(proposals.filter(p => p.proposal_type !== 'TreasuryWithdrawals')).length / otherResolved.length) * 100 : null;

      if (treasuryPassRate !== null && otherPassRate !== null && treasuryResolved.length >= 3) {
        insights.push({
          id: 'treasury-contested',
          headline: 'Treasury proposals face more scrutiny',
          description: `Treasury withdrawals pass at ${fmtPct(treasuryPassRate)} vs ${fmtPct(otherPassRate)} for other proposal types. Money decisions get the most debate.`,
          stat: fmtPct(treasuryPassRate),
          category: 'treasury',
          methodology: 'Pass rate = (ratified + enacted) / (ratified + enacted + dropped + expired) for each proposal type.',
          shareText: `Treasury proposals on Cardano pass at just ${fmtPct(treasuryPassRate)}. DReps take money decisions seriously. Via @DRepScore`,
        });
      }
    }

    // --- Insight 3: Top DRep agreement rate ---
    {
      const top10 = topDreps.filter((d: any) => d.info?.isActive).slice(0, 10);
      if (top10.length >= 5) {
        const topIds = new Set(top10.map(d => d.id));
        const topVotes = allVotes.filter(v => topIds.has(v.drep_id));

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

        const agreementRate = comparisons > 0 ? (agreements / comparisons) * 100 : 0;
        if (comparisons > 10) {
          const descriptor = agreementRate > 80 ? 'form a strong consensus'
            : agreementRate > 60 ? 'mostly agree'
            : 'show real ideological diversity';

          insights.push({
            id: 'top-agreement',
            headline: `Top DReps ${descriptor}`,
            description: `The 10 highest-scoring DReps agree on ${fmtPct(agreementRate)} of votes. ${
              agreementRate > 70
                ? 'Quality governance is converging around shared principles.'
                : 'The best DReps bring genuinely different perspectives.'
            }`,
            stat: fmtPct(agreementRate),
            category: 'voting',
            methodology: 'Pairwise agreement rate across all proposals where at least 2 of the top 10 scored DReps voted.',
            shareText: `Cardano's top 10 DReps agree on ${fmtPct(agreementRate)} of votes. Consensus or groupthink? Via @DRepScore`,
          });
        }
      }
    }

    // --- Insight 4: Voting power concentration ---
    {
      const activeDreps = allDreps.filter((d: any) => d.info?.isActive);
      const powers = activeDreps
        .map((d: any) => parseInt(d.info?.votingPowerLovelace || '0', 10))
        .filter((p: number) => p > 0)
        .sort((a: number, b: number) => b - a);

      if (powers.length >= 10) {
        const totalPower = powers.reduce((s: number, p: number) => s + p, 0);
        const top10Power = powers.slice(0, 10).reduce((s: number, p: number) => s + p, 0);
        const concentration = totalPower > 0 ? (top10Power / totalPower) * 100 : 0;

        if (concentration > 10) {
          insights.push({
            id: 'power-concentration',
            headline: 'Voting power is concentrated',
            description: `The top 10 DReps by delegation control ${fmtPct(concentration)} of all voting power. ${
              concentration > 50 ? 'A highly concentrated landscape — delegation diversity matters.'
              : concentration > 30 ? 'Moderate concentration — room for more distributed delegation.'
              : 'Relatively distributed — a healthy sign for decentralized governance.'
            }`,
            stat: fmtPct(concentration),
            category: 'participation',
            methodology: 'Sum of voting power (lovelace) held by the top 10 DReps divided by total active voting power.',
            shareText: `The top 10 Cardano DReps control ${fmtPct(concentration)} of voting power. How distributed is governance really? Via @DRepScore`,
          });
        }
      }
    }

    // --- Insight 5: Proposal type pass rate patterns ---
    {
      const typeGroups = new Map<string, { passed: number; total: number }>();
      for (const p of proposals) {
        const isResolved = p.ratified_epoch || p.enacted_epoch || p.dropped_epoch || p.expired_epoch;
        if (!isResolved) continue;
        const type = p.proposal_type || 'Unknown';
        if (!typeGroups.has(type)) typeGroups.set(type, { passed: 0, total: 0 });
        const g = typeGroups.get(type)!;
        g.total++;
        if (p.ratified_epoch || p.enacted_epoch) g.passed++;
      }

      const types = [...typeGroups.entries()]
        .filter(([, g]) => g.total >= 2)
        .sort((a, b) => (a[1].passed / a[1].total) - (b[1].passed / b[1].total));

      if (types.length >= 2) {
        const lowest = types[0];
        const highest = types[types.length - 1];
        const lowestRate = (lowest[1].passed / lowest[1].total) * 100;
        const highestRate = (highest[1].passed / highest[1].total) * 100;

        const lowestName = lowest[0].replace(/([A-Z])/g, ' $1').trim();
        const highestName = highest[0].replace(/([A-Z])/g, ' $1').trim();

        insights.push({
          id: 'proposal-type-patterns',
          headline: 'Not all proposals are equal',
          description: `${highestName} proposals pass at ${fmtPct(highestRate)}, while ${lowestName} proposals pass at just ${fmtPct(lowestRate)}. Proposal type significantly predicts outcome.`,
          stat: `${fmtPct(highestRate)} vs ${fmtPct(lowestRate)}`,
          category: 'voting',
          methodology: 'Pass rate by proposal_type for types with at least 2 resolved proposals.',
          shareText: `On Cardano, ${highestName} proposals pass at ${fmtPct(highestRate)} while ${lowestName} is just ${fmtPct(lowestRate)}. Via @DRepScore`,
        });
      }
    }

    // --- Insight 6: Rationale length vs score ---
    {
      const drepScoreMap = new Map(allDreps.map(d => [d.id, d.score ?? 0]));
      const drepRationaleLengths = new Map<string, number[]>();

      for (const v of allVotes) {
        if (!rationaleSet.has(v.vote_tx_hash)) continue;
        const text = rationaleTextMap.get(v.vote_tx_hash) ?? '';
        if (text.length < 10) continue;
        if (!drepRationaleLengths.has(v.drep_id)) drepRationaleLengths.set(v.drep_id, []);
        drepRationaleLengths.get(v.drep_id)!.push(text.length);
      }

      const longWriters: number[] = [];
      const shortWriters: number[] = [];

      for (const [drepId, lengths] of drepRationaleLengths) {
        const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const score = drepScoreMap.get(drepId);
        if (score == null) continue;
        if (avgLen > 300) longWriters.push(score);
        else shortWriters.push(score);
      }

      if (longWriters.length >= 5 && shortWriters.length >= 5) {
        const avgLong = longWriters.reduce((a, b) => a + b, 0) / longWriters.length;
        const avgShort = shortWriters.reduce((a, b) => a + b, 0) / shortWriters.length;
        const delta = Math.round(avgLong - avgShort);

        if (delta > 3) {
          insights.push({
            id: 'rationale-length-score',
            headline: 'Detailed reasoning pays off',
            description: `DReps who write longer rationales (300+ chars) score ${delta} points higher on average. Quality explanations signal quality governance.`,
            stat: `+${delta} pts`,
            category: 'behavior',
            methodology: 'Average score of DReps whose rationales average 300+ characters vs those under 300.',
            shareText: `DReps who write detailed rationales score ${delta} points higher on @DRepScore. Words matter in governance.`,
          });
        }
      }
    }

    // --- Insight 7: Abstention patterns ---
    {
      const epochVotes = new Map<number, { total: number; abstain: number }>();
      for (const v of allVotes) {
        if (!v.epoch_no) continue;
        if (!epochVotes.has(v.epoch_no)) epochVotes.set(v.epoch_no, { total: 0, abstain: 0 });
        const e = epochVotes.get(v.epoch_no)!;
        e.total++;
        if (v.vote === 'Abstain') e.abstain++;
      }

      const epochs = [...epochVotes.entries()].sort((a, b) => b[0] - a[0]);
      if (epochs.length >= 3) {
        const recent = epochs.slice(0, 3);
        const older = epochs.slice(3, 6);

        const recentRate = recent.reduce((s, [, e]) => s + (e.total > 0 ? e.abstain / e.total : 0), 0) / recent.length * 100;
        const olderRate = older.length > 0
          ? older.reduce((s, [, e]) => s + (e.total > 0 ? e.abstain / e.total : 0), 0) / older.length * 100
          : recentRate;

        const delta = recentRate - olderRate;
        if (Math.abs(delta) > 1 || recentRate > 5) {
          const direction = delta > 1 ? 'increasing' : delta < -1 ? 'decreasing' : 'steady';
          insights.push({
            id: 'abstention-trend',
            headline: `Abstention rate is ${direction}`,
            description: `${fmtPct(recentRate)} of recent votes are Abstain${
              older.length > 0 && Math.abs(delta) > 1
                ? `, ${delta > 0 ? 'up' : 'down'} from ${fmtPct(olderRate)} in earlier epochs`
                : ''
            }. ${recentRate > 15 ? 'High abstention may signal proposals DReps find hard to evaluate.' : 'DReps are taking clear positions on most proposals.'}`,
            stat: fmtPct(recentRate),
            category: 'participation',
            trendDirection: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
            trend: Math.abs(delta) > 1 ? `${delta > 0 ? '+' : ''}${fmtPct(delta)} vs prior epochs` : undefined,
            methodology: 'Abstain votes as a percentage of total votes, compared across recent (last 3) vs earlier (prior 3) epochs.',
            shareText: `Abstention rate in Cardano governance is ${direction} at ${fmtPct(recentRate)}. Via @DRepScore`,
          });
        }
      }
    }

    // --- Insight 8: Score-vote correlation (high vs low scorers disagree) ---
    {
      const activeDreps = allDreps.filter((d: any) => d.info?.isActive && d.score != null);
      const highScorers = new Set(activeDreps.filter(d => (d.score ?? 0) >= 70).map(d => d.id));
      const lowScorers = new Set(activeDreps.filter(d => (d.score ?? 0) < 40).map(d => d.id));

      if (highScorers.size >= 5 && lowScorers.size >= 5) {
        const proposalVotesByGroup = new Map<string, { highYes: number; highNo: number; lowYes: number; lowNo: number }>();

        for (const v of allVotes) {
          if (v.vote === 'Abstain') continue;
          const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
          if (!proposalVotesByGroup.has(key)) {
            proposalVotesByGroup.set(key, { highYes: 0, highNo: 0, lowYes: 0, lowNo: 0 });
          }
          const g = proposalVotesByGroup.get(key)!;
          if (highScorers.has(v.drep_id)) {
            if (v.vote === 'Yes') g.highYes++;
            else g.highNo++;
          } else if (lowScorers.has(v.drep_id)) {
            if (v.vote === 'Yes') g.lowYes++;
            else g.lowNo++;
          }
        }

        let disagreements = 0;
        let totalComparisons = 0;
        for (const [, g] of proposalVotesByGroup) {
          const highTotal = g.highYes + g.highNo;
          const lowTotal = g.lowYes + g.lowNo;
          if (highTotal < 2 || lowTotal < 2) continue;
          totalComparisons++;
          const highMajority = g.highYes > g.highNo ? 'Yes' : 'No';
          const lowMajority = g.lowYes > g.lowNo ? 'Yes' : 'No';
          if (highMajority !== lowMajority) disagreements++;
        }

        if (totalComparisons >= 5) {
          const disagreementRate = (disagreements / totalComparisons) * 100;
          insights.push({
            id: 'score-vote-correlation',
            headline: disagreementRate > 30 ? 'Score predicts voting stance' : 'Scores don\'t determine votes',
            description: `High-scoring DReps (70+) and low-scoring DReps (under 40) disagree on ${fmtPct(disagreementRate)} of proposals. ${
              disagreementRate > 30
                ? 'Governance quality and voting patterns are correlated.'
                : 'Score measures process quality, not political alignment — even low-scorers often reach the same conclusions.'
            }`,
            stat: fmtPct(disagreementRate),
            category: 'voting',
            methodology: 'Compares the majority vote direction of DReps scoring 70+ vs under 40 on proposals where each group has 2+ voters.',
            shareText: `High-scoring vs low-scoring DReps disagree on ${fmtPct(disagreementRate)} of Cardano proposals. Score ≠ ideology. Via @DRepScore`,
          });
        }
      }
    }

    // --- Insight 9: Epoch activity rhythm (late voting) ---
    {
      const proposalExpiry = new Map<string, number>();
      for (const p of proposals) {
        if (p.expiration_epoch && p.block_time) {
          proposalExpiry.set(`${p.tx_hash}-${p.proposal_index}`, p.expiration_epoch);
        }
      }

      let lateVotes = 0;
      let earlyVotes = 0;

      for (const v of allVotes) {
        if (!v.epoch_no) continue;
        const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
        const expiry = proposalExpiry.get(key);
        if (expiry == null) continue;

        const epochsBeforeExpiry = expiry - v.epoch_no;
        if (epochsBeforeExpiry <= 1) lateVotes++;
        else earlyVotes++;
      }

      const total = lateVotes + earlyVotes;
      if (total >= 20) {
        const lateRate = (lateVotes / total) * 100;
        insights.push({
          id: 'late-voting',
          headline: lateRate > 40 ? 'Last-minute voting is common' : 'DReps vote early',
          description: `${fmtPct(lateRate)} of votes are cast in the final epoch before a proposal expires. ${
            lateRate > 40
              ? 'Procrastination is human — even in governance.'
              : 'DReps are engaged and deliberating promptly.'
          }`,
          stat: fmtPct(lateRate),
          category: 'participation',
          methodology: 'Votes cast within 1 epoch of proposal expiration vs earlier votes, for proposals with known expiration epochs.',
          shareText: `${fmtPct(lateRate)} of Cardano governance votes come in the final epoch. Deadline-driven or deliberate? Via @DRepScore`,
        });
      }
    }

  } catch (err) {
    console.error('[ProposalIntelligence] Computation error:', err);
  }

  return insights;
}
