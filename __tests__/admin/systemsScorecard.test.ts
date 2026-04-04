import { describe, expect, it } from 'vitest';
import { buildSystemsScorecardSync } from '@/lib/admin/systemsScorecard';

const reviewHistory = [
  {
    id: 'f6975ae8-8f56-4fcb-bf9a-fc49e5d23f6a',
    reviewDate: '2026-04-01',
    reviewedAt: '2026-04-01T12:00:00.000Z',
    overallStatus: 'warning' as const,
    focusArea: 'Freshness and review discipline',
    summary: 'Freshness drift needs a tighter founder loop.',
    topRisk: 'Fast sync is drifting.',
    changeNotes: 'Logged a fresh weekly review and named the next commitment.',
    linkedSloIds: ['freshness', 'journeys'],
    commitment: {
      id: '7f1f16c7-b91c-43a0-b4ec-c2e4bbf07cf9',
      title: 'Repair freshness drift',
      owner: 'Founder + agents',
      status: 'planned' as const,
      dueDate: '2026-04-05',
    },
  },
  {
    id: 'a4fd629f-266b-4cb7-abbb-bd9ed95f9ca1',
    reviewDate: '2026-03-25',
    reviewedAt: '2026-03-25T12:00:00.000Z',
    overallStatus: 'critical' as const,
    focusArea: 'Launch risk reset',
    summary: 'The operating loop was stale and critical paths were weak.',
    topRisk: 'Critical journeys were not guarded well enough.',
    changeNotes: 'Reset the weekly systems loop.',
    linkedSloIds: ['journeys'],
    commitment: {
      id: '4c794d1c-bc7b-4fa4-b4fb-8f816f745e86',
      title: 'Restore critical journey confidence',
      owner: 'Founder + agents',
      status: 'blocked' as const,
      dueDate: '2026-03-29',
    },
  },
];

describe('systems scorecard helpers', () => {
  it('marks scorecard sync critical when no review history exists', () => {
    const sync = buildSystemsScorecardSync({
      reviewHistory: [],
      liveStatus: 'warning',
      liveConcernSloIds: ['freshness'],
      now: new Date('2026-04-04T12:00:00.000Z'),
    });

    expect(sync.status).toBe('critical');
    expect(sync.reviewCount).toBe(0);
    expect(sync.driftSloIds).toEqual(['freshness']);
  });

  it('tracks weekly streak, trend, and hotspots when scorecard is aligned', () => {
    const sync = buildSystemsScorecardSync({
      reviewHistory,
      liveStatus: 'warning',
      liveConcernSloIds: ['freshness', 'journeys'],
      now: new Date('2026-04-04T12:00:00.000Z'),
    });

    expect(sync.status).toBe('good');
    expect(sync.weeklyStreak).toBe(2);
    expect(sync.trend).toBe('improving');
    expect(sync.hotspotSloIds).toEqual(['journeys', 'freshness']);
    expect(sync.recentReviews[0]?.commitmentTitle).toBe('Repair freshness drift');
  });

  it('warns when the live cockpit drifts beyond the last reviewed scorecard focus', () => {
    const sync = buildSystemsScorecardSync({
      reviewHistory,
      liveStatus: 'critical',
      liveConcernSloIds: ['correctness', 'freshness'],
      now: new Date('2026-04-04T12:00:00.000Z'),
    });

    expect(sync.status).toBe('warning');
    expect(sync.driftSloIds).toEqual(['correctness']);
    expect(sync.summary).toMatch(/refresh the scorecard/i);
  });
});
