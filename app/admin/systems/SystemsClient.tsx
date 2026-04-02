'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Gauge,
  HeartPulse,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getStoredSession } from '@/lib/supabaseAuth';
import type {
  SystemsAction,
  SystemsDashboardData,
  SystemsJourney,
  SystemsPromiseCard,
  SystemsStatus,
  AutomationCandidate,
} from '@/lib/admin/systems';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

async function fetchSystems(): Promise<SystemsDashboardData> {
  const token = getStoredSession();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/admin/systems', { headers });
  if (!res.ok) throw new Error('Failed to fetch systems dashboard');
  return res.json();
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
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'systems'],
    queryFn: fetchSystems,
    refetchInterval: 60_000,
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

  const overallClasses = statusClasses(data.overall.status);
  const criticalJourneys = data.journeys.filter((journey) => journey.gateLevel !== 'L2');
  const automatedJourneys = criticalJourneys.filter((journey) => journey.coverage === 'automated');
  const automatedPercent =
    criticalJourneys.length === 0
      ? 0
      : Math.round((automatedJourneys.length / criticalJourneys.length) * 100);

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
          <h2 className="text-lg font-semibold">Automation candidates</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This page is backed by a machine-readable admin feed at{' '}
          <span className="font-mono">/api/admin/systems</span>. These are the first routines I
          would automate against it.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {data.automationCandidates.map((candidate) => (
            <AutomationCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      </section>
    </div>
  );
}
