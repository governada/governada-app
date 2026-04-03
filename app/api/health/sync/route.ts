import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { SYNC_FRESHNESS_POLICY } from '@/lib/syncPolicy';

export const dynamic = 'force-dynamic';

/**
 * Simple sync liveness endpoint for external monitors (BetterStack, UptimeRobot).
 * Returns HTTP 200 when core syncs are healthy, 503 when critical.
 * Designed for simple HTTP status code checks — no auth required.
 */

const CORE_SYNCS = ['proposals', 'dreps', 'scoring', 'alignment'] as const;

const CRITICAL_THRESHOLDS_MINS: Record<string, number> = {
  proposals: 120, // 2h (runs every 30min)
  dreps: SYNC_FRESHNESS_POLICY.dreps.degradedAfterMinutes,
  scoring: 720, // 12h (runs every 6h)
  alignment: 720, // 12h (runs every 6h)
};

export async function GET() {
  try {
    const supabase = createClient();
    const { data: rows } = await supabase.from('v_sync_health').select('*');

    if (!rows?.length) {
      return NextResponse.json(
        { status: 'unknown', message: 'No sync data available' },
        { status: 503 },
      );
    }

    const now = Date.now();
    const coreStatuses = CORE_SYNCS.map((syncType) => {
      const row = rows.find((r) => r.sync_type === syncType);
      if (!row?.last_run)
        return { type: syncType, stale: true, staleMins: null, lastSuccess: null };
      const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60_000);
      const threshold = CRITICAL_THRESHOLDS_MINS[syncType] ?? 720;
      const lastSuccess = row.last_success as boolean | null;
      // A sync is unhealthy if it's stale OR if it ran recently but failed
      const stale = staleMins > threshold || lastSuccess === false;
      return { type: syncType, stale, staleMins, lastSuccess };
    });

    const criticalCount = coreStatuses.filter((s) => s.stale).length;
    const healthy = criticalCount === 0;

    return NextResponse.json(
      {
        status: healthy ? 'healthy' : 'critical',
        core_syncs: coreStatuses,
        checked_at: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ status: 'error', message: 'Health check failed' }, { status: 503 });
  }
}
