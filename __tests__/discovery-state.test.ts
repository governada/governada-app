// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDiscoveryState,
  updateDiscoveryState,
  markSectionVisited,
  startTour,
  advanceTourStep,
  completeTour,
  cancelTour,
  markFeatureExplored,
  shouldShowNudge,
  recordPageView,
  markNudgeDismissed,
  markNudgeConverted,
  shouldCelebrateMilestone,
  markMilestoneCelebrated,
  markHubOpened,
  resetDiscoveryState,
} from '@/lib/discovery/state';

beforeEach(() => {
  resetDiscoveryState();
});

describe('getDiscoveryState', () => {
  it('returns default state when nothing stored', () => {
    const state = getDiscoveryState();
    expect(state.sectionsVisited).toEqual([]);
    expect(state.toursCompleted).toEqual([]);
    expect(state.tourInProgress).toBeNull();
    expect(state.featuresExplored).toEqual([]);
    expect(state.nudgeShownCount).toBe(0);
    expect(state.milestonesShown).toEqual([]);
  });
});

describe('markSectionVisited', () => {
  it('returns true on first visit', () => {
    expect(markSectionVisited('governance')).toBe(true);
  });

  it('returns false on repeat visit', () => {
    markSectionVisited('governance');
    expect(markSectionVisited('governance')).toBe(false);
  });

  it('tracks multiple sections', () => {
    markSectionVisited('governance');
    markSectionVisited('match');
    const state = getDiscoveryState();
    expect(state.sectionsVisited).toEqual(['governance', 'match']);
  });
});

describe('tour management', () => {
  it('starts a tour', () => {
    startTour('hub-citizen');
    const state = getDiscoveryState();
    expect(state.tourInProgress).toBe('hub-citizen');
    expect(state.tourStepIndex).toBe(0);
  });

  it('advances tour step', () => {
    startTour('hub-citizen');
    const next = advanceTourStep();
    expect(next).toBe(1);
    expect(getDiscoveryState().tourStepIndex).toBe(1);
  });

  it('completes a tour', () => {
    startTour('hub-citizen');
    completeTour();
    const state = getDiscoveryState();
    expect(state.tourInProgress).toBeNull();
    expect(state.tourStepIndex).toBe(0);
    expect(state.toursCompleted).toContain('hub-citizen');
  });

  it('does not duplicate completed tours', () => {
    startTour('hub-citizen');
    completeTour();
    startTour('hub-citizen');
    completeTour();
    expect(getDiscoveryState().toursCompleted).toEqual(['hub-citizen']);
  });

  it('cancels a tour without completing', () => {
    startTour('hub-citizen');
    cancelTour();
    const state = getDiscoveryState();
    expect(state.tourInProgress).toBeNull();
    expect(state.toursCompleted).toEqual([]);
  });
});

describe('feature exploration', () => {
  it('marks features explored', () => {
    markFeatureExplored('browse-proposals');
    expect(getDiscoveryState().featuresExplored).toContain('browse-proposals');
  });

  it('does not duplicate features', () => {
    markFeatureExplored('browse-proposals');
    markFeatureExplored('browse-proposals');
    expect(getDiscoveryState().featuresExplored).toEqual(['browse-proposals']);
  });
});

describe('engagement nudges', () => {
  it('does not show nudge initially', () => {
    expect(shouldShowNudge()).toBe(false);
  });

  it('shows nudge after enough page views', () => {
    recordPageView();
    recordPageView();
    recordPageView();
    expect(shouldShowNudge()).toBe(true);
  });

  it('respects cooldown after dismiss', () => {
    recordPageView();
    recordPageView();
    recordPageView();
    markNudgeDismissed();
    expect(shouldShowNudge()).toBe(false);
  });

  it('stops after conversion', () => {
    recordPageView();
    recordPageView();
    recordPageView();
    markNudgeConverted();
    expect(shouldShowNudge()).toBe(false);
  });
});

describe('milestones', () => {
  it('allows celebrating a new milestone', () => {
    expect(shouldCelebrateMilestone('first-proposal-view')).toBe(true);
  });

  it('prevents re-celebrating', () => {
    markMilestoneCelebrated('first-proposal-view');
    expect(shouldCelebrateMilestone('first-proposal-view')).toBe(false);
  });
});

describe('hub tracking', () => {
  it('increments hub opened count and stops pulse', () => {
    markHubOpened();
    const state = getDiscoveryState();
    expect(state.hubOpenedCount).toBe(1);
    expect(state.fabPulseStopped).toBe(true);
  });
});
