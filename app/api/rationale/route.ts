/**
 * Rationale Fetch API Route (DEPRECATED)
 *
 * Rationale text is now fetched and cached during the sync cron job.
 * This endpoint is kept as a no-op to avoid 404s from any stale client calls.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      results: [],
      message:
        'Rationale fetching has moved to the sync pipeline. Data is available from Supabase.',
    },
    { status: 200 },
  );
}
