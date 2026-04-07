import { describe, expect, it } from 'vitest';
import {
  buildSystemsTrustSurfaceFollowupTarget,
  buildSystemsTrustSurfaceReviewHistory,
  buildSystemsTrustSurfaceReviewPayload,
  buildSystemsTrustSurfaceReviewSummary,
  parseSystemsTrustSurfaceReviewHistory,
  SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
} from '@/lib/admin/systemsTrustSurface';

describe('systems trust-surface helpers', () => {
  it('normalizes trust-surface review payloads', () => {
    const payload = buildSystemsTrustSurfaceReviewPayload({
      actorType: 'manual',
      reviewDate: '2026-04-06',
      overallStatus: 'warning',
      linkedSloIds: [' freshness ', 'correctness'],
      reviewedSurfaces: ['Home shell', 'Proposal detail', 'Home shell'],
      summary: ' Public surfaces are partially honest during freshness drift. ',
      currentUserState: ' Users still see data, but the stale signal is too subtle. ',
      honestyGap: ' Freshness drift is easy to miss on proposal detail. ',
      nextFix: ' Add clearer stale-data copy to proposal detail and discovery. ',
      owner: ' Founder + agents ',
      artifactUrl: 'https://example.com/review',
      notes: ' Manual degraded-state walkthrough. ',
    });

    expect(payload.linkedSloIds).toEqual(['freshness', 'correctness']);
    expect(payload.reviewedSurfaces).toEqual(['Home shell', 'Proposal detail']);
    expect(payload.owner).toBe('Founder + agents');
  });

  it('builds a missing-review follow-up when degraded trust signals have no review', () => {
    const summary = buildSystemsTrustSurfaceReviewSummary({
      latestReview: null,
      reviewRequired: true,
      concernStatus: 'critical',
      linkedSloIds: ['availability', 'freshness'],
    });

    const target = buildSystemsTrustSurfaceFollowupTarget({
      latestReview: null,
      summary,
    });

    expect(summary.status).toBe('critical');
    expect(target).toMatchObject({
      sourceKey: 'systems:trust-surface-review',
      reason: 'missing',
      severity: 'critical',
    });
  });

  it('parses durable history and marks stale trust reviews', () => {
    const history = parseSystemsTrustSurfaceReviewHistory(
      [
        {
          action: SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
          payload: {
            actorType: 'manual',
            reviewDate: '2026-03-28',
            overallStatus: 'warning',
            linkedSloIds: ['freshness'],
            reviewedSurfaces: ['Home shell', 'Proposal detail'],
            summary: 'Public surfaces still underplay freshness drift.',
            currentUserState: 'Users still see live-looking proposal detail.',
            honestyGap: 'The stale state is not prominent enough.',
            nextFix: 'Add explicit stale-data copy.',
            owner: 'Founder + agents',
          },
          created_at: '2026-04-01T12:00:00.000Z',
        },
      ],
      new Date('2026-04-06T12:00:00.000Z'),
    );

    expect(history[0]).toMatchObject({
      reviewDate: '2026-03-28',
      overallStatus: 'warning',
      isStale: true,
      reviewedSurfaces: ['Home shell', 'Proposal detail'],
    });
  });

  it('builds a clean summary when no degraded-state review is required', () => {
    const summary = buildSystemsTrustSurfaceReviewSummary({
      latestReview: null,
      reviewRequired: false,
      concernStatus: 'good',
      linkedSloIds: [],
    });

    expect(summary.status).toBe('good');
    expect(summary.reviewRequired).toBe(false);
    expect(buildSystemsTrustSurfaceFollowupTarget({ latestReview: null, summary })).toBeNull();
  });

  it('adds trust-surface reviews into the centralized activity history', () => {
    const history = buildSystemsTrustSurfaceReviewHistory([
      {
        action: SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
        payload: {
          actorType: 'manual',
          reviewDate: '2026-04-06',
          overallStatus: 'good',
          linkedSloIds: ['freshness'],
          reviewedSurfaces: ['Home shell'],
          summary: 'The stale-data state is now explicit.',
          currentUserState: 'Users are clearly told the data is stale.',
          honestyGap: 'No major honesty gap remains.',
          nextFix: 'Keep the copy aligned as surfaces change.',
          owner: 'Founder + agents',
        },
        created_at: '2026-04-06T13:00:00.000Z',
      },
    ]);

    expect(history[0]).toMatchObject({
      type: 'trust_surface_review',
      statusLabel: 'Honesty reviewed',
      actionHref: '/admin/systems#trust-surface-review',
    });
  });
});
