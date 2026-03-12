/**
 * Proposal Historical Context & Value Type Classification
 *
 * Provides budget-calibrated context for treasury proposals:
 * - Percentile ranking among historical withdrawals
 * - Delivery track record of similar proposals
 * - Value type classification (infrastructure, ecosystem, direct utility, governance)
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { DeliveryStatus } from '@/lib/proposalOutcomes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValueType = 'infrastructure' | 'ecosystem' | 'direct-utility' | 'governance';

export interface ValueTypeInfo {
  type: ValueType;
  label: string;
  description: string;
  evaluationLens: string;
}

export interface SimilarOutcomeSummary {
  totalSimilar: number;
  enactedCount: number;
  deliveredCount: number;
  partialCount: number;
  notDeliveredCount: number;
  inProgressCount: number;
  avgDeliveryScore: number | null;
}

export interface ProposalHistoricalContext {
  /** Percentile rank of this proposal's withdrawal amount (0-100) */
  amountPercentile: number;
  /** Median treasury withdrawal amount in ADA */
  medianWithdrawalAda: number;
  /** Total count of historical treasury withdrawals */
  totalTreasuryProposals: number;
  /** Delivery track record of similar proposals */
  similarOutcomes: SimilarOutcomeSummary | null;
  /** Value type classification */
  valueType: ValueTypeInfo;
}

// ---------------------------------------------------------------------------
// Value Type Definitions
// ---------------------------------------------------------------------------

const VALUE_TYPES: Record<ValueType, ValueTypeInfo> = {
  infrastructure: {
    type: 'infrastructure',
    label: 'Public Infrastructure',
    description:
      "Treasury funds shared resources the market won't build. Evaluated by adoption and ecosystem dependency, not financial return.",
    evaluationLens: 'Adoption · Dependencies · Maintenance sustainability',
  },
  ecosystem: {
    type: 'ecosystem',
    label: 'Ecosystem Development',
    description:
      'Growth investment that expands the ecosystem indirectly. Evaluated by reach, participation growth, and community impact.',
    evaluationLens: 'Reach · Participation growth · Community metrics',
  },
  'direct-utility': {
    type: 'direct-utility',
    label: 'Direct Utility',
    description:
      'Projects with measurable outputs and direct user impact. Closest to traditional value assessment.',
    evaluationLens: 'Users · Transactions · Measurable outcomes',
  },
  governance: {
    type: 'governance',
    label: 'Governance & Institutional',
    description:
      'Strengthens governance itself — constitutional work, oversight, and institutional capacity.',
    evaluationLens: 'Participation impact · Process quality · Constitutional compliance',
  },
};

// ---------------------------------------------------------------------------
// Value Type Derivation
// ---------------------------------------------------------------------------

interface ClassificationScores {
  dim_treasury_conservative: number;
  dim_treasury_growth: number;
  dim_decentralization: number;
  dim_security: number;
  dim_innovation: number;
  dim_transparency: number;
}

/**
 * Derive value type from 6D classification scores + proposal metadata.
 * Uses the dominant dimension pattern + keyword signals.
 */
export function deriveValueType(
  scores: ClassificationScores | null,
  proposalType: string,
  text: string,
): ValueTypeInfo {
  const lowerText = text.toLowerCase();

  // Strong signal from proposal type
  if (
    proposalType === 'NoConfidence' ||
    proposalType === 'NewConstitutionalCommittee' ||
    proposalType === 'UpdateConstitution' ||
    proposalType === 'NewConstitution'
  ) {
    return VALUE_TYPES.governance;
  }

  // Keyword-based signals (checked before dimension scores for precision)
  const infraKeywords =
    /\b(infrastructure|tooling|node|protocol|sdk|api|library|framework|developer tool|open.?source|maintenance)\b/;
  const ecosystemKeywords =
    /\b(education|hackathon|event|marketing|community|outreach|onboarding|awareness|adoption|media|content)\b/;
  const governanceKeywords =
    /\b(governance|constitution|committee|oversight|audit|compliance|accountability|transparency|reporting)\b/;
  const utilityKeywords =
    /\b(product|platform|dapp|service|marketplace|exchange|wallet|application|user.?facing)\b/;

  const keywordScores = {
    infrastructure: infraKeywords.test(lowerText) ? 2 : 0,
    ecosystem: ecosystemKeywords.test(lowerText) ? 2 : 0,
    governance: governanceKeywords.test(lowerText) ? 2 : 0,
    'direct-utility': utilityKeywords.test(lowerText) ? 2 : 0,
  };

  // Dimension-based signals
  if (scores) {
    const {
      dim_security,
      dim_innovation,
      dim_decentralization,
      dim_transparency,
      dim_treasury_growth,
    } = scores;

    // Infrastructure: high security + innovation (building tools/protocol)
    if (dim_security > 0.5 && dim_innovation > 0.4) keywordScores.infrastructure += 1;
    // Ecosystem: high innovation + transparency (growth initiatives)
    if (dim_innovation > 0.5 && dim_transparency > 0.3) keywordScores.ecosystem += 1;
    // Governance: high decentralization + transparency
    if (dim_decentralization > 0.5 && dim_transparency > 0.4) keywordScores.governance += 1;
    // Direct utility: high treasury_growth + innovation
    if (dim_treasury_growth > 0.6 && dim_innovation > 0.5) keywordScores['direct-utility'] += 1;
  }

  // Pick the highest-scoring value type
  const sorted = Object.entries(keywordScores).sort(([, a], [, b]) => b - a);
  const [topType, topScore] = sorted[0];

  // If no strong signals, default based on proposal type
  if (topScore === 0) {
    if (proposalType === 'TreasuryWithdrawals') return VALUE_TYPES.infrastructure;
    if (proposalType === 'ParameterChange' || proposalType === 'HardForkInitiation')
      return VALUE_TYPES.infrastructure;
    if (proposalType === 'InfoAction') return VALUE_TYPES.ecosystem;
    return VALUE_TYPES.infrastructure;
  }

  return VALUE_TYPES[topType as ValueType];
}

