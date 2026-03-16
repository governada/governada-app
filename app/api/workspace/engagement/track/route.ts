/**
 * Engagement Tracking API — records proposal engagement events.
 *
 * POST: record engagement event (anonymous tracking allowed)
 * Rate limited: 100 req/60s per client
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { TrackEngagementSchema } from '@/lib/api/schemas/workspace';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request, ctx) => {
    const body = await request.json();
    const parsed = TrackEngagementSchema.parse(body);

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('proposal_engagement_events').insert({
      proposal_tx_hash: parsed.proposalTxHash,
      proposal_index: parsed.proposalIndex,
      event_type: parsed.eventType,
      section: parsed.section ?? null,
      duration_seconds: parsed.durationSeconds ?? null,
      user_segment: parsed.userSegment ?? null,
      user_id: ctx.userId ?? null,
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
    }

    return NextResponse.json({ recorded: true });
  },
  { auth: 'optional', rateLimit: { max: 100, window: 60 } },
);
