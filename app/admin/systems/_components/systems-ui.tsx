'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  SystemsLaunchDecision,
  SystemsProvenanceStamp,
  SystemsStatus,
  SystemsWorkspaceSummary,
} from '@/lib/admin/systems';
import {
  formatDateTime,
  launchDecisionLabel,
  statusLabel,
  workspaceDescription,
  workspaceTitle,
} from './systems-client';

export function statusTone(status: SystemsStatus | SystemsLaunchDecision) {
  switch (status) {
    case 'good':
    case 'ready':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
    case 'warning':
    case 'risky':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    case 'critical':
    case 'blocked':
      return 'border-red-500/30 bg-red-500/10 text-red-100';
    default:
      return 'border-border bg-muted/40 text-muted-foreground';
  }
}

export function StatusBadge({ status }: { status: SystemsStatus | SystemsLaunchDecision }) {
  const label =
    status === 'ready' || status === 'risky' || status === 'blocked'
      ? launchDecisionLabel(status)
      : statusLabel(status);

  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-3 py-1 text-xs font-medium', statusTone(status))}
    >
      {label}
    </Badge>
  );
}

export function ProvenanceBadge({ stamp }: { stamp: SystemsProvenanceStamp }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]',
        statusTone(stamp.isStale ? 'warning' : 'good'),
      )}
    >
      {stamp.label}
    </Badge>
  );
}

export function WorkspaceHero({
  summary,
  children,
}: {
  summary: SystemsWorkspaceSummary;
  children?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92)_58%,rgba(120,53,15,0.75))] text-slate-50 shadow-xl shadow-slate-950/20">
      <CardContent className="space-y-6 p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={summary.launchDecision} />
              <StatusBadge status={summary.proofStatus} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                {workspaceTitle(summary.section)}
              </p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {summary.launchHeadline}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-200/90 md:text-base">
                {workspaceDescription(summary.section, summary)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[22rem] lg:grid-cols-1">
            <HeroMetric
              label="Blockers"
              value={String(summary.blockerCount)}
              status={summary.blockerCount > 0 ? 'critical' : 'good'}
            />
            <HeroMetric
              label="Queue"
              value={String(summary.queueCount)}
              status={summary.queueCount > 0 ? 'warning' : 'good'}
            />
            <HeroMetric label="Updated" value={formatDateTime(summary.generatedAt)} status="good" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {summary.proofStamps.map((stamp) => (
            <ProvenanceBadge key={`${stamp.label}:${stamp.updatedAt ?? 'none'}`} stamp={stamp} />
          ))}
        </div>

        {children}
      </CardContent>
    </Card>
  );
}

function HeroMetric({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: SystemsStatus;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</span>
        <StatusBadge status={status} />
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actionLabel,
  actionHref,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('border-border/70 bg-card/85 shadow-sm', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base tracking-tight">{title}</CardTitle>
          {description ? (
            <CardDescription className="max-w-3xl text-sm leading-6">{description}</CardDescription>
          ) : null}
        </div>
        {action ? (
          action
        ) : actionLabel && actionHref ? (
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href={actionHref}>
              {actionLabel}
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clock3 className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button className="mt-4" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function DecisionStrip({
  decision,
  blockerCount,
  watchCount,
}: {
  decision: SystemsLaunchDecision;
  blockerCount: number;
  watchCount: number;
}) {
  const icon =
    decision === 'ready' ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
    ) : decision === 'risky' ? (
      <AlertTriangle className="h-5 w-5 text-amber-200" />
    ) : (
      <ShieldAlert className="h-5 w-5 text-red-200" />
    );

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        statusTone(decision),
      )}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-black/15 p-2">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] opacity-80">Current Call</p>
          <p className="text-lg font-semibold">{launchDecisionLabel(decision)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          className="rounded-full border-current/30 bg-black/10 px-3 py-1 text-xs"
        >
          {blockerCount} blocker{blockerCount === 1 ? '' : 's'}
        </Badge>
        <Badge
          variant="outline"
          className="rounded-full border-current/30 bg-black/10 px-3 py-1 text-xs"
        >
          {watchCount} watch item{watchCount === 1 ? '' : 's'}
        </Badge>
      </div>
    </div>
  );
}
