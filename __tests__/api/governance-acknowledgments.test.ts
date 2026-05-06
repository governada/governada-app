import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockAcknowledgeItem = vi.fn();
const mockDismissItem = vi.fn();
const mockGetRedis = vi.fn();
const mockLimit = vi.fn();
const mockRequireAuth = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  }));

  Object.assign(Ratelimit, {
    slidingWindow: vi.fn().mockReturnValue('window'),
  });

  return { Ratelimit };
});

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
}));

vi.mock('@/lib/supabaseAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/governance/acknowledgments', () => ({
  acknowledgeItem: (...args: unknown[]) => mockAcknowledgeItem(...args),
  dismissItem: (...args: unknown[]) => mockDismissItem(...args),
}));

import { POST } from '@/app/api/governance/acknowledgments/route';

const wallet = `stake1${'q'.repeat(51)}`;

describe('POST /api/governance/acknowledgments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedis.mockReturnValue({});
    mockLimit.mockResolvedValue({ success: true, remaining: 59 });
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', wallet });
    mockAcknowledgeItem.mockResolvedValue({
      user_id_or_stake_address: wallet,
      item_id: 'item1',
      acknowledged_at: '2026-05-06T14:00:00.000Z',
      dismissed_at: null,
    });
    mockDismissItem.mockResolvedValue({
      user_id_or_stake_address: wallet,
      item_id: 'item1',
      acknowledged_at: null,
      dismissed_at: '2026-05-06T14:00:00.000Z',
    });
  });

  it('requires authentication before writing lifecycle state', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'acknowledge', itemId: 'item1', userIdOrStakeAddress: 'victim-user' },
      }),
    );

    expect(res.status).toBe(401);
    expect(mockAcknowledgeItem).not.toHaveBeenCalled();
    expect(mockDismissItem).not.toHaveBeenCalled();
  });

  it('rejects spoofed lifecycle identifiers from the body', async () => {
    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'dismiss', itemId: 'item1', userIdOrStakeAddress: 'victim-user' },
      }),
    );
    const body = (await parseJson(res)) as { error: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe('Identifier does not match authenticated user');
    expect(mockDismissItem).not.toHaveBeenCalled();
  });

  it('rejects a stake address that does not match the authenticated wallet', async () => {
    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'acknowledge', itemId: 'item1', stakeAddress: `stake1${'z'.repeat(51)}` },
      }),
    );
    const body = (await parseJson(res)) as { error: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe('Stake address does not match authenticated wallet');
    expect(mockAcknowledgeItem).not.toHaveBeenCalled();
  });

  it('acknowledges with a verified body identifier and returns the lifecycle item', async () => {
    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'acknowledge', itemId: 'item1', userIdOrStakeAddress: wallet },
      }),
    );
    const body = (await parseJson(res)) as {
      ok: boolean;
      item: {
        user_id_or_stake_address: string;
        item_id: string;
        acknowledged_at: string;
        dismissed_at: null;
      };
    };

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      item: {
        user_id_or_stake_address: wallet,
        item_id: 'item1',
        acknowledged_at: '2026-05-06T14:00:00.000Z',
        dismissed_at: null,
      },
    });
    expect(mockAcknowledgeItem).toHaveBeenCalledWith({
      userIdOrStakeAddress: wallet,
      itemId: 'item1',
    });
    expect(mockDismissItem).not.toHaveBeenCalled();
  });

  it('uses the verified wallet as the default lifecycle owner', async () => {
    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'acknowledge', itemId: 'item1' },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockAcknowledgeItem).toHaveBeenCalledWith({
      userIdOrStakeAddress: wallet,
      itemId: 'item1',
    });
  });

  it('dismisses with a verified user id and returns the lifecycle item', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', wallet: undefined });
    mockDismissItem.mockResolvedValue({
      user_id_or_stake_address: 'user-1',
      item_id: 'item1',
      acknowledged_at: null,
      dismissed_at: '2026-05-06T14:00:00.000Z',
    });

    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'dismiss', itemId: 'item1', userIdOrStakeAddress: 'user-1' },
      }),
    );
    const body = (await parseJson(res)) as {
      ok: boolean;
      item: {
        user_id_or_stake_address: string;
        item_id: string;
        acknowledged_at: null;
        dismissed_at: string;
      };
    };

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      item: {
        user_id_or_stake_address: 'user-1',
        item_id: 'item1',
        acknowledged_at: null,
        dismissed_at: '2026-05-06T14:00:00.000Z',
      },
    });
    expect(mockDismissItem).toHaveBeenCalledWith({
      userIdOrStakeAddress: 'user-1',
      itemId: 'item1',
    });
    expect(mockAcknowledgeItem).not.toHaveBeenCalled();
  });

  it('falls back to authenticated user id when no wallet is present', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', wallet: undefined });

    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'dismiss', itemId: 'item1' },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockDismissItem).toHaveBeenCalledWith({
      userIdOrStakeAddress: 'user-1',
      itemId: 'item1',
    });
  });

  it('returns 400 for malformed request bodies before writing lifecycle state', async () => {
    const res = await POST(
      createRequest('/api/governance/acknowledgments', {
        method: 'POST',
        body: { action: 'acknowledge' },
      }),
    );
    const body = (await parseJson(res)) as { error: string; details: string[] };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details.some((detail) => detail.includes('itemId'))).toBe(true);
    expect(mockAcknowledgeItem).not.toHaveBeenCalled();
    expect(mockDismissItem).not.toHaveBeenCalled();
  });
});
