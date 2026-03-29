/**
 * Review Session API
 *
 * POST /api/workspace/review-session
 *
 * Persists batch review session data. Called periodically by the client
 * (every 5 reviews) and on page unload via sendBeacon.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { voterId, startedAt, reviewed, totalSeconds, avgSecondsPerProposal } = body;

    if (!voterId || !startedAt) {
      return NextResponse.json({ error: 'Missing voterId or startedAt' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    await supabase.from('review_sessions').upsert(
      {
        voter_id: voterId,
        started_at: startedAt,
        last_activity_at: new Date().toISOString(),
        proposals_reviewed: reviewed ?? 0,
        total_time_seconds: totalSeconds ?? 0,
        avg_seconds_per_proposal: avgSecondsPerProposal ?? null,
        session_data: body,
      },
      { onConflict: 'voter_id,started_at' },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[review-session] Persist error', { error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
