/**
 * Conversational DRep Matching — state machine.
 *
 * Manages a multi-round conversation session where users answer governance
 * questions via pill selection. Accumulates alignment signals, evaluates
 * quality gates, and executes hybrid matching (6D alignment + optional
 * semantic similarity).
 *
 * Gated behind feature flags: `conversational_matching` and
 * `conversational_matching_semantic`.
 */

import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import { extractAlignments, getDominantDimension, getIdentityColor } from '@/lib/drepIdentity';
import { computeDimensionAgreement } from '@/lib/matching/dimensionAgreement';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { PillOption } from './conversationalPillGenerator';
import { getQuestionForRound, TOTAL_QUESTIONS } from './conversationalPillGenerator';

/* ─── Types ────────────────────────────────────────────── */

export interface ConversationRound {
  question: string;
  pills: PillOption[];
  selectedIds: string[];
  rawText?: string;
}

export interface ConversationSession {
  id: string;
  rounds: ConversationRound[];
  accumulatedText: string;
  extractedAlignment: Partial<AlignmentScores>;
  qualityGates: QualityGates;
  status: 'in_progress' | 'ready_to_match' | 'matched';
}

export interface QualityGates {
  discriminativePower: number;
  dimensionalCoverage: number;
  specificity: number;
  passed: boolean;
}

export interface MatchResult {
  drepId: string;
  drepName: string | null;
  score: number;
  semanticScore?: number;
  alignmentScore: number;
  matchingRationales?: { proposalTitle: string; excerpt: string; similarity: number }[];
  alignments: AlignmentScores;
  identityColor: string;
  agreeDimensions: string[];
  differDimensions: string[];
  tier: string | null;
}

/* ─── Constants ────────────────────────────────────────── */

const MAX_ROUNDS = 4;
const MAX_RAW_TEXT_LENGTH = 500;

/** Quality gate thresholds */
const QUALITY_THRESHOLDS = {
  dimensionalCoverage: 4, // >= 4 of 6 dims deviate from neutral 50
  specificity: 15, // average deviation from 50 >= 15
};

const ALL_DIMENSIONS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

/* ─── Session management ────────────────────────────────── */

/**
 * Create a new conversational matching session.
 */
export function createSession(id: string): ConversationSession {
  return {
    id,
    rounds: [],
    accumulatedText: '',
    extractedAlignment: {},
    qualityGates: {
      discriminativePower: 0,
      dimensionalCoverage: 0,
      specificity: 0,
      passed: false,
    },
    status: 'in_progress',
  };
}

/**
 * Process a round answer: resolve selected pills, accumulate text,
 * extract alignment, and check quality gates.
 */
export function processAnswer(
  session: ConversationSession,
  selectedIds: string[],
  rawText?: string,
): ConversationSession {
  if (session.status !== 'in_progress') return session;
  if (session.rounds.length >= MAX_ROUNDS) return session;

  const roundIndex = session.rounds.length;
  const questionSet = getQuestionForRound(roundIndex);
  if (!questionSet) return session;

  // Sanitize raw text
  const sanitizedRawText = rawText ? rawText.slice(0, MAX_RAW_TEXT_LENGTH) : undefined;

  // Resolve selected pills
  const allPills = questionSet.pills;
  const selectedPills = allPills.filter((p) => selectedIds.includes(p.id));

  // All-selected = skipped round (no alignment info)
  const isSkipped = selectedPills.length === allPills.length;

  // Build round record
  const round: ConversationRound = {
    question: questionSet.question,
    pills: allPills,
    selectedIds: isSkipped ? [] : selectedIds,
    rawText: sanitizedRawText,
  };

  // Accumulate text from selected pills (for potential semantic matching)
  let newAccumulatedText = session.accumulatedText;
  if (!isSkipped && selectedPills.length > 0) {
    const pillTexts = selectedPills.map((p) => p.text).join('. ');
    newAccumulatedText += (newAccumulatedText ? ' ' : '') + pillTexts;
  }
  if (sanitizedRawText) {
    newAccumulatedText += (newAccumulatedText ? ' ' : '') + sanitizedRawText;
  }

  // Update alignment from selected pills (skip if all selected)
  const newAlignment = { ...session.extractedAlignment };
  if (!isSkipped && selectedPills.length > 0) {
    mergeAlignmentHints(newAlignment, selectedPills);
  }

  // Build updated session
  const updatedRounds = [...session.rounds, round];
  const updatedSession: ConversationSession = {
    ...session,
    rounds: updatedRounds,
    accumulatedText: newAccumulatedText,
    extractedAlignment: newAlignment,
    qualityGates: evaluateQualityGates({
      ...session,
      rounds: updatedRounds,
      extractedAlignment: newAlignment,
    }),
  };

  // Check if we should transition to ready_to_match
  if (updatedSession.qualityGates.passed || updatedRounds.length >= MAX_ROUNDS) {
    updatedSession.status = 'ready_to_match';
  }

  return updatedSession;
}

