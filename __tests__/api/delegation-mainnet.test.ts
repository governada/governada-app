import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockCaptureServerEvent = vi.fn();
const mockGetRedis = vi.fn();
const mockLimit = vi.fn();
const mockRequireAuth = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  }));

  Object.assign(Ratelimit, {
    slidingWindow: vi.fn().mockReturnValue('window'),
  });

  return { Ratelimit };
});

vi.mock('@/lib/supabaseAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: (...args: unknown[]) => mockLoggerWarn(...args), error: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
}));

import { POST } from '@/app/api/delegation/mainnet/route';

const stakeAddress = `stake1${'q'.repeat(51)}`;
const validBody = {
  stakeAddress,
  targetDrepId: 'drep1_mainnet4',
  txHash: 'a'.repeat(64),
  previousDrepId: 'drep1_previous',
  stakeRegistered: true,
};

describe('POST /api/delegation/mainnet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedis.mockReturnValue({});
    mockLimit.mockResolvedValue({ success: true, remaining: 29 });
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', wallet: stakeAddress });
  });

  it('rejects requests without auth', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const req = createRequest('/api/delegation/mainnet', {
      method: 'POST',
      body: validBody,
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it('captures both success events server-side for valid authenticated mainnet delegations', async () => {
    const req = createRequest('/api/delegation/mainnet', {
      method: 'POST',
      headers: { referer: 'https://governada.io/dev/delegation-test' },
      body: validBody,
    });

    const res = await POST(req);
    const body = (await parseJson(res)) as { captured: boolean; mode: string; txHash: string };

    expect(res.status).toBe(200);
    expect(body).toEqual({
      captured: true,
      mode: 'mainnet',
      txHash: validBody.txHash,
    });
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(2);
    expect(mockCaptureServerEvent).toHaveBeenNthCalledWith(
      1,
      'delegation_completed',
      expect.objectContaining({
        drep_id: 'drep1_mainnet4',
        previous_drep_id: 'drep1_previous',
        tx_hash: validBody.txHash,
        stake_registered: true,
        mode: 'mainnet',
        $current_url: 'https://governada.io/dev/delegation-test',
        $host: 'governada.io',
      }),
      stakeAddress,
    );
    expect(mockCaptureServerEvent).toHaveBeenNthCalledWith(
      2,
      'delegated',
      expect.objectContaining({
        drep_id: 'drep1_mainnet4',
        tx_hash: validBody.txHash,
        mode: 'mainnet',
      }),
      stakeAddress,
    );
  });

  it('rejects captures when the body stake address does not match the authenticated wallet', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', wallet: `stake1${'z'.repeat(51)}` });
    const req = createRequest('/api/delegation/mainnet', {
      method: 'POST',
      body: validBody,
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it('accepts captures when auth has no wallet and logs a warning', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', wallet: undefined });
    const req = createRequest('/api/delegation/mainnet', {
      method: 'POST',
      body: validBody,
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Mainnet delegation capture accepted without wallet on auth context',
      expect.objectContaining({
        context: 'api/delegation/mainnet',
        userId: 'user-1',
        stakeAddress,
      }),
    );
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(2);
  });

  it('rejects sandbox-shaped tx hashes', async () => {
    const req = createRequest('/api/delegation/mainnet', {
      method: 'POST',
      body: { ...validBody, txHash: 'sandbox-2fe922f0-b59a-4b77-ae1e-20b4e96a8566' },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it('rejects malformed bodies', async () => {
    const req = createRequest('/api/delegation/mainnet', {
      method: 'POST',
      body: { ...validBody, stakeRegistered: 'yes' },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
