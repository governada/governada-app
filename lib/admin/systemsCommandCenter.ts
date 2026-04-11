import { getSupabaseAdmin } from '@/lib/supabase';
import { getRedis } from '@/lib/redis';
import { getRuntimeRelease } from '@/lib/runtimeMetadata';
import { checkKoiosHealth } from '@/utils/koios';
import {
  AUTOMATION_CANDIDATES,
  CRITICAL_JOURNEYS,
  SYSTEMS_QUICK_LINKS,
  type SystemsAction,
  type SystemsAutomationActivityRecord,
  type SystemsAutomationFollowup,
  type SystemsAutomationRunRecord,
  type SystemsAutomationSummary,
  type SystemsCommitmentCard,
  type SystemsCommitmentShepherdRecord,
  type SystemsDashboardData,
  type SystemsEvidenceViewData,
  type SystemsHistoryViewData,
  type SystemsIncidentEventRecord,
  type SystemsIncidentRecord,
  type SystemsIncidentsViewData,
  type SystemsJourney,
  type SystemsJourneyVerificationRecord,
  type SystemsLaunchViewData,
  type SystemsOperatorEscalationRecord,
  type SystemsPerformanceBaselineRecord,
  type SystemsProvenanceStamp,
  type SystemsQueueViewData,
  type SystemsReviewDraft,
  type SystemsReviewRecord,
  type SystemsStatus,
  type SystemsTrustSurfaceReviewRecord,
  type SystemsWorkspaceSection,
  type SystemsWorkspaceSummary,
  worstStatus,
} from '@/lib/admin/systems';
import {
  buildOverallNarrative,
  buildPromiseCards,
  buildRecommendedActions,
  buildSloCards,
  buildWeeklyReviewLoop,
  type PromiseInput,
} from '@/lib/admin/systemsStatus';
import {
  buildSystemsAutomationHistory,
  buildSystemsAutomationSummary,
  buildSystemsCommitmentShepherdRecord,
  buildSystemsCommitmentShepherdTarget,
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  SYSTEMS_AUTOMATION_SWEEP_ACTION,
  SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
  SYSTEMS_OPERATOR_ESCALATION_ACTION,
} from '@/lib/admin/systemsAutomation';
import {
  buildReviewDiscipline,
  toSystemsCommitment,
  toSystemsReviewRecord,
} from '@/lib/admin/systemsReview';
import { buildSystemsScorecardSync } from '@/lib/admin/systemsScorecard';
import {
  buildSystemsIncidentSummary,
  toSystemsIncidentEventRecord,
  toSystemsIncidentRecord,
} from '@/lib/admin/systemsIncidents';
import {
  buildSystemsReviewDraftHistory,
  SYSTEMS_REVIEW_DRAFT_ACTION,
} from '@/lib/admin/systemsReviewDraft';
import {
  buildSystemsPerformanceBaselineHistory,
  buildSystemsPerformanceBaselineSummary,
  toSystemsPerformanceBaselineRecord,
  SYSTEMS_PERFORMANCE_BASELINE_ACTION,
} from '@/lib/admin/systemsPerformance';
import {
  buildSystemsTrustSurfaceReviewHistory,
  buildSystemsTrustSurfaceReviewSummary,
  toSystemsTrustSurfaceReviewRecord,
  SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
} from '@/lib/admin/systemsTrustSurface';
import { buildSystemsLaunchControlRoom } from '@/lib/admin/systemsLaunchControl';

type DependencyProbe = {
  status: 'healthy' | 'unhealthy' | 'unavailable';
  latencyMs: number;
};

type SyncHealthRow = {
  sync_type: string;
  last_run: string | null;
};

type SyncLogRow = {
  id: number | string;
  success: boolean;
  sync_type: string;
  started_at: string;
};

type ApiUsageRow = {
  status_code: number;
  response_ms: number | null;
  created_at: string;
};

type SystemsReviewRow = {
  id: string;
  review_date: string;
  reviewed_at: string;
  overall_status: SystemsStatus;
  focus_area: string;
  summary: string;
  top_risk: string;
  change_notes: string | null;
  linked_slo_ids: string[] | null;
};

type SystemsCommitmentRow = {
  id: string;
  review_id: string | null;
  linked_incident_id: string | null;
  title: string;
  summary: string | null;
  owner: string;
  status: SystemsCommitmentCard['status'];
  due_date: string | null;
  linked_slo_ids: string[] | null;
  created_at: string;
};

type SystemsAutomationFollowupRow = {
  source_key: string;
  trigger_type: SystemsAutomationFollowup['triggerType'];
  severity: SystemsAutomationFollowup['severity'];
  status: SystemsAutomationFollowup['status'];
  title: string;
  summary: string;
  recommended_action: string;
  action_href: string | null;
  evidence: Record<string, unknown> | null;
  updated_at: string;
};

type SystemsAutomationRunRow = {
  actor_type: SystemsAutomationRunRecord['actorType'];
  status: 'running' | SystemsAutomationRunRecord['status'] | 'failed';
  summary: string | null;
  followup_count: number;
  critical_count: number;
  opened_count: number;
  updated_count: number;
  resolved_count: number;
  started_at: string;
  completed_at: string | null;
};

type SystemsAutomationEscalationRow = {
  id: string;
  source_key: string;
  reason: 'new' | 'reminder';
  status: 'pending' | 'sent' | 'failed';
  title: string;
  details: string;
  critical_count: number;
  channel_count: number;
  channels: string[] | null;
  created_at: string;
};

type SystemsReviewDraftRow = {
  id: string;
  actor_type: 'manual' | 'cron';
  review_date: string;
  overall_status: SystemsStatus;
  focus_area: string;
  top_risk: string;
  change_notes: string;
  hardening_commitment_title: string;
  hardening_commitment_summary: string;
  commitment_owner: string;
  commitment_due_date: string | null;
  linked_slo_ids: string[] | null;
  linked_incident_id: string | null;
  created_at: string;
};

type SystemsPerformanceBaselineRow = {
  actor_type: 'manual' | 'cron';
  created_at: string;
  baseline_date: string;
  environment: SystemsPerformanceBaselineRecord['environment'];
  scenario_label: string;
  concurrency_profile: string;
  overall_status: SystemsPerformanceBaselineRecord['overallStatus'];
  summary: string;
  bottleneck: string;
  mitigation_owner: string;
  next_step: string;
  artifact_url: string | null;
  notes: string | null;
  api_health_p95_ms: number;
  api_dreps_p95_ms: number;
  api_v1_dreps_p95_ms: number;
  governance_health_p95_ms: number;
  error_rate_pct: number;
};

type SystemsTrustSurfaceReviewRow = {
  actor_type: 'manual' | 'cron';
  created_at: string;
  review_date: string;
  overall_status: SystemsTrustSurfaceReviewRecord['overallStatus'];
  linked_slo_ids: string[] | null;
  reviewed_surfaces: string[] | null;
  summary: string;
  current_user_state: string;
  honesty_gap: string;
  next_fix: string;
  owner: string;
  artifact_url: string | null;
  notes: string | null;
};

type SystemsIncidentCurrentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  last_event_at: string;
  incident_date: string;
  entry_type: SystemsIncidentRecord['entryType'];
  severity: SystemsIncidentRecord['severity'];
  status: SystemsIncidentRecord['status'];
  title: string;
  detected_by: string;
  systems_affected: string[] | null;
  user_impact: string;
  root_cause: string;
  mitigation: string;
  permanent_fix: string;
  follow_up_owner: string;
  time_to_acknowledge_minutes: number | null;
  time_to_mitigate_minutes: number | null;
  time_to_resolve_minutes: number | null;
};

type SystemsIncidentEventRow = {
  id: string;
  incident_id: string;
  event_type: SystemsIncidentEventRecord['eventType'];
  status: SystemsIncidentRecord['status'];
  incident_snapshot: Record<string, unknown>;
  actor_wallet_address: string;
  created_at: string;
};

type SystemsJourneyVerificationRow = {
  id: string;
  journey_id: string;
  verification_type: 'ci' | 'manual';
  status: 'passed' | 'failed';
  workflow_name: string;
  job_name: string | null;
  commit_sha: string | null;
  run_url: string | null;
  executed_at: string;
  details: Record<string, unknown> | null;
};

type SystemsContext = {
  generatedAt: string;
  overall: SystemsDashboardData['overall'];
  story: SystemsDashboardData['story'];
  summary: SystemsDashboardData['summary'];
  slos: SystemsDashboardData['slos'];
  promises: SystemsDashboardData['promises'];
  actions: SystemsAction[];
  reviewLoop: SystemsDashboardData['reviewLoop'];
  reviewDiscipline: SystemsDashboardData['reviewDiscipline'];
  scorecardSync: SystemsDashboardData['scorecardSync'];
  incidentSummary: SystemsDashboardData['incidentSummary'];
  performanceBaselineSummary: SystemsDashboardData['performanceBaselineSummary'];
  trustSurfaceReviewSummary: SystemsDashboardData['trustSurfaceReviewSummary'];
  launchControlRoom: SystemsDashboardData['launchControlRoom'];
  automationSummary: SystemsAutomationSummary;
  automationFollowups: SystemsAutomationFollowup[];
  automationHistory: SystemsAutomationActivityRecord[];
  automationRuns: SystemsAutomationRunRecord[];
  latestAutomationRun: SystemsAutomationRunRecord | null;
  operatorEscalations: SystemsOperatorEscalationRecord[];
  latestOperatorEscalation: SystemsOperatorEscalationRecord | null;
  latestCommitmentShepherd: SystemsCommitmentShepherdRecord | null;
  latestPerformanceBaseline: SystemsPerformanceBaselineRecord | null;
  latestTrustSurfaceReview: SystemsTrustSurfaceReviewRecord | null;
  suggestedReviewDraft: SystemsReviewDraft | null;
  reviewDrafts: SystemsReviewDraft[];
  automationOpenCommitments: SystemsCommitmentCard[];
  openCommitments: SystemsCommitmentCard[];
  reviewHistory: SystemsReviewRecord[];
  incidentHistory: SystemsIncidentRecord[];
  incidentEvents: SystemsIncidentEventRecord[];
  performanceBaselineHistory: SystemsPerformanceBaselineRecord[];
  trustSurfaceReviewHistory: SystemsTrustSurfaceReviewRecord[];
  journeyVerifications: SystemsJourneyVerificationRecord[];
  journeys: SystemsJourney[];
};

function percentile(values: number[], target: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * target));
  return sorted[index] ?? null;
}

