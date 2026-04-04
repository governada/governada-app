import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getOpsEnvReport } from '@/lib/env';
import { getRuntimeRelease } from '@/lib/runtimeMetadata';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkKoiosHealthFast } from '@/utils/koios';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

type DepStatus = 'healthy' | 'unhealthy' | 'unavailable';

interface DepResult {
  status: DepStatus;
  latencyMs: number;
}

interface EnvDepResult extends DepResult {
  invalid: Array<{ key: string; reason: string }>;
  missing: Array<{ key: string; reason: string }>;
  missingGroups: Array<{ keys: string[]; name: string; reason: string }>;
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
    const ok = await checkKoiosHealthFast(2_500);
    return { status: ok ? 'healthy' : 'unhealthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

async function probeRedis(): Promise<DepResult> {
  const start = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

function probeOperationalEnv(): EnvDepResult {
  const report = getOpsEnvReport();

  return {
    status: report.status === 'healthy' ? 'healthy' : 'unhealthy',
    latencyMs: 0,
    invalid: report.invalid,
    missing: report.missing,
    missingGroups: report.missingGroups,
  };
}

export const GET = withRouteHandler(
  async () => {
    const [supabase, koios, redis] = await Promise.all([
      probeSupabase(),
      probeKoios(),
      probeRedis(),
    ]);
    const operationalEnv = probeOperationalEnv();

    // Supabase is critical because pages read from it directly. Redis remains a
    // supporting dependency for shared rate limits and cache-backed coordination,
    // but core reads stay available without it. Koios is background-only because
    // scheduled sync jobs, not page requests, depend on it.
    const coreHealthy = supabase.status === 'healthy';
    const allHealthy =
      coreHealthy &&
      koios.status === 'healthy' &&
      redis.status === 'healthy' &&
      operationalEnv.status === 'healthy';

    return NextResponse.json({
      status: allHealthy ? 'healthy' : coreHealthy ? 'degraded' : 'critical',
      dependencies: { supabase, koios, redis, operational_env: operationalEnv },
      release: getRuntimeRelease(),
      timestamp: new Date().toISOString(),
    });
  },
  { auth: 'none' },
);
