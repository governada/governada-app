'use client';

import { getStoredSession } from '@/lib/supabaseAuth';
import type {
  SystemsAction,
  SystemsAutomationFollowup,
  SystemsAutomationFollowupStatus,
  SystemsCommitmentCard,
  SystemsCommitmentStatus,
  SystemsEvidenceViewData,
  SystemsHistoryViewData,
  SystemsIncidentRecord,
  SystemsIncidentSeverity,
  SystemsIncidentStatus,
  SystemsIncidentType,
  SystemsIncidentsViewData,
  SystemsJourney,
  SystemsLaunchDecision,
  SystemsLaunchViewData,
  SystemsPerformanceBaselineEnvironment,
  SystemsProvenanceStamp,
  SystemsQueueViewData,
  SystemsReviewDraft,
  SystemsStatus,
  SystemsTrustSurfaceReviewRecord,
  SystemsWorkspaceSection,
  SystemsWorkspaceSummary,
} from '@/lib/admin/systems';

export type ReviewFormState = {
  reviewDate: string;
  overallStatus: SystemsStatus;
  focusArea: string;
  topRisk: string;
  changeNotes: string;
  hardeningCommitmentTitle: string;
  hardeningCommitmentSummary: string;
  commitmentOwner: string;
  commitmentDueDate: string;
  linkedSloIds: string[];
  linkedIncidentId: string | null;
};

export type IncidentFormState = {
  id?: string;
  incidentDate: string;
  entryType: SystemsIncidentType;
  severity: SystemsIncidentSeverity;
  status: SystemsIncidentStatus;
  title: string;
  detectedBy: string;
  systemsAffected: string;
  userImpact: string;
  rootCause: string;
  mitigation: string;
  permanentFix: string;
  followUpOwner: string;
  timeToAcknowledgeMinutes: string;
  timeToMitigateMinutes: string;
  timeToResolveMinutes: string;
};

export type PerformanceBaselineFormState = {
  baselineDate: string;
  environment: SystemsPerformanceBaselineEnvironment;
  scenarioLabel: string;
  concurrencyProfile: string;
  summary: string;
  bottleneck: string;
  mitigationOwner: string;
  nextStep: string;
  artifactUrl: string;
  apiHealthP95Ms: string;
  apiDrepsP95Ms: string;
  apiV1DrepsP95Ms: string;
  governanceHealthP95Ms: string;
  errorRatePct: string;
  notes: string;
};

export type TrustSurfaceReviewFormState = {
  reviewDate: string;
  overallStatus: Exclude<SystemsStatus, 'bootstrap'>;
  linkedSloIds: string[];
  reviewedSurfaces: string;
  summary: string;
  currentUserState: string;
  honestyGap: string;
  nextFix: string;
  owner: string;
  artifactUrl: string;
  notes: string;
};

export type SystemsWorkspaceDataMap = {
  launch: SystemsLaunchViewData;
  queue: SystemsQueueViewData;
  incidents: SystemsIncidentsViewData;
  evidence: SystemsEvidenceViewData;
  history: SystemsHistoryViewData;
};

const SECTION_ENDPOINTS: Record<SystemsWorkspaceSection, string> = {
  launch: '/api/admin/systems/launch',
  queue: '/api/admin/systems/queue',
  incidents: '/api/admin/systems/incidents',
  evidence: '/api/admin/systems/evidence',
  history: '/api/admin/systems/history',
};

function authHeaders(includeJson = false): HeadersInit {
  const token = getStoredSession();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return body?.error || fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await readError(response, `Request failed for ${url}`));
  }
  return response.json();
}

