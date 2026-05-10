import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type SourceVendor = 'koios' | 'blockfrost';

export type SourceHealthSummary = {
  source: SourceVendor;
  endpoint: string;
  windowMinutes: number;
  callCount: number;
  successRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  errorBreakdown: Record<string, number>;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

type SourceHealthRow = {
  source: string;
  endpoint: string;
  window_minutes: number;
  call_count: number;
  success_rate: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  error_breakdown: Record<string, number> | null;
  last_success_at: string | null;
  last_failure_at: string | null;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function getErrorStatusCode(message: string): number | null {
  const statusMatch = message.match(/\b([45]\d{2})\b/u);
  if (!statusMatch) return null;
  const parsed = Number.parseInt(statusMatch[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyError(error: unknown): { statusCode: number | null; errorClass: string } {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();
  const statusCode = getErrorStatusCode(message);

  if (statusCode === 429 || lower.includes('rate limit')) {
    return { statusCode: statusCode ?? 429, errorClass: 'rate_limit' };
  }
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    (error instanceof Error && error.name === 'AbortError')
  ) {
    return { statusCode, errorClass: 'timeout' };
  }
  if (statusCode && statusCode >= 500) {
    return { statusCode, errorClass: 'http_5xx' };
  }
  if (statusCode && statusCode >= 400) {
    return { statusCode, errorClass: 'http_4xx' };
  }

  return { statusCode, errorClass: 'network' };
}

async function insertSourceHealthEvent(input: {
  source: SourceVendor;
  endpoint: string;
  startedAt: string;
  latencyMs: number;
  statusCode: number | null;
  success: boolean;
  errorClass: string | null;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('source_health_events').insert({
      source: input.source,
      endpoint: input.endpoint,
      started_at: input.startedAt,
      latency_ms: input.latencyMs,
      status_code: input.statusCode,
      success: input.success,
      error_class: input.errorClass,
    });

    if (error) {
      logger.warn('[SourceHealth] Failed to record source call', {
        source: input.source,
        endpoint: input.endpoint,
        error: error.message,
      });
    }
  } catch (error) {
    logger.warn('[SourceHealth] Failed to record source call', {
      source: input.source,
      endpoint: input.endpoint,
      error: getErrorMessage(error),
    });
  }
}

export async function recordSourceCall<T>(
  source: SourceVendor,
  endpoint: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  try {
    const result = await fn();
    await insertSourceHealthEvent({
      source,
      endpoint,
      startedAt,
      latencyMs: Date.now() - startedMs,
      statusCode: 200,
      success: true,
      errorClass: null,
    });
    return result;
  } catch (error) {
    const classified = classifyError(error);
    await insertSourceHealthEvent({
      source,
      endpoint,
      startedAt,
      latencyMs: Date.now() - startedMs,
      statusCode: classified.statusCode,
      success: false,
      errorClass: classified.errorClass,
    });
    throw error;
  }
}

export async function getSourceHealthSummary(
  windowMinutes: number,
): Promise<SourceHealthSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('get_source_health_summary', {
    input_window_minutes: windowMinutes,
  });

  if (error) {
    throw new Error(`Failed to read source health summary: ${error.message}`);
  }

  return ((data ?? []) as SourceHealthRow[]).map((row) => ({
    source: row.source === 'koios' ? 'koios' : 'blockfrost',
    endpoint: row.endpoint,
    windowMinutes: row.window_minutes,
    callCount: row.call_count,
    successRate: row.success_rate,
    p50LatencyMs: row.p50_latency_ms,
    p95LatencyMs: row.p95_latency_ms,
    errorBreakdown: row.error_breakdown ?? {},
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
  }));
}
