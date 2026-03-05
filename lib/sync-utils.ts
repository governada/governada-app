import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRetry } from '@/lib/retry';

export type SyncType =
  | 'dreps'
  | 'votes'
  | 'proposals'
  | 'secondary'
  | 'slow'
  | 'full'
  | 'treasury'
  | 'scoring'
  | 'alignment'
  | 'ghi'
  | 'benchmarks'
  | 'integrity_check'
  | 'api_health_check'
  | 'spo_votes'
  | 'cc_votes'
  | 'alignment_cache'
  | 'similarity_cache'
  | 'epoch_recaps'
  | 'snapshot_backfill'
  | 'spo_scores'
  | 'governance_epoch_stats'
  | 'data_moat'
  | 'delegator_snapshots'
  | 'drep_lifecycle'
  | 'epoch_summaries'
  | 'committee_sync'
  | 'metadata_archive';

const BATCH_SIZE = 100;
const MAX_UPSERT_RETRIES = 3;

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    try {
      return JSON.stringify(e);
    } catch {
      /* circular ref fallback below */
    }
  }
  return `[${typeof e}] ${String(e)}`;
}

export function capMsg(msg: string, max = 2000): string {
  return msg.length <= max ? msg : msg.slice(0, max - 14) + '...[truncated]';
}

function isTransientError(message: string): boolean {
  const transient = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'socket hang up',
    '503',
    '500',
    'fetch failed',
    'network',
  ];
  return transient.some((t) => message.toLowerCase().includes(t.toLowerCase()));
}

export async function batchUpsert<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  rows: T[],
  onConflict: string,
  label: string,
): Promise<{ success: number; errors: number }> {
  let success = 0,
    errors = 0;
  const total = Math.ceil(rows.length / BATCH_SIZE);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      await withRetry(
        async () => {
          const { error } = await supabase
            .from(table)
            .upsert(batch, { onConflict, ignoreDuplicates: false });
          if (error) throw error;
        },
        {
          maxRetries: MAX_UPSERT_RETRIES - 1,
          isTransient: (err) => isTransientError(errMsg(err)),
          label: `Sync ${label} batch`,
        },
      );
      success += batch.length;
    } catch (err) {
      logger.error(`[Sync] ${label} batch error`, { error: errMsg(err) });
      errors += batch.length;
    }
  }
  if (total > 1) logger.info(`[Sync] ${label} batch complete`, { success, errors, batches: total });
  return { success, errors };
}

export function authorizeCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET not set' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function initSupabase():
  | { supabase: ReturnType<typeof getSupabaseAdmin> }
  | { error: NextResponse } {
  try {
    return { supabase: getSupabaseAdmin() };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return {
      error: NextResponse.json(
        { success: false, error: `Supabase init failed: ${msg}` },
        { status: 500 },
      ),
    };
  }
}

const ANOMALY_THRESHOLD = 0.5;
const ANOMALY_MIN_RECORDS = 20;
const CONSECUTIVE_DROP_RUNS = 3;

export class SyncLogger {
  id: number | null = null;
  private startTime: number;

  constructor(
    private supabase: ReturnType<typeof getSupabaseAdmin>,
    private syncType: SyncType,
    existingId?: number | null,
  ) {
    this.startTime = Date.now();
    if (existingId) this.id = existingId;
  }

  async start() {
    try {
      const { data: logRow } = await this.supabase
        .from('sync_log')
        .insert({ sync_type: this.syncType, started_at: new Date().toISOString(), success: false })
        .select('id')
        .single();
      this.id = logRow?.id ?? null;
    } catch (_e) {
      logger.warn(`[${this.syncType}] sync_log insert failed`, { error: errMsg(_e) });
    }
  }

