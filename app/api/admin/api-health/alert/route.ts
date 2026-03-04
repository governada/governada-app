/**
 * API Health Alert — Cron (every 15 min)
 * Checks API operational health and sends Discord alerts on threshold breaches.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { broadcastDiscord } from '@/lib/notifications';
import { alertEmail } from '@/lib/sync-utils';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

interface HealthCheck {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  passed: boolean;
  detail: string;
}

export const GET = withRouteHandler(async (request) => {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const checks: HealthCheck[] = [];
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // --- Check 1: 5xx Error Rate (15 min window) ---
  const { data: recentLogs } = await supabase
    .from('api_usage_log')
    .select('status_code')
    .gte('created_at', fifteenMinAgo);

  if (recentLogs && recentLogs.length > 0) {
    const total = recentLogs.length;
    const errors5xx = recentLogs.filter((l) => l.status_code >= 500).length;
    const errorRate = (errors5xx / total) * 100;

    checks.push({
      name: 'Error Rate (15 min)',
      severity: 'critical',
      passed: errorRate < 5,
      detail: `${errorRate.toFixed(1)}% (${errors5xx}/${total} requests)`,
    });

    // --- Check 2: Any endpoint 100% errors ---
    const endpointErrors = new Map<string, { total: number; errors: number }>();
    // Fetch with endpoint info for this check
    const { data: endpointLogs } = await supabase
      .from('api_usage_log')
      .select('endpoint, status_code')
      .gte('created_at', fifteenMinAgo);

    if (endpointLogs) {
      for (const log of endpointLogs) {
        const entry = endpointErrors.get(log.endpoint) || { total: 0, errors: 0 };
        entry.total++;
        if (log.status_code >= 500) entry.errors++;
        endpointErrors.set(log.endpoint, entry);
      }

      for (const [endpoint, stats] of endpointErrors) {
        if (stats.total >= 3 && stats.errors === stats.total) {
          checks.push({
            name: `Endpoint Down: ${endpoint}`,
            severity: 'critical',
            passed: false,
            detail: `${stats.total} requests, all failed`,
          });
        }
      }
    }

    // --- Check 3: p95 Latency ---
    const { data: latencyLogs } = await supabase
      .from('api_usage_log')
      .select('response_ms')
      .gte('created_at', fifteenMinAgo)
      .not('response_ms', 'is', null)
      .order('response_ms', { ascending: true });

    if (latencyLogs && latencyLogs.length >= 5) {
      const p95Index = Math.floor(latencyLogs.length * 0.95);
      const p95 = latencyLogs[p95Index]?.response_ms || 0;

      checks.push({
        name: 'p95 Latency (15 min)',
        severity: 'warning',
        passed: p95 < 3000,
        detail: `${p95}ms`,
      });
    }

    // --- Check 4: Data staleness ---
    const { data: staleData } = await supabase
      .from('api_usage_log')
      .select('data_age_s')
      .gte('created_at', fifteenMinAgo)
      .not('data_age_s', 'is', null);

    if (staleData && staleData.length > 0) {
      const avgAge = staleData.reduce((sum, d) => sum + (d.data_age_s || 0), 0) / staleData.length;
      checks.push({
        name: 'Data Staleness',
        severity: 'warning',
        passed: avgAge < 3600,
        detail: `avg ${Math.round(avgAge)}s`,
      });
    }
  }

  // --- Check 5: Abuse detection ---
  const { data: abuseLogs } = await supabase
    .from('api_usage_log')
    .select('ip_hash')
    .gte('created_at', oneHourAgo)
    .not('ip_hash', 'is', null);

  if (abuseLogs && abuseLogs.length > 0) {
    const ipCounts = new Map<string, number>();
    for (const log of abuseLogs) {
      ipCounts.set(log.ip_hash, (ipCounts.get(log.ip_hash) || 0) + 1);
    }

    for (const [ipHash, count] of ipCounts) {
      if (count > 500) {
        checks.push({
          name: 'Abuse Detection',
          severity: 'warning',
          passed: false,
          detail: `IP ${ipHash.slice(0, 8)}... made ${count} requests in 1 hour`,
        });
      }
    }
  }

  // --- Check 6: Rate limit upsell signals ---
  const { data: rateLimitLogs } = await supabase
    .from('api_usage_log')
    .select('key_prefix, tier')
    .eq('status_code', 429)
    .gte('created_at', oneHourAgo);

  if (rateLimitLogs && rateLimitLogs.length > 0) {
    const keyHits = new Map<string, number>();
    for (const log of rateLimitLogs) {
      const key = log.key_prefix || 'anonymous';
      keyHits.set(key, (keyHits.get(key) || 0) + 1);
    }

    for (const [keyPrefix, hits] of keyHits) {
      if (hits >= 5) {
        checks.push({
          name: 'Rate Limit Hits (upsell signal)',
          severity: 'info',
          passed: true,
          detail: `Key ${keyPrefix} hit rate limit ${hits}x in 1 hour`,
        });
      }
    }
  }

  // --- Send Discord alerts for failures ---
  const failures = checks.filter((c) => !c.passed);
  const criticalFailures = failures.filter((c) => c.severity === 'critical');
  const warnings = failures.filter((c) => c.severity === 'warning');

  if (criticalFailures.length > 0 || warnings.length > 0) {
    const lines: string[] = [];

    if (criticalFailures.length > 0) {
      lines.push('**CRITICAL:**');
      for (const c of criticalFailures) {
        lines.push(`  \u274c ${c.name}: ${c.detail}`);
      }
    }

    if (warnings.length > 0) {
      lines.push('**Warnings:**');
      for (const w of warnings) {
        lines.push(`  \u26a0\ufe0f ${w.name}: ${w.detail}`);
      }
    }

    const passedCount = checks.filter((c) => c.passed).length;
    lines.push('', `${passedCount}/${checks.length} checks passed`);

    const alertTitle =
      criticalFailures.length > 0
        ? `\u{1f6a8} API Alert: ${criticalFailures.length} critical issue${criticalFailures.length > 1 ? 's' : ''}`
        : `\u26a0\ufe0f API Warning: ${warnings.length} issue${warnings.length > 1 ? 's' : ''}`;

    await Promise.allSettled([
      broadcastDiscord({
        eventType: 'api-health-alert',
        title: alertTitle,
        body: lines.join('\n'),
        url: 'https://analytics.drepscore.io/api-analytics',
      }),
      criticalFailures.length > 0 ? alertEmail(alertTitle, lines.join('\n')) : Promise.resolve(),
    ]);
  }

  // Log health check to sync_log
  await supabase.from('sync_log').insert({
    sync_type: 'api_health_check',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: 0,
    success: failures.filter((c) => c.severity === 'critical').length === 0,
    metrics: {
      total_checks: checks.length,
      passed: checks.filter((c) => c.passed).length,
      critical_failures: criticalFailures.length,
      warnings: warnings.length,
    },
  });

  return NextResponse.json({
    healthy: criticalFailures.length === 0,
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((c) => c.passed).length,
      critical: criticalFailures.length,
      warnings: warnings.length,
    },
  });
});
