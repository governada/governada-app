import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn(() => ({ insert: insertMock })),
    rpc: rpcMock,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('sourceHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
  });

  it('records successful source calls without changing the return value', async () => {
    const { recordSourceCall } = await import('@/lib/sourceHealth');

    const result = await recordSourceCall('koios', 'drep_info', async () => ({ ok: true }));

    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'koios',
        endpoint: 'drep_info',
        status_code: 200,
        success: true,
        error_class: null,
      }),
    );
  });

  it('records classified failures and rethrows the original error', async () => {
    const { recordSourceCall } = await import('@/lib/sourceHealth');
    const error = new Error('Koios API error: 429 Too Many Requests');

    await expect(
      recordSourceCall('koios', 'proposal_list', async () => {
        throw error;
      }),
    ).rejects.toThrow(error);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'koios',
        endpoint: 'proposal_list',
        status_code: 429,
        success: false,
        error_class: 'rate_limit',
      }),
    );
  });

  it('maps the SQL aggregator result to SourceHealthSummary', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          source: 'blockfrost',
          endpoint: 'governance_dreps',
          window_minutes: 1440,
          call_count: 12,
          success_rate: 0.75,
          p50_latency_ms: 120,
          p95_latency_ms: 900,
          error_breakdown: { timeout: 2, rate_limit: 1 },
          last_success_at: '2026-05-09T12:00:00.000Z',
          last_failure_at: '2026-05-09T12:05:00.000Z',
        },
      ],
      error: null,
    });

    const { getSourceHealthSummary } = await import('@/lib/sourceHealth');
    const result = await getSourceHealthSummary(1440);

    expect(rpcMock).toHaveBeenCalledWith('get_source_health_summary', {
      input_window_minutes: 1440,
    });
    expect(result).toEqual([
      {
        source: 'blockfrost',
        endpoint: 'governance_dreps',
        windowMinutes: 1440,
        callCount: 12,
        successRate: 0.75,
        p50LatencyMs: 120,
        p95LatencyMs: 900,
        errorBreakdown: { timeout: 2, rate_limit: 1 },
        lastSuccessAt: '2026-05-09T12:00:00.000Z',
        lastFailureAt: '2026-05-09T12:05:00.000Z',
      },
    ]);
  });
});
