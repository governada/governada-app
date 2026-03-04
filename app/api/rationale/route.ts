/**
 * Rationale Fetch API Route (DEPRECATED)
 *
 * Rationale text is now fetched and cached during the sync cron job.
 * This endpoint is kept as a no-op to avoid 404s from any stale client calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(async (request, { requestId }) => {
  return NextResponse.json(
    {
      results: [],
      message:
        'Rationale fetching has moved to the sync pipeline. Data is available from Supabase.',
    },
    { status: 200 },
  );
});
