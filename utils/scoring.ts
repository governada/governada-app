/**
 * DRep Scoring and Metrics Calculations
 */

import { DRepVote } from '@/types/koios';
import { VoteRecord } from '@/types/drep';
import { isValidatedSocialLink } from '@/utils/display';

// ---------------------------------------------------------------------------
// V2 Scoring Constants
// ---------------------------------------------------------------------------

export const MIN_RATIONALE_LENGTH = 50;

export interface ProposalContext {
  proposalType: string;
  treasuryTier: string | null;
}

/**
 * Size tier categories based on voting power
 */
export type SizeTier = 'Small' | 'Medium' | 'Large' | 'Whale';

/**
 * Get size tier based on voting power in ADA
 * - Small: < 100,000 ADA (individual holders, emerging DReps)
 * - Medium: 100,000 - 5,000,000 ADA (established community DReps)
 * - Large: 5,000,000 - 50,000,000 ADA (major ecosystem players)
 * - Whale: > 50,000,000 ADA (concentration risk, institutional scale)
 */
export function getSizeTier(votingPowerAda: number): SizeTier {
  if (votingPowerAda < 100_000) return 'Small';
  if (votingPowerAda < 5_000_000) return 'Medium';
  if (votingPowerAda < 50_000_000) return 'Large';
  return 'Whale';
}

/**
 * Get badge styling class for size tier
 */
export function getSizeBadgeClass(tier: SizeTier): string {
  switch (tier) {
    case 'Small':
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
    case 'Medium':
      return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
    case 'Large':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    case 'Whale':
      return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
  }
}

/**
 * Calculate participation rate
 * @param votesCount Number of votes cast
 * @param totalProposals Total number of proposals during active period
 * @returns Participation rate as percentage (0-100)
 */
export function calculateParticipationRate(votesCount: number, totalProposals: number): number {
  if (totalProposals === 0) return 0;
  return Math.min(100, Math.round((votesCount / totalProposals) * 100));
}

/**
 * Calculate rationale provision rate
 * @param votes Array of vote records
 * @returns Percentage of votes with rationale provided (0-100)
 */
export function calculateRationaleRate(votes: DRepVote[] | VoteRecord[]): number {
  if (votes.length === 0) return 0;

  const votesWithRationale = votes.filter((vote) => {
    if ('meta_url' in vote) {
      return (
        vote.meta_url !== null ||
        vote.meta_json?.rationale != null ||
        vote.meta_json?.body?.comment != null ||
        vote.meta_json?.body?.rationale != null
      );
    }
    return vote.hasRationale;
  }).length;

  return Math.round((votesWithRationale / votes.length) * 100);
}

/**
 * Calculate deliberation modifier based on vote uniformity
 * Penalizes rubber-stamping (voting the same way >85% of the time)
 *
 * @param yesVotes Number of Yes votes
 * @param noVotes Number of No votes
 * @param abstainVotes Number of Abstain votes
 * @returns Modifier between 0.70 and 1.00
 */
export function calculateDeliberationModifier(
  yesVotes: number,
  noVotes: number,
  abstainVotes: number,
): number {
  const totalVotes = yesVotes + noVotes + abstainVotes;

  if (totalVotes <= 10) return 1.0;

  const dominantCount = Math.max(yesVotes, noVotes, abstainVotes);
  const dominantRatio = dominantCount / totalVotes;

  if (dominantRatio > 0.95) return 0.7;
  if (dominantRatio > 0.9) return 0.85;
  if (dominantRatio > 0.85) return 0.95;
  return 1.0;
}

export interface ReliabilityResult {
  score: number;
  streak: number;
  recency: number;
  longestGap: number;
  tenure: number;
}

/**
 * Calculate reliability score — "Can I count on this DRep to keep showing up?"
 *
 * Four orthogonal components (none overlap with Participation):
 *   Active Streak  (35%) — consecutive recent epochs with votes
 *   Recency        (30%) — exponential decay since last vote
 *   Gap Penalty    (20%) — penalises longest disappearance
 *   Tenure         (15%) — time since first vote (diminishing returns)
 *
 * Returns both the combined 0-100 score and the raw component values
 * so they can be stored and used in hints/dashboard breakdowns.
 */
