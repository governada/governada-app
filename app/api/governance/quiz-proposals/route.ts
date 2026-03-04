import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const QUIZ_SIZE = 7;
const MIN_DECISIVE_VOTES = 3;
const MIN_DISCRIMINATION = 0.4;
const MIN_DIMENSION_COVERAGE = 0.3;
const MIN_DISTINCT_TYPES = 3;

const DIMENSION_KEYS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

const DIM_DB_COLUMNS: Record<AlignmentDimension, string> = {
  treasuryConservative: 'dim_treasury_conservative',
  treasuryGrowth: 'dim_treasury_growth',
  decentralization: 'dim_decentralization',
  security: 'dim_security',
  innovation: 'dim_innovation',
  transparency: 'dim_transparency',
};

interface ScoredProposal {
  key: string;
  txHash: string;
  index: number;
  discriminationScore: number;
  total: number;
  proposalType: string;
  dimScores: Record<AlignmentDimension, number>;
}

/**
 * Select proposals where DReps are most split (30-70% Yes/No ratio)
 * with type diversity and alignment dimension coverage.
 */
export const GET = withRouteHandler(async (_request, { requestId }) => {
  const supabase = createClient();

  const { data: votes, error: votesError } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index, vote');

  if (votesError) {
    logger.error('Failed to fetch votes', { context: 'quiz-proposals', error: votesError.message });
    return NextResponse.json({ error: 'Failed to fetch vote data' }, { status: 500 });
  }

  // Aggregate votes per proposal
  const proposalVotes = new Map<
    string,
    { yes: number; no: number; abstain: number; total: number }
  >();
  for (const v of votes || []) {
    const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
    const entry = proposalVotes.get(key) || { yes: 0, no: 0, abstain: 0, total: 0 };
    if (v.vote === 'Yes') entry.yes++;
    else if (v.vote === 'No') entry.no++;
    else entry.abstain++;
    entry.total++;
    proposalVotes.set(key, entry);
  }

  // Score by discrimination
  const scored: { key: string; txHash: string; index: number; score: number; total: number }[] = [];
  for (const [key, counts] of proposalVotes) {
    const decisive = counts.yes + counts.no;
    if (decisive < MIN_DECISIVE_VOTES) continue;
    const yesPct = counts.yes / decisive;
    const discriminationScore = 1 - Math.abs(yesPct - 0.5) * 2;
    if (discriminationScore < MIN_DISCRIMINATION) continue;
    const [txHash, indexStr] = key.split(':');
    scored.push({
      key,
      txHash,
      index: parseInt(indexStr, 10),
      score: discriminationScore,
      total: counts.total,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.total - a.total);
  if (scored.length === 0) {
    return NextResponse.json({ proposals: [] });
  }

  // Fetch proposal metadata + classifications in parallel
  const [proposalResult, classResult] = await Promise.all([
    supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, proposal_type, title, abstract, withdrawal_amount, treasury_tier, ai_summary',
      ),
    supabase
      .from('proposal_classifications')
      .select(
        'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
      ),
  ]);

  if (proposalResult.error) {
    logger.error('Failed to fetch proposals', { context: 'quiz-proposals', error: proposalResult.error.message });
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }

  const proposalMap = new Map<string, (typeof proposalResult.data)[number]>();
  for (const p of proposalResult.data || []) {
    proposalMap.set(`${p.tx_hash}:${p.proposal_index}`, p);
  }

  const classMap = new Map<string, Record<AlignmentDimension, number>>();
  if (classResult.data) {
    for (const c of classResult.data) {
      const key = `${c.proposal_tx_hash}:${c.proposal_index}`;
      classMap.set(key, {
        treasuryConservative: Number(c.dim_treasury_conservative) || 0,
        treasuryGrowth: Number(c.dim_treasury_growth) || 0,
        decentralization: Number(c.dim_decentralization) || 0,
        security: Number(c.dim_security) || 0,
        innovation: Number(c.dim_innovation) || 0,
        transparency: Number(c.dim_transparency) || 0,
      });
    }
  }

  // Build enriched scored proposals
  const enriched: ScoredProposal[] = scored.map((s) => ({
    ...s,
    discriminationScore: s.score,
    proposalType: proposalMap.get(s.key)?.proposal_type || 'Unknown',
    dimScores:
      classMap.get(s.key) ||
      (Object.fromEntries(DIMENSION_KEYS.map((d) => [d, 0])) as Record<AlignmentDimension, number>),
  }));

  // Greedy diversified selection: guarantee type diversity
  const selected = greedyDiverseSelect(enriched, QUIZ_SIZE, MIN_DISTINCT_TYPES);

  // Dimension coverage swap: fill gaps if any dimension is under-covered
  if (classMap.size > 0) {
    applyDimensionCoverage(selected, enriched);
  }

  const result = selected.map((s) => {
    const p = proposalMap.get(s.key);
    const topDims = getTopDimensions(s.dimScores, 2);

    return {
      txHash: s.txHash,
      index: s.index,
      proposalType: s.proposalType,
      title: p?.title || `Proposal ${s.txHash.slice(0, 8)}...`,
      summary: p?.ai_summary || p?.abstract || null,
      withdrawalAmount: p?.withdrawal_amount ? Number(p.withdrawal_amount) / 1_000_000 : null,
      treasuryTier: p?.treasury_tier || null,
      discriminationScore: Math.round(s.discriminationScore * 100),
      discriminationLabel: getDiscriminationLabel(s.discriminationScore),
      stakesLabel: getStakesLabel(
        s.proposalType,
        p?.withdrawal_amount ? Number(p.withdrawal_amount) / 1_000_000 : null,
      ),
      dimensionTags: topDims,
    };
  });

  return NextResponse.json({ proposals: result });
});

function greedyDiverseSelect(
  candidates: ScoredProposal[],
  size: number,
  minTypes: number,
): ScoredProposal[] {
  if (candidates.length <= size) return [...candidates];

  const selected: ScoredProposal[] = [];
  const used = new Set<string>();

  // Pick the highest-scoring proposal overall
  selected.push(candidates[0]);
  used.add(candidates[0].key);

  while (selected.length < size) {
    const typeCounts = new Map<string, number>();
    for (const s of selected) {
      typeCounts.set(s.proposalType, (typeCounts.get(s.proposalType) || 0) + 1);
    }

    const distinctTypes = typeCounts.size;
    let best: ScoredProposal | null = null;

    if (distinctTypes < minTypes) {
      // Prioritize unseen types
      for (const c of candidates) {
        if (used.has(c.key)) continue;
        if (!typeCounts.has(c.proposalType)) {
          best = c;
          break;
        }
      }
    }

    if (!best) {
      // Pick from least-represented type
      const minCount = Math.min(...typeCounts.values(), 0);
      const leastTypes = new Set(
        [...typeCounts.entries()].filter(([, count]) => count === minCount).map(([t]) => t),
      );

      // Also consider types not yet in selection
      for (const c of candidates) {
        if (used.has(c.key)) continue;
        if (!typeCounts.has(c.proposalType) || leastTypes.has(c.proposalType)) {
          best = c;
          break;
        }
      }

      // Fallback: just pick the next best
      if (!best) {
        for (const c of candidates) {
          if (!used.has(c.key)) {
            best = c;
            break;
          }
        }
      }
    }

    if (!best) break;
    selected.push(best);
    used.add(best.key);
  }

  return selected;
}

function applyDimensionCoverage(selected: ScoredProposal[], allCandidates: ScoredProposal[]): void {
  const selectedKeys = new Set(selected.map((s) => s.key));

  // Compute dimension coverage
  const coverage: Record<AlignmentDimension, number> = {} as any;
  for (const dim of DIMENSION_KEYS) {
    coverage[dim] = selected.reduce((sum, s) => sum + s.dimScores[dim], 0);
  }

  for (const dim of DIMENSION_KEYS) {
    if (coverage[dim] >= MIN_DIMENSION_COVERAGE) continue;

    // Find the weakest-discriminating proposal in selection
    let weakestIdx = 0;
    for (let i = 1; i < selected.length; i++) {
      if (selected[i].discriminationScore < selected[weakestIdx].discriminationScore) {
        weakestIdx = i;
      }
    }

    // Find the best candidate that covers this gap and isn't already selected
    const replacement = allCandidates.find(
      (c) => !selectedKeys.has(c.key) && c.dimScores[dim] > 0.3,
    );

    if (replacement) {
      const removed = selected[weakestIdx];
      selectedKeys.delete(removed.key);
      selected[weakestIdx] = replacement;
      selectedKeys.add(replacement.key);

      // Recompute coverage after swap
      for (const d of DIMENSION_KEYS) {
        coverage[d] = selected.reduce((sum, s) => sum + s.dimScores[d], 0);
      }
    }
  }
}

function getTopDimensions(scores: Record<AlignmentDimension, number>, count: number): string[] {
  const LABELS: Record<AlignmentDimension, string> = {
    treasuryConservative: 'Treasury Conservative',
    treasuryGrowth: 'Treasury Growth',
    decentralization: 'Decentralization',
    security: 'Security',
    innovation: 'Innovation',
    transparency: 'Transparency',
  };

  return DIMENSION_KEYS.filter((d) => scores[d] > 0)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, count)
    .map((d) => LABELS[d]);
}

function getDiscriminationLabel(score: number): string {
  if (score > 0.8) return 'DReps are divided';
  if (score > 0.6) return 'DReps lean one way';
  return 'Close call';
}

function getStakesLabel(proposalType: string, withdrawalAmountAda: number | null): string | null {
  if (withdrawalAmountAda !== null && withdrawalAmountAda > 0) {
    const formatted =
      withdrawalAmountAda >= 1_000_000
        ? `${(withdrawalAmountAda / 1_000_000).toFixed(1)}M ADA`
        : `${Math.round(withdrawalAmountAda).toLocaleString()} ADA`;
    return `${formatted} at stake`;
  }
  const normalizedType = proposalType.toLowerCase();
  if (normalizedType.includes('parameter') || normalizedType.includes('protocol')) {
    return 'Protocol parameter change';
  }
  if (normalizedType.includes('constitution') || normalizedType.includes('governance')) {
    return 'Governance structure change';
  }
  return null;
}
