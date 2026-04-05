import { describe, expect, it } from 'vitest';
import {
  buildSystemsIncidentPayload,
  buildSystemsIncidentSummary,
  parseSystemsIncidentHistory,
  SYSTEMS_INCIDENT_LOG_ACTION,
} from '@/lib/admin/systemsIncidents';

describe('systems incident helpers', () => {
  it('warns when no incident or drill history exists', () => {
    const summary = buildSystemsIncidentSummary({
      history: [],
      now: new Date('2026-04-04T12:00:00.000Z'),
    });

    expect(summary.status).toBe('warning');
    expect(summary.headline).toMatch(/has not started yet/i);
    expect(summary.currentValue).toMatch(/no drill yet/i);
  });

  it('goes critical when a high-severity incident remains open', () => {
    const history = parseSystemsIncidentHistory([
      {
        action: SYSTEMS_INCIDENT_LOG_ACTION,
        target: 'incident:2026-04-04:koios-outage',
        created_at: '2026-04-04T12:15:00.000Z',
        payload: {
          incidentDate: '2026-04-04',
          entryType: 'incident',
          severity: 'p1',
          status: 'open',
          title: 'Koios outage',
          detectedBy: 'Alert',
          systemsAffected: ['pipeline', 'governance reads'],
          userImpact: 'Public governance reads would drift stale if the dependency stayed down.',
          rootCause: 'The dependency health check showed the upstream endpoint was unavailable.',
          mitigation: 'Switched the team into stabilization mode and monitored the fallback path.',
          permanentFix: 'Add a dependency drill and stronger degraded-state operator prompts.',
          followUpOwner: 'Founder + agents',
          timeToAcknowledgeMinutes: 8,
          timeToMitigateMinutes: 22,
          timeToResolveMinutes: null,
        },
      },
    ]);

    const summary = buildSystemsIncidentSummary({
      history,
      now: new Date('2026-04-04T12:30:00.000Z'),
    });

    expect(summary.status).toBe('critical');
    expect(summary.openIncidentCount).toBe(1);
    expect(summary.headline).toMatch(/still open/i);
  });

  it('stays good when the latest drill is recent and incidents are resolved', () => {
    const history = parseSystemsIncidentHistory([
      {
        action: SYSTEMS_INCIDENT_LOG_ACTION,
        target: 'drill:2026-04-01:koios-outage',
        created_at: '2026-04-01T12:00:00.000Z',
        payload: {
          incidentDate: '2026-04-01',
          entryType: 'drill',
          severity: 'drill',
          status: 'resolved',
          title: 'Koios outage tabletop drill',
          detectedBy: 'Manual review',
          systemsAffected: ['pipeline', 'readiness'],
          userImpact: 'Rehearsed what users would see if Koios reads became stale.',
          rootCause:
            'The drill exposed that degraded-state language still needed a named response.',
          mitigation: 'Walked through detection, acknowledgement, and founder comms.',
          permanentFix:
            'Capture the drill in the systems cockpit and schedule the next failure mode.',
          followUpOwner: 'Founder + agents',
          timeToAcknowledgeMinutes: 4,
          timeToMitigateMinutes: 18,
          timeToResolveMinutes: 35,
        },
      },
    ]);

    const summary = buildSystemsIncidentSummary({
      history,
      now: new Date('2026-04-04T12:00:00.000Z'),
    });

    expect(summary.status).toBe('good');
    expect(summary.drillCount).toBe(1);
    expect(summary.currentValue).toMatch(/last drill 3d ago/i);
  });

  it('rejects drill entries that use incident-only statuses', () => {
    expect(() =>
      buildSystemsIncidentPayload({
        incidentDate: '2026-04-04',
        entryType: 'drill',
        severity: 'drill',
        status: 'open',
        title: 'Readiness drill',
        detectedBy: 'Manual review',
        systemsAffected: ['readiness'],
        userImpact: 'Rehearsed what users would see if the readiness path drifted out of sync.',
        rootCause: 'The exercise targeted a missing operator response loop.',
        mitigation: 'Walked through the detection and acknowledgement sequence.',
        permanentFix: 'Log drills in the cockpit and track follow-up explicitly.',
        followUpOwner: 'Founder + agents',
        timeToAcknowledgeMinutes: 4,
        timeToMitigateMinutes: 15,
        timeToResolveMinutes: 22,
      }),
    ).toThrow(/resolved or follow-up pending/i);
  });
});