export function fetchSystemsSection<T extends SystemsWorkspaceSection>(
  section: T,
): Promise<SystemsWorkspaceDataMap[T]> {
  return fetchJson<SystemsWorkspaceDataMap[T]>(SECTION_ENDPOINTS[section], {
    headers: authHeaders(),
  });
}

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function parseMinutes(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMetric(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parsePercent(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function linkedSloIdsFromFollowup(followup?: SystemsAutomationFollowup | null) {
  if (!followup?.evidence || !Array.isArray(followup.evidence.linkedSloIds)) return [];
  return followup.evidence.linkedSloIds.filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function linkedIncidentIdFromFollowup(followup?: SystemsAutomationFollowup | null) {
  return typeof followup?.evidence?.entryId === 'string' ? followup.evidence.entryId : null;
}

export function buildInitialReviewForm(data: SystemsQueueViewData): ReviewFormState {
  const draft = data.suggestedReviewDraft ?? null;
  if (draft) return buildReviewFormFromDraft(draft);

  const primaryFollowup = data.automationFollowups[0] ?? null;
  const primaryAction = data.actions[0] ?? null;
  const primaryCommitment = data.openCommitments[0] ?? null;

  return {
    reviewDate: todayInputValue(),
    overallStatus:
      data.reviewDiscipline.status === 'critical'
        ? 'critical'
        : data.reviewDiscipline.status === 'good'
          ? 'warning'
          : data.reviewDiscipline.status,
    focusArea:
      primaryAction?.title ??
      primaryFollowup?.title ??
      data.latestCommitmentShepherd?.commitmentTitle ??
      'Launch systems hardening',
    topRisk: primaryFollowup?.summary ?? data.reviewDiscipline.summary,
    changeNotes:
      primaryFollowup?.recommendedAction ??
      data.latestCommitmentShepherd?.recommendedAction ??
      data.reviewDiscipline.summary,
    hardeningCommitmentTitle:
      data.latestCommitmentShepherd?.commitmentTitle ??
      primaryAction?.title ??
      primaryFollowup?.title ??
      primaryCommitment?.title ??
      'Close the top launch gap',
    hardeningCommitmentSummary:
      data.latestCommitmentShepherd?.recommendedAction ??
      primaryFollowup?.recommendedAction ??
      primaryCommitment?.summary ??
      'Refresh the systems operating loop and close the top launch gap this week.',
    commitmentOwner:
      data.latestCommitmentShepherd?.owner ?? primaryCommitment?.owner ?? 'Founder + agents',
    commitmentDueDate: data.latestCommitmentShepherd?.dueDate ?? '',
    linkedSloIds: linkedSloIdsFromFollowup(primaryFollowup).slice(0, 3) ??
      primaryCommitment?.linkedSloIds.slice(0, 3) ?? ['availability'],
    linkedIncidentId: linkedIncidentIdFromFollowup(primaryFollowup),
  };
}

export function buildReviewFormFromDraft(draft: SystemsReviewDraft): ReviewFormState {
  return {
    reviewDate: draft.reviewDate,
    overallStatus: draft.overallStatus,
    focusArea: draft.focusArea,
    topRisk: draft.topRisk,
    changeNotes: draft.changeNotes,
    hardeningCommitmentTitle: draft.hardeningCommitmentTitle,
    hardeningCommitmentSummary: draft.hardeningCommitmentSummary,
    commitmentOwner: draft.commitmentOwner,
    commitmentDueDate: draft.commitmentDueDate ?? '',
    linkedSloIds: draft.linkedSloIds,
    linkedIncidentId: draft.linkedIncidentId ?? null,
  };
}

export function buildInitialIncidentForm(record?: SystemsIncidentRecord | null): IncidentFormState {
  if (record) {
    return {
      id: record.id,
      incidentDate: record.incidentDate,
      entryType: record.entryType,
      severity: record.severity,
      status: record.status,
      title: record.title,
      detectedBy: record.detectedBy,
      systemsAffected: record.systemsAffected.join('\n'),
      userImpact: record.userImpact,
      rootCause: record.rootCause,
      mitigation: record.mitigation,
      permanentFix: record.permanentFix,
      followUpOwner: record.followUpOwner,
      timeToAcknowledgeMinutes:
        record.timeToAcknowledgeMinutes == null ? '' : String(record.timeToAcknowledgeMinutes),
      timeToMitigateMinutes:
        record.timeToMitigateMinutes == null ? '' : String(record.timeToMitigateMinutes),
      timeToResolveMinutes:
        record.timeToResolveMinutes == null ? '' : String(record.timeToResolveMinutes),
    };
  }

  return {
    incidentDate: todayInputValue(),
    entryType: 'drill',
    severity: 'drill',
    status: 'resolved',
    title: '',
    detectedBy: 'Manual review',
    systemsAffected: 'systems cockpit',
    userImpact: '',
    rootCause: '',
    mitigation: '',
    permanentFix: '',
    followUpOwner: 'Founder + agents',
    timeToAcknowledgeMinutes: '',
    timeToMitigateMinutes: '',
    timeToResolveMinutes: '',
  };
}

export function buildInitialPerformanceBaselineForm(
  latest?: SystemsEvidenceViewData['latestPerformanceBaseline'] | null,
): PerformanceBaselineFormState {
  return {
    baselineDate: todayInputValue(),
    environment: latest?.environment ?? 'production',
    scenarioLabel: latest?.scenarioLabel ?? 'Minimum public read baseline',
    concurrencyProfile: latest?.concurrencyProfile ?? '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
    summary: latest?.summary ?? '',
    bottleneck: latest?.bottleneck ?? '',
    mitigationOwner: latest?.mitigationOwner ?? 'Founder + agents',
    nextStep: latest?.nextStep ?? '',
    artifactUrl: latest?.artifactUrl ?? '',
    apiHealthP95Ms: latest?.apiHealthP95Ms == null ? '' : String(latest.apiHealthP95Ms),
    apiDrepsP95Ms: latest?.apiDrepsP95Ms == null ? '' : String(latest.apiDrepsP95Ms),
    apiV1DrepsP95Ms: latest?.apiV1DrepsP95Ms == null ? '' : String(latest.apiV1DrepsP95Ms),
    governanceHealthP95Ms:
      latest?.governanceHealthP95Ms == null ? '' : String(latest.governanceHealthP95Ms),
    errorRatePct: latest?.errorRatePct == null ? '' : String(latest.errorRatePct),
    notes: latest?.notes ?? '',
  };
}

export function buildInitialTrustSurfaceReviewForm(input: {
  latest?: SystemsTrustSurfaceReviewRecord | null;
  linkedSloIds?: string[];
}): TrustSurfaceReviewFormState {
  const latest = input.latest ?? null;
  return {
    reviewDate: todayInputValue(),
    overallStatus: latest?.overallStatus ?? 'warning',
    linkedSloIds: latest?.linkedSloIds.length
      ? latest.linkedSloIds
      : (input.linkedSloIds?.slice(0, 3) ?? ['freshness']),
    reviewedSurfaces:
      latest?.reviewedSurfaces.join('\n') ??
      ['Home shell', 'DRep discovery', 'Proposal detail', 'Quick Match'].join('\n'),
    summary: latest?.summary ?? '',
    currentUserState: latest?.currentUserState ?? '',
    honestyGap: latest?.honestyGap ?? '',
    nextFix: latest?.nextFix ?? '',
    owner: latest?.owner ?? 'Founder + agents',
    artifactUrl: latest?.artifactUrl ?? '',
    notes: latest?.notes ?? '',
  };
}

export async function createSystemsReview(payload: ReviewFormState) {
  return fetchJson('/api/admin/systems/reviews', {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      ...payload,
      commitmentDueDate: payload.commitmentDueDate || null,
      linkedIncidentId: payload.linkedIncidentId ?? null,
    }),
  });
}

export async function createSystemsIncident(payload: IncidentFormState) {
  const systemsAffected = payload.systemsAffected
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return fetchJson('/api/admin/systems/incidents', {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      incidentDate: payload.incidentDate,
      entryType: payload.entryType,
      severity: payload.severity,
      status: payload.status,
      title: payload.title,
      detectedBy: payload.detectedBy,
      systemsAffected,
      userImpact: payload.userImpact,
      rootCause: payload.rootCause,
      mitigation: payload.mitigation,
      permanentFix: payload.permanentFix,
      followUpOwner: payload.followUpOwner,
      timeToAcknowledgeMinutes: parseMinutes(payload.timeToAcknowledgeMinutes),
      timeToMitigateMinutes: parseMinutes(payload.timeToMitigateMinutes),
      timeToResolveMinutes: parseMinutes(payload.timeToResolveMinutes),
    }),
  });
}

