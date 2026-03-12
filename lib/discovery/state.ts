/**
 * Discovery state engine — localStorage-persisted progress tracking
 * for the Discovery Layer (tours, features, milestones, nudges).
 *
 * Pure TypeScript module with no React imports — testable with Vitest.
 */

const STORAGE_KEY = 'governada_discovery';

/* ─── State shape ────────────────────────────────────── */

export interface DiscoveryState {
  /** Sections the user has visited at least once */
  sectionsVisited: string[];
  /** Tour IDs the user has completed */
  toursCompleted: string[];
  /** Currently active tour ID (null if none) */
  tourInProgress: string | null;
  /** Current step index within the active tour */
  tourStepIndex: number;
  /** Feature IDs the user has explored */
  featuresExplored: string[];
  /** Timestamp of last nudge dismiss (null if never) */
  nudgeDismissedAt: number | null;
  /** Lifetime count of nudge impressions */
  nudgeShownCount: number;
  /** Timestamp when user connected wallet after nudge */
  nudgeConvertedAt: number | null;
  /** Milestone IDs already celebrated */
  milestonesShown: string[];
  /** Times the Discovery Hub panel was opened */
  hubOpenedCount: number;
  /** Session timestamp for engagement nudge timing */
  firstPageViewAt: number | null;
  /** Pages viewed this session (resets on new session) */
  pageViewCount: number;
  /** Whether the FAB pulse has been stopped (user opened hub once) */
  fabPulseStopped: boolean;
}

const DEFAULT_STATE: DiscoveryState = {
  sectionsVisited: [],
  toursCompleted: [],
  tourInProgress: null,
  tourStepIndex: 0,
  featuresExplored: [],
  nudgeDismissedAt: null,
  nudgeShownCount: 0,
  nudgeConvertedAt: null,
  milestonesShown: [],
  hubOpenedCount: 0,
  firstPageViewAt: null,
  pageViewCount: 0,
  fabPulseStopped: false,
};

/* ─── Core read/write ────────────────────────────────── */

export function getDiscoveryState(): DiscoveryState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function updateDiscoveryState(partial: Partial<DiscoveryState>): DiscoveryState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE, ...partial };
  const current = getDiscoveryState();
  const updated = { ...current, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* localStorage may be full or disabled */
  }
  return updated;
}

/* ─── Section tracking ───────────────────────────────── */

/** Mark a section as visited. Returns true if this was the first visit. */
export function markSectionVisited(section: string): boolean {
  const state = getDiscoveryState();
  if (state.sectionsVisited.includes(section)) return false;
  updateDiscoveryState({
    sectionsVisited: [...state.sectionsVisited, section],
  });
  return true;
}

/* ─── Tour management ────────────────────────────────── */

export function startTour(tourId: string): void {
  updateDiscoveryState({
    tourInProgress: tourId,
    tourStepIndex: 0,
  });
}

export function advanceTourStep(): number {
  const state = getDiscoveryState();
  const nextIndex = state.tourStepIndex + 1;
  updateDiscoveryState({ tourStepIndex: nextIndex });
  return nextIndex;
}

export function completeTour(): void {
  const state = getDiscoveryState();
  const tourId = state.tourInProgress;
  if (!tourId) return;
  const completed = state.toursCompleted.includes(tourId)
    ? state.toursCompleted
    : [...state.toursCompleted, tourId];
  updateDiscoveryState({
    tourInProgress: null,
    tourStepIndex: 0,
    toursCompleted: completed,
  });
}

export function cancelTour(): void {
  updateDiscoveryState({
    tourInProgress: null,
    tourStepIndex: 0,
  });
}

/* ─── Feature exploration ────────────────────────────── */

export function markFeatureExplored(featureId: string): void {
  const state = getDiscoveryState();
  if (state.featuresExplored.includes(featureId)) return;
  updateDiscoveryState({
    featuresExplored: [...state.featuresExplored, featureId],
  });
}

export function getExplorationProgress(totalFeatures: number): {
  explored: number;
  total: number;
  percent: number;
} {
  const state = getDiscoveryState();
  const explored = state.featuresExplored.length;
  return {
    explored,
    total: totalFeatures,
    percent: totalFeatures > 0 ? Math.round((explored / totalFeatures) * 100) : 0,
  };
}

/* ─── Engagement nudges ──────────────────────────────── */

const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const NUDGE_MAX_IMPRESSIONS = 3;
const NUDGE_TIME_THRESHOLD_MS = 45 * 1000; // 45 seconds
const NUDGE_PAGEVIEW_THRESHOLD = 3;

export function recordPageView(): void {
  const state = getDiscoveryState();
  updateDiscoveryState({
    firstPageViewAt: state.firstPageViewAt ?? Date.now(),
    pageViewCount: state.pageViewCount + 1,
  });
}

export function shouldShowNudge(): boolean {
  const state = getDiscoveryState();

  // Already converted
  if (state.nudgeConvertedAt) return false;

  // Lifetime cap
  if (state.nudgeShownCount >= NUDGE_MAX_IMPRESSIONS) return false;

  // Cooldown
  if (state.nudgeDismissedAt && Date.now() - state.nudgeDismissedAt < NUDGE_COOLDOWN_MS) {
    return false;
  }

  // Time threshold OR page view threshold
  const elapsed = state.firstPageViewAt ? Date.now() - state.firstPageViewAt : 0;
  return elapsed >= NUDGE_TIME_THRESHOLD_MS || state.pageViewCount >= NUDGE_PAGEVIEW_THRESHOLD;
}

export function markNudgeShown(): void {
  const state = getDiscoveryState();
  updateDiscoveryState({ nudgeShownCount: state.nudgeShownCount + 1 });
}

export function markNudgeDismissed(): void {
  updateDiscoveryState({ nudgeDismissedAt: Date.now() });
}

export function markNudgeConverted(): void {
  updateDiscoveryState({ nudgeConvertedAt: Date.now() });
}

/* ─── Milestones ─────────────────────────────────────── */

export function shouldCelebrateMilestone(milestoneId: string): boolean {
  const state = getDiscoveryState();
  return !state.milestonesShown.includes(milestoneId);
}

export function markMilestoneCelebrated(milestoneId: string): void {
  const state = getDiscoveryState();
  if (state.milestonesShown.includes(milestoneId)) return;
  updateDiscoveryState({
    milestonesShown: [...state.milestonesShown, milestoneId],
  });
}

/* ─── Hub tracking ───────────────────────────────────── */

export function markHubOpened(): void {
  const state = getDiscoveryState();
  updateDiscoveryState({
    hubOpenedCount: state.hubOpenedCount + 1,
    fabPulseStopped: true,
  });
}

/* ─── Reset (for testing) ────────────────────────────── */

export function resetDiscoveryState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
