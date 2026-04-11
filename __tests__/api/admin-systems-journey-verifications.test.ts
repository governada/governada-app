import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const { mockInsert, mockLimit, mockFrom } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockLimit: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/adminAuth', () => ({
  isAdminWallet: (wallet?: string | null) => wallet === 'addr_test_admin',
}));

import {
  loadSystemsJourneyVerifications,
  recordSystemsJourneyVerifications,
} from '@/app/api/admin/systems/journey-verifications/route';

function createInsertChain() {
  return {
    insert: mockInsert,
  };
}

function createSelectChain() {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: mockLimit,
  };
}

describe('systems journey verification route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SYSTEMS_JOURNEY_VERIFICATION_TOKEN', 'journey-secret');
    mockInsert.mockResolvedValue({ error: null });
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 'verification-1',
          journey_id: 'J01',
          verification_type: 'ci',
          status: 'passed',
          workflow_name: 'CI',
          job_name: 'e2e-critical',
          commit_sha: 'abc123',
          run_url: 'https://github.com/example/run/1',
          executed_at: '2026-04-10T00:00:00.000Z',
          details: { ref: 'refs/heads/main' },
        },
      ],
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'systems_journey_verifications') return createSelectChain();
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('persists journey verification payloads with the dedicated verification token', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'systems_journey_verifications') return createInsertChain();
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await recordSystemsJourneyVerifications(
      createRequest('/api/admin/systems/journey-verifications', {
        method: 'POST',
        headers: { authorization: 'Bearer journey-secret' },
        body: {
          verificationType: 'ci',
          workflowName: 'CI',
          jobName: 'e2e-critical',
          commitSha: 'abc123',
          runUrl: 'https://github.com/example/run/1',
          executedAt: '2026-04-10T00:00:00.000Z',
          journeys: [
            {
              journeyId: 'J01',
              status: 'passed',
              details: { ref: 'refs/heads/main', refName: 'main' },
            },
          ],
        },
      }),
      { requestId: 'req-journey' },
    );

    const body = (await parseJson(response)) as { inserted: number };

    expect(response.status).toBe(201);
    expect(body.inserted).toBe(1);
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        journey_id: 'J01',
        verification_type: 'ci',
        wallet_address: 'system:journey-verifications',
        details: expect.objectContaining({ ref: 'refs/heads/main', refName: 'main' }),
      }),
    ]);
  });

  it('returns the latest durable journey verification records for admins', async () => {
    const response = await loadSystemsJourneyVerifications(
      createRequest('/api/admin/systems/journey-verifications'),
      { requestId: 'req-load', wallet: 'addr_test_admin' },
    );

    const body = (await parseJson(response)) as Array<{ journey_id: string }>;

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]?.journey_id).toBe('J01');
    expect(mockLimit).toHaveBeenCalledWith(50);
  });
});
