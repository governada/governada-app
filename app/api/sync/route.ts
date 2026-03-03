/**
 * @deprecated — This monolithic sync has been permanently retired.
 *
 * Use the focused sync routes instead:
 *   /api/sync/dreps      (every 6h) — Core DRep enrichment
 *   /api/sync/votes      (every 6h) — Bulk votes + reconciliation
 *   /api/sync/proposals  (every 30m) — Proposals + voting summaries
 *   /api/sync/secondary  (every 6h) — Delegators, power, integrity
 *   /api/sync/slow       (daily)     — Rationales, AI, links, hashes
 *
 * All syncs are orchestrated via Inngest. See inngest/functions/ for details.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'This monolithic sync route has been retired. Use the focused sync routes: /api/sync/dreps, /api/sync/votes, /api/sync/proposals, /api/sync/secondary, /api/sync/slow',
    },
    { status: 410 },
  );
}