  async finalize(success: boolean, errorMessage: string | null, metrics: Record<string, unknown>) {
    if (!this.id) return;
    const durationMs = Date.now() - this.startTime;
    try {
      await this.supabase
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          success,
          error_message: errorMessage ? capMsg(errorMessage) : null,
          metrics,
        })
        .eq('id', this.id);
    } catch (_e) {
      logger.warn(`[${this.syncType}] sync_log finalize failed`, { error: errMsg(_e) });
    }

    if (success) {
      await this.checkRecordCountAnomaly(metrics);
      await this.checkDurationAnomaly(durationMs);
    }
  }

  private extractRecordCount(m: Record<string, unknown>): number | null {
    if (typeof m.records === 'number') return m.records;
    if (typeof m.proposals_synced === 'number') return m.proposals_synced;
    if (typeof m.votes_synced === 'number') return m.votes_synced;
    if (typeof m.dreps_enriched === 'number') return m.dreps_enriched;
    return null;
  }

  private async checkRecordCountAnomaly(metrics: Record<string, unknown>) {
    const currentCount = this.extractRecordCount(metrics);
    if (currentCount === null) return;

    try {
      const { data: prevRuns } = await this.supabase
        .from('sync_log')
        .select('metrics')
        .eq('sync_type', this.syncType)
        .eq('success', true)
        .neq('id', this.id)
        .order('finished_at', { ascending: false })
        .limit(CONSECUTIVE_DROP_RUNS);

      if (!prevRuns || prevRuns.length === 0) return;

      const prevCounts = prevRuns
        .map((r) => this.extractRecordCount((r.metrics ?? {}) as Record<string, unknown>))
        .filter((c): c is number => c !== null && c >= ANOMALY_MIN_RECORDS);

      if (prevCounts.length === 0) return;

      const prevCount = prevCounts[0];
      const ratio = currentCount / prevCount;

      if (ratio < ANOMALY_THRESHOLD) {
        const consecutiveDrops = prevCounts.filter(
          (c, i) => i > 0 && prevCounts[i - 1] > 0 && c / prevCounts[i - 1] < ANOMALY_THRESHOLD,
        ).length;
        const totalDrops = consecutiveDrops + 1;

        const severity =
          totalDrops >= CONSECUTIVE_DROP_RUNS ? 'persistent degradation' : 'single-run drop';

        logger.warn(`[${this.syncType}] Record count anomaly`, {
          severity,
          currentCount,
          prevCount,
          ratio: parseFloat(ratio.toFixed(2)),
          streak: totalDrops,
        });
        await alertDiscord(
          `Record Count Anomaly — ${this.syncType}`,
          `Current: ${currentCount}, Previous: ${prevCount} (${Math.round(ratio * 100)}% of expected). ${severity} (streak: ${totalDrops}). Possible truncated API response.`,
        );
        await emitPostHog(true, this.syncType, 0, {
          event_override: 'sync_anomaly_detected',
          current_count: currentCount,
          previous_count: prevCount,
          ratio,
          consecutive_drops: totalDrops,
          severity,
        });
      }
    } catch {
      /* anomaly check is best-effort */
    }
  }

  private async checkDurationAnomaly(durationMs: number) {
    if (durationMs > 600_000) {
      logger.warn(`[${this.syncType}] Sync duration exceeded 10 min`, {
        durationSeconds: Math.round(durationMs / 1000),
      });
      await emitPostHog(true, this.syncType, durationMs, {
        event_override: 'sync_duration_warning',
      });
    }
  }

  get elapsed() {
    return Date.now() - this.startTime;
  }
}

export async function emitPostHog(
  success: boolean,
  syncType: SyncType,
  durationMs: number,
  metrics: Record<string, unknown>,
) {
  try {
    const { captureServerEvent } = await import('@/lib/posthog-server');
    const eventName =
      (metrics.event_override as string) || (success ? 'sync_completed' : 'sync_failed');
    const { event_override: _, ...rest } = metrics;
    captureServerEvent(eventName, {
      sync_type: syncType,
      duration_ms: durationMs,
      ...rest,
    });
  } catch (_e) {
    /* posthog optional */
  }
}

/**
 * Send an alert to the configured Discord webhook.
 * Retries once after 5s on failure. Never throws — alerting must not crash callers.
 */
export async function alertDiscord(title: string, details: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  await withRetry(
    async () => {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `⚠️ ${title}`,
              description: details,
              color: 0xf59e0b,
              footer: { text: 'DRepScore Sync Monitor' },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(`Discord webhook returned ${res.status}`);
    },
    { maxRetries: 1, baseDelayMs: 5000, label: 'alertDiscord' },
  ).catch(() => {
    // swallow — alerting should not crash the caller
  });
}

/**
 * Send a critical alert email via Resend.
 * Never throws — alerting must not crash callers.
 */
export async function alertEmail(subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'DRepScore Alerts <alerts@drepscore.io>',
        to: ['admin@drepscore.io'],
        subject: `[DRepScore Alert] ${subject}`,
        text: body,
      }),
    });
  } catch {
    // swallow — alerting should not crash the caller
  }
}

/**
 * Send a critical alert to all channels (Discord + Email).
 * Never throws — uses allSettled to ensure both channels are attempted.
 */
export async function alertCritical(title: string, details: string): Promise<void> {
  await Promise.allSettled([alertDiscord(title, details), alertEmail(title, details)]);
}

/**
 * Ping an external heartbeat URL (BetterStack/Cronitor).
 * Fire-and-forget — gracefully skips if URL not configured.
 */
export async function pingHeartbeat(envKey: string): Promise<void> {
  const url = process.env[envKey];
  if (!url) return;
  try {
    await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5_000) });
  } catch (e) {
    logger.warn(`[Heartbeat] ${envKey} ping failed`, { error: errMsg(e) });
  }
}

/**
 * Triggers a deploy hook for the analytics dashboard.
 * Fire-and-forget — never throws, only logs warnings on failure.
 * Waits 5s before firing to let sync_log writes settle in the DB.
 */
export async function triggerAnalyticsDeploy(syncType: SyncType): Promise<void> {
  const hook = process.env.ANALYTICS_DEPLOY_HOOK;
  if (!hook) return;
  try {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      logger.info(`[${syncType}] Analytics deploy hook triggered`, { status: res.status });
    } else {
      logger.warn(`[${syncType}] Analytics deploy hook returned non-OK`, { status: res.status });
    }
  } catch (e) {
    logger.warn(`[${syncType}] Analytics deploy hook failed`, { error: errMsg(e) });
  }
}

/**
 * Fetch all rows from a Supabase table, paginating in chunks of PAGE_SIZE
 * to bypass the PostgREST default 1000-row limit.
 */
const PAGE_SIZE = 1000;

export async function fetchAll<T = Record<string, unknown>>(query: {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
}): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await query.range(from, to);
    if (error) throw new Error(`fetchAll page ${page}: ${errMsg(error)}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}
