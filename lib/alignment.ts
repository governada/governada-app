/**
 * Value Alignment Engine
 * Calculates alignment between user preferences and DRep voting behavior
 */

import { DRepVote, ProposalInfo, ClassifiedProposal } from '@/types/koios';
import { UserPrefKey } from '@/types/drep';
import { EnrichedDRep } from '@/lib/koios';

const TREASURY_KEYWORDS = ['treasury', 'withdrawal', 'budget', 'fund', 'spend', 'grant', 'funding'];

// Treasury amount tiers (in ADA)
const TREASURY_TIER_ROUTINE = 1_000_000; // < 1M ADA
const TREASURY_TIER_SIGNIFICANT = 20_000_000; // 1M - 20M ADA
// > 20M ADA = Major

/**
 * Classify a proposal based on CIP-1694 type and metadata
 */
export function classifyProposal(proposal: ProposalInfo): ClassifiedProposal {
  const relevantPrefs: UserPrefKey[] = [];
  let withdrawalAmountAda: number | null = null;
  let treasuryTier: 'routine' | 'significant' | 'major' | null = null;

  // Map proposal type to relevant preferences
  switch (proposal.proposal_type) {
    case 'TreasuryWithdrawals':
      relevantPrefs.push('treasury-conservative', 'smart-treasury-growth');

      // Calculate total withdrawal amount
      if (proposal.withdrawal && proposal.withdrawal.length > 0) {
        const totalLovelace = proposal.withdrawal.reduce(
          (sum, w) => sum + BigInt(w.amount || '0'),
          BigInt(0),
        );
        withdrawalAmountAda = Number(totalLovelace / BigInt(1_000_000));

        // Determine tier
        if (withdrawalAmountAda < TREASURY_TIER_ROUTINE) {
          treasuryTier = 'routine';
        } else if (withdrawalAmountAda < TREASURY_TIER_SIGNIFICANT) {
          treasuryTier = 'significant';
        } else {
          treasuryTier = 'major';
        }
      }
      break;

    case 'ParameterChange':
      relevantPrefs.push('protocol-security-first');
      break;

    case 'HardForkInitiation':
      relevantPrefs.push('protocol-security-first', 'innovation-defi-growth');
      break;

    case 'NoConfidence':
    case 'NewConstitutionalCommittee':
      relevantPrefs.push('strong-decentralization', 'protocol-security-first');
      break;

    case 'UpdateConstitution':
      relevantPrefs.push('protocol-security-first', 'responsible-governance');
      break;

    case 'InfoAction':
      // For InfoAction, use keyword analysis on title/abstract
      const searchText = [
        proposal.meta_json?.body?.title || proposal.meta_json?.title,
        proposal.meta_json?.body?.abstract || proposal.meta_json?.abstract,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (
        searchText.includes('defi') ||
        searchText.includes('innovation') ||
        searchText.includes('growth')
      ) {
        relevantPrefs.push('innovation-defi-growth');
      }
      if (
        searchText.includes('security') ||
        searchText.includes('stability') ||
        searchText.includes('parameter')
      ) {
        relevantPrefs.push('protocol-security-first');
      }
      if (
        searchText.includes('treasury') ||
        searchText.includes('fund') ||
        searchText.includes('budget')
      ) {
        relevantPrefs.push('treasury-conservative', 'smart-treasury-growth');
      }
      if (
        searchText.includes('decentralization') ||
        searchText.includes('governance') ||
        searchText.includes('community')
      ) {
        relevantPrefs.push('strong-decentralization');
      }
      if (
        searchText.includes('transparent') ||
        searchText.includes('accountability') ||
        searchText.includes('reporting')
      ) {
        relevantPrefs.push('responsible-governance');
      }

      // Default if no keywords matched
      if (relevantPrefs.length === 0) {
        relevantPrefs.push('responsible-governance');
      }
      break;
  }

  return {
    txHash: proposal.proposal_tx_hash,
    index: proposal.proposal_index,
    proposalId: proposal.proposal_id || '',
    type: proposal.proposal_type,
    title:
      proposal.meta_json?.body?.title ||
      proposal.meta_json?.title ||
      `Proposal ${proposal.proposal_tx_hash.slice(0, 8)}...`,
    abstract:
      proposal.meta_json?.body?.abstract ||
      proposal.meta_json?.abstract ||
      proposal.proposal_description ||
      proposal.meta_json?.body?.motivation ||
      null,
    withdrawalAmountAda,
    treasuryTier,
    paramChanges: proposal.param_proposal,
    relevantPrefs,
    proposedEpoch: proposal.proposed_epoch,
    blockTime: proposal.block_time,
    ratifiedEpoch: proposal.ratified_epoch ?? null,
    enactedEpoch: proposal.enacted_epoch ?? null,
    droppedEpoch: proposal.dropped_epoch ?? null,
    expiredEpoch: proposal.expired_epoch ?? null,
    expirationEpoch: proposal.expiration ?? null,
  };
}

/**
 * Classify an array of proposals
 */
export function classifyProposals(proposals: ProposalInfo[]): ClassifiedProposal[] {
  return proposals.map(classifyProposal);
}

/**
 * Get proposals relevant to a specific preference
 */
export function getProposalsForPref(
  classifiedProposals: ClassifiedProposal[],
  pref: UserPrefKey,
): ClassifiedProposal[] {
  return classifiedProposals.filter((p) => p.relevantPrefs.includes(pref));
}

// ============================================================================
// SCORECARD TYPES
// ============================================================================

export interface AlignmentBreakdown {
  treasury: number;
  decentralization: number;
  security: number;
  innovation: number;
  transparency: number;
  overall: number;
}

export interface AlignmentScorecard {
  drepId: string;
  scores: AlignmentBreakdown;
  votesAnalyzed: number;
  calculatedAt: number;
}

export interface AlignmentShift {
  drepId: string;
  drepName: string;
  previousMatch: number;
  currentMatch: number;
  delta: number;
  categoryShifts: {
    pref: UserPrefKey;
    previous: number;
    current: number;
    causedBy: string[];
  }[];
}

// ============================================================================
// SCORECARD CALCULATION
// ============================================================================

export interface VoteWithProposal {
  vote: DRepVote;
  proposal: ClassifiedProposal | null;
}

function voteHasRationale(vote: DRepVote): boolean {
  if (typeof vote.has_rationale === 'boolean') return vote.has_rationale;

  return Boolean(
    vote.meta_url ||
    vote.meta_json?.rationale ||
    vote.meta_json?.body?.comment ||
    vote.meta_json?.body?.rationale,
  );
}

/**
 * Match votes to classified proposals
 */
export function matchVotesToProposals(
  votes: DRepVote[],
  proposals: ClassifiedProposal[],
): VoteWithProposal[] {
  const proposalMap = new Map<string, ClassifiedProposal>();
  for (const p of proposals) {
    proposalMap.set(`${p.txHash}-${p.index}`, p);
  }

  return votes.map((vote) => ({
    vote,
    proposal: proposalMap.get(`${vote.proposal_tx_hash}-${vote.proposal_index}`) || null,
  }));
}

/**
 * Calculate Treasury Conservative score (0-100)
 * "No" on Major = 100, "No" on Significant = 90, Routine = 50, "Yes" penalized
 */
export function calculateTreasuryConservativeScore(votesWithProposals: VoteWithProposal[]): number {
  const treasuryVotes = votesWithProposals.filter(
    (v) => v.proposal?.type === 'TreasuryWithdrawals',
  );

  if (treasuryVotes.length === 0) return 50;

  let totalScore = 0;
  for (const { vote, proposal } of treasuryVotes) {
    const tier = proposal?.treasuryTier || 'routine';

    if (vote.vote === 'No') {
      if (tier === 'major') totalScore += 100;
      else if (tier === 'significant') totalScore += 90;
      else totalScore += 50;
    } else if (vote.vote === 'Yes') {
      if (tier === 'major') totalScore += 10;
      else if (tier === 'significant') totalScore += 30;
      else totalScore += 50;
    } else {
      totalScore += 50;
    }
  }

  return Math.round(totalScore / treasuryVotes.length);
}

/**
 * Calculate Treasury Growth score (0-100)
 * "Yes" with rationale = high, "No" without rationale = low
 */
export function calculateTreasuryGrowthScore(votesWithProposals: VoteWithProposal[]): number {
  const treasuryVotes = votesWithProposals.filter(
    (v) => v.proposal?.type === 'TreasuryWithdrawals',
  );

  if (treasuryVotes.length === 0) return 50;

  let totalScore = 0;
  for (const { vote, proposal } of treasuryVotes) {
    const hasRationale = voteHasRationale(vote);
    const tier = proposal?.treasuryTier || 'routine';

    if (vote.vote === 'Yes') {
      if (hasRationale) {
        if (tier === 'major') totalScore += 90;
        else if (tier === 'significant') totalScore += 85;
        else totalScore += 70;
      } else {
        totalScore += 60;
      }
    } else if (vote.vote === 'No') {
      if (hasRationale) {
        totalScore += 40;
      } else {
        totalScore += 20;
      }
    } else {
      totalScore += 50;
    }
  }

  return Math.round(totalScore / treasuryVotes.length);
}

/**
 * Calculate Decentralization score (0-100)
 * Based on DRep size tier
 */
export function calculateDecentralizationScore(drep: EnrichedDRep): number {
  const tierScores: Record<string, number> = {
    Small: 95,
    Medium: 72,
    Large: 40,
    Whale: 12,
  };
  return tierScores[drep.sizeTier] || 50;
}

/**
 * Calculate Protocol Security score (0-100)
 * Based on participation and rationale on security-related proposals
 */
export function calculateSecurityScore(
  drep: EnrichedDRep,
  votesWithProposals: VoteWithProposal[],
): number {
  const securityVotes = votesWithProposals.filter((v) =>
    v.proposal?.relevantPrefs.includes('protocol-security-first'),
  );

  if (securityVotes.length === 0) {
    return Math.round(drep.participationRate * 0.6 + drep.rationaleRate * 0.4);
  }

  const cautionVotes = securityVotes.filter(
    (v) => v.vote.vote === 'No' || v.vote.vote === 'Abstain',
  ).length;
  const rationalVotes = securityVotes.filter((v) => voteHasRationale(v.vote)).length;

  const cautionRate = (cautionVotes / securityVotes.length) * 100;
  const rationalRate = (rationalVotes / securityVotes.length) * 100;

  return Math.round(cautionRate * 0.6 + rationalRate * 0.4);
}

/**
 * Calculate Innovation/DeFi score (0-100)
 * Based on participation and yes votes on info/innovation proposals
 */
export function calculateInnovationScore(
  drep: EnrichedDRep,
  votesWithProposals: VoteWithProposal[],
): number {
  const innovationVotes = votesWithProposals.filter(
    (v) =>
      v.proposal?.relevantPrefs.includes('innovation-defi-growth') ||
      v.proposal?.type === 'InfoAction',
  );

  if (innovationVotes.length === 0) {
    return Math.round(drep.participationRate * 0.5 + 25);
  }

  const yesVotes = innovationVotes.filter((v) => v.vote.vote === 'Yes').length;
  const yesRate = (yesVotes / innovationVotes.length) * 100;

  return Math.round(yesRate * 0.5 + drep.participationRate * 0.5);
}

/**
 * Calculate Transparency score (0-100)
 * Direct mapping from rationale rate
 */
export function calculateTransparencyScore(drep: EnrichedDRep): number {
  return drep.rationaleRate;
}

/**
 * Calculate full scorecard for a DRep based on classified proposals
 */
export function calculateScorecard(
  drep: EnrichedDRep,
  votes: DRepVote[],
  proposals: ClassifiedProposal[],
  prefs: UserPrefKey[],
): AlignmentScorecard {
  const votesWithProposals = matchVotesToProposals(votes, proposals);

  const scores: AlignmentBreakdown = {
    treasury: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
    overall: 50,
  };

  // Calculate each category score
  if (prefs.includes('treasury-conservative')) {
    scores.treasury = calculateTreasuryConservativeScore(votesWithProposals);
  } else if (prefs.includes('smart-treasury-growth')) {
    scores.treasury = calculateTreasuryGrowthScore(votesWithProposals);
  }

  if (prefs.includes('strong-decentralization')) {
    scores.decentralization = calculateDecentralizationScore(drep);
  }

  if (prefs.includes('protocol-security-first')) {
    scores.security = calculateSecurityScore(drep, votesWithProposals);
  }

  if (prefs.includes('innovation-defi-growth')) {
    scores.innovation = calculateInnovationScore(drep, votesWithProposals);
  }

  if (prefs.includes('responsible-governance')) {
    scores.transparency = calculateTransparencyScore(drep);
  }

  // Calculate overall as simple average of selected categories
  const activeScores: number[] = [];
  if (prefs.includes('treasury-conservative') || prefs.includes('smart-treasury-growth')) {
    activeScores.push(scores.treasury);
  }
  if (prefs.includes('strong-decentralization')) {
    activeScores.push(scores.decentralization);
  }
  if (prefs.includes('protocol-security-first')) {
    activeScores.push(scores.security);
  }
  if (prefs.includes('innovation-defi-growth')) {
    activeScores.push(scores.innovation);
  }
  if (prefs.includes('responsible-governance')) {
    activeScores.push(scores.transparency);
  }

  scores.overall =
    activeScores.length > 0
      ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length)
      : 50;

  return {
    drepId: drep.drepId,
    scores,
    votesAnalyzed: votes.length,
    calculatedAt: Date.now(),
  };
}

