/**
 * Progressive match confidence scoring.
 *
 * Confidence grows as the user provides more data sources:
 * - Quiz answers (Quick Match 3-question quiz): 20% max
 * - Poll votes (Governance DNA Quiz real-proposal votes): 35% max
 * - Proposal type diversity (votes spanning different proposal types): 10% max
 * - Engagement signals (sentiment, endorsements, concern flags, etc.): 10% max
 * - Delegation confirmation (active delegation to any DRep): 15% max
 * - Treasury judgment (accountability poll votes on funded proposals): 10% max
 *
 * Total max: 100%
 */

/* ─── Types ────────────────────────────────────────────── */

export interface ConfidenceSource {
  /** Identifier for this confidence source */
  key: ConfidenceSourceKey;
  /** Human-readable label */
  label: string;
  /** Current contribution to confidence (0-100 scale) */
  score: number;
  /** Maximum possible contribution */
  maxScore: number;
  /** Current input count/value for this source */
  current: number;
  /** Target input count/value for full contribution */
  target: number;
  /** Whether this source has been started (any contribution) */
  active: boolean;
}

export type ConfidenceSourceKey =
  | 'quizAnswers'
  | 'pollVotes'
  | 'proposalDiversity'
  | 'engagement'
  | 'delegation'
  | 'treasuryJudgment';

export interface ConfidenceBreakdown {
  /** Overall confidence score (0-100) */
  overall: number;
  /** Individual source contributions */
  sources: ConfidenceSource[];
  /** Next recommended action to improve confidence */
  nextAction: ConfidenceAction | null;
}

export interface ConfidenceAction {
  /** Action type for routing */
  type:
    | 'take_quiz'
    | 'vote_proposals'
    | 'diversify_votes'
    | 'engage'
    | 'delegate'
    | 'treasury_engage';
  /** Short description */
  label: string;
  /** Longer description */
  description: string;
  /** Link to navigate to */
  href: string;
  /** Potential confidence gain from this action */
  potentialGain: number;
}

/* ─── Weights ──────────────────────────────────────────── */

const WEIGHTS = {
  quizAnswers: 20,
  pollVotes: 35,
  proposalDiversity: 10,
  engagement: 10,
  delegation: 15,
  treasuryJudgment: 10,
} as const;

const TARGETS = {
  quizAnswers: 4, // 4 quick match questions (treasury, protocol, transparency, decentralization)
  pollVotes: 15, // 15 proposal votes for full confidence
  proposalDiversity: 4, // 4 out of 6 proposal types
  engagement: 10, // 10 engagement actions
  delegation: 1, // 1 active delegation
  treasuryJudgment: 5, // 5 treasury accountability judgments
} as const;

/* ─── Input data ───────────────────────────────────────── */

export interface ConfidenceInputs {
  /** Number of quick match quiz answers */
  quizAnswerCount: number;
  /** Number of poll votes on real proposals */
  pollVoteCount: number;
  /** Number of distinct proposal types voted on */
  proposalTypesVoted: number;
  /** Total engagement actions (sentiment + endorsements + concern flags + impact tags + priority signals) */
  engagementActionCount: number;
  /** Whether user has an active DRep delegation */
  hasDelegation: boolean;
  /** Number of treasury accountability judgments (poll votes on funded proposal outcomes) */
  treasuryJudgmentCount?: number;
}

/* ─── Core calculation ─────────────────────────────────── */

/**
 * Calculate progressive confidence from multiple data sources.
 * Returns a full breakdown with source contributions and next-action CTA.
 */
