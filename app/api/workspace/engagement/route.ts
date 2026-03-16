/**
 * Proposal Engagement Analytics API
 *
 * GET /api/workspace/engagement?txHash=<hash>&index=<num>
 *
 * Aggregates engagement events for a proposal: views, time spent,
 * section distribution, and viewer segment breakdown.
 *
 * Note: This returns placeholder/mock data until the proposal_engagement_events
 * table is populated by the analytics pipeline. The API contract is stable
 * so the widget can render immediately.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';
import type { ProposalEngagementAnalytics } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request) => {
    const txHash = request.nextUrl.searchParams.get('txHash');
    const indexStr = request.nextUrl.searchParams.get('index');

    if (!txHash || indexStr == null) {
      return NextResponse.json({ error: 'Missing txHash or index' }, { status: 400 });
    }

    const proposalIndex = parseInt(indexStr, 10);
    if (isNaN(proposalIndex)) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    logger.info('[EngagementAnalytics] Fetching engagement data', { txHash, proposalIndex });

    // TODO: Query proposal_engagement_events table once it exists.
    // For now, return empty analytics so the widget renders in its empty state.
    const analytics: ProposalEngagementAnalytics = {
      totalViews: 0,
      uniqueViewers: 0,
      avgTimeSpentSec: 0,
      sectionDistribution: [],
      viewerSegments: [],
    };

    return NextResponse.json(analytics);
  },
  { auth: 'required' },
);