export function calculateReliability(
  epochVoteCounts: number[],
  firstEpoch: number | undefined,
  currentEpoch: number,
  proposalEpochs?: Map<number, number>,
): ReliabilityResult {
  const zero: ReliabilityResult = { score: 0, streak: 0, recency: 999, longestGap: 0, tenure: 0 };
  if (!epochVoteCounts || epochVoteCounts.length === 0 || firstEpoch === undefined) return zero;

  const votedEpochs = new Set<number>();
  for (let i = 0; i < epochVoteCounts.length; i++) {
    if (epochVoteCounts[i] > 0) votedEpochs.add(firstEpoch + i);
  }
  if (votedEpochs.size === 0) return zero;

  const hasProposalData = proposalEpochs && proposalEpochs.size > 0;
  const epochHadProposals = (e: number) => !hasProposalData || (proposalEpochs!.get(e) ?? 0) > 0;

  const lastVotedEpoch = Math.max(...votedEpochs);

  // 1. Active Streak — consecutive epochs with votes counting backwards
  let streak = 0;
  for (let e = currentEpoch; e >= firstEpoch; e--) {
    if (!epochHadProposals(e)) continue;
    if (votedEpochs.has(e)) {
      streak++;
    } else {
      break;
    }
  }
  const streakScore = Math.min(100, streak * 10);

  // 2. Recency — exponential decay from last vote
  const recency = Math.max(0, currentEpoch - lastVotedEpoch);
  const recencyScore = Math.round(100 * Math.exp(-recency / 5));

  // 3. Gap Penalty — longest run of proposal-epochs without a vote
  let longestGap = 0;
  let currentGap = 0;
  for (let e = firstEpoch; e <= currentEpoch; e++) {
    if (!epochHadProposals(e)) continue;
    if (votedEpochs.has(e)) {
      longestGap = Math.max(longestGap, currentGap);
      currentGap = 0;
    } else {
      currentGap++;
    }
  }
  longestGap = Math.max(longestGap, currentGap);
  const gapScore = Math.max(0, 100 - longestGap * 12);

  // 4. Tenure — epochs since first vote, diminishing returns
  const tenure = Math.max(0, currentEpoch - firstEpoch);
  const tenureScore = Math.min(100, Math.round(20 + 80 * (1 - Math.exp(-tenure / 30))));

  const reliability = Math.round(
    streakScore * 0.35 + recencyScore * 0.3 + gapScore * 0.2 + tenureScore * 0.15,
  );

  return {
    score: Math.max(0, Math.min(100, reliability)),
    streak,
    recency,
    longestGap,
    tenure,
  };
}

/**
 * Calculate effective participation (participation rate with deliberation modifier)
 *
 * @param participationRate Raw participation rate (0-100)
 * @param deliberationModifier Modifier from calculateDeliberationModifier (0.70-1.0)
 * @returns Effective participation rate (0-100)
 */
export function calculateEffectiveParticipation(
  participationRate: number,
  deliberationModifier: number,
): number {
  return Math.round(participationRate * deliberationModifier);
}

// ---------------------------------------------------------------------------
// V2: Profile Completeness (CIP-119 metadata)
// ---------------------------------------------------------------------------

function extractStringValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && '@value' in (value as object)) {
    const inner = (value as Record<string, unknown>)['@value'];
    if (typeof inner === 'string') return inner.trim() || null;
  }
  return null;
}

/**
 * Calculate profile completeness from CIP-119 metadata body.
 * givenName 15pts, objectives 20pts, motivations 15pts,
 * qualifications 10pts, bio 10pts, validated social links 25-30pts.
 */