export function calculateProgressiveConfidence(inputs: ConfidenceInputs): ConfidenceBreakdown {
  const sources: ConfidenceSource[] = [
    {
      key: 'quizAnswers',
      label: 'Quick Match quiz',
      score: sourceScore(inputs.quizAnswerCount, TARGETS.quizAnswers, WEIGHTS.quizAnswers),
      maxScore: WEIGHTS.quizAnswers,
      current: Math.min(inputs.quizAnswerCount, TARGETS.quizAnswers),
      target: TARGETS.quizAnswers,
      active: inputs.quizAnswerCount > 0,
    },
    {
      key: 'pollVotes',
      label: 'Proposal votes',
      score: sourceScore(inputs.pollVoteCount, TARGETS.pollVotes, WEIGHTS.pollVotes),
      maxScore: WEIGHTS.pollVotes,
      current: Math.min(inputs.pollVoteCount, TARGETS.pollVotes),
      target: TARGETS.pollVotes,
      active: inputs.pollVoteCount > 0,
    },
    {
      key: 'proposalDiversity',
      label: 'Vote diversity',
      score: sourceScore(
        inputs.proposalTypesVoted,
        TARGETS.proposalDiversity,
        WEIGHTS.proposalDiversity,
      ),
      maxScore: WEIGHTS.proposalDiversity,
      current: Math.min(inputs.proposalTypesVoted, TARGETS.proposalDiversity),
      target: TARGETS.proposalDiversity,
      active: inputs.proposalTypesVoted > 0,
    },
    {
      key: 'engagement',
      label: 'Civic engagement',
      score: sourceScore(inputs.engagementActionCount, TARGETS.engagement, WEIGHTS.engagement),
      maxScore: WEIGHTS.engagement,
      current: Math.min(inputs.engagementActionCount, TARGETS.engagement),
      target: TARGETS.engagement,
      active: inputs.engagementActionCount > 0,
    },
    {
      key: 'delegation',
      label: 'DRep delegation',
      score: inputs.hasDelegation ? WEIGHTS.delegation : 0,
      maxScore: WEIGHTS.delegation,
      current: inputs.hasDelegation ? 1 : 0,
      target: TARGETS.delegation,
      active: inputs.hasDelegation,
    },
    {
      key: 'treasuryJudgment',
      label: 'Treasury judgment',
      score: sourceScore(
        inputs.treasuryJudgmentCount ?? 0,
        TARGETS.treasuryJudgment,
        WEIGHTS.treasuryJudgment,
      ),
      maxScore: WEIGHTS.treasuryJudgment,
      current: Math.min(inputs.treasuryJudgmentCount ?? 0, TARGETS.treasuryJudgment),
      target: TARGETS.treasuryJudgment,
      active: (inputs.treasuryJudgmentCount ?? 0) > 0,
    },
  ];

  const overall = Math.round(sources.reduce((sum, s) => sum + s.score, 0));
  const nextAction = getNextAction(sources, inputs);

  return { overall, sources, nextAction };
}

function sourceScore(current: number, target: number, weight: number): number {
  const ratio = Math.min(1, current / target);
  return Math.round(ratio * weight * 10) / 10;
}

/* ─── Next action recommendation ───────────────────────── */

function getNextAction(
  sources: ConfidenceSource[],
  inputs: ConfidenceInputs,
): ConfidenceAction | null {
  // Find the source with the highest remaining potential gain
  const actions: ConfidenceAction[] = [];

  for (const source of sources) {
    const gap = source.maxScore - source.score;
    if (gap <= 0) continue;

    switch (source.key) {
      case 'quizAnswers':
        if (inputs.quizAnswerCount === 0) {
          actions.push({
            type: 'take_quiz',
            label: 'Take the Quick Match quiz',
            description:
              'Answer 4 questions about your governance values to establish a baseline match profile.',
            href: '/match',
            potentialGain: gap,
          });
        }
        break;
      case 'pollVotes':
        actions.push({
          type: 'vote_proposals',
          label: 'Vote on governance proposals',
          description: `Vote on ${TARGETS.pollVotes - inputs.pollVoteCount} more real proposals to strengthen your governance profile.`,
          href: '/match/vote',
          potentialGain: gap,
        });
        break;
      case 'proposalDiversity':
        actions.push({
          type: 'diversify_votes',
          label: 'Vote on different proposal types',
          description:
            'Broaden your profile by voting on treasury, protocol, and governance proposals.',
          href: '/match/vote',
          potentialGain: gap,
        });
        break;
      case 'engagement':
        actions.push({
          type: 'engage',
          label: 'Share your civic voice',
          description:
            'Express sentiment on proposals, flag concerns, or endorse DReps to deepen your profile.',
          href: '/engage',
          potentialGain: gap,
        });
        break;
      case 'delegation':
        actions.push({
          type: 'delegate',
          label: 'Delegate to a DRep',
          description: 'Confirm your governance values by delegating to a DRep who represents you.',
          href: '/governance/representatives',
          potentialGain: gap,
        });
        break;
      case 'treasuryJudgment':
        actions.push({
          type: 'treasury_engage',
          label: 'Rate treasury outcomes',
          description:
            'Judge whether funded proposals delivered on their promises to sharpen your fiscal alignment.',
          href: '/governance/treasury',
          potentialGain: gap,
        });
        break;
    }
  }

  // Return the action with highest potential gain
  actions.sort((a, b) => b.potentialGain - a.potentialGain);
  return actions[0] ?? null;
}

/* ─── Backward-compatible wrapper ──────────────────────── */

/**
 * Legacy confidence calculation based on vote overlap count only.
 * Used in per-DRep match confidence (how many votes overlap with a specific DRep).
 */
const FULL_CONFIDENCE_THRESHOLD = 15;

export function calculateMatchConfidence(overlapCount: number): number {
  return Math.min(100, Math.round((overlapCount / FULL_CONFIDENCE_THRESHOLD) * 100));
}
