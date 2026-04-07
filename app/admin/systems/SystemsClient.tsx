'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gauge,
  HeartPulse,
  History,
  Loader2,
  ListChecks,
  Minus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { getStoredSession } from '@/lib/supabaseAuth';
import type {
  SystemsAction,
  SystemsAutomationActivityRecord,
  SystemsAutomationFollowup,
  SystemsAutomationFollowupStatus,
  SystemsCommitmentCard,
  SystemsCommitmentStatus,
  SystemsDashboardData,
  SystemsIncidentRecord,
  SystemsIncidentSeverity,
  SystemsIncidentStatus,
  SystemsIncidentType,
  SystemsJourney,
  SystemsLaunchDecision,
  SystemsPerformanceBaselineEnvironment,
  SystemsPromiseCard,
  SystemsReviewDiscipline,
  SystemsReviewDraft,
  SystemsReviewRecord,
  SystemsReviewStep,
  SystemsSloCard,
  SystemsStatus,
  AutomationCandidate,
} from '@/lib/admin/systems';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

async function fetchSystems(): Promise<SystemsDashboardData> {
  const token = getStoredSession();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/admin/systems', { headers });
  if (!res.ok) throw new Error('Failed to fetch systems dashboard');
  return res.json();
}

type ReviewFormState = {
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
};

type IncidentFormState = {
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

type PerformanceBaselineFormState = {
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

type TrustSurfaceReviewFormState = {
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

const TRUST_SURFACE_SLO_OPTIONS = [
  { id: 'availability', label: 'Availability' },
  { id: 'freshness', label: 'Freshness' },
  { id: 'correctness', label: 'Correctness' },
] as const;

async function createSystemsReview(payload: ReviewFormState) {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const res = await fetch('/api/admin/systems/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      commitmentDueDate: payload.commitmentDueDate || null,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to log systems review');
  }

  return res.json();
}

async function createSystemsIncident(payload: IncidentFormState) {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const systemsAffected = payload.systemsAffected
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const parseMinutes = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const res = await fetch('/api/admin/systems/incidents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to log systems incident');
  }

  return res.json();
}

async function createSystemsPerformanceBaseline(payload: PerformanceBaselineFormState) {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const parseMetric = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  };
  const parsePercent = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const res = await fetch('/api/admin/systems/performance-baseline', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
      actorType: 'manual',
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to log systems performance baseline');
  }

  return res.json();
}

async function createSystemsTrustSurfaceReview(payload: TrustSurfaceReviewFormState) {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const reviewedSurfaces = payload.reviewedSurfaces
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const res = await fetch('/api/admin/systems/trust-surface-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
      actorType: 'manual',
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to log trust-surface review');
  }

  return res.json();
}

async function updateSystemsCommitmentStatus(id: string, status: SystemsCommitmentStatus) {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const res = await fetch('/api/admin/systems/commitments', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, status }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update commitment');
  }

  return res.json();
}

async function runSystemsAutomationSweep() {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const res = await fetch('/api/admin/systems/automation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to run systems automation sweep');
  }

  return res.json();
}

async function updateSystemsAutomationFollowupStatus(
  sourceKey: string,
  status: SystemsAutomationFollowupStatus,
) {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const res = await fetch('/api/admin/systems/followups', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sourceKey, status }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update automation follow-up');
  }

  return res.json();
}

async function generateSystemsReviewDraft() {
  const token = getStoredSession();
  if (!token) throw new Error('Missing session');

  const res = await fetch('/api/admin/systems/review-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to generate systems review draft');
  }

  return res.json();
}

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function buildSuggestedLinkedSloIds(data: SystemsDashboardData) {
  const nonGood = data.slos.filter((slo) => slo.status !== 'good').map((slo) => slo.id);
  if (nonGood.length > 0) return nonGood.slice(0, 3);
  return data.slos.slice(0, 1).map((slo) => slo.id);
}

function buildInitialReviewForm(data: SystemsDashboardData): ReviewFormState {
  const primaryAction = data.actions[0]?.title;

  return {
    reviewDate: todayInputValue(),
    overallStatus: data.overall.status,
    focusArea: primaryAction || data.reviewLoop.currentFocus,
    topRisk: '',
    changeNotes: '',
    hardeningCommitmentTitle: primaryAction || '',
    hardeningCommitmentSummary: '',
    commitmentOwner: 'Founder + agents',
    commitmentDueDate: '',
    linkedSloIds: buildSuggestedLinkedSloIds(data),
  };
}

function buildReviewFormFromDraft(draft: SystemsReviewDraft): ReviewFormState {
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
  };
}

function buildReviewFormFromCommitmentShepherd(
  data: SystemsDashboardData,
  shepherd: NonNullable<SystemsDashboardData['latestCommitmentShepherd']>,
): ReviewFormState {
  return {
    reviewDate: todayInputValue(),
    overallStatus: data.overall.status,
    focusArea: shepherd.commitmentTitle ?? shepherd.title,
    topRisk: shepherd.summary,
    changeNotes: `Commitment shepherd: ${shepherd.summary} ${shepherd.recommendedAction}`,
    hardeningCommitmentTitle: shepherd.commitmentTitle ?? shepherd.title,
    hardeningCommitmentSummary: shepherd.recommendedAction,
    commitmentOwner: shepherd.owner ?? 'Founder + agents',
    commitmentDueDate: shepherd.dueDate ?? '',
    linkedSloIds: buildSuggestedLinkedSloIds(data),
  };
}