/**
 * Merge alignment hints from selected pills into the accumulated alignment.
 * Multi-select: average alignment hints for selected pills.
 */
function mergeAlignmentHints(
  alignment: Partial<AlignmentScores>,
  selectedPills: PillOption[],
): void {
  if (selectedPills.length === 0) return;

  // Collect all dimension updates from selected pills
  const dimUpdates: Partial<Record<AlignmentDimension, number[]>> = {};

  for (const pill of selectedPills) {
    for (const [dim, val] of Object.entries(pill.alignmentHint)) {
      if (val === undefined || val === null) continue;
      const key = dim as AlignmentDimension;
      if (!dimUpdates[key]) dimUpdates[key] = [];
      dimUpdates[key]!.push(val as number);
    }
  }

  // Average values per dimension, then merge with existing
  for (const [dim, values] of Object.entries(dimUpdates) as [AlignmentDimension, number[]][]) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const existing = alignment[dim];

    if (existing !== undefined && existing !== null) {
      // Weighted blend: newer answers have increasing influence
      // This gives later rounds slightly more weight (blend rather than overwrite)
      alignment[dim] = Math.round((existing + avg) / 2);
    } else {
      alignment[dim] = Math.round(avg);
    }
  }
}

/* ─── Quality gates ─────────────────────────────────────── */

/**
 * Evaluate quality gates for the current session state.
 */
export function evaluateQualityGates(
  session: Pick<ConversationSession, 'extractedAlignment' | 'rounds'>,
  sampleEmbeddings?: number[][],
): QualityGates {
  const alignment = session.extractedAlignment;

  // Dimensional coverage: how many of 6 dims deviate from neutral 50
  let deviatingDims = 0;
  let totalDeviation = 0;
  let dimsWithValues = 0;

  for (const dim of ALL_DIMENSIONS) {
    const val = alignment[dim];
    if (val !== undefined && val !== null) {
      dimsWithValues++;
      const deviation = Math.abs(val - 50);
      totalDeviation += deviation;
      if (deviation > 0) deviatingDims++;
    }
  }

  // Specificity: average deviation from 50 across dimensions that have values
  const specificity = dimsWithValues > 0 ? totalDeviation / dimsWithValues : 0;

  // Discriminative power: variance of similarities against DRep rationale sample
  // (only computable when sample embeddings are provided — computed server-side)
  let discriminativePower = 0;
  if (sampleEmbeddings && sampleEmbeddings.length >= 2) {
    // Placeholder — actual computation happens in executeMatch using embedding quality module
    discriminativePower = 0.5;
  }

  const passed =
    deviatingDims >= QUALITY_THRESHOLDS.dimensionalCoverage &&
    specificity >= QUALITY_THRESHOLDS.specificity;

  return {
    discriminativePower,
    dimensionalCoverage: deviatingDims,
    specificity: Math.round(specificity * 10) / 10,
    passed,
  };
}

/* ─── Matching ──────────────────────────────────────────── */

/**
 * Build a full AlignmentScores from the accumulated partial alignment.
 * Missing dimensions default to 50 (neutral).
 */
export function buildFullAlignment(partial: Partial<AlignmentScores>): AlignmentScores {
  return {
    treasuryConservative: partial.treasuryConservative ?? 50,
    treasuryGrowth: partial.treasuryGrowth ?? 50,
    decentralization: partial.decentralization ?? 50,
    security: partial.security ?? 50,
    innovation: partial.innovation ?? 50,
    transparency: partial.transparency ?? 50,
  };
}

/**
 * Execute matching: hybrid 6D alignment + optional semantic similarity.
 */
