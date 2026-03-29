/**
 * Proposal Engagement Analytics API
 *
 * GET /api/workspace/engagement?txHash=<hash>&index=<num>
 *
 * Aggregates engagement events for a proposal: views, time spent,
 * section distribution, and viewer segment breakdown.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
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

    try {
      const supabase = getSupabaseAdmin();

      // Total views
      const { count: totalViews } = await supabase
        .from('proposal_engagement_events')
        .select('*', { count: 'exact', head: true })
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .eq('event_type', 'view');

      // Unique viewers
      const { data: uniqueData } = await supabase
        .from('proposal_engagement_events')
        .select('user_id')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .eq('event_type', 'view')
        .not('user_id', 'is', null);

      const uniqueViewerIds = new Set((uniqueData ?? []).map((r) => r.user_id));

      // Average time spent (from section_read events)
      const { data: readEvents } = await supabase
        .from('proposal_engagement_events')
        .select('duration_seconds')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .eq('event_type', 'section_read')
        .not('duration_seconds', 'is', null);

      const durations = (readEvents ?? [])
        .map((r) => r.duration_seconds)
        .filter((d): d is number => d != null && d > 0);
      const avgTimeSpentSec =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

      // Section distribution
      const { data: sectionData } = await supabase
        .from('proposal_engagement_events')
        .select('section')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .eq('event_type', 'section_read')
        .not('section', 'is', null);

      const sectionCounts = new Map<string, number>();
      for (const row of sectionData ?? []) {
        if (row.section) {
          sectionCounts.set(row.section, (sectionCounts.get(row.section) ?? 0) + 1);
        }
      }
      const sectionDistribution = Array.from(sectionCounts.entries())
        .map(([section, viewCount]) => ({ section, viewCount }))
        .sort((a, b) => b.viewCount - a.viewCount);

      // Viewer segments
      const { data: segmentData } = await supabase
        .from('proposal_engagement_events')
        .select('user_segment')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .eq('event_type', 'view')
        .not('user_segment', 'is', null);

      const segmentCounts = new Map<string, number>();
      for (const row of segmentData ?? []) {
        if (row.user_segment) {
          segmentCounts.set(row.user_segment, (segmentCounts.get(row.user_segment) ?? 0) + 1);
        }
      }
      const viewerSegments = Array.from(segmentCounts.entries())
        .map(([segment, count]) => ({ segment, count }))
        .sort((a, b) => b.count - a.count);

      const analytics: ProposalEngagementAnalytics = {
        totalViews: totalViews ?? 0,
        uniqueViewers: uniqueViewerIds.size,
        avgTimeSpentSec,
        sectionDistribution,
        viewerSegments,
      };

      return NextResponse.json(analytics);
    } catch (err) {
      logger.error('[EngagementAnalytics] Query error', { error: err });
      // Return empty analytics on error so the widget still renders
      const emptyAnalytics: ProposalEngagementAnalytics = {
        totalViews: 0,
        uniqueViewers: 0,
        avgTimeSpentSec: 0,
        sectionDistribution: [],
        viewerSegments: [],
      };
      return NextResponse.json(emptyAnalytics);
    }
  },
  { auth: 'required' },
);
