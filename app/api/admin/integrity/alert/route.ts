import { NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';
import { logger } from '@/lib/logger';
import { getSyncPolicy, SYNC_POLICY, type SyncPolicy } from '@/lib/syncPolicy';
import { alertEmail } from '@/lib/sync-utils';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Alert {
  level: 'critical' | 'warning';
  metric: string;
  value: string;
  threshold: string;
  action: string;
}

const ACTIVE_SYNC_TYPES = new Set(Object.keys(SYNC_POLICY));

export const GET = withRouteHandler(async (request) => {
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

    const config = getSyncPolicy(row.sync_type);

    const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60000);
    const staleHuman =
      staleMins >= 60 ? `${Math.floor(staleMins / 60)}h ${staleMins % 60}m` : `${staleMins}m`;

    if (staleMins > config.retriggerAfterMinutes) {
      const staleAction = config.event
        ? `Trigger via Inngest Cloud (event: ${config.event}). Check Inngest dashboard if recurring.`
        : `Check ${config.label} manually. No auto-trigger event is configured for ${row.sync_type}.`;
      alerts.push({
        level: 'critical',
        metric: `${config.label} — No runs in ${staleHuman}`,
        value: `Last run: ${staleHuman} ago`,
        threshold: config.schedule,
        action: staleAction,
      });
    }

    if (row.last_success === false) {
      const failureCount = row.failure_count ?? 0;
      const successCount = row.success_count ?? 0;
      const totalCount = successCount + (failureCount as number);
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
        action = config.event
          ? `Check Railway/Inngest logs for ${config.label}. Retrigger via Inngest Cloud (event: ${config.event}).`
          : `Check Railway/Inngest logs for ${config.label}. No auto-trigger event is configured for ${row.sync_type}.`;
      }

      // Determine severity: a single transient failure among hundreds of successes
      // is a warning, not critical. Only escalate if there's a pattern of failures.
      const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
      const failureContext =
        successRate >= 95
          ? `${failureCount} failures out of ${totalCount} runs (${successRate}% success rate)`
          : `${failureCount}/${totalCount} runs failed`;

      // Transient: high success rate + known transient error (429, 503, deployment restart).
      const isTransient =
        successRate >= 95 &&
        (row.last_error?.includes('429') ||
          row.last_error?.includes('503') ||
          row.last_error?.includes('deployment restart') ||
          row.last_error?.includes('Process terminated') ||
          !row.last_error);
      const level = isTransient ? 'warning' : 'critical';

      alerts.push({
        level,
        metric: `${config.label} — Last Run Failed`,
        value: `${errorDetail}\n${failureContext} · ${runAge}`,
        threshold: 'must succeed',
        action,
      });
    }
  }

  // ── Orphan vote check (votes referencing DReps not in dreps table) ──

  const [{ count: totalVotes }, { count: totalDreps }] = await Promise.all([
    supabase.from('drep_votes').select('*', { count: 'exact', head: true }),
    supabase.from('dreps').select('*', { count: 'exact', head: true }),
  ]);

  if (totalVotes && totalDreps) {
    // Sample-based orphan check: get distinct voter IDs vs DRep IDs
    const [{ data: voterSample }, { data: drepIds }] = await Promise.all([
      supabase.from('drep_votes').select('drep_id').limit(5000),
      supabase.from('dreps').select('id').limit(99999),
    ]);

    if (voterSample && drepIds) {
      const drepSet = new Set(drepIds.map((d: { id: string }) => d.id));
      const orphanVoters = new Set(
        voterSample
          .filter((v: { drep_id: string }) => !drepSet.has(v.drep_id))
          .map((v: { drep_id: string }) => v.drep_id),
      );
      const orphanPct =
        voterSample.length > 0
          ? (voterSample.filter((v: { drep_id: string }) => !drepSet.has(v.drep_id)).length /
              voterSample.length) *
            100
          : 0;

      if (orphanPct > 15) {
        alerts.push({
          level: 'warning',
          metric: `Orphan Votes — ${orphanPct.toFixed(1)}% of votes reference missing DReps`,
          value: `${orphanVoters.size} unique DRep IDs in votes but not in dreps table`,
          threshold: '<15% orphan rate',
          action:
            'Review deregistered DReps. Consider retaining them with a deregistered flag or excluding orphan votes from scoring.',
        });
      }
    }
  }

  // ── Table count day-over-day drop detection ──

  const { data: recentSnapshots } = await supabase
    .from('integrity_snapshots')
    .select('snapshot_date, total_dreps, total_votes, total_proposals, total_rationales')
    .order('snapshot_date', { ascending: false })
    .limit(2);

  if (recentSnapshots && recentSnapshots.length === 2) {
    const [today, yesterday] = recentSnapshots;
    const countChecks: { label: string; current: number; previous: number }[] = [
      { label: 'DReps', current: today.total_dreps, previous: yesterday.total_dreps },
      { label: 'Votes', current: today.total_votes, previous: yesterday.total_votes },
      { label: 'Proposals', current: today.total_proposals, previous: yesterday.total_proposals },
      {
        label: 'Rationales',
        current: today.total_rationales,
        previous: yesterday.total_rationales,
      },
    ];

    for (const check of countChecks) {
      if (check.previous > 0) {
        const dropPct = ((check.previous - check.current) / check.previous) * 100;
        if (dropPct > 10) {
          alerts.push({
            level: 'critical',
            metric: `${check.label} Count Drop — ${dropPct.toFixed(1)}% decrease`,
            value: `${check.previous} → ${check.current} (lost ${check.previous - check.current} records)`,
            threshold: '<10% day-over-day drop',
            action: `Investigate ${check.label.toLowerCase()} sync. Check Koios responses for truncated data. Review sync_log for recent failures.`,
          });
        }
      }
    }
  }

  // ── Epoch gap detection for snapshot tables ──

  const { data: govStats } = await supabase
    .from('governance_stats')
    .select('current_epoch')
    .eq('id', 1)
    .single();
  const currentEpoch = govStats?.current_epoch ?? 0;

  if (currentEpoch > 0) {
    const snapshotChecks: {
      table: string;
      label: string;
      epochCol: string;
      minCoverage: number;
    }[] = [
      { table: 'ghi_snapshots', label: 'GHI', epochCol: 'epoch_no', minCoverage: 1 },
      { table: 'treasury_snapshots', label: 'Treasury', epochCol: 'epoch_no', minCoverage: 1 },
      {
        table: 'drep_score_history',
        label: 'Score History',
        epochCol: 'epoch_no',
        minCoverage: 50,
      },
    ];

    for (const check of snapshotChecks) {
      const { count } = await supabase
        .from(check.table)
        .select('*', { count: 'exact', head: true })
        .eq(check.epochCol, currentEpoch);

      if ((count ?? 0) < check.minCoverage) {
        alerts.push({
          level: 'warning',
          metric: `${check.label} — Missing epoch ${currentEpoch} data`,
          value: `${count ?? 0} records for current epoch (expected >= ${check.minCoverage})`,
          threshold: `>= ${check.minCoverage} per epoch`,
          action: `Check if the ${check.label.toLowerCase()} sync ran this epoch. Trigger manually if needed.`,
        });
      }
    }
  }

  // ── Vote-proposal reconciliation ──

  {
    const { data: voteTxSample } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash')
      .limit(5000);
    const { data: proposalTxes } = await supabase.from('proposals').select('tx_hash');

    if (voteTxSample && proposalTxes) {
      const proposalSet = new Set(proposalTxes.map((p: { tx_hash: string }) => p.tx_hash));
      const orphanProposalVotes = voteTxSample.filter(
        (v: { proposal_tx_hash: string }) => !proposalSet.has(v.proposal_tx_hash),
      );
      const orphanPct =
        voteTxSample.length > 0 ? (orphanProposalVotes.length / voteTxSample.length) * 100 : 0;

      if (orphanPct > 5) {
        alerts.push({
          level: 'warning',
          metric: `Vote-Proposal Mismatch — ${orphanPct.toFixed(1)}% of votes reference unknown proposals`,
          value: `${orphanProposalVotes.length} votes in sample point to proposals not in our table`,
          threshold: '<5% orphan rate',
          action:
            'Proposals may have been dropped during sync. Trigger proposals sync and check for expired/deleted proposals.',
        });
      }
    }
  }

  // ── Score distribution shift detection ──

  {
    const { data: scoreDist } = await supabase
      .from('dreps')
      .select('drep_score')
      .not('drep_score', 'is', null);

    if (scoreDist && scoreDist.length > 10) {
      const scores = scoreDist.map((d: { drep_score: number }) => d.drep_score);
      const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      const zeroCount = scores.filter((s: number) => s === 0).length;
      const zeroPct = (zeroCount / scores.length) * 100;

      if (zeroPct > 50) {
        alerts.push({
          level: 'critical',
          metric: `Score Distribution Anomaly — ${zeroPct.toFixed(0)}% of DReps have score 0`,
          value: `${zeroCount}/${scores.length} DReps scored zero (avg: ${avg.toFixed(1)})`,
          threshold: '<50% zero scores',
          action:
            'Scoring sync may have failed or reset scores. Check sync-drep-scores in Inngest dashboard. Verify scoring model inputs.',
        });
      }

      if (avg < 10 || avg > 90) {
        alerts.push({
          level: 'warning',
          metric: `Score Distribution Skew — avg score: ${avg.toFixed(1)}`,
          value: `Average score outside normal range (expected 20-80)`,
          threshold: '10 < avg < 90',
          action:
            'Score distribution is heavily skewed. Review percentile normalization in scoring model. Check input data quality.',
        });
      }
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

  // ── Self-healing: trigger stale syncs via Inngest events ──

  const recoveries: string[] = [];

  const staleTypes: {
    syncType: string;
    staleMins: number;
    config: SyncPolicy & { event: string };
  }[] = [];
  for (const row of sh || []) {
    if (!ACTIVE_SYNC_TYPES.has(row.sync_type)) continue;
    if (!row.last_run) continue;
    const config = getSyncPolicy(row.sync_type);
    const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60000);
    if (staleMins > config.retriggerAfterMinutes && config.event) {
      staleTypes.push({
        syncType: row.sync_type,
        staleMins,
        config: { ...config, event: config.event },
      });
    }
  }

  for (const { syncType, staleMins, config } of staleTypes) {
    try {
      logger.info('Self-healing: triggering sync via Inngest', {
        context: 'alert-cron',
        syncType,
        staleMins,
        threshold: config.retriggerAfterMinutes,
      });
      await inngest.send({ name: config.event });
      recoveries.push(`${syncType}: triggered`);
      logger.info('Recovery: Inngest event sent', { context: 'alert-cron', syncType });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recoveries.push(`${syncType}: failed (${msg})`);
      logger.warn('Recovery failed', { context: 'alert-cron', syncType, error: msg });
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
          text: `Governada: ${criticals.length} critical, ${warnings.length} warning`,
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
    body = { content: `**Governada Integrity Alert**\n\n${lines.join('\n\n')}` };
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
    if (criticals.length > 0) {
      const emailBody = alerts
        .map(
          (a) =>
            `[${a.level.toUpperCase()}] ${a.metric}\n${a.value}\nThreshold: ${a.threshold}\nAction: ${a.action}`,
        )
        .join('\n\n');
      alertEmail(`Integrity Alert: ${criticals.length} critical`, emailBody).catch(() => {});
    }

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
});