export async function executeMatch(
  session: ConversationSession,
  options: {
    useSemantic: boolean;
    limit?: number;
  },
): Promise<MatchResult[]> {
  const limit = options.limit ?? 5;
  const userAlignment = buildFullAlignment(session.extractedAlignment);

  const supabase = getSupabaseAdmin();

  // Fetch DReps with alignment scores
  const { data: dreps } = await supabase
    .from('dreps')
    .select(
      'id, info, score, current_tier, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .not('alignment_treasury_conservative', 'is', null);

  if (!dreps?.length) return [];

  // Compute 6D alignment scores for each DRep
  const alignmentResults = dreps.map((d) => {
    const drepAlignments = extractAlignments(d);
    const distance = euclideanDistance6D(userAlignment, drepAlignments);
    const alignmentScore = distanceToScore(distance);
    const dimAgreement = computeDimensionAgreement(userAlignment, drepAlignments);
    const info = d.info as Record<string, unknown> | null;

    return {
      drepId: d.id as string,
      drepName: (info?.name as string) || null,
      drepScore: Number(d.score) || 0,
      alignmentScore,
      alignments: drepAlignments,
      identityColor: getIdentityColor(getDominantDimension(drepAlignments)).hex,
      agreeDimensions: dimAgreement.agreeDimensions,
      differDimensions: dimAgreement.differDimensions,
      tier: (d.current_tier as string) || null,
    };
  });

  // Optional semantic matching
  let semanticMap: Map<string, number> | undefined;
  let rationaleMap: Map<string, { proposalTitle: string; excerpt: string; similarity: number }[]> =
    new Map();

  if (options.useSemantic && session.accumulatedText.length > 20) {
    try {
      const { semanticSearch } = await import('@/lib/embeddings/query');

      const semanticResults = await semanticSearch(session.accumulatedText, 'rationale', {
        threshold: 0.3,
        limit: limit * 3,
      });

      // Group by DRep (secondary_id is the DRep ID for rationale embeddings)
      semanticMap = new Map<string, number>();
      for (const result of semanticResults) {
        const drepId = result.secondary_id ?? result.entity_id;
        const existing = semanticMap.get(drepId) ?? 0;
        semanticMap.set(drepId, Math.max(existing, result.similarity));

        // Collect matching rationales
        if (!rationaleMap.has(drepId)) rationaleMap.set(drepId, []);
        rationaleMap.get(drepId)!.push({
          proposalTitle: (result.metadata?.proposal_title as string) ?? 'Governance Action',
          excerpt: (result.metadata?.excerpt as string) ?? '',
          similarity: result.similarity,
        });
      }
    } catch {
      // Semantic search failure is non-fatal — fall back to alignment-only
      semanticMap = undefined;
      rationaleMap = new Map();
    }
  }

  // Combine scores
  const results: MatchResult[] = alignmentResults.map((r) => {
    const semanticScore = semanticMap?.get(r.drepId);
    const combinedScore = semanticScore
      ? Math.round(r.alignmentScore * 0.6 + semanticScore * 100 * 0.4)
      : r.alignmentScore;

    return {
      drepId: r.drepId,
      drepName: r.drepName,
      score: combinedScore,
      semanticScore: semanticScore ? Math.round(semanticScore * 100) : undefined,
      alignmentScore: r.alignmentScore,
      matchingRationales: rationaleMap.get(r.drepId)?.slice(0, 3),
      alignments: r.alignments,
      identityColor: r.identityColor,
      agreeDimensions: r.agreeDimensions,
      differDimensions: r.differDimensions,
      tier: r.tier,
    };
  });

  // Sort by combined score, then entity quality score
  results.sort((a, b) => b.score - a.score);

  // Filter: minimum quality threshold
  const MIN_SCORE = 40;
  return results.filter((r) => r.score >= MIN_SCORE).slice(0, limit);
}

/* ─── Helpers ───────────────────────────────────────────── */

/**
 * Get the next question for the current session state.
 * Returns null if max rounds reached or session is not in_progress.
 */
export function getNextQuestion(session: ConversationSession) {
  if (session.status !== 'in_progress') return null;
  if (session.rounds.length >= MAX_ROUNDS) return null;
  return getQuestionForRound(session.rounds.length);
}

function euclideanDistance6D(a: AlignmentScores, b: AlignmentScores): number {
  let sum = 0;
  for (const dim of ALL_DIMENSIONS) {
    const diff = (a[dim] ?? 50) - (b[dim] ?? 50);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function distanceToScore(distance: number): number {
  const maxDist = 245; // sqrt(6 * 100^2) ≈ 245
  return Math.max(0, Math.round((1 - distance / maxDist) * 100));
}

export { MAX_ROUNDS, MAX_RAW_TEXT_LENGTH, TOTAL_QUESTIONS };
