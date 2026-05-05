import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockCaptureServerEvent = vi.fn();
const mockGetRedis = vi.fn();
const mockInsert = vi.fn();
const mockIsSandboxMode = vi.fn();
const mockLimit = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  }));

  Object.assign(Ratelimit, {
    slidingWindow: vi.fn().mockReturnValue('window'),
  });

  return { Ratelimit };
});

vi.mock('@/lib/delegation/mode', () => ({
  isSandboxMode: () => mockIsSandboxMode(),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      insert: (data: unknown) => {
        mockInsert(table, data);
        return mockInsert();
      },
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
}));

import { POST } from '@/app/api/delegation/sandbox/route';

describe('POST /api/delegation/sandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedis.mockReturnValue({});
    mockIsSandboxMode.mockReturnValue(true);
    mockLimit.mockResolvedValue({ success: true, remaining: 9 });
    mockInsert.mockResolvedValue({ error: null });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('2fe922f0-b59a-4b77-ae1e-20b4e96a8566');
  });

  it('records the sandbox delegation and captures both success events server-side', async () => {
    const stakeAddress = `stake1${'q'.repeat(51)}`;
    const req = createRequest('/api/delegation/sandbox', {
      method: 'POST',
      headers: { referer: 'https://governada-app-app-pr-948.up.railway.app/dev/delegation-test' },
      body: { stakeAddress, targetDrepId: 'drep1_test4' },
    });

    const res = await POST(req);
    const body = (await parseJson(res)) as { mode: string; txHash: string; drepId: string };

    expect(res.status).toBe(200);
    expect(body).toEqual({
      mode: 'sandbox',
      txHash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566',
      drepId: 'drep1_test4',
    });
    expect(mockInsert).toHaveBeenCalledWith(
      'sandbox_delegations',
      expect.objectContaining({
        stake_address: stakeAddress,
        target_drep_id: 'drep1_test4',
        simulated_tx_hash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566',
      }),
    );
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(2);
    expect(mockCaptureServerEvent).toHaveBeenNthCalledWith(
      1,
      'delegation_completed',
      expect.objectContaining({
        drep_id: 'drep1_test4',
        previous_drep_id: null,
        tx_hash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566',
        stake_registered: false,
        mode: 'sandbox',
        $current_url: 'https://governada-app-app-pr-948.up.railway.app/dev/delegation-test',
        $host: 'governada-app-app-pr-948.up.railway.app',
      }),
      stakeAddress,
    );
    expect(mockCaptureServerEvent).toHaveBeenNthCalledWith(
      2,
      'delegated',
      expect.objectContaining({
        tx_hash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566',
        mode: 'sandbox',
      }),
      stakeAddress,
    );
  });

  it('does not capture analytics when sandbox mode is disabled', async () => {
    mockIsSandboxMode.mockReturnValue(false);

    const req = createRequest('/api/delegation/sandbox', {
      method: 'POST',
      body: { stakeAddress: `stake1${'q'.repeat(51)}`, targetDrepId: 'drep1_test4' },
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
