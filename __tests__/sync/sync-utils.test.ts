import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({
  upsert: mockUpsert,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}));

import {
  batchUpsert,
  errMsg,
  capMsg,
  alertDiscord,
  pingHeartbeat,
  fetchAll,
} from '@/lib/sync-utils';

describe('sync-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  describe('errMsg', () => {
    it('extracts Error message', () => {
      expect(errMsg(new Error('test'))).toBe('test');
    });
    it('converts non-Error to string', () => {
      expect(errMsg(42)).toBe('[number] 42');
    });
  });

  describe('capMsg', () => {
    it('returns short messages unchanged', () => {
      expect(capMsg('short')).toBe('short');
    });
    it('truncates long messages', () => {
      const long = 'a'.repeat(3000);
      const result = capMsg(long);
      expect(result.length).toBe(2000);
      expect(result).toContain('[truncated]');
    });
  });

  describe('batchUpsert', () => {
    const supabase = { from: mockFrom } as any;

    it('upserts all rows successfully', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      const result = await batchUpsert(supabase, 'test', rows, 'id', 'test');
      expect(result.success).toBe(5);
      expect(result.errors).toBe(0);
      expect(result.errorMessages).toEqual([]);
    });

    it('retries on transient error', async () => {
      mockUpsert
        .mockResolvedValueOnce({ error: { message: 'ECONNRESET' } })
        .mockResolvedValueOnce({ error: null });

      const rows = [{ id: 1 }];
      const result = await batchUpsert(supabase, 'test', rows, 'id', 'test');
      expect(result.success).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-transient error', async () => {
      mockUpsert.mockResolvedValue({ error: { message: 'violates foreign key constraint' } });

      const rows = [{ id: 1 }];
      const result = await batchUpsert(supabase, 'test', rows, 'id', 'test');
      expect(result.success).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.errorMessages).toEqual(['violates foreign key constraint']);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    it('captures sampled batch errors for sync_log diagnostics', async () => {
      mockUpsert
        .mockResolvedValueOnce({ error: { message: 'first batch failed' } })
        .mockResolvedValueOnce({ error: { message: 'second batch failed' } })
        .mockResolvedValueOnce({ error: { message: 'third batch failed' } })
        .mockResolvedValueOnce({ error: { message: 'fourth batch failed' } });

      const rows = Array.from({ length: 350 }, (_, i) => ({ id: i }));
      const result = await batchUpsert(supabase, 'test', rows, 'id', 'test');

      expect(result.success).toBe(0);
      expect(result.errors).toBe(350);
      expect(result.errorMessages).toEqual([
        'first batch failed',
        'second batch failed',
        'third batch failed',
      ]);
    });

    it('handles multiple batches', async () => {
      const rows = Array.from({ length: 250 }, (_, i) => ({ id: i }));
      const result = await batchUpsert(supabase, 'test', rows, 'id', 'test');
      expect(result.success).toBe(250);
      expect(mockUpsert).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    });
  });

  describe('fetchAll', () => {
    it('paginates until a short page is returned', async () => {
      const range = vi
        .fn()
        .mockResolvedValueOnce({
          data: Array.from({ length: 1000 }, (_, id) => ({ id })),
          error: null,
        })
        .mockResolvedValueOnce({
          data: Array.from({ length: 179 }, (_, id) => ({ id: id + 1000 })),
          error: null,
        });

      const rows = await fetchAll<{ id: number }>(() => ({ range }));

      expect(rows).toHaveLength(1179);
      expect(range).toHaveBeenNthCalledWith(1, 0, 999);
      expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    });
  });

  describe('alertDiscord', () => {
    it('skips when DISCORD_WEBHOOK_URL not set', async () => {
      delete process.env.DISCORD_WEBHOOK_URL;
      await alertDiscord('test', 'details');
      // no error thrown
    });
  });

  describe('pingHeartbeat', () => {
    it('skips when env var not set', async () => {
      delete process.env.HEARTBEAT_URL_PROPOSALS;
      await pingHeartbeat('HEARTBEAT_URL_PROPOSALS');
      // no error thrown
    });
  });
});