export async function updateSystemsIncident(payload: IncidentFormState) {
  if (!payload.id) throw new Error('Missing incident id');

  const systemsAffected = payload.systemsAffected
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return fetchJson('/api/admin/systems/incidents', {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({
      id: payload.id,
      incidentDate: payload.incidentDate,
      entryType: payload.entryType,
      severity: payload.severity,
      status: payload.status,
      title: payload.title,
      detectedBy: payload.detectedBy,
      systemsAffected,
      userImpact: payload.userImpact,
      rootCause: payload.rootCause,
      mitigation: payload.mitigation,
      permanentFix: payload.permanentFix,
      followUpOwner: payload.followUpOwner,
      timeToAcknowledgeMinutes: parseMinutes(payload.timeToAcknowledgeMinutes),
      timeToMitigateMinutes: parseMinutes(payload.timeToMitigateMinutes),
      timeToResolveMinutes: parseMinutes(payload.timeToResolveMinutes),
    }),
  });
}

export async function createSystemsPerformanceBaseline(payload: PerformanceBaselineFormState) {
  return fetchJson('/api/admin/systems/performance-baseline', {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      baselineDate: payload.baselineDate,
      environment: payload.environment,
      scenarioLabel: payload.scenarioLabel,
      concurrencyProfile: payload.concurrencyProfile,
      summary: payload.summary,
      bottleneck: payload.bottleneck,
      mitigationOwner: payload.mitigationOwner,
      nextStep: payload.nextStep,
      artifactUrl: payload.artifactUrl.trim() || null,
      apiHealthP95Ms: parseMetric(payload.apiHealthP95Ms),
      apiDrepsP95Ms: parseMetric(payload.apiDrepsP95Ms),
      apiV1DrepsP95Ms: parseMetric(payload.apiV1DrepsP95Ms),
      governanceHealthP95Ms: parseMetric(payload.governanceHealthP95Ms),
      errorRatePct: parsePercent(payload.errorRatePct),
      notes: payload.notes.trim() || null,
    }),
  });
}

