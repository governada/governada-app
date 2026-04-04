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
  SystemsAutomationFollowup,
  SystemsAutomationFollowupStatus,
  SystemsCommitmentCard,
  SystemsCommitmentStatus,
  SystemsDashboardData,
  SystemsJourney,
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
            <p className="text-sm mt-1">{followup.triggerType.replace(/_/g, ' ')}</p>
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
  const [pendingCommitmentId, setPendingCommitmentId] = useState<string | null>(null);
  const [pendingFollowupId, setPendingFollowupId] = useState<string | null>(null);

  useEffect(() => {
    if (!data || reviewForm) return;
    setReviewForm(buildInitialReviewForm(data));
  }, [data, reviewForm]);

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
                  stale, a commitment slips, or a critical automation-ready action appears, it
                  should show up here as durable operating work.
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

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-chart-1" />
            <h3 className="text-base font-semibold">Next automations</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            The daily sweep, weekly draft, critical follow-up escalation, and commitment shepherd
            are live now. These are the next routines that can compound on top of the same feed and
            audit trail.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {data.automationCandidates.map((candidate) => (
              <AutomationCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