// ============================================================================
// SHIFT DETECTION (for alerts)
// ============================================================================

const SHIFT_THRESHOLD = 8;

/**
 * Detect alignment shifts between previous and current scorecards
 */
export function detectAlignmentShifts(
  previous: AlignmentScorecard | null,
  current: AlignmentScorecard,
  drepName: string,
  prefs: UserPrefKey[],
): AlignmentShift | null {
  if (!previous) return null;

  const delta = current.scores.overall - previous.scores.overall;

  if (delta >= -SHIFT_THRESHOLD) return null;

  const categoryShifts: AlignmentShift['categoryShifts'] = [];

  const checkCategory = (pref: UserPrefKey, scoreKey: keyof AlignmentBreakdown) => {
    if (!prefs.includes(pref)) return;
    const prevScore = previous.scores[scoreKey];
    const currScore = current.scores[scoreKey];
    if (currScore < prevScore - 5) {
      categoryShifts.push({
        pref,
        previous: prevScore,
        current: currScore,
        causedBy: [],
      });
    }
  };

  checkCategory('treasury-conservative', 'treasury');
  checkCategory('smart-treasury-growth', 'treasury');
  checkCategory('strong-decentralization', 'decentralization');
  checkCategory('protocol-security-first', 'security');
  checkCategory('innovation-defi-growth', 'innovation');
  checkCategory('responsible-governance', 'transparency');

  return {
    drepId: current.drepId,
    drepName,
    previousMatch: previous.scores.overall,
    currentMatch: current.scores.overall,
    delta,
    categoryShifts,
  };
}

