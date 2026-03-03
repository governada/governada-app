import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const THRESHOLDS: Record<string, number> = {
  proposals: 90,
  dreps: 720,
  votes: 720,
  secondary: 2880,
  slow: 2880,
  treasury: 2880,
  full: 1560,
};

export async function GET() {
  try {
    const supabase = createClient();
    const { data: rows } = await supabase.from('v_sync_health').select('*');

    if (!rows?.length) {
      return NextResponse.json({ status: 'unknown', message: 'No sync data', syncs: [] });
    }

    const now = Date.now();
    let worstLevel: 'healthy' | 'degraded' | 'critical' = 'healthy';

    const syncs = rows.map((row) => {
      const staleMins = row.last_run
        ? Math.round((now - new Date(row.last_run).getTime()) / 60000)
        : Infinity;
      const threshold = THRESHOLDS[row.sync_type] ?? 1560;
      const failed = row.last_success === false;
      const stale = staleMins > threshold;

      let level: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (failed) level = 'critical';
      else if (stale) level = staleMins > threshold * 2 ? 'critical' : 'degraded';

      if (level === 'critical') worstLevel = 'critical';
      else if (level === 'degraded' && worstLevel !== 'critical') worstLevel = 'degraded';

      return {
        type: row.sync_type,
        level,
        last_run: row.last_run,
        stale_mins: staleMins === Infinity ? null : staleMins,
        last_success: row.last_success,
        success_count: row.success_count,
        failure_count: row.failure_count,
      };
    });

    return NextResponse.json({ status: worstLevel, syncs });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
