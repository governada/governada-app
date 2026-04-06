import { describe, expect, it } from 'vitest';
import {
  buildSystemsDrillCadenceTarget,
  buildSystemsIncidentPayload,
  buildSystemsIncidentRetroTarget,
  buildSystemsIncidentSummary,
  parseSystemsIncidentHistory,
  SYSTEMS_INCIDENT_LOG_ACTION,
} from '@/lib/admin/systemsIncidents';
import { toSystemsCommitment } from '@/lib/admin/systemsReview';

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

  it('suggests the first missing launch drill scenario when cadence has not started', () => {
    const summary = buildSystemsIncidentSummary({
      history: [],
      now: new Date('2026-04-05T12:00:00.000Z'),
    });

    const target = buildSystemsDrillCadenceTarget({
      summary,
      history: [],
      now: new Date('2026-04-05T12:00:00.000Z'),
    });

    expect(target?.reason).toBe('missing');
    expect(target?.suggestedScenario).toBe('data_freshness');
    expect(target?.title).toMatch(/first failure drill/i);
  });

  it('rotates to the next uncovered failure mode when cadence is stale', () => {
    const history = parseSystemsIncidentHistory([
      {
        action: SYSTEMS_INCIDENT_LOG_ACTION,
        target: 'drill:2026-01-20:stale-sync',
        created_at: '2026-01-20T12:00:00.000Z',
        payload: {
          incidentDate: '2026-01-20',
          entryType: 'drill',
          severity: 'drill',
          status: 'resolved',
          title: 'Stale sync drill',
          detectedBy: 'Manual review',
          systemsAffected: ['pipeline', 'supabase', 'freshness'],
          userImpact: 'Rehearsed stale governance data before public trust degraded.',
          rootCause: 'Simulated sync freshness drift and founder communications.',
          mitigation: 'Walked through detection, acknowledgement, and freeze criteria.',
          permanentFix: 'Keep the failure drill cadence alive.',
          followUpOwner: 'Founder + agents',
          timeToAcknowledgeMinutes: 5,
          timeToMitigateMinutes: 15,
          timeToResolveMinutes: 25,
        },
      },
    ]);

    const summary = buildSystemsIncidentSummary({
      history,
      now: new Date('2026-04-05T12:00:00.000Z'),
    });
    const target = buildSystemsDrillCadenceTarget({
      summary,
      history,
      now: new Date('2026-04-05T12:00:00.000Z'),
    });

    expect(target?.reason).toBe('stale');
    expect(target?.severity).toBe('critical');
    expect(target?.suggestedScenario).toBe('deploy_failure');
  });

  it('does not create a cadence nudge when the latest drill is still fresh', () => {
    const history = parseSystemsIncidentHistory([
      {
        action: SYSTEMS_INCIDENT_LOG_ACTION,
        target: 'drill:2026-04-01:rollback-rehearsal',
        created_at: '2026-04-01T12:00:00.000Z',
        payload: {
          incidentDate: '2026-04-01',
          entryType: 'drill',
          severity: 'drill',
          status: 'resolved',
          title: 'Deploy rollback drill',
          detectedBy: 'Manual review',
          systemsAffected: ['deploy', 'rollback', 'readiness'],
          userImpact: 'Rehearsed a failed deploy and rollback decision path.',
          rootCause: 'Simulated a broken release that required immediate recovery.',
          mitigation: 'Walked through rollback, readiness verification, and founder comms.',
          permanentFix: 'Keep a monthly drill rhythm for bad deploys.',
          followUpOwner: 'Founder + agents',
          timeToAcknowledgeMinutes: 4,
          timeToMitigateMinutes: 14,
          timeToResolveMinutes: 20,
        },
      },
    ]);

    const summary = buildSystemsIncidentSummary({
      history,
      now: new Date('2026-04-05T12:00:00.000Z'),
    });

    expect(
      buildSystemsDrillCadenceTarget({
        summary,
        history,
        now: new Date('2026-04-05T12:00:00.000Z'),
      }),
    ).toBeNull();
  });

  it('turns a follow-up-pending incident into a weekly hardening target', () => {
    const history = parseSystemsIncidentHistory([
      {
        action: SYSTEMS_INCIDENT_LOG_ACTION,
        target: 'incident:2026-04-04:koios-outage',
        created_at: '2026-04-04T12:15:00.000Z',
        payload: {
          incidentDate: '2026-04-04',
          entryType: 'incident',
          severity: 'p1',
          status: 'follow_up_pending',
          title: 'Koios outage',
          detectedBy: 'Alert',
          systemsAffected: ['pipeline', 'freshness'],
          userImpact: 'Public governance reads would drift stale if the dependency stayed down.',
          rootCause: 'The dependency health check showed the upstream endpoint was unavailable.',
          mitigation: 'Switched the team into stabilization mode and monitored the fallback path.',
          permanentFix: 'Add a dependency drill and stronger stale-data operator prompts.',
          followUpOwner: 'Founder + agents',
          timeToAcknowledgeMinutes: 8,
          timeToMitigateMinutes: 22,
          timeToResolveMinutes: null,
        },
      },
    ]);

    const target = buildSystemsIncidentRetroTarget({
      history,
      openCommitments: [],
    });

    expect(target?.sourceKey).toBe('systems:incident-retro:incident:2026-04-04:koios-outage');
    expect(target?.severity).toBe('critical');
    expect(target?.commitmentTitle).toMatch(/close the incident follow-up from koios outage/i);
    expect(target?.linkedSloIds).toEqual(expect.arrayContaining(['freshness']));
  });

  it('suppresses the retro nudge when the matching commitment already exists', () => {
    const history = parseSystemsIncidentHistory([
      {
        action: SYSTEMS_INCIDENT_LOG_ACTION,
        target: 'drill:2026-04-04:deploy-rollback',
        created_at: '2026-04-04T12:15:00.000Z',
        payload: {
          incidentDate: '2026-04-04',
          entryType: 'drill',
          severity: 'drill',
          status: 'follow_up_pending',
          title: 'Deploy rollback drill',
          detectedBy: 'Manual review',
          systemsAffected: ['deploy', 'readiness'],
          userImpact: 'Rehearsed a failed deploy and rollback decision path.',
          rootCause: 'The drill exposed a gap in rollback communication.',
          mitigation: 'Walked through rollback, readiness verification, and founder comms.',
          permanentFix: 'Close the communication gap with a clearer operator runbook.',
          followUpOwner: 'Founder + agents',
          timeToAcknowledgeMinutes: 4,
          timeToMitigateMinutes: 14,
          timeToResolveMinutes: 20,
        },
      },
    ]);

    expect(
      buildSystemsIncidentRetroTarget({
        history,
        openCommitments: [
          toSystemsCommitment({
            id: '2be66a2b-0f24-4f03-9b2b-7c67d3646c31',
            review_id: '9d4fb0f3-9c82-4e7a-8ab5-9ef8bafcaa4d',
            title: 'Close the drill follow-up from Deploy rollback drill',
            summary: 'Operationalize the drill lesson.',
            owner: 'Founder + agents',
            status: 'planned',
            due_date: '2026-04-11',
            linked_slo_ids: ['availability'],
            created_at: '2026-04-05T00:00:00.000Z',
          }),
        ],
      }),
    ).toBeNull();
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