export async function createSystemsTrustSurfaceReview(payload: TrustSurfaceReviewFormState) {
  const reviewedSurfaces = payload.reviewedSurfaces
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return fetchJson('/api/admin/systems/trust-surface-review', {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      reviewDate: payload.reviewDate,
      overallStatus: payload.overallStatus,
      linkedSloIds: payload.linkedSloIds,
      reviewedSurfaces,
      summary: payload.summary,
      currentUserState: payload.currentUserState,
      honestyGap: payload.honestyGap,
      nextFix: payload.nextFix,
      owner: payload.owner,
      artifactUrl: payload.artifactUrl.trim() || null,
      notes: payload.notes.trim() || null,
    }),
  });
}

export async function updateSystemsCommitmentStatus(id: string, status: SystemsCommitmentStatus) {
  return fetchJson('/api/admin/systems/commitments', {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({ id, status }),
  });
}

export async function updateSystemsAutomationFollowupStatus(
  sourceKey: string,
  status: SystemsAutomationFollowupStatus,
) {
  return fetchJson('/api/admin/systems/followups', {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({ sourceKey, status }),
  });
}

export async function runSystemsAutomationSweep() {
  return fetchJson<{
    status: string;
    summary: string;
    followupCount: number;
    criticalCount: number;
    openedCount: number;
    updatedCount: number;
    resolvedCount: number;
  }>('/api/admin/systems/automation', {
    method: 'POST',
    headers: authHeaders(true),
  });
}

export async function generateSystemsReviewDraft() {
  return fetchJson<{
    draft?: SystemsReviewDraft;
    status?: string;
    message?: string;
  }>('/api/admin/systems/review-draft', {
    method: 'POST',
    headers: authHeaders(true),
  });
}

export function statusLabel(status: SystemsStatus) {
  switch (status) {
    case 'good':
      return 'Healthy';
    case 'warning':
      return 'Watch';
    case 'critical':
      return 'Act now';
    default:
      return 'Bootstrapping';
  }
}

export function launchDecisionLabel(decision: SystemsLaunchDecision) {
  switch (decision) {
    case 'ready':
      return 'Launch-ready';
    case 'risky':
      return 'Risky';
    default:
      return 'Blocked';
  }
}

export function commitmentStatusLabel(status: SystemsCommitmentStatus) {
  switch (status) {
    case 'planned':
      return 'Planned';
    case 'in_progress':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Done';
  }
}

