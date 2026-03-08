export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const GET = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const syncType = searchParams.get('syncType') || null;

    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('sync_log')
      .select(
        'id, sync_type, success, duration_ms, error_message, started_at, finished_at, metrics',
      )
      .gte('started_at', since)
      .order('started_at', { ascending: false });

    if (syncType) {
      query = query.eq('sync_type', syncType);
    }

    const { data: logs, error } = await query.limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute aggregates
    const byType: Record<
      string,
      {
        total: number;
        successes: number;
        failures: number;
        durations: number[];
        lastRun: string;
        errors: string[];
      }
    > = {};

    for (const log of logs || []) {
      const t = log.sync_type;
      if (!byType[t]) {
        byType[t] = {
          total: 0,
          successes: 0,
          failures: 0,
          durations: [],
          lastRun: log.started_at,
          errors: [],
        };
      }
      byType[t].total++;
      if (log.success) {
        byType[t].successes++;
      } else {
        byType[t].failures++;
        if (log.error_message) {
          byType[t].errors.push(log.error_message);
        }
      }
      if (log.duration_ms) {
        byType[t].durations.push(log.duration_ms);
      }
    }

    const aggregates = Object.entries(byType).map(([type, stats]) => {
      const sorted = [...stats.durations].sort((a, b) => a - b);
      return {
        sync_type: type,
        total: stats.total,
        successes: stats.successes,
        failures: stats.failures,
        success_rate: stats.total > 0 ? Math.round((stats.successes / stats.total) * 100) : 0,
        avg_duration_ms:
          sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null,
        p95_duration_ms: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : null,
        max_duration_ms: sorted.length > 0 ? sorted[sorted.length - 1] : null,
        last_run: stats.lastRun,
        recent_errors: stats.errors.slice(0, 3),
      };
    });

    // Timeline data: bucket by hour
    const timeline: Array<{ hour: string; success: number; failure: number }> = [];
    const bucketMs = 60 * 60 * 1000;
    const now = Date.now();
    for (let i = hours - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketMs;
      const bucketEnd = now - i * bucketMs;
      const hourLabel = new Date(bucketStart).toISOString().slice(0, 13) + ':00';
      let success = 0;
      let failure = 0;
      for (const log of logs || []) {
        const t = new Date(log.started_at).getTime();
        if (t >= bucketStart && t < bucketEnd) {
          if (log.success) success++;
          else failure++;
        }
      }
      timeline.push({ hour: hourLabel, success, failure });
    }

    return NextResponse.json({
      logs: (logs || []).slice(0, 100), // Limit detailed logs
      aggregates: aggregates.sort((a, b) => a.sync_type.localeCompare(b.sync_type)),
      timeline,
      sync_types: Object.keys(byType).sort(),
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
