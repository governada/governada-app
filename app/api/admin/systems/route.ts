export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRedis } from '@/lib/redis';
import { checkKoiosHealth } from '@/utils/koios';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import {
  AUTOMATION_CANDIDATES,
  CRITICAL_JOURNEYS,
  SYSTEMS_QUICK_LINKS,
  type SystemsStatus,
} from '@/lib/admin/systems';
import {
  buildOverallNarrative,
  buildPromiseCards,
  buildRecommendedActions,
  buildSloCards,
  buildWeeklyReviewLoop,
  type PromiseInput,
} from '@/lib/admin/systemsStatus';

type DependencyProbe = {
  status: 'healthy' | 'unhealthy' | 'unavailable';
  latencyMs: number;
};

function percentile(values: number[], target: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * target));
  return sorted[index] ?? null;
}

async function probeSupabase(): Promise<DependencyProbe> {
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

async function probeKoios(): Promise<DependencyProbe> {
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

async function probeRedis(): Promise<DependencyProbe> {
  const start = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

function formatLatency(ms: number | null): string {
  if (ms === null) return 'No sample yet';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function minutesToLabel(minutes: number | null): string {
  if (minutes === null) return 'Unknown';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const [
      supabaseProbe,
      koiosProbe,
      redisProbe,
      syncHealthResult,
      syncLogResult,
      votePowerResult,
      hashVerifyResult,
      reconciliationResult,
      apiUsageResult,
    ] = await Promise.all([
      probeSupabase(),
      probeKoios(),
      probeRedis(),
      supabase.from('v_sync_health').select('*'),
      supabase
        .from('sync_log')
        .select('id, success, sync_type, started_at')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false })
        .limit(300),
      supabase.from('v_vote_power_coverage').select('*').single(),
      supabase.from('v_hash_verification').select('*').single(),
      supabase
        .from('reconciliation_log')
        .select('checked_at, overall_status, mismatches')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('api_usage_log')
        .select('status_code, response_ms, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const dependencyStatus: SystemsStatus =
      supabaseProbe.status === 'healthy' &&
      koiosProbe.status === 'healthy' &&
      redisProbe.status === 'healthy'
        ? 'good'
        : supabaseProbe.status === 'healthy'
          ? 'warning'
          : 'critical';

    const dependencySummary =
      dependencyStatus === 'good'
        ? 'Supabase, Koios, and Redis all responded to live probes.'
        : dependencyStatus === 'warning'
          ? 'Core reads are healthy, but at least one supporting dependency is degraded.'
          : 'Supabase is unhealthy or unavailable, so the core product is at risk.';

    const syncHealthRows = syncHealthResult.data || [];
    const syncHealthByType = new Map(
      syncHealthRows.map((row) => [
        row.sync_type,
        {
          ...row,
          stale_minutes: row.last_run
            ? Math.round((Date.now() - new Date(row.last_run).getTime()) / 60000)
            : null,
        },
      ]),
    );

    const fastSync = syncHealthByType.get('fast');
    const fullSync = syncHealthByType.get('full');

    let freshnessStatus: SystemsStatus = 'bootstrap';
    if (fastSync?.stale_minutes !== null || fullSync?.stale_minutes !== null) {
      const fastStale = fastSync?.stale_minutes ?? null;
      const fullStale = fullSync?.stale_minutes ?? null;
      if ((fastStale !== null && fastStale > 90) || (fullStale !== null && fullStale > 1560)) {
        freshnessStatus = 'critical';
      } else if (
        (fastStale !== null && fastStale > 45) ||
        (fullStale !== null && fullStale > 720)
      ) {
        freshnessStatus = 'warning';
      } else {
        freshnessStatus = 'good';
      }
    }

    const freshnessValue = `Fast ${minutesToLabel(fastSync?.stale_minutes ?? null)} / Full ${minutesToLabel(fullSync?.stale_minutes ?? null)}`;
    const freshnessSummary =
      freshnessStatus === 'good'
        ? 'The primary fast and full sync loops are within the expected operating window.'
        : freshnessStatus === 'warning'
          ? 'Freshness is drifting toward stale territory. Watch the fast and full sync lanes closely.'
          : freshnessStatus === 'critical'
            ? 'At least one core sync lane is stale beyond the launch bar.'
            : 'Freshness tracking is present, but this page does not yet have enough live signal to grade it confidently.';

    const votePowerCoverage = votePowerResult.data?.coverage_pct
      ? Number.parseFloat(votePowerResult.data.coverage_pct)
      : null;
    const mismatchRate = hashVerifyResult.data?.mismatch_rate_pct
      ? Number.parseFloat(hashVerifyResult.data.mismatch_rate_pct)
      : null;

    let correctnessStatus: SystemsStatus = 'bootstrap';
    if (votePowerCoverage !== null || mismatchRate !== null || reconciliationResult.data) {
      correctnessStatus = 'good';
      if (
        reconciliationResult.data?.overall_status === 'mismatch' ||
        (votePowerCoverage !== null && votePowerCoverage < 95) ||
        (mismatchRate !== null && mismatchRate > 5)
      ) {
        correctnessStatus = 'critical';
      } else if (
        reconciliationResult.data?.overall_status === 'drift' ||
        (votePowerCoverage !== null && votePowerCoverage < 99) ||
        (mismatchRate !== null && mismatchRate > 1)
      ) {
        correctnessStatus = 'warning';
      }
    }

    const correctnessValue =
      correctnessStatus === 'bootstrap'
        ? 'No baseline yet'
        : `${votePowerCoverage?.toFixed(1) ?? '--'}% vote power / ${mismatchRate?.toFixed(1) ?? '--'}% mismatch`;

    const correctnessSummary =
      correctnessStatus === 'good'
        ? 'Integrity signals look clean: vote power coverage is high and reconciliation is not flagging drift.'
        : correctnessStatus === 'warning'
          ? 'Correctness signals are watchable but not ideal. One or more integrity indicators are outside the comfort zone.'
          : correctnessStatus === 'critical'
            ? 'Integrity needs attention now. Either reconciliation drift, vote power coverage, or hash mismatch rate is breaching the launch bar.'
            : 'Correctness checks exist, but the page does not yet have enough live evidence to grade them.';

    const apiLogs = apiUsageResult.data || [];
    const apiResponseTimes = apiLogs
      .map((entry) => entry.response_ms)
      .filter((value): value is number => typeof value === 'number');
    const apiP95 = percentile(apiResponseTimes, 0.95);
    const apiErrorCount = apiLogs.filter((entry) => entry.status_code >= 500).length;
    const apiErrorRate = apiLogs.length > 0 ? (apiErrorCount / apiLogs.length) * 100 : null;

    let performanceStatus: SystemsStatus = 'bootstrap';
    if (apiP95 !== null) {
      if ((apiErrorRate ?? 0) > 5 || apiP95 > 1000) performanceStatus = 'critical';
      else if ((apiErrorRate ?? 0) > 1 || apiP95 > 500) performanceStatus = 'warning';
      else performanceStatus = 'good';
    }

    const performanceValue =
      apiP95 === null
        ? 'No live API sample yet'
        : `p95 ${formatLatency(apiP95)} / ${(apiErrorRate ?? 0).toFixed(1)}% 5xx`;
    const performanceSummary =
      performanceStatus === 'good'
        ? 'Recent API samples are within the launch bar.'
        : performanceStatus === 'warning'
          ? 'Performance is serviceable, but recent latency or 5xx rates are above the ideal launch bar.'
          : performanceStatus === 'critical'
            ? 'Recent API behavior is too slow or error-prone for launch confidence.'
            : 'This page can show live API performance, but you still need the first explicit baseline run for disciplined tracking.';

    const syncLogs = syncLogResult.data || [];
    const syncFailureCount = syncLogs.filter((entry) => !entry.success).length;
    const syncSuccessRate =
      syncLogs.length > 0
        ? Math.round(((syncLogs.length - syncFailureCount) / syncLogs.length) * 100)
        : null;

    const promiseInput: PromiseInput = {
      availability: {
        status: dependencyStatus,
        summary: dependencySummary,
        value:
          dependencyStatus === 'good'
            ? '3/3 healthy'
            : `${[supabaseProbe, koiosProbe, redisProbe].filter((probe) => probe.status === 'healthy').length}/3 healthy`,
      },
      freshness: {
        status: freshnessStatus,
        summary: freshnessSummary,
        value: freshnessValue,
      },
      correctness: {
        status: correctnessStatus,
        summary: correctnessSummary,
        value: correctnessValue,
      },
      performance: {
        status: performanceStatus,
        summary: performanceSummary,
        value: performanceValue,
      },
      changeSafety: {
        status: 'bootstrap',
        summary:
          'CI and post-deploy verification are in place, but deploy failure rate still needs to be tracked as an explicit weekly operating signal.',
        value:
          syncSuccessRate === null
            ? 'Weekly scorecard not started'
            : `Post-deploy loop exists, sync success ${syncSuccessRate}%`,
      },
      incidentResponse: {
        status: 'bootstrap',
        summary:
          'You have runbooks and alert paths, but operator readiness is still mostly theoretical until drills and incident logging become routine.',
        value: 'Alerts exist, drills not started',
      },
      userHonesty: {
        status: freshnessStatus === 'critical' ? 'warning' : 'bootstrap',
        summary:
          'Governada already has health and integrity surfaces, but degraded-state UX still needs to be reviewed as a first-class operating signal.',
        value:
          freshnessStatus === 'critical'
            ? 'Degraded-state review required'
            : 'Needs recurring trust-surface review',
      },
    };

    const { cards, coverage } = buildPromiseCards(promiseInput);
    const slos = buildSloCards(promiseInput);
    const overall = buildOverallNarrative(cards);
    const actions = buildRecommendedActions(cards);
    const reviewLoop = buildWeeklyReviewLoop(slos, actions);

    const wins: string[] = [];
    const watchouts: string[] = [];
    const blockers: string[] = [];

    if (dependencyStatus === 'good') wins.push('Core dependency probes are green right now.');
    if (correctnessStatus === 'good')
      wins.push('Integrity signals are currently inside the comfort zone.');
    wins.push(`Public-path automation covers ${coverage.automatedCount} critical journeys today.`);

    if (freshnessStatus !== 'good') watchouts.push(freshnessSummary);
    if (performanceStatus !== 'good') watchouts.push(performanceSummary);
    if (coverage.status !== 'good') {
      watchouts.push(
        'DRep workspace and authoring flows still rely too much on manual or lower-layer verification.',
      );
    }

    if (dependencyStatus === 'critical') blockers.push('Core availability is red.');
    if (correctnessStatus === 'critical') blockers.push('Integrity correctness is red.');
    if (freshnessStatus === 'critical') blockers.push('Freshness is outside the launch bar.');

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overall,
      story: {
        wins,
        watchouts,
        blockers,
      },
      summary: {
        dependencyHealth:
          dependencyStatus === 'good'
            ? '3/3 healthy'
            : `${[supabaseProbe, koiosProbe, redisProbe].filter((probe) => probe.status === 'healthy').length}/3 healthy`,
        syncSuccessRate:
          syncSuccessRate === null ? 'No recent sample' : `${syncSuccessRate}% last 24h`,
        integrityState:
          correctnessStatus === 'bootstrap'
            ? 'No baseline yet'
            : correctnessStatus === 'good'
              ? 'Clean'
              : correctnessStatus === 'warning'
                ? 'Watch'
                : 'Act now',
        apiPerformance: apiP95 === null ? 'No live sample' : `p95 ${formatLatency(apiP95)}`,
        criticalJourneyCoverage: `${coverage.automatedCount}/${coverage.totalCount} automated`,
      },
      slos,
      promises: cards,
      actions,
      reviewLoop,
      journeys: CRITICAL_JOURNEYS,
      automationCandidates: AUTOMATION_CANDIDATES,
      quickLinks: SYSTEMS_QUICK_LINKS,
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
