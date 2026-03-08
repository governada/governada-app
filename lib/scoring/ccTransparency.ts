/**
 * CC Transparency Index — 5-pillar accountability score for Constitutional Committee members.
 *
 * Aligned with the CC Member persona doc specification:
 *   1. Participation (35%)    — Vote rate on governance actions
 *   2. Rationale Quality (30%) — Provision rate + article coverage + reasoning depth
 *   3. Responsiveness (15%)   — Time from proposal to CC vote
 *   4. Independence (10%)     — Independent judgment vs CC-bloc groupthink
 *   5. Community Engagement (10%) — Citizen endorsements + question responses
 *
 * Design: measures process, not outcomes. A CC member who votes against
 * community sentiment but provides thorough constitutional reasoning scores well.
 */

import {
  computeRationaleProvision,
  computeAvgArticleCoverage,
  computeAvgReasoningQuality,
  computeResponsivenessScore,
  computeIndependenceScore as computeDRepAlignmentIndependence,
} from '@/lib/cc/fidelityScore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransparencyPillars {
  participation: number; // 0-100
  rationaleQuality: number; // 0-100
  responsiveness: number; // 0-100
  independence: number; // 0-100
  communityEngagement: number; // 0-100
}

export interface TransparencyResult {
  index: number; // 0-100 composite
  pillars: TransparencyPillars;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// ---------------------------------------------------------------------------
// Weights — per persona doc spec
// ---------------------------------------------------------------------------

const WEIGHTS = {
  participation: 0.35,
  rationaleQuality: 0.3,
  responsiveness: 0.15,
  independence: 0.1,
  communityEngagement: 0.1,
};

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

export function computeTransparencyIndex(pillars: TransparencyPillars): TransparencyResult {
  const index = Math.round(
    pillars.participation * WEIGHTS.participation +
      pillars.rationaleQuality * WEIGHTS.rationaleQuality +
      pillars.responsiveness * WEIGHTS.responsiveness +
      pillars.independence * WEIGHTS.independence +
      pillars.communityEngagement * WEIGHTS.communityEngagement,
  );

  return { index, pillars, grade: indexToGrade(index) };
}

function indexToGrade(index: number): TransparencyResult['grade'] {
  if (index >= 85) return 'A';
  if (index >= 70) return 'B';
  if (index >= 55) return 'C';
  if (index >= 40) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Pillar 1: Participation (0-100)
// What % of eligible governance actions did they vote on?
// Non-participation is the most basic accountability failure.
// ---------------------------------------------------------------------------

export function computeParticipationScore(votesCast: number, eligibleProposals: number): number {
  if (eligibleProposals === 0) return 0;
  return Math.min(100, Math.round((votesCast / eligibleProposals) * 100));
}

// ---------------------------------------------------------------------------
// Pillar 2: Rationale Quality (0-100)
// Composite of: provision rate, article coverage, reasoning depth.
// Uses existing fidelity sub-components.
// ---------------------------------------------------------------------------

export function computeRationaleQualityScore(
  totalVotes: number,
  votesWithRationale: number,
  votesWithArticleData: Array<{ proposalType: string; citedArticles: string[] }>,
  reasoningScores: number[],
): number {
  // Sub-scores with internal weights
  const provision = computeRationaleProvision(totalVotes, votesWithRationale); // 0-100
  const coverage = computeAvgArticleCoverage(votesWithArticleData); // 0-100
  const reasoning =
    reasoningScores.length > 0
      ? computeAvgReasoningQuality(reasoningScores)
      : votesWithRationale > 0
        ? Math.round(coverage * 0.7 + provision * 0.3)
        : 0;

  // Weight: provision 30%, coverage 35%, reasoning 35%
  return Math.round(provision * 0.3 + coverage * 0.35 + reasoning * 0.35);
}

// ---------------------------------------------------------------------------
// Pillar 3: Responsiveness (0-100)
// Uses computeResponsivenessScore from fidelityScore.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pillar 4: Independence (0-100)
// Measures independent judgment vs CC-bloc groupthink.
// Two sub-components:
//   - CC-bloc independence (60%): How often do they diverge from unanimous CC votes?
//     Some disagreement is healthy; perfect unanimity suggests groupthink.
//   - DRep alignment independence (40%): Bell curve peaking at moderate alignment.
// ---------------------------------------------------------------------------

/**
 * CC-bloc independence: measures how often a member diverges from the CC majority.
 * Perfect unanimity on every vote = low score. Moderate independent votes = high score.
 * @param totalCcVotes Total proposals where the CC voted
 * @param memberDissentCount Proposals where this member voted differently from CC majority
 */
export function computeBlocIndependenceScore(
  totalCcVotes: number,
  memberDissentCount: number,
): number {
  if (totalCcVotes === 0) return 50; // neutral default
  const dissentRate = (memberDissentCount / totalCcVotes) * 100;

  // Ideal dissent range: 5-25% (healthy independent judgment)
  if (dissentRate >= 5 && dissentRate <= 25) return 100;
  if (dissentRate < 5) {
    // Too little dissent — groupthink signal
    return Math.round(50 + dissentRate * 10); // 0%->50, 5%->100
  }
  // More than 25% dissent — still scores well but tapers
  return Math.max(40, Math.round(100 - (dissentRate - 25) * 2));
}

/**
 * Combined independence score.
 */
export function computeIndependenceScoreCombined(
  totalCcVotes: number,
  memberDissentCount: number,
  drepAlignmentPct: number,
): number {
  const bloc = computeBlocIndependenceScore(totalCcVotes, memberDissentCount);
  const drepIndep = computeDRepAlignmentIndependence(drepAlignmentPct);
  return Math.round(bloc * 0.6 + drepIndep * 0.4);
}

// ---------------------------------------------------------------------------
// Pillar 5: Community Engagement (0-100)
// Citizen questions answered, endorsement count, explanations beyond rationales.
// When engagement data doesn't exist yet, returns 0.
// ---------------------------------------------------------------------------

export function computeCommunityEngagementScore(
  questionsAnswered: number,
  endorsementCount: number,
): number {
  // Score based on available engagement signals
  // Each question answered = 15 points (max 60)
  const questionScore = Math.min(60, questionsAnswered * 15);
  // Each endorsement = 5 points (max 40)
  const endorsementScore = Math.min(40, endorsementCount * 5);
  return Math.min(100, questionScore + endorsementScore);
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
  drepMajorityMap: Map<string, string>;
  ccMajorityMap: Map<string, string>;
  totalEligibleProposals: number;
  questionsAnswered: number;
  endorsementCount: number;
}

export function computeFullTransparencyIndex(input: CCMemberScoringInput): TransparencyResult & {
  votesCast: number;
  eligibleProposals: number;
} {
  const { votes, proposalMap, rationaleMap, drepMajorityMap, ccMajorityMap } = input;
  const totalVotes = votes.length;
  const votesWithRationale = votes.filter((v) => v.hasRationale).length;

  // Pillar 1: Participation
  const participation = computeParticipationScore(totalVotes, input.totalEligibleProposals);

  // Pillar 2: Rationale Quality
  const votesWithArticleData: Array<{ proposalType: string; citedArticles: string[] }> = [];
  const qualityScores: number[] = [];
  for (const v of votes) {
    const rKey = `${input.ccHotId}:${v.proposalTxHash}:${v.proposalIndex}`;
    const rationale = rationaleMap.get(rKey);
    if (rationale) {
      const pKey = `${v.proposalTxHash}:${v.proposalIndex}`;
      const proposal = proposalMap.get(pKey);
      votesWithArticleData.push({
        proposalType: proposal?.type ?? 'InfoAction',
        citedArticles: rationale.citedArticles,
      });
      if (rationale.reasoningScore != null) {
        qualityScores.push(rationale.reasoningScore);
      }
    }
  }
  const rationaleQuality = computeRationaleQualityScore(
    totalVotes,
    votesWithRationale,
    votesWithArticleData,
    qualityScores,
  );

  // Pillar 3: Responsiveness
  let totalDaysToVote = 0;
  let responsiveVotes = 0;
  for (const v of votes) {
    const pKey = `${v.proposalTxHash}:${v.proposalIndex}`;
    const proposal = proposalMap.get(pKey);
    if (proposal) {
      const daysToVote = (v.blockTime - proposal.blockTime) / 86400;
      if (daysToVote >= 0) {
        totalDaysToVote += daysToVote;
        responsiveVotes++;
      }
    }
  }
  const avgDaysToVote = responsiveVotes > 0 ? totalDaysToVote / responsiveVotes : 10;
  const responsiveness = computeResponsivenessScore(avgDaysToVote);

  // Pillar 4: Independence
  let drepAgreements = 0;
  let drepComparisons = 0;
  let memberDissentCount = 0;
  let ccComparisons = 0;

  for (const v of votes) {
    const pKey = `${v.proposalTxHash}:${v.proposalIndex}`;

    // DRep alignment
    const drepMajority = drepMajorityMap.get(pKey);
    if (drepMajority && drepMajority !== 'Abstain') {
      drepComparisons++;
      if (v.vote === drepMajority) drepAgreements++;
    }

    // CC-bloc dissent
    const ccMajority = ccMajorityMap.get(pKey);
    if (ccMajority) {
      ccComparisons++;
      if (v.vote !== ccMajority) memberDissentCount++;
    }
  }

  const drepAlignmentPct = drepComparisons > 0 ? (drepAgreements / drepComparisons) * 100 : 50;
  const independence = computeIndependenceScoreCombined(
    ccComparisons,
    memberDissentCount,
    drepAlignmentPct,
  );

  // Pillar 5: Community Engagement
  const communityEngagement = computeCommunityEngagementScore(
    input.questionsAnswered,
    input.endorsementCount,
  );

  const result = computeTransparencyIndex({
    participation,
    rationaleQuality,
    responsiveness,
    independence,
    communityEngagement,
  });

  return {
    ...result,
    votesCast: totalVotes,
    eligibleProposals: input.totalEligibleProposals,
  };
}