// ---------------------------------------------------------------------------
// Historical Context Computation
// ---------------------------------------------------------------------------

/**
 * Compute the percentile rank of a withdrawal amount among all treasury proposals.
 */
function computePercentile(amount: number, allAmounts: number[]): number {
  if (allAmounts.length === 0) return 50;
  const sorted = [...allAmounts].sort((a, b) => a - b);
  const belowCount = sorted.filter((a) => a < amount).length;
  return Math.round((belowCount / sorted.length) * 100);
}

/**
 * Compute the median of an array of numbers.
 */
function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Get historical context for a treasury proposal.
 * Returns percentile ranking, similar proposal outcomes, and value type.
 */
export async function getProposalHistoricalContext(
  txHash: string,
  proposalIndex: number,
): Promise<ProposalHistoricalContext | null> {
  const supabase = createClient();

  try {
    // Parallel: get this proposal, all treasury amounts, classification, similar proposals + outcomes
    const [proposalRes, amountsRes, classificationRes, similarRes] = await Promise.all([
      supabase
        .from('proposals')
        .select('withdrawal_amount, proposal_type, title, abstract')
        .eq('tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .single(),
      supabase
        .from('proposals')
        .select('withdrawal_amount')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .not('withdrawal_amount', 'is', null),
      supabase
        .from('proposal_classifications')
        .select(
          'dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
        )
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .single(),
      supabase
        .from('proposal_similarity_cache')
        .select('similar_tx_hash, similar_index, similarity_score')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .order('similarity_score', { ascending: false })
        .limit(10),
    ]);

    const proposal = proposalRes.data;
    if (!proposal) return null;

    const withdrawalAda = proposal.withdrawal_amount
      ? Number(proposal.withdrawal_amount) / 1_000_000
      : 0;
    const allAmounts = (amountsRes.data || []).map((r) => Number(r.withdrawal_amount) / 1_000_000);

    // Percentile + median
    const amountPercentile = computePercentile(withdrawalAda, allAmounts);
    const medianWithdrawalAda = computeMedian(allAmounts);

    // Value type from classification + metadata
    const classification = classificationRes.data as ClassificationScores | null;
    const text = [proposal.title, proposal.abstract].filter(Boolean).join(' ');
    const valueType = deriveValueType(classification, proposal.proposal_type || '', text);

    // Similar proposal outcomes
    let similarOutcomes: SimilarOutcomeSummary | null = null;
    const similarRows = similarRes.data || [];

    if (similarRows.length > 0) {
      const similarKeys = similarRows.map((s) => ({
        txHash: s.similar_tx_hash as string,
        proposalIndex: s.similar_index as number,
      }));

      // Get outcomes for similar proposals
      const { data: outcomeRows } = await supabase
        .from('proposal_outcomes')
        .select('proposal_tx_hash, proposal_index, delivery_status, delivery_score')
        .in(
          'proposal_tx_hash',
          similarKeys.map((k) => k.txHash),
        );

      // Also check which similar proposals were enacted
      const { data: enactedRows } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, enacted_epoch')
        .in(
          'tx_hash',
          similarKeys.map((k) => k.txHash),
        )
        .not('enacted_epoch', 'is', null);

      const enactedSet = new Set(
        (enactedRows || []).map((r) => `${r.tx_hash}-${r.proposal_index}`),
      );
      const outcomeMap = new Map(
        (outcomeRows || []).map((r) => [
          `${r.proposal_tx_hash}-${r.proposal_index}`,
          r as { delivery_status: string; delivery_score: number | null },
        ]),
      );

      const enactedCount = similarKeys.filter((k) =>
        enactedSet.has(`${k.txHash}-${k.proposalIndex}`),
      ).length;

      let deliveredCount = 0;
      let partialCount = 0;
      let notDeliveredCount = 0;
      let inProgressCount = 0;
      const scores: number[] = [];

      for (const key of similarKeys) {
        const outcome = outcomeMap.get(`${key.txHash}-${key.proposalIndex}`);
        if (!outcome) continue;
        const status = outcome.delivery_status as DeliveryStatus;
        if (status === 'delivered') deliveredCount++;
        else if (status === 'partial') partialCount++;
        else if (status === 'not_delivered') notDeliveredCount++;
        else if (status === 'in_progress') inProgressCount++;
        if (outcome.delivery_score != null) scores.push(outcome.delivery_score);
      }

      similarOutcomes = {
        totalSimilar: similarKeys.length,
        enactedCount,
        deliveredCount,
        partialCount,
        notDeliveredCount,
        inProgressCount,
        avgDeliveryScore:
          scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      };
    }

    return {
      amountPercentile,
      medianWithdrawalAda,
      totalTreasuryProposals: allAmounts.length,
      similarOutcomes,
      valueType,
    };
  } catch (err) {
    logger.error('[proposalContext] Failed to compute historical context', {
      error: err instanceof Error ? err.message : String(err),
      txHash,
    });
    return null;
  }
}
