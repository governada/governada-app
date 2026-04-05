import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const { mockInsert, mockFrom } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/adminAuth', () => ({
  isAdminWallet: () => true,
}));

import { logSystemsIncident } from '@/app/api/admin/systems/incidents/route';

function createAuditLogChain() {
  return {
    insert: mockInsert,
  };
}

describe('systems incidents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_audit_log') {
        return createAuditLogChain();
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('logs incident and drill entries into the admin audit trail', async () => {
    const response = await logSystemsIncident(
      createRequest('/api/admin/systems/incidents', {
        method: 'POST',
        body: {
          incidentDate: '2026-04-04',
          entryType: 'drill',
          severity: 'drill',
          status: 'resolved',
          title: 'Readiness drill',
          detectedBy: 'Manual review',
          systemsAffected: ['readiness', 'pipeline'],
          userImpact:
            'Rehearsed the founder response if readiness checks stayed green while data drifted.',
          rootCause: 'The drill targeted a stale-data communication gap.',
          mitigation: 'Walked through alerting, operator checks, and public honesty expectations.',
          permanentFix: 'Add a durable drill trail in the systems cockpit.',
          followUpOwner: 'Founder + agents',
          timeToAcknowledgeMinutes: 5,
          timeToMitigateMinutes: 20,
          timeToResolveMinutes: 35,
        },
      }),
      { requestId: 'req-1', wallet: 'addr_test_admin' },
    );
    const body = (await parseJson(response)) as { id: string; entryType: string; title: string };

    expect(response.status).toBe(201);
    expect(body.entryType).toBe('drill');
    expect(body.id).toMatch(/^drill:2026-04-04:/);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'addr_test_admin',
        action: 'log_systems_incident',
        target: expect.stringMatching(/^drill:2026-04-04:/),
        payload: expect.objectContaining({
          entryType: 'drill',
          severity: 'drill',
          systemsAffected: ['readiness', 'pipeline'],
        }),
      }),
    );
  });
});
