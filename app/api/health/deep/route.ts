import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkKoiosHealth } from '@/utils/koios';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

type DepStatus = 'healthy' | 'unhealthy' | 'unavailable';

interface DepResult {
  status: DepStatus;
  latencyMs: number;
}

async function probeSupabase(): Promise<DepResult> {
  const start = Date.now();
  try {
    const supabase = getSupabaseAdmin();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const { error } = await supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timer);
    return { status: error ? 'unhealthy' : 'healthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

async function probeKoios(): Promise<DepResult> {
  const start = Date.now();
  try {
    const ok = await Promise.race([
      checkKoiosHealth(),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]);
    return { status: ok ? 'healthy' : 'unhealthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

async function probeRedis(): Promise<DepResult> {
  const start = Date.now();
  try {
    const redis = getRedis();
    if (!redis) return { status: 'unavailable', latencyMs: Date.now() - start };
    await redis.ping();
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

export const GET = withRouteHandler(
  async (_request: NextRequest) => {
    const [supabase, koios, redis] = await Promise.all([
      probeSupabase(),
      probeKoios(),
      probeRedis(),
    ]);

    const allHealthy =
      supabase.status === 'healthy' &&
      koios.status === 'healthy' &&
      (redis.status === 'healthy' || redis.status === 'unavailable');

    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'degraded',
      dependencies: { supabase, koios, redis },
      timestamp: new Date().toISOString(),
    });
  },
  { auth: 'none' },
);