function buildInitialIncidentForm(): IncidentFormState {
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

function buildInitialPerformanceBaselineForm(
  data?: SystemsDashboardData | null,
): PerformanceBaselineFormState {
  const latest = data?.latestPerformanceBaseline ?? null;

  return {
    baselineDate: todayInputValue(),
    environment: latest?.environment ?? 'production',
    scenarioLabel: latest?.scenarioLabel ?? 'Minimum public read baseline',
    concurrencyProfile: latest?.concurrencyProfile ?? '1->10->50->100 VUs over 5 minutes',
    summary: latest?.summary ?? '',
    bottleneck: latest?.bottleneck ?? '',
    mitigationOwner: latest?.mitigationOwner ?? 'Founder + agents',
    nextStep: latest?.nextStep ?? '',
    artifactUrl: latest?.artifactUrl ?? '',
    apiHealthP95Ms:
      latest?.apiHealthP95Ms === null || latest?.apiHealthP95Ms === undefined
        ? ''
        : String(latest.apiHealthP95Ms),
    apiDrepsP95Ms:
      latest?.apiDrepsP95Ms === null || latest?.apiDrepsP95Ms === undefined
        ? ''
        : String(latest.apiDrepsP95Ms),
    apiV1DrepsP95Ms:
      latest?.apiV1DrepsP95Ms === null || latest?.apiV1DrepsP95Ms === undefined
        ? ''
        : String(latest.apiV1DrepsP95Ms),
    governanceHealthP95Ms:
      latest?.governanceHealthP95Ms === null || latest?.governanceHealthP95Ms === undefined
        ? ''
        : String(latest.governanceHealthP95Ms),
    errorRatePct:
      latest?.errorRatePct === null || latest?.errorRatePct === undefined
        ? ''
        : String(latest.errorRatePct),
    notes: latest?.notes ?? '',
  };
}

function buildInitialTrustSurfaceReviewForm(
  data?: SystemsDashboardData | null,
): TrustSurfaceReviewFormState {
  const latest = data?.latestTrustSurfaceReview ?? null;
  const concernSloIds =
    latest?.linkedSloIds && latest.linkedSloIds.length > 0
      ? latest.linkedSloIds
      : data?.trustSurfaceReviewSummary.linkedSloIds &&
          data.trustSurfaceReviewSummary.linkedSloIds.length > 0
        ? data.trustSurfaceReviewSummary.linkedSloIds
        : ['freshness'];

  return {
    reviewDate: todayInputValue(),
    overallStatus: latest?.overallStatus ?? 'warning',
    linkedSloIds: concernSloIds,
    reviewedSurfaces:
      latest?.reviewedSurfaces.join('\n') ??
      ['Home shell', 'DRep discovery', 'Proposal detail', 'DRep workspace read path'].join('\n'),
    summary: latest?.summary ?? '',
    currentUserState: latest?.currentUserState ?? '',
    honestyGap: latest?.honestyGap ?? '',
    nextFix: latest?.nextFix ?? '',
    owner: latest?.owner ?? 'Founder + agents',
    artifactUrl: latest?.artifactUrl ?? '',
    notes: latest?.notes ?? '',
  };
}

function statusClasses(status: SystemsStatus) {
  switch (status) {
    case 'good':
      return {
        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        border: 'border-l-emerald-500',
        text: 'text-emerald-300',
      };
    case 'warning':
      return {
        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        border: 'border-l-amber-500',
        text: 'text-amber-300',
      };
    case 'critical':
      return {
        badge: 'bg-red-500/15 text-red-300 border-red-500/30',
        border: 'border-l-red-500',
        text: 'text-red-300',
      };
    default:
      return {
        badge: 'bg-muted text-muted-foreground border-border',
        border: 'border-l-border',
        text: 'text-muted-foreground',
      };
  }
}

function statusLabel(status: SystemsStatus) {
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

function commitmentStatusLabel(status: SystemsCommitmentStatus) {
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'done':
      return 'Done';
    default:
      return 'Planned';
  }
}

function commitmentStatusClasses(status: SystemsCommitmentStatus) {
  switch (status) {
    case 'done':
      return 'border-emerald-500/30 text-emerald-300';
    case 'in_progress':
      return 'border-chart-1/40 text-chart-1';
    case 'blocked':
      return 'border-red-500/30 text-red-300';
    default:
      return 'border-amber-500/30 text-amber-300';
  }
}

function incidentStatusLabel(status: SystemsIncidentStatus) {
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

function incidentStatusClasses(status: SystemsIncidentStatus) {
  switch (status) {
    case 'resolved':
      return 'border-emerald-500/30 text-emerald-300';
    case 'mitigated':
      return 'border-chart-1/40 text-chart-1';
    case 'follow_up_pending':
      return 'border-amber-500/30 text-amber-300';
    default:
      return 'border-red-500/30 text-red-300';
  }
}

function incidentSeverityLabel(severity: SystemsIncidentSeverity) {
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

function incidentSeverityClasses(severity: SystemsIncidentSeverity) {
  switch (severity) {
    case 'p0':
      return 'border-red-500/30 text-red-300';
    case 'p1':
      return 'border-amber-500/30 text-amber-300';
    case 'p2':
      return 'border-chart-1/40 text-chart-1';
    case 'near_miss':
      return 'border-border text-muted-foreground';
    default:
      return 'border-emerald-500/30 text-emerald-300';
  }
}

function incidentTypeLabel(entryType: SystemsIncidentType) {
  return entryType === 'drill' ? 'Drill' : 'Incident';
}

function automationFollowupStatusLabel(status: SystemsAutomationFollowupStatus) {
  switch (status) {
    case 'acknowledged':
      return 'Acknowledged';
    case 'resolved':
      return 'Resolved';
    default:
      return 'Open';
  }
}

function automationFollowupStatusClasses(status: SystemsAutomationFollowupStatus) {
  switch (status) {
    case 'acknowledged':
      return 'border-chart-1/40 text-chart-1';
    case 'resolved':
      return 'border-emerald-500/30 text-emerald-300';
    default:
      return 'border-amber-500/30 text-amber-300';
  }
}

function automationActivityToneClasses(tone: SystemsAutomationActivityRecord['tone']) {
  switch (tone) {
    case 'good':
      return 'border-emerald-500/30 text-emerald-300';
    case 'warning':
      return 'border-amber-500/30 text-amber-300';
    case 'critical':
      return 'border-red-500/30 text-red-300';
    default:
      return 'border-border text-muted-foreground';
  }
}

function automationActivityTypeLabel(type: SystemsAutomationActivityRecord['type']) {
  switch (type) {
    case 'review_draft':
      return 'Review draft';
    case 'operator_escalation':
      return 'Escalation';
    case 'commitment_shepherd':
      return 'Shepherd';
    case 'performance_baseline':
      return 'Baseline';
    case 'trust_surface_review':
      return 'Trust review';
    case 'followup':
      return 'Follow-up';
    default:
      return 'Sweep';
  }
}

function automationTriggerLabel(triggerType: SystemsAutomationFollowup['triggerType']) {
  switch (triggerType) {
    case 'review_discipline':
      return 'Review discipline';
    case 'performance_baseline':
      return 'Performance baseline';
    case 'trust_surface_review':
      return 'Trust surfaces';
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

function automationActorLabel(actorType: SystemsAutomationActivityRecord['actorType']) {
  switch (actorType) {
    case 'cron':
      return 'Scheduled';
    case 'manual':
      return 'Manual';
    default:
      return 'Synced';
  }
}

function automationActivityIcon(type: SystemsAutomationActivityRecord['type']) {
  switch (type) {
    case 'review_draft':
      return Sparkles;
    case 'operator_escalation':
      return AlertTriangle;
    case 'commitment_shepherd':
      return Target;
    case 'performance_baseline':
      return Gauge;
    case 'trust_surface_review':
      return ShieldCheck;
    case 'followup':
      return ListChecks;
    default:
      return Bot;
  }
}

function performanceBaselineEnvironmentLabel(environment: SystemsPerformanceBaselineEnvironment) {
  switch (environment) {
    case 'production':
      return 'Production';
    case 'preview':
      return 'Preview';
    default:
      return 'Local';
  }
}

function formatPerformanceMetric(value?: number | null) {
  if (value === null || value === undefined) return 'Not recorded';
  return `${Math.round(value)}ms`;
}

function trustSurfaceSloLabel(sloId: string) {
  return TRUST_SURFACE_SLO_OPTIONS.find((option) => option.id === sloId)?.label ?? sloId;
}

function launchDecisionLabel(decision: SystemsLaunchDecision) {
  switch (decision) {
    case 'ready':
      return 'Launch-ready';
    case 'blocked':
      return 'Launch-blocked';
    default:
      return 'Launch-risky';
  }
}

function launchDecisionClasses(decision: SystemsLaunchDecision) {
  switch (decision) {
    case 'ready':
      return statusClasses('good');
    case 'blocked':
      return statusClasses('critical');
    default:
      return statusClasses('warning');
  }
}

function commitmentShepherdStatusLabel(
  status: NonNullable<SystemsDashboardData['latestCommitmentShepherd']>['status'],
) {
  return status === 'focus' ? 'Needs focus' : 'Clear';
}

function commitmentShepherdStatusClasses(
  status: NonNullable<SystemsDashboardData['latestCommitmentShepherd']>['status'],
) {
  return status === 'focus'
    ? 'border-amber-500/30 text-amber-300'
    : 'border-emerald-500/30 text-emerald-300';
}

function commitmentShepherdReasonLabel(
  reason: NonNullable<SystemsDashboardData['latestCommitmentShepherd']>['reason'],
) {
  return reason === 'blocked' ? 'Blocked' : 'Overdue';
}

function automationSeverityClasses(severity: SystemsAutomationFollowup['severity']) {
  return severity === 'critical'
    ? 'border-red-500/30 text-red-300'
    : 'border-amber-500/30 text-amber-300';
}

function coverageLabel(coverage: SystemsJourney['coverage']) {
  switch (coverage) {
    case 'automated':
      return 'Automated';
    case 'partial':
      return 'Partial';
    default:
      return 'Manual';
  }
}

function scorecardTrendMeta(trend: SystemsDashboardData['scorecardSync']['trend']) {
  switch (trend) {
    case 'improving':
      return {
        label: 'Improving',
        className: 'border-emerald-500/30 text-emerald-300',
        icon: TrendingUp,
      };
    case 'worsening':
      return {
        label: 'Worsening',
        className: 'border-red-500/30 text-red-300',
        icon: TrendingDown,
      };
    case 'steady':
      return {
        label: 'Steady',
        className: 'border-border text-muted-foreground',
        icon: Minus,
      };
    default:
      return {
        label: 'New',
        className: 'border-chart-1/40 text-chart-1',
        icon: Sparkles,
      };
  }
}

function sloTitle(sloId: string, slos: SystemsDashboardData['slos']) {
  return slos.find((slo) => slo.id === sloId)?.title ?? sloId;
}

function formatMinutesLabel(minutes?: number | null) {
  if (minutes === null || minutes === undefined) return 'Not recorded';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function ActionCard({ action }: { action: SystemsAction }) {
  const priorityClasses =
    action.priority === 'P0'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : action.priority === 'P1'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <Card className="border-l-2 border-l-chart-1/50">
      <CardContent className="pt-5 pb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={priorityClasses}>
              {action.priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {action.timeframe === 'now'
                ? 'Now'
                : action.timeframe === 'this-week'
                  ? 'This week'
                  : 'Foundation'}
            </Badge>
          </div>
          {action.automationReady ? (
            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-300">
              Agent-ready
            </Badge>
          ) : null}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{action.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{action.summary}</p>
        </div>
        {action.href ? (
          <Button asChild size="sm" variant="outline" className="w-full justify-between">
            <Link href={action.href}>
              Open
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PromiseCard({ promise }: { promise: SystemsPromiseCard }) {
  const classes = statusClasses(promise.status);

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={classes.badge}>
                {statusLabel(promise.status)}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {promise.confidence}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold">{promise.title}</h3>
          </div>
          <ShieldCheck className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{promise.metricLabel}</p>
          <p className="text-2xl font-bold leading-none">{promise.currentValue}</p>
          <p className="text-xs text-muted-foreground">Target: {promise.target}</p>
        </div>

        <p className="text-sm text-muted-foreground">{promise.summary}</p>

        {promise.actionHref ? (
          <Button asChild size="sm" variant="outline" className="w-full justify-between">
            <Link href={promise.actionHref}>
              {promise.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SloCard({ slo }: { slo: SystemsSloCard }) {
  const classes = statusClasses(slo.status);

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {statusLabel(slo.status)}
            </Badge>
            <h3 className="text-sm font-semibold">{slo.title}</h3>
          </div>
          <Target className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <p className="text-sm text-muted-foreground">{slo.objective}</p>

        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current</p>
            <p className="text-sm font-semibold mt-1">{slo.currentValue}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Target</p>
            <p className="text-sm mt-1">{slo.target}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alert when</p>
            <p className="text-sm mt-1">{slo.alertThreshold}</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">SLI: {slo.sli}</p>
          <p className="text-sm text-muted-foreground">{slo.summary}</p>
        </div>

        {slo.actionHref ? (
          <Button asChild size="sm" variant="outline" className="w-full justify-between">
            <Link href={slo.actionHref}>
              {slo.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReviewDisciplineCard({ reviewDiscipline }: { reviewDiscipline: SystemsReviewDiscipline }) {
  const classes = statusClasses(reviewDiscipline.status);

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {statusLabel(reviewDiscipline.status)}
            </Badge>
            <h3 className="text-sm font-semibold">{reviewDiscipline.headline}</h3>
          </div>
          <CalendarDays className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current cadence</p>
          <p className="text-2xl font-bold leading-none">{reviewDiscipline.currentValue}</p>
          <p className="text-xs text-muted-foreground">Target: {reviewDiscipline.target}</p>
        </div>

        <p className="text-sm text-muted-foreground">{reviewDiscipline.summary}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Open commitments
            </p>
            <p className="text-sm font-semibold mt-1">{reviewDiscipline.openCommitments}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Overdue</p>
            <p className="text-sm font-semibold mt-1">{reviewDiscipline.overdueCommitments}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScorecardSyncCard({
  scorecardSync,
  slos,
}: {
  scorecardSync: SystemsDashboardData['scorecardSync'];
  slos: SystemsDashboardData['slos'];
}) {
  const classes = statusClasses(scorecardSync.status);
  const trend = scorecardTrendMeta(scorecardSync.trend);
  const TrendIcon = trend.icon;

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {statusLabel(scorecardSync.status)}
            </Badge>
            <h3 className="text-sm font-semibold">{scorecardSync.headline}</h3>
          </div>
          <History className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current scorecard sync</p>
          <p className="text-2xl font-bold leading-none">{scorecardSync.currentValue}</p>
          <p className="text-xs text-muted-foreground">Target: {scorecardSync.target}</p>
        </div>

        <p className="text-sm text-muted-foreground">{scorecardSync.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last review</p>
            <p className="text-sm font-semibold mt-1">
              {scorecardSync.lastReviewedAt
                ? new Date(scorecardSync.lastReviewedAt).toLocaleDateString()
                : 'Not logged'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Live posture
            </p>
            <p className="text-sm font-semibold mt-1">{statusLabel(scorecardSync.liveStatus)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Trend</p>
            <div className="mt-1">
              <Badge variant="outline" className={trend.className}>
                <TrendIcon className="h-3 w-3" />
                {trend.label}
              </Badge>
            </div>
          </div>
        </div>

        {scorecardSync.driftSloIds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Missing live focus
            </p>
            <div className="flex flex-wrap gap-2">
              {scorecardSync.driftSloIds.map((sloId) => (
                <Badge
                  key={sloId}
                  variant="outline"
                  className="text-xs border-amber-500/30 text-amber-300"
                >
                  {sloTitle(sloId, slos)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {scorecardSync.hotspotSloIds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Recurring hotspots
            </p>
            <div className="flex flex-wrap gap-2">
              {scorecardSync.hotspotSloIds.map((sloId) => (
                <Badge key={sloId} variant="outline" className="text-xs">
                  {sloTitle(sloId, slos)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SuggestedReviewDraftCard({
  draft,
  onApply,
  onRefresh,
  isRefreshing,
}: {
  draft?: SystemsReviewDraft | null;
  onApply: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const classes = statusClasses(draft?.overallStatus ?? 'bootstrap');

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-chart-1" />
            Suggested weekly review draft
          </span>
          {draft ? (
            <Badge variant="outline" className="capitalize">
              {draft.actorType === 'cron' ? 'Scheduled' : 'Manual'}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Review date
                </p>
                <p className="text-sm font-semibold mt-1">
                  {new Date(`${draft.reviewDate}T00:00:00`).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Generated
                </p>
                <p className="text-sm font-semibold mt-1">
                  {new Date(draft.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Focus area
              </p>
              <p className="text-sm font-semibold">{draft.focusArea}</p>
            </div>

            <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Top risk</p>
              <p className="text-sm mt-1">{draft.topRisk}</p>
            </div>

            <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Commitment to leave behind
              </p>
              <p className="text-sm font-semibold mt-1">{draft.hardeningCommitmentTitle}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {draft.hardeningCommitmentSummary}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Suggested evidence notes
              </p>
              <p className="text-sm text-muted-foreground">{draft.changeNotes}</p>
            </div>

            {draft.linkedSloIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {draft.linkedSloIds.map((sloId) => (
                  <Badge key={sloId} variant="outline" className="text-xs">
                    {sloId}
                  </Badge>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">No weekly draft has been generated yet.</p>
            <p className="text-sm text-muted-foreground">
              The Monday cadence will create one automatically. You can also refresh it manually
              right now and apply it into the review form below.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {draft ? (
            <Button type="button" variant="secondary" className="flex-1" onClick={onApply}>
              Apply draft to form
            </Button>
          ) : null}
          <Button
            type="button"
            variant={draft ? 'outline' : 'default'}
            className="flex-1"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing draft...
              </>
            ) : draft ? (
              'Refresh draft'
            ) : (
              'Generate first draft'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StoryColumn({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string;
  icon: typeof CheckCircle2;
  items: string[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">{empty}</p>
        ) : (
          items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-md border border-border/60 bg-card/40 px-3 py-2 text-muted-foreground"
            >
              {item}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ReviewStepCard({ step, index }: { step: SystemsReviewStep; index: number }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-chart-1/40 text-xs font-semibold text-chart-1">
              {index}
            </div>
            <div>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{step.summary}</p>
            </div>
          </div>
          {step.automationReady ? (
            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-300">
              Agent-ready
            </Badge>
          ) : null}
        </div>
        <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Required output
          </p>
          <p className="text-sm mt-1">{step.output}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CommitmentShepherdCard({
  shepherd,
  onApply,
}: {
  shepherd: SystemsDashboardData['latestCommitmentShepherd'];
  onApply: () => void;
}) {
  const isFocused = shepherd?.status === 'focus';

  return (
    <Card className={cn(isFocused && shepherd.reason === 'blocked' && 'border-red-500/40')}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-chart-1" />
            Commitment shepherd
          </span>
          {shepherd ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={commitmentShepherdStatusClasses(shepherd.status)}>
                {commitmentShepherdStatusLabel(shepherd.status)}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {shepherd.actorType === 'cron' ? 'Scheduled' : 'Manual'}
              </Badge>
            </div>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFocused ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={commitmentStatusClasses(shepherd.commitmentStatus!)}
              >
                {commitmentStatusLabel(shepherd.commitmentStatus!)}
              </Badge>
              <Badge
                variant="outline"
                className={
                  shepherd.reason === 'blocked'
                    ? 'border-red-500/30 text-red-300'
                    : 'border-amber-500/30 text-amber-300'
                }
              >
                {commitmentShepherdReasonLabel(shepherd.reason)}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold">{shepherd.commitmentTitle ?? shepherd.title}</p>
              <p className="text-sm text-muted-foreground">{shepherd.summary}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Owner</p>
                <p className="text-sm mt-1">{shepherd.owner}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Due</p>
                <p className="text-sm mt-1">
                  {shepherd.dueDate
                    ? new Date(`${shepherd.dueDate}T00:00:00`).toLocaleDateString()
                    : 'No due date'}
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Recommended action
              </p>
              <p className="text-sm mt-1">{shepherd.recommendedAction}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onApply}>
                Apply to weekly review
              </Button>
              {shepherd.actionHref ? (
                <Button asChild size="sm" variant="outline" className="flex-1 justify-between">
                  <Link href={shepherd.actionHref}>
                    Open commitment
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </>
        ) : shepherd ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{shepherd.title}</p>
            <p className="text-sm text-muted-foreground">{shepherd.summary}</p>
            <p className="text-sm text-muted-foreground">{shepherd.recommendedAction}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">No commitment shepherd recommendation yet.</p>
            <p className="text-sm text-muted-foreground">
              Run the daily sweep to pick the one blocked or overdue hardening commitment that
              deserves founder attention next.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommitmentCard({
  commitment,
  onStatusChange,
  isUpdating,
}: {
  commitment: SystemsCommitmentCard;
  onStatusChange: (status: SystemsCommitmentStatus) => void;
  isUpdating: boolean;
}) {
  return (
    <Card
      id={`commitment-${commitment.id}`}
      className={cn(commitment.isOverdue && 'border-red-500/40')}
    >
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={commitmentStatusClasses(commitment.status)}>
                {commitmentStatusLabel(commitment.status)}
              </Badge>
              {commitment.isOverdue ? (
                <Badge variant="outline" className="border-red-500/30 text-red-300">
                  Overdue
                </Badge>
              ) : null}
            </div>
            <h3 className="text-sm font-semibold">{commitment.title}</h3>
          </div>
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <p className="text-sm text-muted-foreground">{commitment.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Owner</p>
            <p className="text-sm mt-1">{commitment.owner}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Due</p>
            <p className="text-sm mt-1">
              {commitment.dueDate
                ? new Date(`${commitment.dueDate}T00:00:00`).toLocaleDateString()
                : 'No due date'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Age</p>
            <p className="text-sm mt-1">
              {commitment.ageDays} day{commitment.ageDays === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {commitment.linkedSloIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {commitment.linkedSloIds.map((sloId) => (
              <Badge key={sloId} variant="outline" className="text-xs">
                {sloId}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`commitment-status-${commitment.id}`}>Update status</Label>
          <Select
            value={commitment.status}
            onValueChange={(value) => onStatusChange(value as SystemsCommitmentStatus)}
            disabled={isUpdating}
          >
            <SelectTrigger id={`commitment-status-${commitment.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewHistoryCard({ review }: { review: SystemsReviewRecord }) {
  const classes = statusClasses(review.overallStatus);

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={classes.badge}>
                {statusLabel(review.overallStatus)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {new Date(review.reviewedAt).toLocaleDateString()}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold">{review.focusArea}</h3>
          </div>
          <CalendarDays className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Review note</p>
          <p className="text-sm text-muted-foreground">{review.summary}</p>
        </div>

        <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Top risk</p>
          <p className="text-sm mt-1">{review.topRisk}</p>
        </div>

        {review.commitment ? (
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2 space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Hardening commitment
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{review.commitment.title}</p>
              <Badge
                variant="outline"
                className={commitmentStatusClasses(review.commitment.status)}
              >
                {commitmentStatusLabel(review.commitment.status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {review.commitment.owner}
              {review.commitment.dueDate
                ? ` • due ${new Date(`${review.commitment.dueDate}T00:00:00`).toLocaleDateString()}`
                : ''}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function IncidentSummaryCard({ summary }: { summary: SystemsDashboardData['incidentSummary'] }) {
  const classes = statusClasses(summary.status);

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {statusLabel(summary.status)}
            </Badge>
            <h3 className="text-sm font-semibold">{summary.headline}</h3>
          </div>
          <AlertTriangle className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current response posture</p>
          <p className="text-2xl font-bold leading-none">{summary.currentValue}</p>
          <p className="text-xs text-muted-foreground">Target: {summary.target}</p>
        </div>

        <p className="text-sm text-muted-foreground">{summary.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last drill</p>
            <p className="text-sm font-semibold mt-1">
              {summary.lastDrillAt
                ? new Date(`${summary.lastDrillAt}T00:00:00`).toLocaleDateString()
                : 'Not logged'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Last incident
            </p>
            <p className="text-sm font-semibold mt-1">
              {summary.lastIncidentAt
                ? new Date(`${summary.lastIncidentAt}T00:00:00`).toLocaleDateString()
                : 'None logged'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Logged drills
            </p>
            <p className="text-sm font-semibold mt-1">{summary.drillCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IncidentHistoryCard({ entry }: { entry: SystemsIncidentRecord }) {
  return (
    <Card
      className={cn(
        entry.entryType === 'incident' && entry.status === 'open' && 'border-red-500/40',
      )}
    >
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={incidentSeverityClasses(entry.severity)}>
                {incidentSeverityLabel(entry.severity)}
              </Badge>
              <Badge variant="outline" className={incidentStatusClasses(entry.status)}>
                {incidentStatusLabel(entry.status)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {incidentTypeLabel(entry.entryType)}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold">{entry.title}</h3>
          </div>
          <History className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />
        </div>

        <p className="text-sm text-muted-foreground">{entry.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date</p>
            <p className="text-sm mt-1">
              {new Date(`${entry.incidentDate}T00:00:00`).toLocaleDateString()}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Detected by</p>
            <p className="text-sm mt-1">{entry.detectedBy}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Follow-up owner
            </p>
            <p className="text-sm mt-1">{entry.followUpOwner}</p>
          </div>
        </div>

        {entry.systemsAffected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entry.systemsAffected.map((system) => (
              <Badge key={system} variant="outline" className="text-xs">
                {system}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Root cause</p>
            <p className="text-sm mt-1">{entry.rootCause}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mitigation</p>
            <p className="text-sm mt-1">{entry.mitigation}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Permanent fix
            </p>
            <p className="text-sm mt-1">{entry.permanentFix}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ack</p>
            <p className="text-sm mt-1">{formatMinutesLabel(entry.timeToAcknowledgeMinutes)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mitigate</p>
            <p className="text-sm mt-1">{formatMinutesLabel(entry.timeToMitigateMinutes)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Resolve</p>
            <p className="text-sm mt-1">{formatMinutesLabel(entry.timeToResolveMinutes)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceBaselineSummaryCard({ data }: { data: SystemsDashboardData }) {
  const classes = statusClasses(data.performanceBaselineSummary.status);
  const latest = data.latestPerformanceBaseline;

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {statusLabel(data.performanceBaselineSummary.status)}
            </Badge>
            <h3 className="text-sm font-semibold">{data.performanceBaselineSummary.headline}</h3>
          </div>
          <Gauge className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current state</p>
          <p className="text-2xl font-bold leading-none">
            {data.performanceBaselineSummary.currentValue}
          </p>
          <p className="text-xs text-muted-foreground">
            Target: {data.performanceBaselineSummary.target}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">{data.performanceBaselineSummary.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Latest baseline
            </p>
            <p className="text-sm mt-1">
              {latest
                ? `${latest.baselineDate} (${performanceBaselineEnvironmentLabel(latest.environment)})`
                : 'Not recorded'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Bottleneck owner
            </p>
            <p className="text-sm mt-1">{latest?.mitigationOwner ?? 'Not assigned yet'}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Worst recorded p95
            </p>
            <p className="text-sm mt-1">
              {latest
                ? ([
                    latest.apiDrepsP95Ms,
                    latest.apiV1DrepsP95Ms,
                    latest.governanceHealthP95Ms,
                    latest.apiHealthP95Ms,
                  ]
                    .filter((value): value is number => typeof value === 'number')
                    .sort((left, right) => right - left)
                    .map((value) => `${Math.round(value)}ms`)[0] ?? 'Not recorded')
                : 'Not recorded'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Error rate</p>
            <p className="text-sm mt-1">
              {latest?.errorRatePct === null || latest?.errorRatePct === undefined
                ? 'Not recorded'
                : `${latest.errorRatePct.toFixed(1)}%`}
            </p>
          </div>
        </div>

        {latest ? (
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Latest bottleneck
            </p>
            <p className="text-sm">{latest.bottleneck}</p>
            <p className="text-sm text-muted-foreground">{latest.nextStep}</p>
            {latest.artifactUrl ? (
              <Button asChild size="sm" variant="outline" className="w-full justify-between">
                <Link href={latest.artifactUrl} target="_blank" rel="noreferrer">
                  Open artifact
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PerformanceBaselineHistoryCard({
  history,
}: {
  history: SystemsDashboardData['performanceBaselineHistory'];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-chart-1" />
          Performance baseline trail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Keep the latest load-test evidence, bottleneck owner, and next step here so performance
          discipline survives beyond one-off test runs.
        </p>

        {history.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-4">
            <p className="text-sm font-medium">No performance baseline is logged yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Record the first durable baseline so the sweep can track freshness and follow-through.
            </p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={`${entry.loggedAt}:${entry.baselineDate}:${entry.environment}`}
              className="rounded-md border border-border/60 bg-card/40 px-3 py-3 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={statusClasses(entry.overallStatus).badge}>
                      {statusLabel(entry.overallStatus)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {performanceBaselineEnvironmentLabel(entry.environment)}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{entry.baselineDate}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.scenarioLabel} • {entry.concurrencyProfile}
                    </p>
                  </div>
                </div>

                {entry.artifactUrl ? (
                  <Button asChild size="sm" variant="ghost" className="shrink-0">
                    <Link href={entry.artifactUrl} target="_blank" rel="noreferrer">
                      Artifact
                    </Link>
                  </Button>
                ) : null}
              </div>

              <p className="text-sm text-muted-foreground">{entry.summary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                <div className="rounded-md border border-border/60 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    `/api/health`
                  </p>
                  <p className="text-sm mt-1">{formatPerformanceMetric(entry.apiHealthP95Ms)}</p>
                </div>
                <div className="rounded-md border border-border/60 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    `/api/dreps`
                  </p>
                  <p className="text-sm mt-1">{formatPerformanceMetric(entry.apiDrepsP95Ms)}</p>
                </div>
                <div className="rounded-md border border-border/60 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    `/api/v1/dreps`
                  </p>
                  <p className="text-sm mt-1">{formatPerformanceMetric(entry.apiV1DrepsP95Ms)}</p>
                </div>
                <div className="rounded-md border border-border/60 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Error rate
                  </p>
                  <p className="text-sm mt-1">
                    {entry.errorRatePct === null || entry.errorRatePct === undefined
                      ? 'Not recorded'
                      : `${entry.errorRatePct.toFixed(1)}%`}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-border/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Bottleneck and next step
                </p>
                <p className="text-sm mt-1">{entry.bottleneck}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Owner: {entry.mitigationOwner}. {entry.nextStep}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TrustSurfaceReviewSummaryCard({ data }: { data: SystemsDashboardData }) {
  const classes = statusClasses(data.trustSurfaceReviewSummary.status);
  const latest = data.latestTrustSurfaceReview;

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {statusLabel(data.trustSurfaceReviewSummary.status)}
            </Badge>
            <h3 className="text-sm font-semibold">{data.trustSurfaceReviewSummary.headline}</h3>
          </div>
          <ShieldCheck className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current state</p>
          <p className="text-2xl font-bold leading-none">
            {data.trustSurfaceReviewSummary.currentValue}
          </p>
          <p className="text-xs text-muted-foreground">
            Target: {data.trustSurfaceReviewSummary.target}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">{data.trustSurfaceReviewSummary.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Latest review
            </p>
            <p className="text-sm mt-1">{latest ? latest.reviewDate : 'Not reviewed yet'}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Review owner
            </p>
            <p className="text-sm mt-1">{latest?.owner ?? 'Founder + agents'}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2 sm:col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Linked SLOs</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(latest?.linkedSloIds ?? data.trustSurfaceReviewSummary.linkedSloIds).length ===
              0 ? (
                <span className="text-sm text-muted-foreground">
                  No active degraded-state review required.
                </span>
              ) : (
                (latest?.linkedSloIds ?? data.trustSurfaceReviewSummary.linkedSloIds).map(
                  (sloId) => (
                    <Badge key={sloId} variant="outline" className="text-xs">
                      {trustSurfaceSloLabel(sloId)}
                    </Badge>
                  ),
                )
              )}
            </div>
          </div>
        </div>

        {latest ? (
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Current user state
            </p>
            <p className="text-sm">{latest.currentUserState}</p>
            <p className="text-sm text-muted-foreground">Honesty gap: {latest.honestyGap}</p>
            <p className="text-sm text-muted-foreground">Next fix: {latest.nextFix}</p>
            {latest.artifactUrl ? (
              <Button asChild size="sm" variant="outline" className="w-full justify-between">
                <Link href={latest.artifactUrl} target="_blank" rel="noreferrer">
                  Open artifact
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TrustSurfaceReviewHistoryCard({
  history,
}: {
  history: SystemsDashboardData['trustSurfaceReviewHistory'];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-chart-1" />
          Trust-surface review trail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Record what degraded users actually saw, where the UI was honest or misleading, and who
          owns the next honesty fix.
        </p>

        {history.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-4">
            <p className="text-sm font-medium">No degraded-state trust review is logged yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              When availability, freshness, or correctness drifts, log what the user experience
              looked like before the signal goes stale.
            </p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={`${entry.loggedAt}:${entry.reviewDate}`}
              className="rounded-md border border-border/60 bg-card/40 px-3 py-3 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={statusClasses(entry.overallStatus).badge}>
                      {statusLabel(entry.overallStatus)}
                    </Badge>
                    {entry.linkedSloIds.map((sloId) => (
                      <Badge key={sloId} variant="outline" className="text-xs">
                        {trustSurfaceSloLabel(sloId)}
                      </Badge>
                    ))}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{entry.reviewDate}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Owner: {entry.owner}</p>
                  </div>
                </div>

                {entry.artifactUrl ? (
                  <Button asChild size="sm" variant="ghost" className="shrink-0">
                    <Link href={entry.artifactUrl} target="_blank" rel="noreferrer">
                      Artifact
                    </Link>
                  </Button>
                ) : null}
              </div>

              <p className="text-sm text-muted-foreground">{entry.summary}</p>

              <div className="rounded-md border border-border/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Reviewed surfaces
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.reviewedSurfaces.map((surface) => (
                    <Badge key={surface} variant="outline" className="text-xs">
                      {surface}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-border/60 px-3 py-2 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  User state and next fix
                </p>
                <p className="text-sm">{entry.currentUserState}</p>
                <p className="text-sm text-muted-foreground">Honesty gap: {entry.honestyGap}</p>
                <p className="text-sm text-muted-foreground">Next fix: {entry.nextFix}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function LaunchControlRoomCard({ data }: { data: SystemsDashboardData }) {
  const room = data.launchControlRoom;
  const classes = launchDecisionClasses(room.decision);

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {launchDecisionLabel(room.decision)}
            </Badge>
            <h3 className="text-sm font-semibold">{room.headline}</h3>
          </div>
          <Target className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Decision</p>
            <p className="text-sm mt-1">{launchDecisionLabel(room.decision)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Blockers</p>
            <p className="text-sm mt-1">{room.blockerCount}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Watch items</p>
            <p className="text-sm mt-1">{room.watchCount}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{room.summary}</p>
        <div className="rounded-md border border-border/60 bg-card/40 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current call</p>
          <p className="text-sm mt-2">{room.currentCall}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LaunchChecklistCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item) => (
            <div
              key={item}
              className="rounded-md border border-border/60 bg-card/40 px-3 py-3 text-sm"
            >
              {item}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function LaunchChecklistTable({ data }: { data: SystemsDashboardData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Go / no-go checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.launchControlRoom.checklist.map((item) => {
          const classes = launchDecisionClasses(item.decision);

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-md border border-l-2 bg-card/40 px-3 py-3 space-y-2',
                classes.border,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </div>
                <Badge variant="outline" className={classes.badge}>
                  {launchDecisionLabel(item.decision)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Threshold: {item.threshold}</p>
              <p className="text-xs text-muted-foreground">Evidence: {item.evidence}</p>
              {item.href ? (
                <Button asChild size="sm" variant="outline" className="w-full justify-between">
                  <Link href={item.href}>
                    Open evidence
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LaunchWeekCadenceCard({ data }: { data: SystemsDashboardData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Launch-week cadence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.launchControlRoom.launchWeekCadence.map((item) => (
          <div
            key={item.day}
            className="rounded-md border border-border/60 bg-card/40 px-3 py-3 space-y-1"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.day}</p>
              <Badge variant="outline" className="text-xs">
                {item.trigger}
              </Badge>
            </div>
            <p className="text-sm">{item.focus}</p>
            <p className="text-xs text-muted-foreground">Output: {item.output}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AutomationInboxSummaryCard({
  data,
  onRunSweep,
  isRunning,
}: {
  data: SystemsDashboardData;
  onRunSweep: () => void;
  isRunning: boolean;
}) {
  const classes = statusClasses(data.automationSummary.status);

  return (
    <Card className={cn('border-l-2', classes.border)}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className={classes.badge}>
              {statusLabel(data.automationSummary.status)}
            </Badge>
            <h3 className="text-sm font-semibold">{data.automationSummary.headline}</h3>
          </div>
          <Bot className={cn('h-4 w-4 shrink-0 mt-1', classes.text)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current state</p>
          <p className="text-2xl font-bold leading-none">{data.automationSummary.currentValue}</p>
          <p className="text-xs text-muted-foreground">Target: {data.automationSummary.target}</p>
        </div>

        <p className="text-sm text-muted-foreground">{data.automationSummary.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last sweep</p>
            <p className="text-sm mt-1">
              {data.automationSummary.lastSweepAt
                ? new Date(data.automationSummary.lastSweepAt).toLocaleString()
                : 'Not started'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Latest result
            </p>
            <p className="text-sm mt-1">
              {data.latestAutomationRun?.summary || 'No sweep recorded yet.'}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Latest escalation
            </p>
            <p className="text-sm mt-1">
              {data.latestOperatorEscalation
                ? `${new Date(data.latestOperatorEscalation.createdAt).toLocaleString()} (${
                    data.latestOperatorEscalation.status
                  })`
                : 'No founder digest sent yet.'}
            </p>
          </div>
        </div>

        <Button onClick={onRunSweep} disabled={isRunning} className="w-full">
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running sweep...
            </>
          ) : (
            'Run sweep now'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function AutomationFollowupCard({
  followup,
  onStatusChange,
  isUpdating,
}: {
  followup: SystemsAutomationFollowup;
  onStatusChange: (status: SystemsAutomationFollowupStatus) => void;
  isUpdating: boolean;
}) {
  return (
    <Card className={cn(followup.severity === 'critical' && 'border-red-500/40')}>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={automationSeverityClasses(followup.severity)}>
                {followup.severity === 'critical' ? 'Critical' : 'Warning'}
              </Badge>
              <Badge variant="outline" className={automationFollowupStatusClasses(followup.status)}>
                {automationFollowupStatusLabel(followup.status)}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold">{followup.title}</h3>
          </div>
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <p className="text-sm text-muted-foreground">{followup.summary}</p>

        <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Recommended action
          </p>
          <p className="text-sm mt-1">{followup.recommendedAction}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Trigger</p>
            <p className="text-sm mt-1">{automationTriggerLabel(followup.triggerType)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Last updated
            </p>
            <p className="text-sm mt-1">{new Date(followup.updatedAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`followup-status-${followup.sourceKey}`}>Follow-up status</Label>
          <Select
            value={followup.status}
            onValueChange={(value) => onStatusChange(value as SystemsAutomationFollowupStatus)}
            disabled={isUpdating}
          >
            <SelectTrigger id={`followup-status-${followup.sourceKey}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {followup.actionHref ? (
          <Button asChild size="sm" variant="outline" className="w-full justify-between">
            <Link href={followup.actionHref}>
              Open action
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AutomationCadenceCard({ data }: { data: SystemsDashboardData }) {
  const cadenceRows = [
    {
      label: 'Daily sweep',
      schedule: 'Every day at 9:00 AM ET',
      latest: data.latestAutomationRun
        ? `${new Date(data.latestAutomationRun.createdAt).toLocaleString()} • ${data.latestAutomationRun.summary}`
        : 'No sweep recorded yet.',
    },
    {
      label: 'Weekly draft',
      schedule: 'Mondays at 9:15 AM ET',
      latest: data.suggestedReviewDraft
        ? `${new Date(data.suggestedReviewDraft.generatedAt).toLocaleString()} • ${data.suggestedReviewDraft.focusArea}`
        : 'No review draft recorded yet.',
    },
    {
      label: 'Commitment shepherd',
      schedule: 'Runs after each sweep',
      latest: data.latestCommitmentShepherd
        ? `${new Date(data.latestCommitmentShepherd.createdAt).toLocaleString()} • ${data.latestCommitmentShepherd.title}`
        : 'No shepherd record yet.',
    },
    {
      label: 'Performance baseline discipline',
      schedule: 'Every 14 days or after risky route changes',
      latest: data.latestPerformanceBaseline
        ? `${new Date(data.latestPerformanceBaseline.loggedAt).toLocaleString()} (${data.latestPerformanceBaseline.baselineDate}, ${data.latestPerformanceBaseline.overallStatus})`
        : 'No durable baseline recorded yet.',
    },
    {
      label: 'Trust-surface review discipline',
      schedule: 'When availability, freshness, or correctness drops below healthy',
      latest: data.latestTrustSurfaceReview
        ? `${new Date(data.latestTrustSurfaceReview.loggedAt).toLocaleString()} (${data.latestTrustSurfaceReview.reviewDate}, ${data.latestTrustSurfaceReview.overallStatus})`
        : 'No trust-surface review recorded yet.',
    },
    {
      label: 'Founder escalation',
      schedule: 'Only when critical follow-ups stay open',
      latest: data.latestOperatorEscalation
        ? `${new Date(data.latestOperatorEscalation.createdAt).toLocaleString()} • ${data.latestOperatorEscalation.status === 'sent' ? 'digest sent' : 'delivery failed'}`
        : 'No escalation digest recorded yet.',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-chart-1" />
          Automation cadence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Backend automations run through Inngest. This card shows the intended cadence and the
          latest durable record for each automation loop.
        </p>
        <div className="space-y-3">
          {cadenceRows.map((row) => (
            <div
              key={row.label}
              className="rounded-md border border-border/60 bg-card/40 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{row.label}</p>
                <Badge variant="outline" className="text-xs">
                  {row.schedule}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{row.latest}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationHistoryCard({
  history,
}: {
  history: SystemsDashboardData['automationHistory'];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-chart-1" />
          Automation history and outcomes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Every sweep, follow-up sync, review draft, performance baseline, escalation, and
          commitment shepherd record lands here so you can see what ran, what it created, and what
          later got resolved.
        </p>

        {history.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-card/40 px-3 py-4">
            <p className="text-sm font-medium">No automation history yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Run the first sweep or generate the first draft to start the durable operating trail.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => {
              const Icon = automationActivityIcon(entry.type);

              return (
                <div
                  key={entry.id}
                  className="rounded-md border border-border/60 bg-card/40 px-3 py-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={automationActivityToneClasses(entry.tone)}
                        >
                          {entry.statusLabel}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {automationActivityTypeLabel(entry.type)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {automationActorLabel(entry.actorType)}
                        </Badge>
                      </div>
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 text-chart-1 mt-0.5 shrink-0" />
                        <div>
                          <h3 className="text-sm font-semibold">{entry.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {entry.actionHref ? (
                      <Button asChild size="sm" variant="ghost" className="shrink-0">
                        <Link href={entry.actionHref}>Open</Link>
                      </Button>
                    ) : null}
                  </div>

                  <p className="text-sm text-muted-foreground">{entry.summary}</p>

                  {entry.metricItems.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                      {entry.metricItems.map((metric) => (
                        <div
                          key={`${entry.id}-${metric.label}`}
                          className="rounded-md border border-border/60 px-3 py-2"
                        >
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {metric.label}
                          </p>
                          <p className="text-sm mt-1">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutomationCard({ candidate }: { candidate: AutomationCandidate }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-3">
        <div className="flex items-start gap-2">
          <Bot className="h-4 w-4 mt-0.5 text-chart-1" />
          <div>
            <h3 className="text-sm font-semibold">{candidate.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{candidate.whyItMatters}</p>
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Trigger</p>
          <p className="text-sm mt-1">{candidate.trigger}</p>
        </div>
        <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Action</p>
          <p className="text-sm mt-1">{candidate.action}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemsClient() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'systems'],
    queryFn: fetchSystems,
    refetchInterval: 60_000,
  });
  const [reviewForm, setReviewForm] = useState<ReviewFormState | null>(null);
  const [incidentForm, setIncidentForm] = useState<IncidentFormState | null>(null);
  const [performanceBaselineForm, setPerformanceBaselineForm] =
    useState<PerformanceBaselineFormState | null>(null);
  const [trustSurfaceReviewForm, setTrustSurfaceReviewForm] =
    useState<TrustSurfaceReviewFormState | null>(null);
  const [pendingCommitmentId, setPendingCommitmentId] = useState<string | null>(null);
  const [pendingFollowupId, setPendingFollowupId] = useState<string | null>(null);

  useEffect(() => {
    if (!data || reviewForm) return;
    setReviewForm(buildInitialReviewForm(data));
  }, [data, reviewForm]);

  useEffect(() => {
    if (!incidentForm) {
      setIncidentForm(buildInitialIncidentForm());
    }
  }, [incidentForm]);

  useEffect(() => {
    if (!performanceBaselineForm) {
      setPerformanceBaselineForm(buildInitialPerformanceBaselineForm(data));
    }
  }, [data, performanceBaselineForm]);

  useEffect(() => {
    if (!trustSurfaceReviewForm) {
      setTrustSurfaceReviewForm(buildInitialTrustSurfaceReviewForm(data));
    }
  }, [data, trustSurfaceReviewForm]);

  const createReviewMutation = useMutation({
    mutationFn: createSystemsReview,
    onSuccess: () => {
      toast.success('Weekly systems review logged');
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
      if (data) {
        setReviewForm(buildInitialReviewForm(data));
      }
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to log systems review');
    },
  });

  const updateCommitmentMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SystemsCommitmentStatus }) =>
      updateSystemsCommitmentStatus(id, status),
    onMutate: ({ id }) => setPendingCommitmentId(id),
    onSuccess: () => {
      toast.success('Commitment updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to update commitment');
    },
    onSettled: () => setPendingCommitmentId(null),
  });

  const createIncidentMutation = useMutation({
    mutationFn: createSystemsIncident,
    onSuccess: (result: { entryType: SystemsIncidentType; title: string }) => {
      toast.success(`${incidentTypeLabel(result.entryType)} logged: ${result.title}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
      setIncidentForm(buildInitialIncidentForm());
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to log systems incident');
    },
  });

  const createPerformanceBaselineMutation = useMutation({
    mutationFn: createSystemsPerformanceBaseline,
    onSuccess: (result: {
      baselineDate: string;
      overallStatus: Exclude<SystemsStatus, 'bootstrap'>;
    }) => {
      toast.success(
        `Performance baseline logged for ${result.baselineDate} (${statusLabel(result.overallStatus)})`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
      setPerformanceBaselineForm(buildInitialPerformanceBaselineForm(null));
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to log performance baseline');
    },
  });

  const createTrustSurfaceReviewMutation = useMutation({
    mutationFn: createSystemsTrustSurfaceReview,
    onSuccess: (result: {
      reviewDate: string;
      overallStatus: Exclude<SystemsStatus, 'bootstrap'>;
    }) => {
      toast.success(
        `Trust-surface review logged for ${result.reviewDate} (${statusLabel(result.overallStatus)})`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
      setTrustSurfaceReviewForm(buildInitialTrustSurfaceReviewForm(null));
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to log trust-surface review');
    },
  });

  const runSweepMutation = useMutation({
    mutationFn: runSystemsAutomationSweep,
    onSuccess: (result: {
      status: string;
      followupCount: number;
      criticalCount: number;
      openedCount: number;
      updatedCount: number;
      resolvedCount: number;
    }) => {
      const prefix =
        result.status === 'good'
          ? 'Sweep is clean'
          : `Sweep recorded ${result.followupCount} open follow-up${result.followupCount === 1 ? '' : 's'}`;
      toast.success(
        `${prefix}. Opened ${result.openedCount}, updated ${result.updatedCount}, resolved ${result.resolvedCount}.`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to run systems automation sweep');
    },
  });

  const generateDraftMutation = useMutation({
    mutationFn: generateSystemsReviewDraft,
    onSuccess: (result: { draft: SystemsReviewDraft; message?: string }) => {
      toast.success(result.message || 'Weekly systems review draft refreshed');
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to generate systems review draft');
    },
  });

  const updateFollowupMutation = useMutation({
    mutationFn: ({
      sourceKey,
      status,
    }: {
      sourceKey: string;
      status: SystemsAutomationFollowupStatus;
    }) => updateSystemsAutomationFollowupStatus(sourceKey, status),
    onMutate: ({ sourceKey }) => setPendingFollowupId(sourceKey),
    onSuccess: () => {
      toast.success('Automation follow-up updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to update automation follow-up');
    },
    onSettled: () => setPendingFollowupId(null),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-40 bg-muted rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-l-2 border-l-red-500">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold">Systems dashboard failed to load</h1>
              <p className="text-sm text-muted-foreground mt-1">
                The page could not fetch the consolidated systems feed. Use the existing admin pages
                while this is being repaired.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (!reviewForm) {
    return null;
  }

  if (!incidentForm) {
    return null;
  }

  if (!performanceBaselineForm) {
    return null;
  }

  if (!trustSurfaceReviewForm) {
    return null;
  }

  const overallClasses = statusClasses(data.overall.status);
  const criticalJourneys = data.journeys.filter((journey) => journey.gateLevel !== 'L2');
  const automatedJourneys = criticalJourneys.filter((journey) => journey.coverage === 'automated');
  const automatedPercent =
    criticalJourneys.length === 0
      ? 0
      : Math.round((automatedJourneys.length / criticalJourneys.length) * 100);

  function updateReviewForm(patch: Partial<ReviewFormState>) {
    setReviewForm((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleLinkedSlo(sloId: string) {
    setReviewForm((current) => {
      if (!current) return current;
      const alreadySelected = current.linkedSloIds.includes(sloId);
      return {
        ...current,
        linkedSloIds: alreadySelected
          ? current.linkedSloIds.filter((id) => id !== sloId)
          : [...current.linkedSloIds, sloId].slice(0, 5),
      };
    });
  }

  async function handleSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewForm) return;
    await createReviewMutation.mutateAsync(reviewForm);
  }

  function updateIncidentForm(patch: Partial<IncidentFormState>) {
    setIncidentForm((current) => {
      if (!current) return current;

      const next = { ...current, ...patch };
      if (patch.entryType === 'drill') {
        next.severity = 'drill';
        if (next.status === 'open' || next.status === 'mitigated') {
          next.status = 'resolved';
        }
      } else if (patch.entryType === 'incident' && current.severity === 'drill') {
        next.severity = 'p1';
        next.status = 'open';
      }

      return next;
    });
  }

  async function handleSubmitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!incidentForm) return;
    await createIncidentMutation.mutateAsync(incidentForm);
  }

  function updatePerformanceBaselineForm(patch: Partial<PerformanceBaselineFormState>) {
    setPerformanceBaselineForm((current) => (current ? { ...current, ...patch } : current));
  }

  function updateTrustSurfaceReviewForm(patch: Partial<TrustSurfaceReviewFormState>) {
    setTrustSurfaceReviewForm((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleTrustSurfaceSlo(sloId: string) {
    setTrustSurfaceReviewForm((current) => {
      if (!current) return current;
      const nextLinkedSloIds = current.linkedSloIds.includes(sloId)
        ? current.linkedSloIds.filter((value) => value !== sloId)
        : [...current.linkedSloIds, sloId];
      return {
        ...current,
        linkedSloIds: nextLinkedSloIds.length > 0 ? nextLinkedSloIds : current.linkedSloIds,
      };
    });
  }

  async function handleSubmitPerformanceBaseline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!performanceBaselineForm) return;
    await createPerformanceBaselineMutation.mutateAsync(performanceBaselineForm);
  }

  async function handleSubmitTrustSurfaceReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trustSurfaceReviewForm) return;
    await createTrustSurfaceReviewMutation.mutateAsync(trustSurfaceReviewForm);
  }

  function applySuggestedDraft() {
    const suggestedReviewDraft = data?.suggestedReviewDraft;
    if (!suggestedReviewDraft) return;
    setReviewForm(buildReviewFormFromDraft(suggestedReviewDraft));
    toast.success('Suggested draft applied to the weekly review form');
  }

  function applyCommitmentShepherd() {
    const shepherd = data?.latestCommitmentShepherd;
    if (!data || !shepherd || shepherd.status !== 'focus') return;
    setReviewForm(buildReviewFormFromCommitmentShepherd(data, shepherd));
    toast.success('Commitment shepherd applied to the weekly review form');
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Systems</h1>
          <p className="text-sm text-muted-foreground">
            Your operating cockpit for launch reliability, trust, and next actions.
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </Badge>
      </div>

      <Card className={cn('border-l-4', overallClasses.border)}>
        <CardContent className="pt-6 space-y-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={overallClasses.badge}>
                  {statusLabel(data.overall.status)}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {data.overall.dataConfidence} confidence
                </Badge>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{data.overall.headline}</h2>
                <p className="text-sm text-muted-foreground mt-2">{data.overall.narrative}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[280px]">
              <Card className="bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <HeartPulse className="h-3.5 w-3.5" />
                    Live ops
                  </div>
                  <p className="text-lg font-semibold mt-2">{data.summary.dependencyHealth}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sync: {data.summary.syncSuccessRate}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Trust
                  </div>
                  <p className="text-lg font-semibold mt-2">{data.summary.integrityState}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Perf: {data.summary.apiPerformance}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 col-span-2">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Gauge className="h-3.5 w-3.5" />
                      Critical journey automation
                    </div>
                    <span className="text-sm font-semibold">
                      {data.summary.criticalJourneyCoverage}
                    </span>
                  </div>
                  <Progress value={Number.isNaN(automatedPercent) ? 0 : automatedPercent} />
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <section id="launch-control-room" className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Launch control room</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This is the explicit go / no-go layer for the founder. It turns the live scorecard,
          journeys, operator loop, and trust-surface evidence into one launch call instead of a
          gut-feel read across multiple tools.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <div className="space-y-4">
            <LaunchControlRoomCard data={data} />
            <LaunchChecklistCard
              title="Launch blockers"
              items={data.launchControlRoom.blockers}
              empty="No hard launch blocker is active right now."
            />
            <LaunchChecklistCard
              title="Watch items"
              items={data.launchControlRoom.watchItems}
              empty="No launch watch item is currently open."
            />
          </div>

          <div className="space-y-4">
            <LaunchChecklistTable data={data} />
            <LaunchWeekCadenceCard data={data} />
          </div>
        </div>
      </section>

      <section id="operating-rhythm" className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Operating rhythm</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This is where the cockpit becomes a management loop: durable weekly reviews, explicit
          hardening commitments, and a trail that future agents can update without inventing a new
          process every time.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <div className="space-y-4">
            <ReviewDisciplineCard reviewDiscipline={data.reviewDiscipline} />
            <ScorecardSyncCard scorecardSync={data.scorecardSync} slos={data.slos} />
            <CommitmentShepherdCard
              shepherd={data.latestCommitmentShepherd}
              onApply={applyCommitmentShepherd}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Open hardening commitments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.openCommitments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No open commitments are recorded yet. Log the next weekly review and leave
                    behind one named systems move.
                  </p>
                ) : (
                  data.openCommitments.map((commitment) => (
                    <CommitmentCard
                      key={commitment.id}
                      commitment={commitment}
                      isUpdating={
                        updateCommitmentMutation.isPending && pendingCommitmentId === commitment.id
                      }
                      onStatusChange={(status) =>
                        updateCommitmentMutation.mutate({ id: commitment.id, status })
                      }
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <SuggestedReviewDraftCard
              draft={data.suggestedReviewDraft}
              onApply={applySuggestedDraft}
              onRefresh={() => generateDraftMutation.mutate()}
              isRefreshing={generateDraftMutation.isPending}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Log this week&apos;s review</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmitReview}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="review-date">Review date</Label>
                      <Input
                        id="review-date"
                        type="date"
                        value={reviewForm.reviewDate}
                        onChange={(event) => updateReviewForm({ reviewDate: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="review-status">Current posture</Label>
                      <Select
                        value={reviewForm.overallStatus}
                        onValueChange={(value) =>
                          updateReviewForm({ overallStatus: value as SystemsStatus })
                        }
                      >
                        <SelectTrigger id="review-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Healthy</SelectItem>
                          <SelectItem value="warning">Watch</SelectItem>
                          <SelectItem value="critical">Act now</SelectItem>
                          <SelectItem value="bootstrap">Bootstrapping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="focus-area">Focus area</Label>
                    <Input
                      id="focus-area"
                      value={reviewForm.focusArea}
                      onChange={(event) => updateReviewForm({ focusArea: event.target.value })}
                      placeholder="What system are you hardening this week?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Linked SLOs</Label>
                    <div className="flex flex-wrap gap-2">
                      {data.slos.map((slo) => {
                        const selected = reviewForm.linkedSloIds.includes(slo.id);
                        return (
                          <Button
                            key={slo.id}
                            type="button"
                            variant={selected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleLinkedSlo(slo.id)}
                          >
                            {slo.title}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="top-risk">Top risk</Label>
                    <Textarea
                      id="top-risk"
                      value={reviewForm.topRisk}
                      onChange={(event) => updateReviewForm({ topRisk: event.target.value })}
                      placeholder="What is the clearest launch risk right now?"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="change-notes">Evidence and notes</Label>
                    <Textarea
                      id="change-notes"
                      value={reviewForm.changeNotes}
                      onChange={(event) => updateReviewForm({ changeNotes: event.target.value })}
                      placeholder="What changed this week, what you observed, and why it matters."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commitment-title">Hardening commitment</Label>
                    <Input
                      id="commitment-title"
                      value={reviewForm.hardeningCommitmentTitle}
                      onChange={(event) =>
                        updateReviewForm({ hardeningCommitmentTitle: event.target.value })
                      }
                      placeholder="Name the one systems move that matters most this week"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commitment-summary">Commitment scope</Label>
                    <Textarea
                      id="commitment-summary"
                      value={reviewForm.hardeningCommitmentSummary}
                      onChange={(event) =>
                        updateReviewForm({ hardeningCommitmentSummary: event.target.value })
                      }
                      placeholder="What exactly should this commitment fix or de-risk?"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="commitment-owner">Owner</Label>
                      <Input
                        id="commitment-owner"
                        value={reviewForm.commitmentOwner}
                        onChange={(event) =>
                          updateReviewForm({ commitmentOwner: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commitment-due-date">Due date</Label>
                      <Input
                        id="commitment-due-date"
                        type="date"
                        value={reviewForm.commitmentDueDate}
                        onChange={(event) =>
                          updateReviewForm({ commitmentDueDate: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={createReviewMutation.isPending}
                    className="w-full"
                  >
                    {createReviewMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Logging review...
                      </>
                    ) : (
                      'Log weekly review'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="slos" className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Launch SLOs</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          These are the first explicit launch bars for Governada. The purpose is to make it clear
          what &quot;good enough to trust&quot; actually means week over week.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {data.slos.map((slo) => (
            <SloCard key={slo.id} slo={slo} />
          ))}
        </div>
      </section>

      <section id="actions" className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Act now</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          These are the highest-leverage next moves based on the current systems posture.
        </p>
        {data.actions.length === 0 ? (
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-sm font-medium">No urgent action is being flagged right now.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Treat this as permission to strengthen automation, tighten launch gates, or run the
                next drill rather than chase reactive fixes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {data.actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        )}
      </section>

      <section id="weekly-review" className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Weekly operating loop</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This is the weekly rhythm that turns the dashboard into an operating system instead of a
          passive status page. The daily sweep and Monday draft generation now run on their own;
          this section is where you turn that machine output into a founder-grade operating record.
        </p>
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Card className="bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Cadence
                  </div>
                  <p className="text-sm font-semibold mt-2">{data.reviewLoop.cadence}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Owner
                  </div>
                  <p className="text-sm font-semibold mt-2">{data.reviewLoop.owner}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Clock3 className="h-3.5 w-3.5" />
                    Duration
                  </div>
                  <p className="text-sm font-semibold mt-2">{data.reviewLoop.duration}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <ListChecks className="h-3.5 w-3.5" />
                    Output
                  </div>
                  <p className="text-sm font-semibold mt-2">{data.reviewLoop.output}</p>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-4 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                This week&apos;s focus
              </p>
              <p className="text-sm font-semibold">{data.reviewLoop.currentFocus}</p>
              <p className="text-sm text-muted-foreground">{data.reviewLoop.narrative}</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {data.reviewLoop.steps.map((step, index) => (
                <ReviewStepCard key={step.id} step={step} index={index + 1} />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="review-history" className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Recent review history</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This is the durable operating memory for the systems cockpit. If the page is trustworthy,
          this history should tell you what changed, what risk was called out, and what hardening
          work was committed next.
        </p>
        {data.reviewHistory.length === 0 ? (
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-sm font-medium">No systems reviews have been logged yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use the weekly review form above to create the first durable operating record.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {data.reviewHistory.map((review) => (
              <ReviewHistoryCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </section>

      <section id="incident-log" className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Incident + drill trail</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Capture real incidents, near misses, and tabletop drills here so launch readiness is
          practiced and durable instead of living only in the runbook.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="space-y-4">
            <IncidentSummaryCard summary={data.incidentSummary} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Log incident or drill</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmitIncident}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="incident-date">Date</Label>
                      <Input
                        id="incident-date"
                        type="date"
                        value={incidentForm.incidentDate}
                        onChange={(event) =>
                          updateIncidentForm({ incidentDate: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incident-type">Entry type</Label>
                      <Select
                        value={incidentForm.entryType}
                        onValueChange={(value) =>
                          updateIncidentForm({ entryType: value as SystemsIncidentType })
                        }
                      >
                        <SelectTrigger id="incident-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="drill">Drill</SelectItem>
                          <SelectItem value="incident">Incident</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="incident-severity">Severity</Label>
                      <Select
                        value={incidentForm.severity}
                        onValueChange={(value) =>
                          updateIncidentForm({ severity: value as SystemsIncidentSeverity })
                        }
                      >
                        <SelectTrigger id="incident-severity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {incidentForm.entryType === 'drill' ? (
                            <SelectItem value="drill">Drill</SelectItem>
                          ) : (
                            <>
                              <SelectItem value="p0">P0</SelectItem>
                              <SelectItem value="p1">P1</SelectItem>
                              <SelectItem value="p2">P2</SelectItem>
                              <SelectItem value="near_miss">Near miss</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incident-status">Status</Label>
                      <Select
                        value={incidentForm.status}
                        onValueChange={(value) =>
                          updateIncidentForm({ status: value as SystemsIncidentStatus })
                        }
                      >
                        <SelectTrigger id="incident-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {incidentForm.entryType === 'drill' ? (
                            <>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="follow_up_pending">Follow-up pending</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="mitigated">Mitigated</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="follow_up_pending">Follow-up pending</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-title">Title</Label>
                    <Input
                      id="incident-title"
                      value={incidentForm.title}
                      onChange={(event) => updateIncidentForm({ title: event.target.value })}
                      placeholder="Koios outage drill for stale governance reads"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="incident-detected-by">Detected by</Label>
                      <Input
                        id="incident-detected-by"
                        value={incidentForm.detectedBy}
                        onChange={(event) => updateIncidentForm({ detectedBy: event.target.value })}
                        placeholder="Alert, user report, manual review, audit"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incident-owner">Follow-up owner</Label>
                      <Input
                        id="incident-owner"
                        value={incidentForm.followUpOwner}
                        onChange={(event) =>
                          updateIncidentForm({ followUpOwner: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-systems">Systems affected</Label>
                    <Input
                      id="incident-systems"
                      value={incidentForm.systemsAffected}
                      onChange={(event) =>
                        updateIncidentForm({ systemsAffected: event.target.value })
                      }
                      placeholder="pipeline, supabase, readiness endpoint"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-impact">User impact or drill scenario</Label>
                    <Textarea
                      id="incident-impact"
                      value={incidentForm.userImpact}
                      onChange={(event) => updateIncidentForm({ userImpact: event.target.value })}
                      placeholder="What broke, what users would have seen, or what failure mode was rehearsed."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-root-cause">Root cause</Label>
                    <Textarea
                      id="incident-root-cause"
                      value={incidentForm.rootCause}
                      onChange={(event) => updateIncidentForm({ rootCause: event.target.value })}
                      placeholder="What actually caused the incident or what weakness the drill exposed?"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-mitigation">Mitigation</Label>
                    <Textarea
                      id="incident-mitigation"
                      value={incidentForm.mitigation}
                      onChange={(event) => updateIncidentForm({ mitigation: event.target.value })}
                      placeholder="How did you contain the issue or walk through the response?"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-permanent-fix">Permanent fix</Label>
                    <Textarea
                      id="incident-permanent-fix"
                      value={incidentForm.permanentFix}
                      onChange={(event) => updateIncidentForm({ permanentFix: event.target.value })}
                      placeholder="What needs to change in code, alerts, runbooks, or UX so this gets easier next time?"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="incident-ack">Time to acknowledge (min)</Label>
                      <Input
                        id="incident-ack"
                        type="number"
                        min="0"
                        value={incidentForm.timeToAcknowledgeMinutes}
                        onChange={(event) =>
                          updateIncidentForm({
                            timeToAcknowledgeMinutes: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incident-mitigate">Time to mitigate (min)</Label>
                      <Input
                        id="incident-mitigate"
                        type="number"
                        min="0"
                        value={incidentForm.timeToMitigateMinutes}
                        onChange={(event) =>
                          updateIncidentForm({
                            timeToMitigateMinutes: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incident-resolve">Time to resolve (min)</Label>
                      <Input
                        id="incident-resolve"
                        type="number"
                        min="0"
                        value={incidentForm.timeToResolveMinutes}
                        onChange={(event) =>
                          updateIncidentForm({
                            timeToResolveMinutes: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={createIncidentMutation.isPending}
                    className="w-full"
                  >
                    {createIncidentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Logging incident...
                      </>
                    ) : (
                      'Log incident or drill'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {data.incidentHistory.length === 0 ? (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <p className="text-sm font-medium">No incidents or drills are logged yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start with a tabletop drill so response readiness becomes a durable part of the
                    weekly operating system.
                  </p>
                </CardContent>
              </Card>
            ) : (
              data.incidentHistory.map((entry) => (
                <IncidentHistoryCard key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </div>
      </section>

      <section id="trust-surface-review" className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Trust-surface review</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Review what users actually see when availability, freshness, or correctness is degraded,
          then log the next honesty fix here so the degraded-state UX stays auditable.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <div className="space-y-4">
            <TrustSurfaceReviewSummaryCard data={data} />
            <TrustSurfaceReviewHistoryCard history={data.trustSurfaceReviewHistory} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Log trust-surface review</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmitTrustSurfaceReview}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trust-review-date">Review date</Label>
                    <Input
                      id="trust-review-date"
                      type="date"
                      value={trustSurfaceReviewForm.reviewDate}
                      onChange={(event) =>
                        updateTrustSurfaceReviewForm({ reviewDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trust-review-status">Review status</Label>
                    <Select
                      value={trustSurfaceReviewForm.overallStatus}
                      onValueChange={(value) =>
                        updateTrustSurfaceReviewForm({
                          overallStatus: value as Exclude<SystemsStatus, 'bootstrap'>,
                        })
                      }
                    >
                      <SelectTrigger id="trust-review-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Linked SLOs</Label>
                  <div className="flex flex-wrap gap-2">
                    {TRUST_SURFACE_SLO_OPTIONS.map((option) => {
                      const isActive = trustSurfaceReviewForm.linkedSloIds.includes(option.id);
                      return (
                        <Button
                          key={option.id}
                          type="button"
                          variant={isActive ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleTrustSurfaceSlo(option.id)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trust-reviewed-surfaces">Reviewed surfaces</Label>
                  <Textarea
                    id="trust-reviewed-surfaces"
                    value={trustSurfaceReviewForm.reviewedSurfaces}
                    required
                    onChange={(event) =>
                      updateTrustSurfaceReviewForm({ reviewedSurfaces: event.target.value })
                    }
                    placeholder="Home shell&#10;DRep discovery&#10;Proposal detail&#10;DRep workspace read path"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trust-review-summary">Review summary</Label>
                  <Textarea
                    id="trust-review-summary"
                    value={trustSurfaceReviewForm.summary}
                    required
                    onChange={(event) =>
                      updateTrustSurfaceReviewForm({ summary: event.target.value })
                    }
                    placeholder="Summarize whether the degraded-state UX stayed honest across the surfaces you reviewed."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trust-current-user-state">Current user state</Label>
                  <Textarea
                    id="trust-current-user-state"
                    value={trustSurfaceReviewForm.currentUserState}
                    required
                    onChange={(event) =>
                      updateTrustSurfaceReviewForm({ currentUserState: event.target.value })
                    }
                    placeholder="Describe exactly what a user sees today when the system is degraded."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trust-honesty-gap">Honesty gap</Label>
                  <Textarea
                    id="trust-honesty-gap"
                    value={trustSurfaceReviewForm.honestyGap}
                    required
                    onChange={(event) =>
                      updateTrustSurfaceReviewForm({ honestyGap: event.target.value })
                    }
                    placeholder="Name the misleading copy, missing state, or ambiguous confidence signal that still needs correction."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trust-next-fix">Next fix</Label>
                  <Textarea
                    id="trust-next-fix"
                    value={trustSurfaceReviewForm.nextFix}
                    required
                    onChange={(event) =>
                      updateTrustSurfaceReviewForm({ nextFix: event.target.value })
                    }
                    placeholder="Describe the concrete UI or messaging fix that should ship next."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trust-owner">Owner</Label>
                    <Input
                      id="trust-owner"
                      value={trustSurfaceReviewForm.owner}
                      required
                      onChange={(event) =>
                        updateTrustSurfaceReviewForm({ owner: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trust-artifact">Artifact URL</Label>
                    <Input
                      id="trust-artifact"
                      value={trustSurfaceReviewForm.artifactUrl}
                      onChange={(event) =>
                        updateTrustSurfaceReviewForm({ artifactUrl: event.target.value })
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trust-notes">Notes</Label>
                  <Textarea
                    id="trust-notes"
                    value={trustSurfaceReviewForm.notes}
                    onChange={(event) =>
                      updateTrustSurfaceReviewForm({ notes: event.target.value })
                    }
                    placeholder="Optional notes about the environment, screenshots, temporary mitigations, or follow-up context."
                    rows={4}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={createTrustSurfaceReviewMutation.isPending}
                  className="w-full"
                >
                  {createTrustSurfaceReviewMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logging trust review...
                    </>
                  ) : (
                    'Log trust-surface review'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="performance-baseline" className="space-y-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Performance baseline</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Record the durable load-test baseline here so performance discipline lives in the same
          operating loop as the weekly review, incident trail, and automation inbox.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <div className="space-y-4">
            <PerformanceBaselineSummaryCard data={data} />
            <PerformanceBaselineHistoryCard history={data.performanceBaselineHistory} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Log performance baseline</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmitPerformanceBaseline}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseline-date">Baseline date</Label>
                    <Input
                      id="baseline-date"
                      type="date"
                      value={performanceBaselineForm.baselineDate}
                      onChange={(event) =>
                        updatePerformanceBaselineForm({ baselineDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseline-environment">Environment</Label>
                    <Select
                      value={performanceBaselineForm.environment}
                      onValueChange={(value) =>
                        updatePerformanceBaselineForm({
                          environment: value as SystemsPerformanceBaselineEnvironment,
                        })
                      }
                    >
                      <SelectTrigger id="baseline-environment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="preview">Preview</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseline-scenario">Scenario</Label>
                    <Input
                      id="baseline-scenario"
                      value={performanceBaselineForm.scenarioLabel}
                      required
                      onChange={(event) =>
                        updatePerformanceBaselineForm({ scenarioLabel: event.target.value })
                      }
                      placeholder="Minimum public read baseline"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseline-concurrency">Concurrency profile</Label>
                    <Input
                      id="baseline-concurrency"
                      value={performanceBaselineForm.concurrencyProfile}
                      required
                      onChange={(event) =>
                        updatePerformanceBaselineForm({
                          concurrencyProfile: event.target.value,
                        })
                      }
                      placeholder="1 -> 10 -> 50 -> 100 VUs over 5 minutes"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseline-owner">Mitigation owner</Label>
                  <Input
                    id="baseline-owner"
                    value={performanceBaselineForm.mitigationOwner}
                    required
                    onChange={(event) =>
                      updatePerformanceBaselineForm({ mitigationOwner: event.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseline-summary">Baseline summary</Label>
                  <Textarea
                    id="baseline-summary"
                    value={performanceBaselineForm.summary}
                    required
                    onChange={(event) =>
                      updatePerformanceBaselineForm({ summary: event.target.value })
                    }
                    placeholder="Summarize the outcome, the routes tested, and whether the result stayed inside the launch bar."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseline-bottleneck">Primary bottleneck</Label>
                  <Textarea
                    id="baseline-bottleneck"
                    value={performanceBaselineForm.bottleneck}
                    required
                    onChange={(event) =>
                      updatePerformanceBaselineForm({ bottleneck: event.target.value })
                    }
                    placeholder="Name the slow route, query pattern, or cache miss that most needs attention."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseline-next-step">Next step</Label>
                  <Textarea
                    id="baseline-next-step"
                    value={performanceBaselineForm.nextStep}
                    required
                    onChange={(event) =>
                      updatePerformanceBaselineForm({ nextStep: event.target.value })
                    }
                    placeholder="Describe the concrete mitigation, rerun condition, or owner follow-through."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseline-api-health">`/api/health` p95 (ms)</Label>
                    <Input
                      id="baseline-api-health"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={performanceBaselineForm.apiHealthP95Ms}
                      onChange={(event) =>
                        updatePerformanceBaselineForm({ apiHealthP95Ms: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseline-api-dreps">`/api/dreps` p95 (ms)</Label>
                    <Input
                      id="baseline-api-dreps"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={performanceBaselineForm.apiDrepsP95Ms}
                      onChange={(event) =>
                        updatePerformanceBaselineForm({ apiDrepsP95Ms: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseline-api-v1-dreps">`/api/v1/dreps` p95 (ms)</Label>
                    <Input
                      id="baseline-api-v1-dreps"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={performanceBaselineForm.apiV1DrepsP95Ms}
                      onChange={(event) =>
                        updatePerformanceBaselineForm({ apiV1DrepsP95Ms: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseline-governance-health">
                      `/api/v1/governance/health` p95 (ms)
                    </Label>
                    <Input
                      id="baseline-governance-health"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={performanceBaselineForm.governanceHealthP95Ms}
                      onChange={(event) =>
                        updatePerformanceBaselineForm({
                          governanceHealthP95Ms: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseline-error-rate">Error rate (%)</Label>
                    <Input
                      id="baseline-error-rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={performanceBaselineForm.errorRatePct}
                      onChange={(event) =>
                        updatePerformanceBaselineForm({ errorRatePct: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseline-artifact">Artifact URL</Label>
                    <Input
                      id="baseline-artifact"
                      value={performanceBaselineForm.artifactUrl}
                      onChange={(event) =>
                        updatePerformanceBaselineForm({ artifactUrl: event.target.value })
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseline-notes">Notes</Label>
                  <Textarea
                    id="baseline-notes"
                    value={performanceBaselineForm.notes}
                    onChange={(event) =>
                      updatePerformanceBaselineForm({ notes: event.target.value })
                    }
                    placeholder="Optional notes about k6 artifacts, route selection, caveats, or comparison to the last run."
                    rows={4}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={createPerformanceBaselineMutation.isPending}
                  className="w-full"
                >
                  {createPerformanceBaselineMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logging baseline...
                    </>
                  ) : (
                    'Log performance baseline'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-chart-1" />
            <h2 className="text-lg font-semibold">Service promises</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            This is the clearest narrative of what the product is promising and how well the system
            is defending it right now.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.promises.map((promise) => (
              <PromiseCard key={promise.id} promise={promise} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <StoryColumn
            title="What is working"
            icon={CheckCircle2}
            items={data.story.wins}
            empty="No major wins recorded yet."
          />
          <StoryColumn
            title="Watch closely"
            icon={Clock3}
            items={data.story.watchouts}
            empty="No active watchouts."
          />
          <StoryColumn
            title="Launch blockers"
            icon={AlertTriangle}
            items={data.story.blockers}
            empty="No hard blockers are being reported by this page right now."
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-md border border-border/60 bg-card/40 px-3 py-2 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{link.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      <section id="journeys" className="space-y-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Critical journeys</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          These are the flows that most directly protect launch trust. The goal is to make it
          obvious which ones are already defended and which ones still need deterministic
          automation.
        </p>
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Journey</TableHead>
                    <TableHead>Gate</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Why it matters</TableHead>
                    <TableHead>Next step</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.journeys.map((journey) => (
                    <TableRow key={journey.id}>
                      <TableCell className="min-w-[220px]">
                        <div>
                          <p className="text-sm font-medium">{journey.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{journey.persona}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{journey.gateLevel}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            journey.coverage === 'automated'
                              ? 'border-emerald-500/30 text-emerald-300'
                              : journey.coverage === 'partial'
                                ? 'border-amber-500/30 text-amber-300'
                                : 'border-border text-muted-foreground',
                          )}
                        >
                          {coverageLabel(journey.coverage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[260px] text-sm text-muted-foreground">
                        <div className="space-y-1">
                          <p>{journey.whyItMatters}</p>
                          <p className="text-xs text-muted-foreground/80">
                            Evidence: {journey.currentEvidence}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[260px]">
                        <div className="space-y-1">
                          <p className="text-sm">{journey.nextStep}</p>
                          <p className="text-xs text-muted-foreground">{journey.gap}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="automation" className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-chart-1" />
          <h2 className="text-lg font-semibold">Automation cockpit</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This is the live automation layer for the founder operating system. The daily sweep runs
          on a schedule, and you can still trigger it manually when you want a fresh posture check,
          new durable follow-ups, or an updated inbox for later agent work.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
          <AutomationInboxSummaryCard
            data={data}
            isRunning={runSweepMutation.isPending}
            onRunSweep={() => runSweepMutation.mutate()}
          />

          {data.automationFollowups.length === 0 ? (
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-sm font-medium">No open automation follow-ups right now.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep the sweep cadence alive so this stays meaningful. The moment a review goes
                  stale, a commitment slips, an incident retro needs a real owner, or a critical
                  automation-ready action appears, it should show up here as durable operating work.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.automationFollowups.map((followup) => (
                <AutomationFollowupCard
                  key={followup.sourceKey}
                  followup={followup}
                  isUpdating={
                    updateFollowupMutation.isPending && pendingFollowupId === followup.sourceKey
                  }
                  onStatusChange={(status) =>
                    updateFollowupMutation.mutate({ sourceKey: followup.sourceKey, status })
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-4">
          <AutomationCadenceCard data={data} />
          <AutomationHistoryCard history={data.automationHistory} />
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-chart-1" />
            <h3 className="text-base font-semibold">Roadmap follow-through</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            The systems-excellence roadmap is now materially present on one page: scorecard, weekly
            review loop, automation history, drills, performance baseline discipline, trust-surface
            review, and the launch control room. The next work is operating this surface honestly
            during launch-like conditions, not inventing a new dashboard.
          </p>
          {data.automationCandidates.length === 0 ? (
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-sm font-medium">No additional roadmap phase is queued here.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep the launch control room current, run the weekly review, log drills and trust
                  reviews, and let new work prove itself against the live checklist before the plan
                  expands again.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {data.automationCandidates.map((candidate) => (
                <AutomationCard key={candidate.id} candidate={candidate} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