// ============================================================================
// PER-VOTE ALIGNMENT EVALUATION
// ============================================================================

export interface VoteAlignmentResult {
  status: 'aligned' | 'unaligned' | 'neutral';
  reasons: string[];
}

/**
 * Evaluate a single vote's alignment with user preferences.
 * This is the atomic unit that rolls up into the match score.
 */
export function evaluateVoteAlignment(
  vote: 'Yes' | 'No' | 'Abstain',
  hasRationale: boolean,
  proposalType: string | null,
  treasuryTier: string | null,
  relevantPrefs: string[],
  userPrefs: UserPrefKey[],
): VoteAlignmentResult {
  if (userPrefs.length === 0) return { status: 'neutral', reasons: [] };

  const matchingPrefs = userPrefs.filter((p) => relevantPrefs.includes(p));
  if (matchingPrefs.length === 0) return { status: 'neutral', reasons: [] };

  const reasons: string[] = [];
  let alignedCount = 0;
  let unalignedCount = 0;

  for (const pref of matchingPrefs) {
    switch (pref) {
      case 'treasury-conservative':
        if (proposalType === 'TreasuryWithdrawals') {
          if (vote === 'No') {
            alignedCount++;
            reasons.push('Voted No on treasury spend');
          } else if (vote === 'Yes') {
            unalignedCount++;
            reasons.push('Voted Yes on treasury spend');
          }
        }
        break;

      case 'smart-treasury-growth':
        if (proposalType === 'TreasuryWithdrawals') {
          if (vote === 'Yes' && hasRationale) {
            alignedCount++;
            reasons.push('Supported treasury spend with rationale');
          } else if (vote === 'Yes' && !hasRationale) {
            unalignedCount++;
            reasons.push('Supported treasury spend without rationale');
          } else if (vote === 'No' && !hasRationale) {
            unalignedCount++;
            reasons.push('Rejected treasury spend without rationale');
          }
        }
        break;

      case 'protocol-security-first':
        if (vote === 'No' || vote === 'Abstain') {
          alignedCount++;
          reasons.push('Cautious vote on security-relevant proposal');
        } else {
          unalignedCount++;
          reasons.push('Approved security-relevant proposal');
        }
        break;

      case 'innovation-defi-growth':
        if (vote === 'Yes') {
          alignedCount++;
          reasons.push('Supported innovation/growth proposal');
        } else if (vote === 'No') {
          unalignedCount++;
          reasons.push('Voted against innovation/growth proposal');
        }
        break;

      case 'responsible-governance':
        if (hasRationale) {
          alignedCount++;
          reasons.push('Provided on-chain rationale');
        } else {
          unalignedCount++;
          reasons.push('No on-chain rationale provided');
        }
        break;

      // strong-decentralization is DRep-level, not per-vote
    }
  }

  if (alignedCount === 0 && unalignedCount === 0) {
    return { status: 'neutral', reasons };
  }

  return {
    status: alignedCount >= unalignedCount ? 'aligned' : 'unaligned',
    reasons,
  };
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Check if a vote is treasury-related based on metadata keywords
 */
export function isTreasuryVote(vote: DRepVote): boolean {
  const searchText = [
    vote.meta_json?.title,
    vote.meta_json?.abstract,
    vote.meta_json?.motivation,
    vote.meta_json?.rationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return TREASURY_KEYWORDS.some((keyword) => searchText.includes(keyword));
}

/**
 * Calculate alignment breakdown per preference category (legacy)
 */
export function calculateAlignmentBreakdown(
  drep: EnrichedDRep,
  votes: DRepVote[],
  prefs: UserPrefKey[],
): AlignmentBreakdown {
  return calculateScorecard(drep, votes, [], prefs).scores;
}

/**
 * Calculate overall alignment percentage (0-100)
 */
export function calculateAlignment(
  drep: EnrichedDRep,
  votes: DRepVote[],
  prefs: UserPrefKey[],
): number {
  if (prefs.length === 0) return 50;
  return calculateAlignmentBreakdown(drep, votes, prefs).overall;
}

/**
 * Get human-readable preference label
 */
export function getPrefLabel(pref: UserPrefKey): string {
  const labels: Record<UserPrefKey, string> = {
    'treasury-conservative': 'Treasury Conservative',
    'smart-treasury-growth': 'Treasury Growth-Oriented',
    'strong-decentralization': 'Decentralization First',
    'protocol-security-first': 'Protocol Security & Stability',
    'innovation-defi-growth': 'Innovation & DeFi Growth',
    'responsible-governance': 'Transparency & Accountability',
  };
  return labels[pref] || pref;
}

/**
 * Get alignment badge color based on percentage
 */
export function getAlignmentColor(alignment: number): string {
  if (alignment >= 70)
    return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
  if (alignment >= 50)
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
}

// ============================================================================
// DREP TRAIT TAGS (derived from pre-computed alignment scores)
// ============================================================================

interface TraitRule {
  field: keyof Pick<
    EnrichedDRep,
    | 'alignmentTreasuryConservative'
    | 'alignmentTreasuryGrowth'
    | 'alignmentDecentralization'
    | 'alignmentSecurity'
    | 'alignmentInnovation'
    | 'alignmentTransparency'
  >;
  threshold: number;
  direction: 'gte' | 'lte';
  label: string;
}

// Thresholds tuned for percentile-normalized distribution (uniform 0-100)
const TRAIT_RULES: TraitRule[] = [
  {
    field: 'alignmentTreasuryConservative',
    threshold: 70,
    direction: 'gte',
    label: 'Cautious on treasury spending',
  },
  {
    field: 'alignmentTreasuryGrowth',
    threshold: 70,
    direction: 'gte',
    label: 'Supports strategic treasury use',
  },
  {
    field: 'alignmentDecentralization',
    threshold: 70,
    direction: 'gte',
    label: 'Decentralization advocate',
  },
  { field: 'alignmentSecurity', threshold: 70, direction: 'gte', label: 'Security-first voter' },
  {
    field: 'alignmentInnovation',
    threshold: 70,
    direction: 'gte',
    label: 'Supports innovation & growth',
  },
  {
    field: 'alignmentTransparency',
    threshold: 70,
    direction: 'gte',
    label: 'Detailed rationale provider',
  },
  {
    field: 'alignmentTreasuryConservative',
    threshold: 30,
    direction: 'lte',
    label: 'Open to treasury spending',
  },
  { field: 'alignmentSecurity', threshold: 30, direction: 'lte', label: 'Favors protocol changes' },
  {
    field: 'alignmentInnovation',
    threshold: 30,
    direction: 'lte',
    label: 'Conservative on changes',
  },
  {
    field: 'alignmentTransparency',
    threshold: 30,
    direction: 'lte',
    label: 'Minimal rationale provider',
  },
];

const MAX_TAGS = 3;

/**
 * Derive human-readable behavioral trait tags from a DRep's pre-computed alignment scores.
 * Returns up to MAX_TAGS labels, prioritizing the most distinctive traits (furthest from 50).
 */
export function getDRepTraitTags(drep: EnrichedDRep): string[] {
  const matches: { label: string; distance: number }[] = [];

  for (const rule of TRAIT_RULES) {
    const value = drep[rule.field];
    if (value == null) continue;
    const passes = rule.direction === 'gte' ? value >= rule.threshold : value <= rule.threshold;
    if (passes) {
      matches.push({ label: rule.label, distance: Math.abs(value - 50) });
    }
  }

  matches.sort((a, b) => b.distance - a.distance);

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const m of matches) {
    if (seen.has(m.label)) continue;
    seen.add(m.label);
    tags.push(m.label);
    if (tags.length >= MAX_TAGS) break;
  }

  return tags;
}

// ============================================================================
// PRE-COMPUTED ALIGNMENT (used by sync route and client)
// ============================================================================

export interface AllCategoryScores {
  alignmentTreasuryConservative: number;
  alignmentTreasuryGrowth: number;
  alignmentDecentralization: number;
  alignmentSecurity: number;
  alignmentInnovation: number;
  alignmentTransparency: number;
  lastVoteTime: number | null;
}

/**
 * Compute all 6 per-category alignment scores for a DRep.
 * Called during sync to pre-compute scores stored in the dreps table.
 */
export function computeAllCategoryScores(
  drep: EnrichedDRep,
  votes: DRepVote[],
  classifiedProposals: ClassifiedProposal[],
): AllCategoryScores {
  const votesWithProposals = matchVotesToProposals(votes, classifiedProposals);

  const lastVoteTime = votes.length > 0 ? Math.max(...votes.map((v) => v.block_time)) : null;

  return {
    alignmentTreasuryConservative: calculateTreasuryConservativeScore(votesWithProposals),
    alignmentTreasuryGrowth: calculateTreasuryGrowthScore(votesWithProposals),
    alignmentDecentralization: calculateDecentralizationScore(drep),
    alignmentSecurity: calculateSecurityScore(drep, votesWithProposals),
    alignmentInnovation: calculateInnovationScore(drep, votesWithProposals),
    alignmentTransparency: calculateTransparencyScore(drep),
    lastVoteTime,
  };
}

/**
 * Compute overall alignment from pre-computed per-category scores on an EnrichedDRep.
 * Client-side utility: picks relevant categories based on user prefs and averages them.
 */
export function computeOverallAlignment(drep: EnrichedDRep, prefs: UserPrefKey[]): number {
  if (prefs.length === 0) return 50;

  const activeScores: number[] = [];

  if (prefs.includes('treasury-conservative') && drep.alignmentTreasuryConservative != null) {
    activeScores.push(drep.alignmentTreasuryConservative);
  } else if (prefs.includes('smart-treasury-growth') && drep.alignmentTreasuryGrowth != null) {
    activeScores.push(drep.alignmentTreasuryGrowth);
  }

  if (prefs.includes('strong-decentralization') && drep.alignmentDecentralization != null) {
    activeScores.push(drep.alignmentDecentralization);
  }

  if (prefs.includes('protocol-security-first') && drep.alignmentSecurity != null) {
    activeScores.push(drep.alignmentSecurity);
  }

  if (prefs.includes('innovation-defi-growth') && drep.alignmentInnovation != null) {
    activeScores.push(drep.alignmentInnovation);
  }

  if (prefs.includes('responsible-governance') && drep.alignmentTransparency != null) {
    activeScores.push(drep.alignmentTransparency);
  }

  if (activeScores.length === 0) return 50;

  return Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);
}

/**
 * Build an AlignmentBreakdown from pre-computed scores on an EnrichedDRep.
 */
export function getPrecomputedBreakdown(
  drep: EnrichedDRep,
  prefs: UserPrefKey[],
): AlignmentBreakdown {
  return {
    treasury: prefs.includes('treasury-conservative')
      ? (drep.alignmentTreasuryConservative ?? 50)
      : prefs.includes('smart-treasury-growth')
        ? (drep.alignmentTreasuryGrowth ?? 50)
        : 50,
    decentralization: drep.alignmentDecentralization ?? 50,
    security: drep.alignmentSecurity ?? 50,
    innovation: drep.alignmentInnovation ?? 50,
    transparency: drep.alignmentTransparency ?? 50,
    overall: computeOverallAlignment(drep, prefs),
  };
}
