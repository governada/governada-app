import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const { mockAuditInsert, mockIncidentInsert, mockIncidentEventInsert, mockFrom } = vi.hoisted(
  () => ({
    mockAuditInsert: vi.fn(),
    mockIncidentInsert: vi.fn(),
    mockIncidentEventInsert: vi.fn(),
    mockFrom: vi.fn(),
  }),
);

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/adminAuth', () => ({
  isAdminWallet: () => true,
}));

import { logSystemsIncident } from '@/app/api/admin/systems/incidents/route';

function createIncidentsChain() {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: mockIncidentInsert,
  };
}

function createIncidentEventsChain() {
  return {
    insert: mockIncidentEventInsert,
  };
}

function createAuditLogChain() {
  return {
    insert: mockAuditInsert,
  };
}

describe('systems incidents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditInsert.mockResolvedValue({ error: null });
    mockIncidentEventInsert.mockResolvedValue({ error: null });
    mockIncidentInsert.mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        entry_type: 'drill',
        title: 'Readiness drill',
      },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'systems_incidents') return createIncidentsChain();
      if (table === 'systems_incident_events') return createIncidentEventsChain();
      if (table === 'admin_audit_log') return createAuditLogChain();
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('logs incident and drill entries into durable state and the admin audit trail', async () => {
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
    expect(body.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(mockIncidentEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        incident_id: '11111111-1111-4111-8111-111111111111',
        event_type: 'created',
      }),
    );
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'addr_test_admin',
        action: 'log_systems_incident',
        target: '11111111-1111-4111-8111-111111111111',
        payload: expect.objectContaining({
          entryType: 'drill',
          severity: 'drill',
          systemsAffected: ['readiness', 'pipeline'],
        }),
      }),
    );
  });
});