export function followupStatusLabel(status: SystemsAutomationFollowupStatus) {
  switch (status) {
    case 'acknowledged':
      return 'Acknowledged';
    case 'resolved':
      return 'Resolved';
    default:
      return 'Open';
  }
}

export function incidentStatusLabel(status: SystemsIncidentStatus) {
  switch (status) {
    case 'mitigated':
      return 'Mitigated';
    case 'resolved':
      return 'Resolved';
    case 'follow_up_pending':
      return 'Follow-up pending';
    default:
      return 'Open';
  }
}

export function incidentSeverityLabel(severity: SystemsIncidentSeverity) {
  switch (severity) {
    case 'p0':
      return 'P0';
    case 'p1':
      return 'P1';
    case 'p2':
      return 'P2';
    case 'near_miss':
      return 'Near miss';
    default:
      return 'Drill';
  }
}

export function incidentEntryTypeLabel(entryType: SystemsIncidentType) {
  return entryType === 'incident' ? 'Incident' : 'Drill';
}

export function automationTriggerLabel(triggerType: SystemsAutomationFollowup['triggerType']) {
  switch (triggerType) {
    case 'review_discipline':
      return 'Review discipline';
    case 'performance_baseline':
      return 'Performance baseline';
    case 'trust_surface_review':
      return 'Trust review';
    case 'drill_cadence':
      return 'Drill cadence';
    case 'incident_retro_followup':
      return 'Incident retro';
    case 'overdue_commitment':
      return 'Commitment health';
    default:
      return 'Systems action';
  }
}

export function performanceEnvironmentLabel(environment: SystemsPerformanceBaselineEnvironment) {
  switch (environment) {
    case 'production':
      return 'Production';
    case 'preview':
      return 'Preview';
    default:
      return 'Local';
  }
}

export function evidenceCoverageLabel(journey: SystemsJourney) {
  switch (journey.coverage) {
    case 'automated':
      return 'CI verified';
    case 'partial':
      return 'Partial proof';
    default:
      return 'Manual';
  }
}

export function provenanceLabel(stamp: SystemsProvenanceStamp) {
  return `${stamp.label} • ${stamp.freshnessLabel}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function workspaceTitle(section: SystemsWorkspaceSection) {
  switch (section) {
    case 'launch':
      return 'Launch Call';
    case 'queue':
      return 'Work Queue';
    case 'incidents':
      return 'Incidents & Drills';
    case 'evidence':
      return 'Evidence';
    default:
      return 'History';
  }
}

export function workspaceDescription(
  section: SystemsWorkspaceSection,
  summary: SystemsWorkspaceSummary,
) {
  switch (section) {
    case 'launch':
      return `${summary.launchHeadline} Focus on the launch call, the blockers, and the proof freshness.`;
    case 'queue':
      return 'Work the founder queue, not the raw history. Clear follow-ups, commitments, and the weekly review loop here.';
    case 'incidents':
      return 'Keep incident state honest, drills current, and status transitions explicit and auditable.';
    case 'evidence':
      return 'Review the proof behind the current call: SLOs, journey verification, performance baselines, trust reviews, and scorecard drift.';
    default:
      return 'Audit the operating trail: reviews, automation runs, escalations, review drafts, and incident state transitions.';
  }
}

export function suggestCommitmentAction(commitment: SystemsCommitmentCard) {
  switch (commitment.status) {
    case 'planned':
      return 'Start';
    case 'in_progress':
      return 'Block';
    case 'blocked':
      return 'Reopen';
    default:
      return 'Reopen';
  }
}

export function nextCommitmentStatus(commitment: SystemsCommitmentCard): SystemsCommitmentStatus {
  switch (commitment.status) {
    case 'planned':
      return 'in_progress';
    case 'in_progress':
      return 'blocked';
    case 'blocked':
      return 'planned';
    default:
      return 'planned';
  }
}

export function maybeLinkedSloIds(action?: SystemsAction | null) {
  if (!action) return [];
  return action.id === 'record-baseline'
    ? ['performance']
    : action.id === 'log-trust-review'
      ? ['availability', 'freshness', 'correctness']
      : [];
}
