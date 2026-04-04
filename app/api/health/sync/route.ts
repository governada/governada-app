import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { CORE_SYNC_TYPES, getExternalSyncHealthLevel, getSyncPolicy } from '@/lib/syncPolicy';

export const dynamic = 'force-dynamic';

/**
 * Simple sync liveness endpoint for external monitors (BetterStack, UptimeRobot).
 * Returns HTTP 200 when core syncs are healthy, 503 when critical.
 * Designed for simple HTTP status code checks — no auth required.
 */
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
    const coreStatuses = CORE_SYNC_TYPES.map((syncType) => {
      const row = rows.find((r) => r.sync_type === syncType);
      if (!row?.last_run)
        return { type: syncType, stale: true, staleMins: null, lastSuccess: null };
      const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60_000);
      const lastSuccess = row.last_success as boolean | null;
      const status = getExternalSyncHealthLevel(syncType, staleMins, lastSuccess);
      const policy = getSyncPolicy(syncType);

      return {
        type: syncType,
        label: policy.label,
        stale: status === 'critical',
        staleMins,
        lastSuccess,
      };
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
