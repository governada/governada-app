/**
 * CC Constitutional Fidelity Score — 3-pillar accountability score for Constitutional Committee members.
 *
 * Simplified from the 5-pillar Transparency Index to focus on what matters:
 *   1. Participation (30%)            — Do they vote?
 *   2. Constitutional Grounding (40%) — Do they cite relevant constitutional articles?
 *   3. Reasoning Quality (30%)        — How thorough is their reasoning?
 *
 * Removed: Responsiveness (timeliness — voting within the window is sufficient),
 * Independence (hard to measure fairly), Community Engagement (no data sources yet).
 *
 * Philosophy: "Do they vote in line with the constitution? In ambiguous cases,
 * do they justify their votes enough to back it up?"
 */

import {
  computeRationaleProvision,
  computeAvgArticleCoverage,
  computeAvgReasoningQuality,
} from '@/lib/cc/fidelityScore';
import { CC_FIDELITY_WEIGHTS } from './calibration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConstitutionalFidelityPillars {
  participation: number; // 0-100
  constitutionalGrounding: number; // 0-100
  reasoningQuality: number; // 0-100
}

export interface ConstitutionalFidelityResult {
  score: number; // 0-100 composite
  pillars: ConstitutionalFidelityPillars;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

export function computeConstitutionalFidelity(
  pillars: ConstitutionalFidelityPillars,
): ConstitutionalFidelityResult {
  const score = Math.round(
    pillars.participation * CC_FIDELITY_WEIGHTS.participation +
      pillars.constitutionalGrounding * CC_FIDELITY_WEIGHTS.constitutionalGrounding +
      pillars.reasoningQuality * CC_FIDELITY_WEIGHTS.reasoningQuality,
  );

  return { score, pillars, grade: scoreToGrade(score) };
}

function scoreToGrade(score: number): ConstitutionalFidelityResult['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
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
// Pillar 2: Constitutional Grounding (0-100)
// How well do they cite relevant constitutional articles?
// Combines rationale provision rate with article coverage.
// ---------------------------------------------------------------------------

export function computeConstitutionalGroundingScore(
  totalVotes: number,
  votesWithRationale: number,
  votesWithArticleData: Array<{ proposalType: string; citedArticles: string[] }>,
): number {
  // Provision rate gates the score — no rationale means no grounding possible
  const provision = computeRationaleProvision(totalVotes, votesWithRationale); // 0-100
  const coverage = computeAvgArticleCoverage(votesWithArticleData); // 0-100

  // Weight: provision 35% (did they even provide rationale?), coverage 65% (did they cite correctly?)
  return Math.round(provision * 0.35 + coverage * 0.65);
}

// ---------------------------------------------------------------------------
// Pillar 3: Reasoning Quality (0-100)
// AI-assessed depth of constitutional reasoning.
// Falls back to a blend of provision + coverage when no AI scores available.
// ---------------------------------------------------------------------------

export function computeReasoningQualityScore(
  totalVotes: number,
  votesWithRationale: number,
  votesWithArticleData: Array<{ proposalType: string; citedArticles: string[] }>,
  reasoningScores: number[],
): number {
  if (reasoningScores.length > 0) {
    return computeAvgReasoningQuality(reasoningScores);
  }

  // Fallback when AI scores aren't available yet
  if (votesWithRationale > 0) {
    const provision = computeRationaleProvision(totalVotes, votesWithRationale);
    const coverage = computeAvgArticleCoverage(votesWithArticleData);
    return Math.round(coverage * 0.7 + provision * 0.3);
  }

  return 0;
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
  totalEligibleProposals: number;
}

export function computeFullConstitutionalFidelity(
  input: CCMemberScoringInput,
): ConstitutionalFidelityResult & {
  votesCast: number;
  eligibleProposals: number;
} {
  const { votes, rationaleMap } = input;
  const totalVotes = votes.length;
  const votesWithRationale = votes.filter((v) => v.hasRationale).length;

  // Pillar 1: Participation
  const participation = computeParticipationScore(totalVotes, input.totalEligibleProposals);

  // Build article data for Pillars 2 & 3
  const votesWithArticleData: Array<{ proposalType: string; citedArticles: string[] }> = [];
  const qualityScores: number[] = [];
  for (const v of votes) {
    const rKey = `${input.ccHotId}:${v.proposalTxHash}:${v.proposalIndex}`;
    const rationale = rationaleMap.get(rKey);
    if (rationale) {
      const pKey = `${v.proposalTxHash}:${v.proposalIndex}`;
      const proposal = input.proposalMap.get(pKey);
      votesWithArticleData.push({
        proposalType: proposal?.type ?? 'InfoAction',
        citedArticles: rationale.citedArticles,
      });
      if (rationale.reasoningScore != null) {
        qualityScores.push(rationale.reasoningScore);
      }
    }
  }

  // Pillar 2: Constitutional Grounding
  const constitutionalGrounding = computeConstitutionalGroundingScore(
    totalVotes,
    votesWithRationale,
    votesWithArticleData,
  );

  // Pillar 3: Reasoning Quality
  const reasoningQuality = computeReasoningQualityScore(
    totalVotes,
    votesWithRationale,
    votesWithArticleData,
    qualityScores,
  );

  const result = computeConstitutionalFidelity({
    participation,
    constitutionalGrounding,
    reasoningQuality,
  });

  return {
    ...result,
    votesCast: totalVotes,
    eligibleProposals: input.totalEligibleProposals,
  };
}
