/**
 * CC Constitutional Fidelity Score — 4-pillar accountability score for Constitutional Committee members.
 *
 * Designed for public defensibility under scrutiny. Each pillar measures an
 * independent signal with zero overlap:
 *
 *   1. Participation (25%)             — Do they vote on eligible proposals?
 *   2. Rationale Provision (20%)       — Do they submit CIP-136 rationale documents?
 *   3. Reasoning Quality (40%)         — AI-assessed deliberation substance (primary signal)
 *   4. Constitutional Engagement (15%) — Breadth + depth of constitutional article references
 *
 * This scores PROCESS, not OUTCOME. A "No" vote with excellent reasoning scores
 * identically to a "Yes" vote with excellent reasoning. We never score vote direction.
 */

import { computeRationaleProvision, computeAvgReasoningQuality } from '@/lib/cc/fidelityScore';
import {
  CC_FIDELITY_WEIGHTS,
  CC_ENGAGEMENT_PARAMS,
  CC_GRADE_THRESHOLDS,
  CC_BOILERPLATE_PENALTY,
} from './calibration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConstitutionalFidelityPillars {
  participation: number; // 0-100
  rationaleProvision: number; // 0-100
  reasoningQuality: number; // 0-100 (AI-scored, or null → pending)
  constitutionalEngagement: number; // 0-100
}

