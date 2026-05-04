import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockCaptureServerEvent = vi.fn();
const mockGetRedis = vi.fn();
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

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
}));

import { POST } from '@/app/api/delegation/events/route';

describe('POST /api/delegation/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedis.mockReturnValue({});
    mockLimit.mockResolvedValue({ success: true, remaining: 29 });
  });

  it('captures both delegation success events server-side', async () => {
    const req = createRequest('/api/delegation/events', {
      method: 'POST',
      headers: { referer: 'https://governada-app-app-pr-948.up.railway.app/dev/delegation-test' },
      body: {
        stakeAddress: 'stake1u9rl9nvxdummy0000000000000000000000000000000000000000',
        drepId: 'drep1_test4',
        previousDrepId: null,
        txHash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566',
        stakeRegistered: false,
        mode: 'sandbox',
      },
    });

    const res = await POST(req);
    const body = (await parseJson(res)) as { captured: boolean; events: string[] };

    expect(res.status).toBe(200);
    expect(body.captured).toBe(true);
    expect(body.events).toEqual(['delegation_completed', 'delegated']);
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
      'stake1u9rl9nvxdummy0000000000000000000000000000000000000000',
    );
    expect(mockCaptureServerEvent).toHaveBeenNthCalledWith(
      2,
      'delegated',
      expect.objectContaining({
        tx_hash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566',
      }),
      'stake1u9rl9nvxdummy0000000000000000000000000000000000000000',
    );
  });

  it('rejects invalid payloads before capturing analytics', async () => {
    const req = createRequest('/api/delegation/events', {
      method: 'POST',
      body: {
        stakeAddress: 'addr_test1notamainnetstakeaddress',
        drepId: 'drep1_test4',
        txHash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566',
        stakeRegistered: false,
        mode: 'sandbox',
      },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
