'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchSystemsSection, formatDateTime } from './systems-client';
import {
  DecisionStrip,
  EmptyState,
  ProvenanceBadge,
  SectionCard,
  StatusBadge,
  WorkspaceHero,
  statusTone,
} from './systems-ui';

export function LaunchBoardClient() {
  const query = useQuery({
    queryKey: ['systems', 'launch'],
    queryFn: () => fetchSystemsSection('launch'),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Card className="h-72 animate-pulse border-border/60 bg-muted/25" />
        <Card className="h-96 animate-pulse border-border/60 bg-muted/25" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Launch board unavailable"
        description={
          query.error instanceof Error
            ? query.error.message
            : 'The systems launch board could not be loaded.'
        }
      />
    );
  }

  const { summary, launchControlRoom, topActions, proofItems } = query.data;

  return (
    <div className="space-y-6">
      <WorkspaceHero summary={summary}>
        <DecisionStrip
          decision={launchControlRoom.decision}
          blockerCount={launchControlRoom.blockerCount}
          watchCount={launchControlRoom.watchCount}
        />
      </WorkspaceHero>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Launch decision"
          description={launchControlRoom.summary}
          actionLabel="Open evidence"
          actionHref="/admin/systems/evidence"
        >
          <div className="space-y-4">
            <Card className="border-border/70 bg-muted/20">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={launchControlRoom.decision} />
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    {launchControlRoom.currentCall}
                  </Badge>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {launchControlRoom.headline}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {launchControlRoom.summary}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <RiskColumn
                title="Blockers"
                items={launchControlRoom.blockers}
                tone={launchControlRoom.blockers.length > 0 ? 'critical' : 'good'}
                emptyCopy="No active blockers are recorded right now."
              />
              <RiskColumn
                title="Watch items"
                items={launchControlRoom.watchItems}
                tone={launchControlRoom.watchItems.length > 0 ? 'warning' : 'good'}
                emptyCopy="No watch items are recorded right now."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Proof freshness" description={summary.proofFreshness}>
          <div className="space-y-3">
            {proofItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/70 bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {item.value}
                    </p>
                  </div>
                  {item.href ? (
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <Link href={item.href}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                {item.provenance ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ProvenanceBadge stamp={item.provenance} />
                    {item.provenance.updatedAt ? (
                      <span>Updated {formatDateTime(item.provenance.updatedAt)}</span>
                    ) : (
                      <span>{item.provenance.freshnessLabel}</span>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Top 3 actions"
          description='The founder should be able to answer "what next?" from this list alone.'
        >
          <div className="space-y-3">
            {topActions.length === 0 ? (
              <EmptyState
                title="No immediate actions"
                description="The launch board currently has no founder-critical actions queued."
              />
            ) : (
              topActions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={statusTone(action.priority === 'P0' ? 'critical' : 'warning')}
                    >
                      {action.priority}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {action.timeframe}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{action.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.summary}</p>
                  {action.href ? (
                    <Button asChild variant="ghost" className="mt-3 px-0">
                      <Link href={action.href}>
                        Open action
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Launch checklist"
          description="Every optimistic label should be backed by explicit evidence and a threshold."
        >
          <div className="space-y-3">
            {launchControlRoom.checklist.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.decision} />
                  <p className="text-sm font-semibold">{item.title}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Threshold:</span> {item.threshold}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Evidence:</span> {item.evidence}
                  </p>
                </div>
                {item.href ? (
                  <Button asChild variant="ghost" className="mt-3 px-0">
                    <Link href={item.href}>
                      Open backing evidence
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function RiskColumn({
  title,
  items,
  tone,
  emptyCopy,
}: {
  title: string;
  items: string[];
  tone: 'good' | 'warning' | 'critical';
  emptyCopy: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        {tone === 'critical' ? (
          <ShieldAlert className="h-4 w-4 text-red-300" />
        ) : tone === 'warning' ? (
          <AlertTriangle className="h-4 w-4 text-amber-200" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        )}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">{emptyCopy}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item}
              className={
                statusTone(tone === 'good' ? 'good' : tone === 'warning' ? 'warning' : 'critical') +
                ' rounded-xl border p-3 text-sm leading-6'
              }
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