export interface ConstitutionalFidelityResult {
  score: number; // 0-100 composite
  pillars: ConstitutionalFidelityPillars;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** True when AI reasoning scores haven't been computed yet. */
  pendingAnalysis: boolean;
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

export function computeConstitutionalFidelity(
  pillars: ConstitutionalFidelityPillars,
  pendingAnalysis = false,
): ConstitutionalFidelityResult {
  const score = Math.round(
    pillars.participation * CC_FIDELITY_WEIGHTS.participation +
      pillars.rationaleProvision * CC_FIDELITY_WEIGHTS.rationaleProvision +
      pillars.reasoningQuality * CC_FIDELITY_WEIGHTS.reasoningQuality +
      pillars.constitutionalEngagement * CC_FIDELITY_WEIGHTS.constitutionalEngagement,
  );

  return { score, pillars, grade: scoreToGrade(score), pendingAnalysis };
}

function scoreToGrade(score: number): ConstitutionalFidelityResult['grade'] {
  if (score >= CC_GRADE_THRESHOLDS.A) return 'A';
  if (score >= CC_GRADE_THRESHOLDS.B) return 'B';
  if (score >= CC_GRADE_THRESHOLDS.C) return 'C';
  if (score >= CC_GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Pillar 1: Participation (0-100)
// What % of eligible governance actions did they vote on?
// ---------------------------------------------------------------------------

export function computeParticipationScore(votesCast: number, eligibleProposals: number): number {
  if (eligibleProposals === 0) return 0;
  return Math.min(100, Math.round((votesCast / eligibleProposals) * 100));
}

// ---------------------------------------------------------------------------
// Pillar 2: Rationale Provision (0-100)
// What % of their votes include a CIP-136 rationale document?
// This is a binary, independent signal — separate from reasoning QUALITY.
// ---------------------------------------------------------------------------

export function computeRationaleProvisionScore(
  totalVotes: number,
  votesWithRationale: number,
): number {
  return computeRationaleProvision(totalVotes, votesWithRationale);
}

// ---------------------------------------------------------------------------
// Pillar 3: Reasoning Quality (0-100)
// AI-assessed deliberation quality. NO FALLBACK — if AI scores don't exist,
// returns 0 and sets pendingAnalysis flag. This prevents double-counting
// article coverage in two pillars.
// ---------------------------------------------------------------------------

export function computeReasoningQualityScore(
  aiDeliberationScores: number[],
  boilerplateScores: number[],
): { score: number; hasScoredRationales: boolean } {
  if (aiDeliberationScores.length === 0) {
    return { score: 0, hasScoredRationales: false };
  }

  const avgQuality = computeAvgReasoningQuality(aiDeliberationScores);

  // Apply boilerplate penalty if scores exist
  if (boilerplateScores.length > 0) {
    const avgBoilerplate = boilerplateScores.reduce((a, b) => a + b, 0) / boilerplateScores.length;
    const penalty = avgBoilerplate * CC_BOILERPLATE_PENALTY.decayRate;
    const penaltyFactor = Math.max(1 - CC_BOILERPLATE_PENALTY.maxPenaltyFactor, 1 - penalty);
    return { score: Math.round(avgQuality * penaltyFactor), hasScoredRationales: true };
  }

  return { score: Math.round(avgQuality), hasScoredRationales: true };
}

// ---------------------------------------------------------------------------
// Pillar 4: Constitutional Engagement (0-100)
// Breadth + depth of constitutional article references.
// Credits ANY article citation — no expected-article format matching.
// ---------------------------------------------------------------------------

export function computeConstitutionalEngagementScore(
  uniqueArticlesCited: number,
  avgArticlesPerRationale: number,
): number {
  const { totalConstitutionalArticles, targetArticlesPerRationale, breadthWeight, depthWeight } =
    CC_ENGAGEMENT_PARAMS;

  const breadth = Math.min(
    100,
    Math.round((uniqueArticlesCited / totalConstitutionalArticles) * 100),
  );
  const depth = Math.min(
    100,
    Math.round((avgArticlesPerRationale / targetArticlesPerRationale) * 100),
  );

  return Math.round(breadth * breadthWeight + depth * depthWeight);
}

// ---------------------------------------------------------------------------
// Full computation from raw data (used by sync pipeline)
// ---------------------------------------------------------------------------

export interface CCMemberVoteData {
  proposalTxHash: string;
  proposalIndex: number;
  vote: string;
  blockTime: number;
  hasRationale: boolean;
}

export interface CCMemberScoringInput {
  ccHotId: string;
  votes: CCMemberVoteData[];
  proposalMap: Map<string, { type: string; blockTime: number }>;
  rationaleMap: Map<string, { citedArticles: string[]; reasoningScore: number | null }>;
  /** AI deliberation quality scores from cc_rationale_analysis. */
  aiScores: { deliberationQuality: number; boilerplateScore: number | null }[];
  totalEligibleProposals: number;
}

export function computeFullConstitutionalFidelity(
  input: CCMemberScoringInput,
): ConstitutionalFidelityResult & {
  votesCast: number;
  eligibleProposals: number;
} {
  const { votes, rationaleMap, aiScores } = input;
  const totalVotes = votes.length;
  const votesWithRationale = votes.filter((v) => v.hasRationale).length;

  // Pillar 1: Participation
  const participation = computeParticipationScore(totalVotes, input.totalEligibleProposals);

  // Pillar 2: Rationale Provision
  const rationaleProvision = computeRationaleProvisionScore(totalVotes, votesWithRationale);

  // Pillar 3: Reasoning Quality (AI-only)
  const deliberationScores = aiScores.map((s) => s.deliberationQuality);
  const boilerplateScores = aiScores
    .filter((s) => s.boilerplateScore != null)
    .map((s) => s.boilerplateScore!);
  const { score: reasoningQuality, hasScoredRationales } = computeReasoningQualityScore(
    deliberationScores,
    boilerplateScores,
  );

  // Pillar 4: Constitutional Engagement — breadth + depth from rationale citations
  const allCitedArticles = new Set<string>();
  let totalArticlesCited = 0;
  let rationalesWithArticles = 0;
  for (const v of votes) {
    const rKey = `${input.ccHotId}:${v.proposalTxHash}:${v.proposalIndex}`;
    const rationale = rationaleMap.get(rKey);
    if (rationale?.citedArticles?.length) {
      for (const a of rationale.citedArticles) {
        // Normalize: extract the article number (e.g., "Article IV" from "Article IV, Section 3")
        const normalized = normalizeArticle(a);
        if (normalized) allCitedArticles.add(normalized);
      }
      totalArticlesCited += rationale.citedArticles.length;
      rationalesWithArticles++;
    }
  }
  const avgArticlesPerRationale =
    rationalesWithArticles > 0 ? totalArticlesCited / rationalesWithArticles : 0;
  const constitutionalEngagement = computeConstitutionalEngagementScore(
    allCitedArticles.size,
    avgArticlesPerRationale,
  );

  const pendingAnalysis = votesWithRationale > 0 && !hasScoredRationales;

  const result = computeConstitutionalFidelity(
    { participation, rationaleProvision, reasoningQuality, constitutionalEngagement },
    pendingAnalysis,
  );

  return {
    ...result,
    votesCast: totalVotes,
    eligibleProposals: input.totalEligibleProposals,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPELLED_TO_ROMAN: Record<string, string> = {
  one: 'I',
  two: 'II',
  three: 'III',
  four: 'IV',
  five: 'V',
  six: 'VI',
  seven: 'VII',
  eight: 'VIII',
  nine: 'IX',
  ten: 'X',
};

const CONSTITUTIONAL_CONCEPTS: Record<string, string> = {
  treasury: 'Article IV',
  withdrawal: 'Article IV',
  'hard fork': 'Article III',
  'protocol parameter': 'Article III',
  committee: 'Article V',
  'no confidence': 'Article V',
  'new constitution': 'Article VI',
  amendment: 'Article VI',
  delegation: 'Article II',
  governance: 'Article II',
  drep: 'Article II',
  'stake pool': 'Article II',
};

/** Normalize article citations to top-level article identity (e.g., "Article IV"). */
function normalizeArticle(citation: string): string | null {
  // Match patterns like "Article IV", "Article II, § 6", "Article VII, Section 4"
  const match = citation.match(/Article\s+([IVX]+|\d+)/i);
  if (match) return `Article ${match[1].toUpperCase()}`;

  // Abbreviated format: "Art. II", "Art. 4"
  const abbrevMatch = citation.match(/Art\.\s*([IVX]+|\d+)/i);
  if (abbrevMatch) return `Article ${abbrevMatch[1].toUpperCase()}`;

  // Spelled-out numbers: "Article One" → "Article I"
  const spelledMatch = citation.match(
    /Article\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)/i,
  );
  if (spelledMatch) {
    const roman = SPELLED_TO_ROMAN[spelledMatch[1].toLowerCase()];
    if (roman) return `Article ${roman}`;
  }

  // Also handle "Appendix I", "Preamble", etc.
  if (/appendix/i.test(citation)) return 'Appendix';
  if (/preamble/i.test(citation)) return 'Preamble';

  // If citation contains "Constitution" broadly, don't count as a specific article
  if (/constitution/i.test(citation)) return null;

  // Conceptual references: map keywords to canonical articles
  const lower = citation.toLowerCase();
  for (const [keyword, article] of Object.entries(CONSTITUTIONAL_CONCEPTS)) {
    if (lower.includes(keyword)) return article;
  }

  return null;
}