async function probeSupabase(): Promise<DependencyProbe> {
  const start = Date.now();
  try {
    const supabase = getSupabaseAdmin();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const { error } = await supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timer);
    return { status: error ? 'unhealthy' : 'healthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

async function probeKoios(): Promise<DependencyProbe> {
  const start = Date.now();
  try {
    const ok = await Promise.race([
      checkKoiosHealth(),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]);
    return { status: ok ? 'healthy' : 'unhealthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

async function probeRedis(): Promise<DependencyProbe> {
  const start = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

function formatLatency(ms: number | null): string {
  if (ms === null) return 'No sample yet';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function minutesToLabel(minutes: number | null): string {
  if (minutes === null) return 'Unknown';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function sortOpenCommitments(commitments: SystemsCommitmentCard[]) {
  return commitments
    .filter((commitment) => commitment.status !== 'done')
    .sort((left, right) => {
      if ((left.status === 'blocked') !== (right.status === 'blocked')) {
        return left.status === 'blocked' ? -1 : 1;
      }
      if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
      if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return left.createdAt < right.createdAt ? 1 : -1;
    });
}

function sortFollowups(followups: SystemsAutomationFollowup[]) {
  const severityWeight = (severity: SystemsAutomationFollowup['severity']) =>
    severity === 'critical' ? 0 : 1;
  const statusWeight = (status: SystemsAutomationFollowup['status']) => {
    switch (status) {
      case 'open':
        return 0;
      case 'acknowledged':
        return 1;
      default:
        return 2;
    }
  };

  return [...followups].sort((left, right) => {
    if (severityWeight(left.severity) !== severityWeight(right.severity)) {
      return severityWeight(left.severity) - severityWeight(right.severity);
    }
    if (statusWeight(left.status) !== statusWeight(right.status)) {
      return statusWeight(left.status) - statusWeight(right.status);
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function daysAgo(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86400000));
}

function normalizeCommitSha(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function verificationDetailValue(
  verification: SystemsJourneyVerificationRecord,
  key: string,
): string | null {
  const value = verification.details?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isMainBranchVerification(verification: SystemsJourneyVerificationRecord) {
  const ref = verificationDetailValue(verification, 'ref');
  const refName = verificationDetailValue(verification, 'refName');
  return ref === 'refs/heads/main' || refName === 'main';
}

function pickCiVerification(
  records: SystemsJourneyVerificationRecord[],
  runtimeCommitSha: string | null,
) {
  const ciRecords = records.filter((record) => record.verificationType === 'ci');

  if (runtimeCommitSha) {
    const exactRuntimeMatch = ciRecords.find(
      (record) => normalizeCommitSha(record.commitSha) === runtimeCommitSha,
    );
    if (exactRuntimeMatch) return exactRuntimeMatch;
  }

  return ciRecords.find(isMainBranchVerification) ?? null;
}

function buildStamp(
  kind: SystemsProvenanceStamp['kind'],
  label: string,
  updatedAt: string | null | undefined,
  staleAfterDays: number,
): SystemsProvenanceStamp {
  const ageDays = daysAgo(updatedAt);
  const isStale = ageDays === null ? true : ageDays > staleAfterDays;
  const freshnessLabel =
    ageDays === null ? 'No record yet' : ageDays === 0 ? 'Updated today' : `${ageDays}d old`;

  return {
    kind: isStale ? 'stale' : kind,
    label,
    freshnessLabel,
    updatedAt: updatedAt ?? null,
    isStale,
  };
}

function toFollowup(row: SystemsAutomationFollowupRow): SystemsAutomationFollowup {
  return {
    sourceKey: row.source_key,
    triggerType: row.trigger_type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    summary: row.summary,
    recommendedAction: row.recommended_action,
    actionHref: row.action_href,
    evidence: row.evidence ?? {},
    updatedAt: row.updated_at,
  };
}

function toRunRecord(row: SystemsAutomationRunRow): SystemsAutomationRunRecord | null {
  if (!['good', 'warning', 'critical'].includes(row.status)) return null;
  return {
    actorType: row.actor_type,
    status: row.status as SystemsAutomationRunRecord['status'],
    summary: row.summary ?? 'No sweep summary recorded.',
    followupCount: row.followup_count,
    criticalCount: row.critical_count,
    openedCount: row.opened_count,
    updatedCount: row.updated_count,
    resolvedCount: row.resolved_count,
    createdAt: row.completed_at ?? row.started_at,
  };
}

function toReviewDraft(row: SystemsReviewDraftRow): SystemsReviewDraft {
  return {
    actorType: row.actor_type,
    generatedAt: row.created_at,
    reviewDate: row.review_date,
    overallStatus: row.overall_status,
    focusArea: row.focus_area,
    topRisk: row.top_risk,
    changeNotes: row.change_notes,
    hardeningCommitmentTitle: row.hardening_commitment_title,
    hardeningCommitmentSummary: row.hardening_commitment_summary,
    commitmentOwner: row.commitment_owner,
    commitmentDueDate: row.commitment_due_date,
    linkedSloIds: row.linked_slo_ids ?? [],
    linkedIncidentId: row.linked_incident_id,
  };
}

function toJourneyVerificationRecord(
  row: SystemsJourneyVerificationRow,
): SystemsJourneyVerificationRecord {
  return {
    id: row.id,
    journeyId: row.journey_id,
    verificationType: row.verification_type,
    status: row.status,
    workflowName: row.workflow_name,
    jobName: row.job_name,
    commitSha: row.commit_sha,
    runUrl: row.run_url,
    executedAt: row.executed_at,
    details: row.details ?? {},
  };
}

function aggregateOperatorEscalations(
  rows: SystemsAutomationEscalationRow[],
): SystemsOperatorEscalationRecord[] {
  const byTimestamp = new Map<string, SystemsAutomationEscalationRow[]>();
  for (const row of rows) {
    const existing = byTimestamp.get(row.created_at) ?? [];
    existing.push(row);
    byTimestamp.set(row.created_at, existing);
  }

  return Array.from(byTimestamp.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([createdAt, group]) => {
      const first = group[0]!;
      return {
        actorType: 'cron',
        status: group.every((entry) => entry.status === 'sent') ? 'sent' : 'failed',
        title: first.title,
        details: first.details,
        criticalCount: Math.max(...group.map((entry) => entry.critical_count)),
        followupSourceKeys: group.map((entry) => entry.source_key),
        channelCount: Math.max(...group.map((entry) => entry.channel_count)),
        channels: Array.from(new Set(group.flatMap((entry) => entry.channels ?? []))),
        createdAt,
      };
    });
}

function buildJourneyStatuses(
  verifications: SystemsJourneyVerificationRecord[],
  now = new Date(),
  runtimeCommitSha = normalizeCommitSha(getRuntimeRelease().commit_sha),
): SystemsJourney[] {
  const recordsByJourney = new Map<string, SystemsJourneyVerificationRecord[]>();
  for (const verification of verifications) {
    const existing = recordsByJourney.get(verification.journeyId) ?? [];
    existing.push(verification);
    recordsByJourney.set(verification.journeyId, existing);
  }

  const ciExpected = new Set(['J01', 'J02', 'J03', 'J05', 'J06', 'J13']);

  return CRITICAL_JOURNEYS.map((journey) => {
    const records = recordsByJourney.get(journey.id) ?? [];
    const ciVerification = pickCiVerification(records, runtimeCommitSha);
    const manualVerification =
      records.find((record) => record.verificationType === 'manual') ?? null;
    const latest = ciVerification ?? manualVerification;
    const usesManualProof = !ciVerification && !!manualVerification;
    const ageDays = daysAgo(latest?.executedAt, now);
    const isFresh = ageDays !== null && ageDays <= 7;
    const verificationStatus = !latest
      ? 'missing'
      : latest.status === 'failed'
        ? 'failed'
        : isFresh
          ? 'passed'
          : 'stale';
    const coverage =
      verificationStatus === 'passed'
        ? usesManualProof
          ? 'manual'
          : 'automated'
        : ciExpected.has(journey.id)
          ? 'partial'
          : usesManualProof
            ? 'manual'
            : journey.coverage;

    return {
      ...journey,
      coverage,
      currentEvidence: !latest
        ? ciExpected.has(journey.id)
          ? 'No CI verification has been ingested for this journey yet.'
          : journey.currentEvidence
        : latest.status === 'failed'
          ? `Latest ${usesManualProof ? 'manual' : latest.workflowName} verification failed on ${latest.executedAt.slice(0, 10)}.`
          : isFresh
            ? usesManualProof
              ? `Manually verified on ${latest.executedAt.slice(0, 10)}.`
              : `CI verified by ${latest.workflowName} on ${latest.executedAt.slice(0, 10)}.`
            : usesManualProof
              ? `Manual verification passed on ${latest.executedAt.slice(0, 10)}, but the proof is now stale.`
              : `Last CI verification passed on ${latest.executedAt.slice(0, 10)}, but the proof is now stale.`,
      gap: !latest
        ? ciExpected.has(journey.id)
          ? 'The cockpit has no ingested proof yet, so launch-control should not treat this path as protected.'
          : journey.gap
        : latest.status === 'failed'
          ? 'The latest verification failed, so this path should be treated as an active launch risk until re-proven.'
          : isFresh
            ? journey.gap
            : 'The last successful verification is stale enough that the founder should not assume this path is still protected.',
      verificationStatus,
      lastVerifiedAt: latest?.executedAt ?? null,
      freshnessLabel:
        ageDays === null ? 'No proof yet' : ageDays === 0 ? 'Verified today' : `${ageDays}d old`,
      runUrl: latest?.runUrl ?? null,
      provenance: {
        kind:
          verificationStatus === 'passed'
            ? usesManualProof
              ? 'manual_review'
              : 'ci_verified'
            : verificationStatus === 'failed'
              ? 'stale'
              : 'derived',
        label:
          verificationStatus === 'passed'
            ? usesManualProof
              ? 'Manual review'
              : 'CI verified'
            : verificationStatus === 'failed'
              ? usesManualProof
                ? 'Manual review failed'
                : 'CI failed'
              : verificationStatus === 'stale'
                ? usesManualProof
                  ? 'Manual review stale'
                  : 'CI stale'
                : ciExpected.has(journey.id)
                  ? 'CI missing'
                  : 'No proof',
        freshnessLabel:
          ageDays === null ? 'No proof yet' : ageDays === 0 ? 'Verified today' : `${ageDays}d old`,
        updatedAt: latest?.executedAt ?? null,
        isStale: verificationStatus !== 'passed',
        href: latest?.runUrl ?? null,
      },
    };
  });
}

function proofStatusFromJourneys(journeys: SystemsJourney[]): SystemsStatus {
  const brokenL0 = journeys.filter(
    (journey) =>
      journey.gateLevel === 'L0' &&
      (journey.verificationStatus !== 'passed' || journey.coverage !== 'automated'),
  );
  if (brokenL0.length > 0) return 'critical';
  return journeys.some((journey) => journey.verificationStatus === 'stale') ? 'warning' : 'good';
}

function latestCiProofStamp(journeys: SystemsJourney[]): SystemsProvenanceStamp {
  const latest =
    journeys
      .filter((journey) => journey.provenance?.label?.startsWith('CI'))
      .map((journey) => journey.lastVerifiedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return buildStamp('ci_verified', 'Critical journeys', latest, 7);
}

function buildWorkspaceSummary(
  section: SystemsWorkspaceSection,
  input: {
    generatedAt: string;
    launchDecision: SystemsDashboardData['launchControlRoom']['decision'];
    launchHeadline: string;
    blockerCount: number;
    queueCount: number;
    proofStamps: SystemsProvenanceStamp[];
    proofStatus: SystemsStatus;
  },
): SystemsWorkspaceSummary {
  return {
    generatedAt: input.generatedAt,
    section,
    launchDecision: input.launchDecision,
    launchHeadline: input.launchHeadline,
    blockerCount: input.blockerCount,
    queueCount: input.queueCount,
    proofFreshness: input.proofStamps
      .map((stamp) => `${stamp.label} ${stamp.freshnessLabel}`)
      .join(' / '),
    proofStatus: input.proofStatus,
    proofStamps: input.proofStamps,
  };
}

async function loadSystemsContext(): Promise<SystemsContext> {
  const supabase = getSupabaseAdmin();
  const generatedAt = new Date().toISOString();

  const [
    supabaseProbe,
    koiosProbe,
    redisProbe,
    syncHealthResult,
    syncLogResult,
    votePowerResult,
    hashVerifyResult,
    reconciliationResult,
    apiUsageResult,
    reviewsResult,
    commitmentsResult,
    followupsResult,
    runsResult,
    escalationsResult,
    draftsResult,
    incidentsResult,
    incidentEventsResult,
    performanceResult,
    trustSurfaceResult,
    verificationResult,
  ] = await Promise.all([
    probeSupabase(),
    probeKoios(),
    probeRedis(),
    supabase.from('v_sync_health').select('*'),
    supabase
      .from('sync_log')
      .select('id, success, sync_type, started_at')
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false }),
    supabase.from('v_vote_power_coverage').select('*').single(),
    supabase.from('v_hash_verification').select('*').single(),
    supabase
      .from('reconciliation_log')
      .select('checked_at, overall_status, mismatches')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('api_usage_log')
      .select('status_code, response_ms, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }),
    supabase.from('systems_reviews').select('*').order('reviewed_at', { ascending: false }),
    supabase.from('systems_commitments').select('*').order('created_at', { ascending: false }),
    supabase
      .from('systems_automation_followups')
      .select('*')
      .order('updated_at', { ascending: false }),
    supabase.from('systems_automation_runs').select('*').order('started_at', { ascending: false }),
    supabase
      .from('systems_automation_escalations')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('systems_review_drafts').select('*').order('created_at', { ascending: false }),
    supabase.from('systems_incidents').select('*').order('last_event_at', { ascending: false }),
    supabase.from('systems_incident_events').select('*').order('created_at', { ascending: false }),
    supabase
      .from('systems_performance_baselines')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('systems_trust_surface_reviews')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('systems_journey_verifications')
      .select('*')
      .order('executed_at', { ascending: false }),
  ]);

  const dependencyStatus: SystemsStatus =
    supabaseProbe.status === 'healthy' &&
    koiosProbe.status === 'healthy' &&
    redisProbe.status === 'healthy'
      ? 'good'
      : supabaseProbe.status === 'healthy'
        ? 'warning'
        : 'critical';

  const dependencySummary =
    dependencyStatus === 'good'
      ? 'Supabase, Koios, and Redis all responded to live probes.'
      : dependencyStatus === 'warning'
        ? 'Core reads are healthy, but at least one supporting dependency is degraded.'
        : 'Supabase is unhealthy or unavailable, so the core product is at risk.';

  const syncHealthRows = (syncHealthResult.data || []) as SyncHealthRow[];
  const syncHealthByType = new Map(
    syncHealthRows.map((row) => [
      row.sync_type,
      {
        ...row,
        stale_minutes: row.last_run
          ? Math.round((Date.now() - new Date(row.last_run).getTime()) / 60000)
          : null,
      },
    ]),
  );

  const fastSync = syncHealthByType.get('fast');
  const fullSync = syncHealthByType.get('full');

  let freshnessStatus: SystemsStatus = 'bootstrap';
  if (fastSync?.stale_minutes !== null || fullSync?.stale_minutes !== null) {
    const fastStale = fastSync?.stale_minutes ?? null;
    const fullStale = fullSync?.stale_minutes ?? null;
    if ((fastStale !== null && fastStale > 90) || (fullStale !== null && fullStale > 1560)) {
      freshnessStatus = 'critical';
    } else if ((fastStale !== null && fastStale > 45) || (fullStale !== null && fullStale > 720)) {
      freshnessStatus = 'warning';
    } else {
      freshnessStatus = 'good';
    }
  }

  const freshnessValue = `Fast ${minutesToLabel(fastSync?.stale_minutes ?? null)} / Full ${minutesToLabel(fullSync?.stale_minutes ?? null)}`;
  const freshnessSummary =
    freshnessStatus === 'good'
      ? 'The primary fast and full sync loops are within the expected operating window.'
      : freshnessStatus === 'warning'
        ? 'Freshness is drifting toward stale territory. Watch the fast and full sync lanes closely.'
        : freshnessStatus === 'critical'
          ? 'At least one core sync lane is stale beyond the launch bar.'
          : 'Freshness tracking is present, but this page does not yet have enough live signal to grade it confidently.';

  const votePowerCoverage = votePowerResult.data?.coverage_pct
    ? Number.parseFloat(votePowerResult.data.coverage_pct)
    : null;
  const mismatchRate = hashVerifyResult.data?.mismatch_rate_pct
    ? Number.parseFloat(hashVerifyResult.data.mismatch_rate_pct)
    : null;

  let correctnessStatus: SystemsStatus = 'bootstrap';
  if (votePowerCoverage !== null || mismatchRate !== null || reconciliationResult.data) {
    correctnessStatus = 'good';
    if (
      reconciliationResult.data?.overall_status === 'mismatch' ||
      (votePowerCoverage !== null && votePowerCoverage < 95) ||
      (mismatchRate !== null && mismatchRate > 5)
    ) {
      correctnessStatus = 'critical';
    } else if (
      reconciliationResult.data?.overall_status === 'drift' ||
      (votePowerCoverage !== null && votePowerCoverage < 99) ||
      (mismatchRate !== null && mismatchRate > 1)
    ) {
      correctnessStatus = 'warning';
    }
  }

  const correctnessValue =
    correctnessStatus === 'bootstrap'
      ? 'No baseline yet'
      : `${votePowerCoverage?.toFixed(1) ?? '--'}% vote power / ${mismatchRate?.toFixed(1) ?? '--'}% mismatch`;
  const correctnessSummary =
    correctnessStatus === 'good'
      ? 'Integrity signals look clean: vote power coverage is high and reconciliation is not flagging drift.'
      : correctnessStatus === 'warning'
        ? 'Correctness signals are watchable but not ideal. One or more integrity indicators are outside the comfort zone.'
        : correctnessStatus === 'critical'
          ? 'Integrity needs attention now. Either reconciliation drift, vote power coverage, or hash mismatch rate is breaching the launch bar.'
          : 'Correctness checks exist, but the page does not yet have enough live evidence to grade them.';

  const apiLogs = (apiUsageResult.data || []) as ApiUsageRow[];
  const apiResponseTimes = apiLogs
    .map((entry) => entry.response_ms)
    .filter((value): value is number => typeof value === 'number');
  const apiP95 = percentile(apiResponseTimes, 0.95);
  const apiErrorCount = apiLogs.filter((entry) => entry.status_code >= 500).length;
  const apiErrorRate = apiLogs.length > 0 ? (apiErrorCount / apiLogs.length) * 100 : null;

  let livePerformanceStatus: SystemsStatus = 'bootstrap';
  if (apiP95 !== null) {
    if ((apiErrorRate ?? 0) > 5 || apiP95 > 1000) livePerformanceStatus = 'critical';
    else if ((apiErrorRate ?? 0) > 1 || apiP95 > 500) livePerformanceStatus = 'warning';
    else livePerformanceStatus = 'good';
  }

  const livePerformanceValue =
    apiP95 === null
      ? 'No live API sample yet'
      : `p95 ${formatLatency(apiP95)} / ${(apiErrorRate ?? 0).toFixed(1)}% 5xx`;
  const livePerformanceSummary =
    livePerformanceStatus === 'good'
      ? 'Recent API samples are within the launch bar.'
      : livePerformanceStatus === 'warning'
        ? 'Performance is serviceable, but recent latency or 5xx rates are above the ideal launch bar.'
        : livePerformanceStatus === 'critical'
          ? 'Recent API behavior is too slow or error-prone for launch confidence.'
          : 'This page can show live API performance, but it still needs a durable baseline run for disciplined tracking.';

  const syncLogs = (syncLogResult.data || []) as SyncLogRow[];
  const syncFailureCount = syncLogs.filter((entry) => !entry.success).length;
  const syncSuccessRate =
    syncLogs.length > 0
      ? Math.round(((syncLogs.length - syncFailureCount) / syncLogs.length) * 100)
      : null;

  const commitmentRows = (commitmentsResult.data || []) as SystemsCommitmentRow[];
  const allCommitments = commitmentRows.map(toSystemsCommitment);
  const automationOpenCommitments = sortOpenCommitments(allCommitments);
  const openCommitments = automationOpenCommitments.slice(0, 6);

  const commitmentByReview = new Map<string, SystemsCommitmentCard>();
  for (const commitment of allCommitments) {
    if (!commitment.reviewId || commitmentByReview.has(commitment.reviewId)) continue;
    commitmentByReview.set(commitment.reviewId, commitment);
  }

  const reviewHistory = ((reviewsResult.data || []) as SystemsReviewRow[]).map((row) =>
    toSystemsReviewRecord(row, commitmentByReview.get(row.id) ?? null),
  );
  const reviewDiscipline = buildReviewDiscipline(reviewHistory, automationOpenCommitments);

  const followups = sortFollowups(
    ((followupsResult.data || []) as SystemsAutomationFollowupRow[]).map(toFollowup),
  );
  const automationFollowups = followups.filter((followup) => followup.status !== 'resolved');
  const automationRuns = ((runsResult.data || []) as SystemsAutomationRunRow[])
    .map(toRunRecord)
    .filter((value): value is SystemsAutomationRunRecord => Boolean(value));
  const latestAutomationRun = automationRuns[0] ?? null;
  const automationSummary = buildSystemsAutomationSummary(automationFollowups, latestAutomationRun);

  const operatorEscalations = aggregateOperatorEscalations(
    (escalationsResult.data || []) as SystemsAutomationEscalationRow[],
  );
  const latestOperatorEscalation = operatorEscalations[0] ?? null;

  const reviewDrafts = ((draftsResult.data || []) as SystemsReviewDraftRow[]).map(toReviewDraft);
  const suggestedReviewDraft = reviewDrafts[0] ?? null;

  const performanceBaselineHistory = (
    (performanceResult.data || []) as SystemsPerformanceBaselineRow[]
  ).map((row) => toSystemsPerformanceBaselineRecord(row));
  const latestPerformanceBaseline = performanceBaselineHistory[0] ?? null;
  const performanceBaselineSummary =
    buildSystemsPerformanceBaselineSummary(latestPerformanceBaseline);

  const incidentHistory = ((incidentsResult.data || []) as SystemsIncidentCurrentRow[]).map(
    toSystemsIncidentRecord,
  );
  const incidentEvents = ((incidentEventsResult.data || []) as SystemsIncidentEventRow[])
    .map(toSystemsIncidentEventRecord)
    .filter((value): value is SystemsIncidentEventRecord => Boolean(value));
  const incidentSummary = buildSystemsIncidentSummary({ history: incidentHistory });

  const trustSurfaceConcernSloIds = [
    dependencyStatus !== 'good' ? 'availability' : null,
    freshnessStatus !== 'good' ? 'freshness' : null,
    correctnessStatus !== 'good' ? 'correctness' : null,
  ].filter((value): value is string => Boolean(value));

  const trustSurfaceReviewHistory = (
    (trustSurfaceResult.data || []) as SystemsTrustSurfaceReviewRow[]
  ).map((row) => toSystemsTrustSurfaceReviewRecord(row));
  const latestTrustSurfaceReview = trustSurfaceReviewHistory[0] ?? null;
  const trustSurfaceReviewSummary = buildSystemsTrustSurfaceReviewSummary({
    latestReview: latestTrustSurfaceReview,
    reviewRequired: trustSurfaceConcernSloIds.length > 0,
    concernStatus:
      trustSurfaceConcernSloIds.length > 0
        ? worstStatus([dependencyStatus, freshnessStatus, correctnessStatus])
        : 'good',
    linkedSloIds: trustSurfaceConcernSloIds,
  });

  const journeyVerifications = (
    (verificationResult.data || []) as SystemsJourneyVerificationRow[]
  ).map(toJourneyVerificationRecord);
  const journeys = buildJourneyStatuses(journeyVerifications);

  const performanceStatus = !latestPerformanceBaseline
    ? livePerformanceStatus === 'critical'
      ? 'critical'
      : 'warning'
    : worstStatus(
        [livePerformanceStatus, performanceBaselineSummary.status].filter(
          (status): status is SystemsStatus => status !== 'bootstrap',
        ),
      );

  const performanceValue = latestPerformanceBaseline
    ? `${livePerformanceValue} / baseline ${latestPerformanceBaseline.baselineDate}`
    : `${livePerformanceValue} / no baseline`;
  const performanceSummary = !latestPerformanceBaseline
    ? `${livePerformanceSummary} The cockpit still needs the first durable baseline run with named bottleneck ownership.`
    : performanceBaselineSummary.status === 'good'
      ? `${livePerformanceSummary} ${performanceBaselineSummary.summary}`
      : `${performanceBaselineSummary.summary} ${livePerformanceSummary}`;

  const promiseInput: PromiseInput = {
    availability: {
      status: dependencyStatus,
      summary: dependencySummary,
      value:
        dependencyStatus === 'good'
          ? '3/3 healthy'
          : `${[supabaseProbe, koiosProbe, redisProbe].filter((probe) => probe.status === 'healthy').length}/3 healthy`,
    },
    freshness: {
      status: freshnessStatus,
      summary: freshnessSummary,
      value: freshnessValue,
    },
    correctness: {
      status: correctnessStatus,
      summary: correctnessSummary,
      value: correctnessValue,
    },
    performance: {
      status: performanceStatus,
      summary: performanceSummary,
      value: performanceValue,
    },
    changeSafety: {
      status: reviewDiscipline.status,
      summary:
        reviewDiscipline.status === 'good'
          ? 'A recent weekly review exists and the hardening loop is leaving behind explicit commitments.'
          : reviewDiscipline.summary,
      value:
        reviewDiscipline.lastReviewedAt === null
          ? 'No founder review logged yet'
          : `${reviewDiscipline.currentValue}${syncSuccessRate === null ? '' : ` - sync success ${syncSuccessRate}%`}`,
    },
    incidentResponse: {
      status: incidentSummary.status,
      summary: incidentSummary.summary,
      value: incidentSummary.currentValue,
    },
    userHonesty: {
      status: trustSurfaceReviewSummary.status,
      summary: trustSurfaceReviewSummary.summary,
      value: trustSurfaceReviewSummary.currentValue,
    },
  };

  const { cards, coverage } = buildPromiseCards(promiseInput, journeys);
  const slos = buildSloCards(promiseInput, journeys);
  const overall = buildOverallNarrative(cards);
  const actions = buildRecommendedActions(cards);
  const reviewLoop = buildWeeklyReviewLoop(slos, actions);
  const scorecardSync = buildSystemsScorecardSync({
    reviewHistory,
    liveStatus: overall.status,
    liveConcernSloIds: slos.filter((slo) => slo.status !== 'good').map((slo) => slo.id),
  });
  const launchControlRoom = buildSystemsLaunchControlRoom({
    slos,
    journeys,
    reviewDiscipline,
    scorecardSync,
    incidentSummary,
    performanceBaselineSummary,
    trustSurfaceReviewSummary,
    automationSummary,
    automationFollowups,
  });

  const latestCommitmentShepherdBase = buildSystemsCommitmentShepherdRecord(
    buildSystemsCommitmentShepherdTarget(automationOpenCommitments),
    latestAutomationRun?.actorType ?? 'cron',
  );
  const latestCommitmentShepherd: SystemsCommitmentShepherdRecord = {
    ...latestCommitmentShepherdBase,
    createdAt: latestAutomationRun?.createdAt ?? generatedAt,
  };

  const wins: string[] = [];
  const watchouts: string[] = [];
  const blockers: string[] = [];

  if (dependencyStatus === 'good') wins.push('Core dependency probes are green right now.');
  if (correctnessStatus === 'good')
    wins.push('Integrity signals are currently inside the comfort zone.');
  if (coverage.automatedCount > 0) {
    wins.push(
      `CI currently verifies ${coverage.automatedCount}/${coverage.totalCount} critical public journeys.`,
    );
  }
  if (automationSummary.status === 'good') wins.push('The systems work queue is clear right now.');

  if (freshnessStatus !== 'good') watchouts.push(freshnessSummary);
  if (performanceStatus !== 'good') watchouts.push(performanceSummary);
  if (proofStatusFromJourneys(journeys) !== 'good') {
    watchouts.push(
      'Critical journey proof is stale, missing, or failed. Treat launch claims as conditional until CI-backed evidence is fresh again.',
    );
  }
  if (reviewDiscipline.status !== 'good') watchouts.push(reviewDiscipline.summary);
  if (automationSummary.status === 'warning') watchouts.push(automationSummary.summary);
  if (incidentSummary.status === 'warning') watchouts.push(incidentSummary.summary);
  if (trustSurfaceReviewSummary.status === 'warning')
    watchouts.push(trustSurfaceReviewSummary.summary);

  if (dependencyStatus === 'critical') blockers.push('Core availability is red.');
  if (correctnessStatus === 'critical') blockers.push('Integrity correctness is red.');
  if (freshnessStatus === 'critical') blockers.push('Freshness is outside the launch bar.');
  if (proofStatusFromJourneys(journeys) === 'critical')
    blockers.push('Critical journey proof is missing, stale, or failed.');
  if (reviewDiscipline.status === 'critical') blockers.push(reviewDiscipline.headline);
  if (automationSummary.status === 'critical') blockers.push(automationSummary.headline);
  if (incidentSummary.status === 'critical') blockers.push(incidentSummary.headline);
  if (trustSurfaceReviewSummary.status === 'critical')
    blockers.push(trustSurfaceReviewSummary.headline);

  const automationAuditRows = [
    ...followups.map((followup) => ({
      action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
      target: followup.sourceKey,
      payload: {
        sourceKey: followup.sourceKey,
        triggerType: followup.triggerType,
        severity: followup.severity,
        status: followup.status,
        title: followup.title,
        summary: followup.summary,
        recommendedAction: followup.recommendedAction,
        actionHref: followup.actionHref ?? null,
        evidence: followup.evidence ?? {},
      },
      created_at: followup.updatedAt,
    })),
    ...automationRuns.map((run) => ({
      action: SYSTEMS_AUTOMATION_SWEEP_ACTION,
      target: 'systems',
      payload: {
        actorType: run.actorType,
        status: run.status,
        summary: run.summary,
        followupCount: run.followupCount,
        criticalCount: run.criticalCount,
        openedCount: run.openedCount,
        updatedCount: run.updatedCount,
        resolvedCount: run.resolvedCount,
      },
      created_at: run.createdAt,
    })),
    ...operatorEscalations.map((escalation) => ({
      action: SYSTEMS_OPERATOR_ESCALATION_ACTION,
      target: 'systems',
      payload: {
        actorType: escalation.actorType,
        status: escalation.status,
        title: escalation.title,
        details: escalation.details,
        criticalCount: escalation.criticalCount,
        followupSourceKeys: escalation.followupSourceKeys,
        channelCount: escalation.channelCount,
        channels: escalation.channels,
      },
      created_at: escalation.createdAt,
    })),
    {
      action: SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
      target: latestCommitmentShepherd.commitmentId ?? 'systems',
      payload: {
        actorType: latestCommitmentShepherd.actorType,
        status: latestCommitmentShepherd.status,
        title: latestCommitmentShepherd.title,
        summary: latestCommitmentShepherd.summary,
        recommendedAction: latestCommitmentShepherd.recommendedAction,
        commitmentId: latestCommitmentShepherd.commitmentId,
        commitmentTitle: latestCommitmentShepherd.commitmentTitle,
        commitmentStatus: latestCommitmentShepherd.commitmentStatus,
        owner: latestCommitmentShepherd.owner,
        dueDate: latestCommitmentShepherd.dueDate,
        reason: latestCommitmentShepherd.reason,
        actionHref: latestCommitmentShepherd.actionHref,
      },
      created_at: latestCommitmentShepherd.createdAt,
    },
  ];

  const reviewDraftAuditRows = reviewDrafts.map((draft) => ({
    action: SYSTEMS_REVIEW_DRAFT_ACTION,
    payload: {
      actorType: draft.actorType,
      generatedAt: draft.generatedAt,
      reviewDate: draft.reviewDate,
      overallStatus: draft.overallStatus,
      focusArea: draft.focusArea,
      topRisk: draft.topRisk,
      changeNotes: draft.changeNotes,
      hardeningCommitmentTitle: draft.hardeningCommitmentTitle,
      hardeningCommitmentSummary: draft.hardeningCommitmentSummary,
      commitmentOwner: draft.commitmentOwner,
      commitmentDueDate: draft.commitmentDueDate ?? null,
      linkedSloIds: draft.linkedSloIds,
      linkedIncidentId: draft.linkedIncidentId ?? null,
    },
    created_at: draft.generatedAt,
  }));

  const performanceAuditRows = performanceBaselineHistory.map((baseline) => ({
    action: SYSTEMS_PERFORMANCE_BASELINE_ACTION,
    payload: {
      actorType: baseline.actorType,
      baselineDate: baseline.baselineDate,
      environment: baseline.environment,
      scenarioLabel: baseline.scenarioLabel,
      concurrencyProfile: baseline.concurrencyProfile,
      overallStatus: baseline.overallStatus,
      summary: baseline.summary,
      bottleneck: baseline.bottleneck,
      mitigationOwner: baseline.mitigationOwner,
      nextStep: baseline.nextStep,
      artifactUrl: baseline.artifactUrl,
      notes: baseline.notes,
      apiHealthP95Ms: baseline.apiHealthP95Ms,
      apiDrepsP95Ms: baseline.apiDrepsP95Ms,
      apiV1DrepsP95Ms: baseline.apiV1DrepsP95Ms,
      governanceHealthP95Ms: baseline.governanceHealthP95Ms,
      errorRatePct: baseline.errorRatePct,
    },
    created_at: baseline.loggedAt,
  }));

  const trustAuditRows = trustSurfaceReviewHistory.map((review) => ({
    action: SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
    payload: {
      actorType: review.actorType,
      reviewDate: review.reviewDate,
      overallStatus: review.overallStatus,
      linkedSloIds: review.linkedSloIds,
      reviewedSurfaces: review.reviewedSurfaces,
      summary: review.summary,
      currentUserState: review.currentUserState,
      honestyGap: review.honestyGap,
      nextFix: review.nextFix,
      owner: review.owner,
      artifactUrl: review.artifactUrl,
      notes: review.notes,
    },
    created_at: review.loggedAt,
  }));

  const automationHistory = [
    ...buildSystemsAutomationHistory(automationAuditRows),
    ...buildSystemsReviewDraftHistory(reviewDraftAuditRows),
    ...buildSystemsPerformanceBaselineHistory(performanceAuditRows),
    ...buildSystemsTrustSurfaceReviewHistory(trustAuditRows),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 24);

  return {
    generatedAt,
    overall,
    story: { wins, watchouts, blockers },
    summary: {
      dependencyHealth:
        dependencyStatus === 'good'
          ? '3/3 healthy'
          : `${[supabaseProbe, koiosProbe, redisProbe].filter((probe) => probe.status === 'healthy').length}/3 healthy`,
      syncSuccessRate:
        syncSuccessRate === null ? 'No recent sample' : `${syncSuccessRate}% last 24h`,
      integrityState:
        correctnessStatus === 'bootstrap'
          ? 'No baseline yet'
          : correctnessStatus === 'good'
            ? 'Clean'
            : correctnessStatus === 'warning'
              ? 'Watch'
              : 'Act now',
      apiPerformance: apiP95 === null ? 'No live sample' : `p95 ${formatLatency(apiP95)}`,
      criticalJourneyCoverage: `${coverage.automatedCount}/${coverage.totalCount} CI verified`,
    },
    slos,
    promises: cards,
    actions,
    reviewLoop,
    reviewDiscipline,
    scorecardSync,
    incidentSummary,
    performanceBaselineSummary,
    trustSurfaceReviewSummary,
    launchControlRoom,
    automationSummary,
    automationFollowups,
    automationHistory,
    automationRuns,
    latestAutomationRun,
    operatorEscalations,
    latestOperatorEscalation,
    latestCommitmentShepherd,
    latestPerformanceBaseline,
    latestTrustSurfaceReview,
    suggestedReviewDraft,
    reviewDrafts,
    automationOpenCommitments,
    openCommitments,
    reviewHistory,
    incidentHistory,
    incidentEvents,
    performanceBaselineHistory,
    trustSurfaceReviewHistory,
    journeyVerifications,
    journeys,
  };
}

function toLegacyDashboardData(context: SystemsContext): SystemsDashboardData {
  return {
    generatedAt: context.generatedAt,
    overall: context.overall,
    story: context.story,
    summary: context.summary,
    slos: context.slos,
    promises: context.promises,
    actions: context.actions,
    reviewLoop: context.reviewLoop,
    reviewDiscipline: context.reviewDiscipline,
    scorecardSync: context.scorecardSync,
    incidentSummary: context.incidentSummary,
    performanceBaselineSummary: context.performanceBaselineSummary,
    trustSurfaceReviewSummary: context.trustSurfaceReviewSummary,
    launchControlRoom: context.launchControlRoom,
    automationSummary: context.automationSummary,
    automationFollowups: context.automationFollowups,
    automationHistory: context.automationHistory,
    latestAutomationRun: context.latestAutomationRun,
    latestOperatorEscalation: context.latestOperatorEscalation,
    latestCommitmentShepherd: context.latestCommitmentShepherd,
    latestPerformanceBaseline: context.latestPerformanceBaseline,
    latestTrustSurfaceReview: context.latestTrustSurfaceReview,
    suggestedReviewDraft: context.suggestedReviewDraft,
    automationOpenCommitments: context.automationOpenCommitments,
    openCommitments: context.openCommitments,
    reviewHistory: context.reviewHistory,
    incidentHistory: context.incidentHistory,
    performanceBaselineHistory: context.performanceBaselineHistory,
    trustSurfaceReviewHistory: context.trustSurfaceReviewHistory,
    journeys: context.journeys,
    automationCandidates: AUTOMATION_CANDIDATES,
    quickLinks: SYSTEMS_QUICK_LINKS,
  };
}

function summaryFor(
  section: SystemsWorkspaceSection,
  context: SystemsContext,
): SystemsWorkspaceSummary {
  const proofStamps = [
    latestCiProofStamp(context.journeys),
    buildStamp('durable_record', 'Weekly review', context.scorecardSync.lastReviewedAt ?? null, 7),
    buildStamp(
      'durable_record',
      'Performance baseline',
      context.latestPerformanceBaseline?.loggedAt ?? null,
      14,
    ),
    buildStamp(
      'manual_review',
      'Trust review',
      context.latestTrustSurfaceReview?.loggedAt ?? null,
      7,
    ),
  ];

  return buildWorkspaceSummary(section, {
    generatedAt: context.generatedAt,
    launchDecision: context.launchControlRoom.decision,
    launchHeadline: context.launchControlRoom.headline,
    blockerCount: context.launchControlRoom.blockerCount,
    queueCount: context.automationFollowups.length + context.automationOpenCommitments.length,
    proofStamps,
    proofStatus: worstStatus([
      proofStatusFromJourneys(context.journeys),
      context.scorecardSync.status,
      context.performanceBaselineSummary.status,
      context.trustSurfaceReviewSummary.status,
    ]),
  });
}

export async function buildSystemsDashboardData(): Promise<SystemsDashboardData> {
  return toLegacyDashboardData(await loadSystemsContext());
}

export async function buildSystemsWorkspaceSummaryData(
  section: SystemsWorkspaceSection,
): Promise<SystemsWorkspaceSummary> {
  return summaryFor(section, await loadSystemsContext());
}

export async function buildSystemsLaunchViewData(): Promise<SystemsLaunchViewData> {
  const context = await loadSystemsContext();
  return {
    summary: summaryFor('launch', context),
    launchControlRoom: context.launchControlRoom,
    topActions: context.actions.slice(0, 3),
    proofItems: [
      {
        id: 'journeys',
        title: 'Critical journeys',
        status: proofStatusFromJourneys(context.journeys),
        value: context.summary.criticalJourneyCoverage,
        summary:
          proofStatusFromJourneys(context.journeys) === 'good'
            ? 'Public launch paths have fresh CI-backed proof.'
            : 'At least one critical journey is missing, stale, or failing proof.',
        href: '/admin/systems/evidence#journeys',
        provenance: latestCiProofStamp(context.journeys),
      },
      {
        id: 'scorecard',
        title: 'Weekly scorecard',
        status: context.scorecardSync.status,
        value: context.scorecardSync.currentValue,
        summary: context.scorecardSync.summary,
        href: '/admin/systems/history',
        provenance: buildStamp(
          'durable_record',
          'Weekly review',
          context.scorecardSync.lastReviewedAt ?? null,
          7,
        ),
      },
      {
        id: 'performance',
        title: 'Performance baseline',
        status: context.performanceBaselineSummary.status,
        value: context.performanceBaselineSummary.currentValue,
        summary: context.performanceBaselineSummary.summary,
        href: '/admin/systems/evidence?panel=performance',
        provenance: buildStamp(
          'durable_record',
          'Performance baseline',
          context.latestPerformanceBaseline?.loggedAt ?? null,
          14,
        ),
      },
      {
        id: 'trust',
        title: 'Trust review',
        status: context.trustSurfaceReviewSummary.status,
        value: context.trustSurfaceReviewSummary.currentValue,
        summary: context.trustSurfaceReviewSummary.summary,
        href: '/admin/systems/evidence?panel=trust',
        provenance: buildStamp(
          'manual_review',
          'Trust review',
          context.latestTrustSurfaceReview?.loggedAt ?? null,
          7,
        ),
      },
    ],
  };
}

export async function buildSystemsQueueViewData(): Promise<SystemsQueueViewData> {
  const context = await loadSystemsContext();
  return {
    summary: summaryFor('queue', context),
    reviewDiscipline: context.reviewDiscipline,
    suggestedReviewDraft: context.suggestedReviewDraft,
    automationSummary: context.automationSummary,
    automationFollowups: context.automationFollowups,
    openCommitments: context.automationOpenCommitments,
    latestCommitmentShepherd: context.latestCommitmentShepherd,
    actions: context.actions,
  };
}

export async function buildSystemsIncidentsViewData(): Promise<SystemsIncidentsViewData> {
  const context = await loadSystemsContext();
  return {
    summary: summaryFor('incidents', context),
    incidentSummary: context.incidentSummary,
    incidents: context.incidentHistory,
    incidentEvents: context.incidentEvents,
    automationFollowups: context.automationFollowups.filter(
      (followup) =>
        followup.triggerType === 'drill_cadence' ||
        followup.triggerType === 'incident_retro_followup',
    ),
  };
}

export async function buildSystemsEvidenceViewData(): Promise<SystemsEvidenceViewData> {
  const context = await loadSystemsContext();
  return {
    summary: summaryFor('evidence', context),
    slos: context.slos,
    scorecardSync: context.scorecardSync,
    journeys: context.journeys,
    latestPerformanceBaseline: context.latestPerformanceBaseline,
    latestTrustSurfaceReview: context.latestTrustSurfaceReview,
    performanceBaselineSummary: context.performanceBaselineSummary,
    trustSurfaceReviewSummary: context.trustSurfaceReviewSummary,
    journeyVerifications: context.journeyVerifications,
  };
}

export async function buildSystemsHistoryViewData(): Promise<SystemsHistoryViewData> {
  const context = await loadSystemsContext();
  return {
    summary: summaryFor('history', context),
    reviewHistory: context.reviewHistory,
    automationHistory: context.automationHistory,
    automationRuns: context.automationRuns,
    operatorEscalations: context.operatorEscalations,
    reviewDrafts: context.reviewDrafts,
    incidentEvents: context.incidentEvents,
  };
}
