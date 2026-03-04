/**
 * Citizen Engagement Level — recognition system for civic participation.
 * Levels: Registered → Informed → Engaged → Champion.
 * These are recognition, not grades — all participation is valued.
 */

export const ENGAGEMENT_LEVELS = ['Registered', 'Informed', 'Engaged', 'Champion'] as const;
export type EngagementLevel = (typeof ENGAGEMENT_LEVELS)[number];

export interface EngagementInput {
  hasDelegation: boolean;
  epochRecapViewCount: number;
  pollParticipationCount: number;
  shareCount: number;
  visitStreak: number;
  accountAgeDays: number;
}

export interface EngagementResult {
  level: EngagementLevel;
  levelIndex: number;
  nextLevel: EngagementLevel | null;
  progressToNext: number;
  factors: {
    delegation: boolean;
    informed: boolean;
    engaged: boolean;
    champion: boolean;
  };
}

/**
 * Compute citizen engagement level from participation signals.
 *
 * - Registered: created an account / connected wallet
 * - Informed: has delegation + viewed epoch recaps (reads governance info)
 * - Engaged: Informed + participates in polls + 3+ visit streak
 * - Champion: Engaged + shares content + 7+ visit streak
 */
export function computeEngagementLevel(input: EngagementInput): EngagementResult {
  const delegation = input.hasDelegation;
  const informed = delegation && input.epochRecapViewCount >= 1;
  const engaged = informed && input.pollParticipationCount >= 1 && input.visitStreak >= 3;
  const champion = engaged && input.shareCount >= 1 && input.visitStreak >= 7;

  let level: EngagementLevel;
  if (champion) level = 'Champion';
  else if (engaged) level = 'Engaged';
  else if (informed) level = 'Informed';
  else level = 'Registered';

  const levelIndex = ENGAGEMENT_LEVELS.indexOf(level);
  const nextLevel =
    levelIndex < ENGAGEMENT_LEVELS.length - 1 ? ENGAGEMENT_LEVELS[levelIndex + 1] : null;

  let progressToNext = 100;
  if (nextLevel) {
    progressToNext = computeProgress(level, input);
  }

  return {
    level,
    levelIndex,
    nextLevel,
    progressToNext,
    factors: { delegation, informed, engaged, champion },
  };
}

function computeProgress(currentLevel: EngagementLevel, input: EngagementInput): number {
  switch (currentLevel) {
    case 'Registered': {
      let score = 0;
      if (input.hasDelegation) score += 50;
      if (input.epochRecapViewCount >= 1) score += 50;
      return Math.min(99, score);
    }
    case 'Informed': {
      let score = 0;
      if (input.pollParticipationCount >= 1) score += 50;
      score += Math.min(50, (input.visitStreak / 3) * 50);
      return Math.min(99, Math.round(score));
    }
    case 'Engaged': {
      let score = 0;
      if (input.shareCount >= 1) score += 40;
      score += Math.min(60, (input.visitStreak / 7) * 60);
      return Math.min(99, Math.round(score));
    }
    default:
      return 100;
  }
}
