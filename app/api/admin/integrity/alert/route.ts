import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Alert {
  level: 'critical' | 'warning';
  metric: string;
  value: string;
  threshold: string;
  action: string;
}

const ACTIVE_SYNC_TYPES = new Set(['proposals', 'dreps', 'votes', 'secondary', 'slow']);

const SYNC_CONFIG: Record<
  string,
  { mins: number; schedule: string; route: string; label: string }
> = {
  proposals: {
    mins: 90,
    schedule: 'every 30m',
    route: '/api/sync/proposals',
    label: 'Proposals Sync',
  },
  dreps: { mins: 720, schedule: 'every 6h', route: '/api/sync/dreps', label: 'DReps Sync' },
  votes: { mins: 720, schedule: 'every 6h', route: '/api/sync/votes', label: 'Votes Sync' },
  secondary: {
    mins: 720,
    schedule: 'every 6h',
    route: '/api/sync/secondary',
    label: 'Secondary Sync',
  },
  slow: { mins: 2160, schedule: 'daily', route: '/api/sync/slow', label: 'Slow Sync' },
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ skipped: true, reason: 'No webhook URL configured' });
  }

  const supabase = createClient();
  const alerts: Alert[] = [];

  const [{ data: vpc }, { data: hv }, { data: ai }, { data: sh }] = await Promise.all([
    supabase.from('v_vote_power_coverage').select('*').single(),
    supabase.from('v_hash_verification').select('*').single(),
    supabase.from('v_ai_summary_coverage').select('*').single(),
    supabase.from('v_sync_health').select('*'),
  ]);

  if (vpc && parseFloat(vpc.coverage_pct) < 95) {
    alerts.push({
      level: 'critical',
      metric: 'Vote power coverage',
      value: `${vpc.coverage_pct}%`,
      threshold: '95%',
      action:
        'Run /api/sync/dreps to refresh vote power data. If persistent, check Koios drep_info endpoint.',
    });
  }

  if (hv && parseFloat(hv.mismatch_rate_pct) > 5) {
    alerts.push({
      level: 'warning',
      metric: 'Hash mismatch rate',
      value: `${hv.mismatch_rate_pct}%`,
      threshold: '5%',
      action:
        'Run /api/sync/slow to re-verify metadata hashes. If persistent, DReps may have updated their metadata.',
    });
  }

  if (ai && ai.proposals_with_abstract > 0) {
    const pct = Math.round((ai.proposals_with_summary / ai.proposals_with_abstract) * 100);
    if (pct < 90) {
      alerts.push({
        level: 'warning',
        metric: 'Proposal AI summary coverage',
        value: `${pct}%`,
        threshold: '90%',
        action: 'Run /api/sync/slow to generate missing AI summaries.',
      });
    }
  }

  const now = Date.now();

  for (const row of sh || []) {
    if (!ACTIVE_SYNC_TYPES.has(row.sync_type)) continue;
    if (!row.last_run) continue;

    const config = SYNC_CONFIG[row.sync_type];
    if (!config) continue;

    const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60000);
    const staleHuman =
      staleMins >= 60 ? `${Math.floor(staleMins / 60)}h ${staleMins % 60}m` : `${staleMins}m`;

    if (staleMins > config.mins) {
      alerts.push({
        level: 'critical',
        metric: `${config.label} — No runs in ${staleHuman}`,
        value: `Last run: ${staleHuman} ago`,
        threshold: config.schedule,
        action: `Trigger manually: curl -H "Authorization: Bearer $CRON_SECRET" https://drepscore.io${config.route}. Check Inngest dashboard if recurring.`,
      });
    }

    if (row.last_success === false) {
      const failureCount = row.failure_count ?? '?';
      const totalCount = (row.success_count ?? 0) + (row.failure_count ?? 0);
      const errorDetail = row.last_error
        ? row.last_error.length > 200
          ? row.last_error.slice(0, 200) + '…'
          : row.last_error
        : 'No error message captured';
      const runAge = staleHuman + ' ago';

      let action: string;
      if (row.last_error?.includes('429')) {
        action =
          'Koios rate limited. Wait 60s then retry. If recurring, reduce sync concurrency or check Koios tier.';
      } else if (row.last_error?.includes('timeout') || row.last_error?.includes('Timeout')) {
        action =
          'Function timed out. Check maxDuration setting and Koios response times. Consider splitting work.';
      } else if (row.last_error?.includes('no data') || row.last_error?.includes('No data')) {
        action =
          'Koios returned empty response. Check Koios API status at api.koios.rest. Retry in a few minutes.';
      } else {
        action = `Check Railway logs for ${config.route} in the dashboard. Then retry manually.`;
      }

      alerts.push({
        level: 'critical',
        metric: `${config.label} — Last Run Failed`,
        value: `${errorDetail}\n${failureCount}/${totalCount} runs failed · ${runAge}`,
        threshold: 'must succeed',
        action,
      });
    }
  }

  // ── Treasury snapshot staleness check ──

  const { data: latestTreasury } = await supabase
    .from('treasury_snapshots')
    .select('epoch_no, snapshot_at')
    .order('epoch_no', { ascending: false })
    .limit(1)
    .single();

  if (latestTreasury) {
    const snapshotAge = Math.round((now - new Date(latestTreasury.snapshot_at).getTime()) / 60000);
    if (snapshotAge > 1500) {
      alerts.push({
        level: 'warning',
        metric: 'Treasury Snapshot — Stale',
        value: `Last snapshot: epoch ${latestTreasury.epoch_no}, ${Math.floor(snapshotAge / 60)}h ago`,
        threshold: 'daily (via Inngest)',
        action:
          'Check Inngest dashboard for sync-treasury-snapshot failures. The function runs at 22:30 UTC daily.',
      });
    }
  } else {
    alerts.push({
      level: 'warning',
      metric: 'Treasury Snapshot — No Data',
      value: 'No treasury snapshots found',
      threshold: 'at least 1 snapshot',
      action: 'Trigger sync-treasury-snapshot via Inngest Cloud or wait for next daily run.',
    });
  }

  // ── Self-healing: trigger stale syncs ──

  const recoveries: string[] = [];
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || null;

  if (cronSecret && baseUrl) {
    const staleTypes: {
      syncType: string;
      staleMins: number;
      config: (typeof SYNC_CONFIG)[string];
    }[] = [];
    for (const row of sh || []) {
      if (!ACTIVE_SYNC_TYPES.has(row.sync_type)) continue;
      if (!row.last_run) continue;
      const config = SYNC_CONFIG[row.sync_type];
      if (!config) continue;
      const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60000);
      if (staleMins > config.mins) {
        staleTypes.push({ syncType: row.sync_type, staleMins, config });
      }
    }

    const recoveryResults = await Promise.allSettled(
      staleTypes.map(async ({ syncType, staleMins, config }) => {
        console.log(
          `[AlertCron] Self-healing: triggering ${syncType} (${staleMins}m stale > ${config.mins}m threshold)`,
        );
        const res = await fetch(`${baseUrl}${config.route}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${cronSecret}` },
          signal: AbortSignal.timeout(5000),
        });
        return { syncType, status: res.status };
      }),
    );

    for (const result of recoveryResults) {
      if (result.status === 'fulfilled') {
        recoveries.push(`${result.value.syncType}: ${result.value.status}`);
        console.log(`[AlertCron] Recovery ${result.value.syncType}: ${result.value.status}`);
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        recoveries.push(`unknown: failed (${msg})`);
        console.warn(`[AlertCron] Recovery failed:`, msg);
      }
    }
  }

  const admin = getSupabaseAdmin();

  if (alerts.length === 0) {
    try {
      await admin.from('sync_log').insert({
        sync_type: 'integrity_check',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 0,
        success: true,
        metrics: { alerts: 0, recoveries },
      });
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ alerts: 0, sent: false, recoveries });
  }

  const criticals = alerts.filter((a) => a.level === 'critical');
  const warnings = alerts.filter((a) => a.level === 'warning');

  const isSlack = webhookUrl.includes('hooks.slack.com');

  function formatAlertLine(a: Alert): string {
    const icon = a.level === 'critical' ? '🔴' : '🟡';
    return `${icon} **${a.metric}**\n↳ ${a.value}  ·  threshold: ${a.threshold}\n🔧 **Action:** ${a.action}`;
  }

  let body: unknown;
  if (isSlack) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `DRepScore: ${criticals.length} critical, ${warnings.length} warning`,
        },
      },
      ...alerts.map((a) => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${a.level === 'critical' ? ':red_circle:' : ':large_yellow_circle:'} *${a.metric}*\n>${a.value}  ·  threshold: ${a.threshold}\n>🔧 *Action:* ${a.action}`,
        },
      })),
    ];
    body = { blocks };
  } else {
    const lines = alerts.map(formatAlertLine);
    body = { content: `**DRepScore Integrity Alert**\n\n${lines.join('\n\n')}` };
  }

  if (recoveries.length > 0) {
    const recoveryNote = `♻️ Auto-recovery triggered: ${recoveries.join(', ')}`;
    if (isSlack) {
      (body as { blocks: unknown[] }).blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: recoveryNote }],
      });
    } else {
      (body as { content: string }).content += `\n\n${recoveryNote}`;
    }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    try {
      await admin.from('sync_log').insert({
        sync_type: 'integrity_check',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 0,
        success: true,
        metrics: { alerts: alerts.length, webhook_status: res.status, recoveries },
      });
    } catch {
      /* best-effort */
    }

    try {
      const { captureServerEvent } = await import('@/lib/posthog-server');
      captureServerEvent('integrity_alert_sent', {
        alert_count: alerts.length,
        critical_count: criticals.length,
        warning_count: warnings.length,
      });
    } catch {
      /* optional */
    }

    return NextResponse.json({ alerts: alerts.length, sent: res.ok, details: alerts, recoveries });
  } catch (err) {
    return NextResponse.json(
      {
        alerts: alerts.length,
        sent: false,
        error: err instanceof Error ? err.message : 'Webhook failed',
      },
      { status: 502 },
    );
  }
}