export function calculateProfileCompleteness(
  metadata: Record<string, unknown> | null,
  brokenUris?: Set<string>,
): number {
  if (!metadata) return 0;

  let score = 0;

  if (extractStringValue(metadata.givenName) || extractStringValue(metadata.name)) score += 15;
  if (extractStringValue(metadata.objectives)) score += 20;
  if (extractStringValue(metadata.motivations)) score += 15;
  if (extractStringValue(metadata.qualifications)) score += 10;
  if (extractStringValue(metadata.bio)) score += 10;

  const references = metadata.references;
  if (Array.isArray(references)) {
    let validCount = 0;
    const seenUris = new Set<string>();
    for (const ref of references) {
      if (ref && typeof ref === 'object' && 'uri' in ref) {
        const { uri, label } = ref as { uri: string; label?: string };
        if (!uri || seenUris.has(uri)) continue;
        seenUris.add(uri);
        if (isValidatedSocialLink(uri, label)) {
          if (brokenUris && brokenUris.has(uri)) continue;
          validCount++;
        }
      }
    }
    if (validCount >= 2) score += 30;
    else if (validCount >= 1) score += 25;
  }

  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// V2: Proposal-Type-Weighted Rationale
// ---------------------------------------------------------------------------

const CRITICAL_PROPOSAL_TYPES = [
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'NewConstitution',
  'UpdateConstitution',
];

const RATIONALE_EXEMPT_TYPES = ['InfoAction'];

function getProposalImportanceWeight(ctx: ProposalContext): number {
  if (CRITICAL_PROPOSAL_TYPES.includes(ctx.proposalType)) return 3;
  if (ctx.proposalType === 'ParameterChange') return 2;
  if (
    ctx.proposalType === 'TreasuryWithdrawals' &&
    (ctx.treasuryTier === 'significant' || ctx.treasuryTier === 'major')
  )
    return 2;
  return 1;
}

/**
 * Check if a vote has quality rationale (>= MIN_RATIONALE_LENGTH chars).
 * Gives benefit of the doubt when rationale is hosted externally and not yet fetched.
 */
export function hasQualityRationale(vote: DRepVote, resolvedText?: string): boolean {
  if (resolvedText !== undefined) {
    return resolvedText.length >= MIN_RATIONALE_LENGTH;
  }

  const inline =
    vote.meta_json?.body?.comment || vote.meta_json?.body?.rationale || vote.meta_json?.rationale;

  if (typeof inline === 'string') {
    return inline.length >= MIN_RATIONALE_LENGTH;
  }

  if (vote.meta_url !== null) return true;
  return false;
}

/**
 * Calculate rationale rate weighted by proposal importance.
 * Critical (3x), Important (2x), Standard (1x).
 * InfoActions are excluded entirely (non-binding polls don't need rationale).
 * Falls back to equal weights when proposal context is unavailable.
 */
export function calculateWeightedRationaleRate(
  votes: DRepVote[],
  proposalMap: Map<string, ProposalContext>,
  rationaleTexts?: Map<string, string>,
): number {
  if (votes.length === 0) return 0;

  let weightedRationale = 0;
  let totalWeight = 0;

  for (const vote of votes) {
    const key = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
    const ctx = proposalMap.get(key);

    if (ctx && RATIONALE_EXEMPT_TYPES.includes(ctx.proposalType)) {
      continue;
    }

    const weight = ctx ? getProposalImportanceWeight(ctx) : 1;
    const resolved = rationaleTexts?.get(vote.vote_tx_hash);

    totalWeight += weight;
    if (hasQualityRationale(vote, resolved)) {
      weightedRationale += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedRationale / totalWeight) * 100);
}

// ---------------------------------------------------------------------------
// V2: Forgiving Rationale Curve
// ---------------------------------------------------------------------------

/**
 * Apply tiered curve to rationale rate so early effort is rewarded more.
 * 0-20% raw  -> 0-30 adjusted  (1.5x, rewards initial effort)
 * 20-60% raw -> 30-70 adjusted (1.0x, linear middle)
 * 60-100% raw -> 70-100 adjusted (0.75x, diminishing returns)
 */
export function applyRationaleCurve(rawRate: number): number {
  const rate = Math.max(0, Math.min(100, rawRate));

  let adjusted: number;
  if (rate <= 20) {
    adjusted = (rate / 20) * 30;
  } else if (rate <= 60) {
    adjusted = 30 + ((rate - 20) / 40) * 40;
  } else {
    adjusted = 70 + ((rate - 60) / 40) * 30;
  }

  return Math.round(Math.max(0, Math.min(100, adjusted)));
}

/**
 * Format voting power from lovelace to ADA
 * @param lovelace Voting power in lovelace (string)
 * @returns Voting power in ADA (number)
 */
export function lovelaceToAda(lovelace: string): number {
  return parseInt(lovelace, 10) / 1_000_000;
}

/**
 * Format ADA with commas
 * @param ada Amount in ADA
 * @returns Formatted string
 */
export function formatAda(ada: number): string {
  return ada.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Get badge/background color class for DRep Score
 */
export function getDRepScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
  if (score >= 60) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
}

/**
 * Compute human-readable reliability hint from stored component values.
 * Prefers stored values; falls back to recomputing from epoch data.
 */
export function getReliabilityHintFromStored(streak: number, recency: number): string {
  if (recency > 5) return `Last voted ${recency} epochs ago`;
  if (streak >= 3) return `${streak}-epoch active streak`;
  if (recency === 0) return 'Voted this epoch';
  return `Last voted ${recency} epoch${recency === 1 ? '' : 's'} ago`;
}

// ---------------------------------------------------------------------------
// Pillar status helpers (for score card redesign)
// ---------------------------------------------------------------------------

export type PillarStatus = 'strong' | 'needs-work' | 'low';

export function getPillarStatus(value: number): PillarStatus {
  if (value >= 80) return 'strong';
  if (value >= 50) return 'needs-work';
  return 'low';
}

/**
 * Return the CIP-119 metadata fields that are missing/empty.
 * Social link checking mirrors calculateProfileCompleteness() logic:
 * - 0 validated links -> missing 'social links'
 * - 1 validated link -> missing 'a second social link (2+ recommended)'
 */
export function getMissingProfileFields(
  metadata: Record<string, unknown> | null,
  brokenUris?: Set<string>,
): string[] {
  const missing: string[] = [];
  if (!metadata)
    return ['name', 'objectives', 'motivations', 'qualifications', 'bio', 'social links'];

  if (!extractStringValue(metadata.givenName) && !extractStringValue(metadata.name))
    missing.push('name');
  if (!extractStringValue(metadata.objectives)) missing.push('objectives');
  if (!extractStringValue(metadata.motivations)) missing.push('motivations');
  if (!extractStringValue(metadata.qualifications)) missing.push('qualifications');
  if (!extractStringValue(metadata.bio)) missing.push('bio');

  const references = metadata.references;
  if (!Array.isArray(references) || references.length === 0) {
    missing.push('social links');
  } else {
    let validCount = 0;
    const seenUris = new Set<string>();
    for (const ref of references) {
      if (ref && typeof ref === 'object' && 'uri' in ref) {
        const { uri, label } = ref as { uri: string; label?: string };
        if (!uri || seenUris.has(uri)) continue;
        seenUris.add(uri);
        if (isValidatedSocialLink(uri, label)) {
          if (brokenUris && brokenUris.has(uri)) continue;
          validCount++;
        }
      }
    }
    if (validCount === 0) missing.push('social links');
    else if (validCount === 1) missing.push('a second social link (2+ recommended)');
  }

  return missing;
}

/**
 * Identify the single highest-impact quick win across all pillars.
 * Returns a label like "Complete your profile (+6 pts)" or null if all strong.
 */
export function getEasiestWin(
  pillars: { label: string; value: number; maxPoints: number }[],
): string | null {
  let best: { label: string; gain: number } | null = null;

  for (const p of pillars) {
    const status = getPillarStatus(p.value);
    if (status === 'strong') continue;

    const targetValue = status === 'low' ? 50 : 80;
    const gap = targetValue - p.value;
    const targetLabel = status === 'low' ? 'Needs Work' : 'Strong';
    const pointGain = Math.round((gap * p.maxPoints) / 100);

    if (!best || pointGain > best.gain) {
      best = { label: `Improve ${p.label} to ${targetLabel} (+${pointGain} pts)`, gain: pointGain };
    }
  }

  return best?.label ?? null;
}
