'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  fetchSystemsSection,
  formatDate,
  formatDateTime,
  incidentStatusLabel,
} from './systems-client';
import { EmptyState, SectionCard, StatusBadge, WorkspaceHero } from './systems-ui';

export function HistoryWorkspaceClient() {
  const query = useQuery({
    queryKey: ['systems', 'history'],
    queryFn: () => fetchSystemsSection('history'),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-3xl border border-border/60 bg-muted/25" />
        <div className="h-[36rem] animate-pulse rounded-3xl border border-border/60 bg-muted/25" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="History unavailable"
        description={
          query.error instanceof Error
            ? query.error.message
            : 'The systems history workspace could not be loaded.'
        }
      />
    );
  }

  const data = query.data;

  return (
    <div className="space-y-6">
      <WorkspaceHero summary={data.summary} />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Review history"
          description="Scorecard sync should be explainable from the durable review trail."
        >
          <div className="space-y-3">
            {data.reviewHistory.length === 0 ? (
              <EmptyState
                title="No reviews logged"
                description="The founder has not logged a weekly systems review yet."
              />
            ) : (
              data.reviewHistory.map((review) => (
                <div key={review.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={review.overallStatus} />
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {review.focusArea}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{review.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(review.reviewDate)} | Reviewed {formatDateTime(review.reviewedAt)}
                  </p>
                  {review.commitment ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Commitment: {review.commitment.title} ({review.commitment.status})
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Automation history"
          description="History belongs here, not on the launch board."
        >
          <div className="space-y-3">
            {data.automationHistory.length === 0 ? (
              <EmptyState
                title="No automation history"
                description="Automation activity has not been recorded yet."
              />
            ) : (
              data.automationHistory.map((record) => (
                <div key={record.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={record.tone === 'neutral' ? 'warning' : record.tone} />
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {record.statusLabel}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {record.actorType}
                    </Badge>
                  </div>
                  <p className="mt-3 text-base font-semibold">{record.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{record.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.metricItems.map((metric) => (
                      <Badge
                        key={`${record.id}:${metric.label}`}
                        variant="outline"
                        className="rounded-full px-3 py-1 text-xs"
                      >
                        {metric.label}: {metric.value}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDateTime(record.createdAt)}
                  </p>
                  {record.actionHref ? (
                    <Button asChild variant="ghost" className="mt-2 px-0">
                      <Link href={record.actionHref}>Open related workspace</Link>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Sweep runs and escalations"
          description="Durable run records and escalation history should make retries and operator load visible."
        >
          <div className="space-y-3">
            {data.automationRuns.length === 0 && data.operatorEscalations.length === 0 ? (
              <EmptyState
                title="No sweep history yet"
                description="Automation runs and escalation attempts will appear here once the durable sweep starts operating."
              />
            ) : (
              <>
                {data.automationRuns.map((run) => (
                  <div
                    key={`${run.actorType}:${run.createdAt}`}
                    className="rounded-2xl border border-border/70 bg-card/70 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={run.status} />
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        {run.actorType}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{run.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        Open {run.followupCount}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        Critical {run.criticalCount}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        Opened {run.openedCount}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        Resolved {run.resolvedCount}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatDateTime(run.createdAt)}
                    </p>
                  </div>
                ))}

                {data.operatorEscalations.map((escalation) => (
                  <div
                    key={`${escalation.createdAt}:${escalation.title}`}
                    className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={escalation.status === 'sent' ? 'warning' : 'critical'} />
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        {escalation.channelCount} channel{escalation.channelCount === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{escalation.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {escalation.details}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatDateTime(escalation.createdAt)}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Draft and incident trail"
          description="Review drafts and incident events remain visible even after the current state changes."
        >
          <div className="space-y-3">
            {data.reviewDrafts.length === 0 && data.incidentEvents.length === 0 ? (
              <EmptyState
                title="No draft or incident trail yet"
                description="Review drafts and incident events will populate once the operating loop starts recording them."
              />
            ) : (
              <>
                {data.reviewDrafts.map((draft) => (
                  <div
                    key={`${draft.generatedAt}:${draft.reviewDate}`}
                    className="rounded-2xl border border-border/70 bg-card/70 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={draft.overallStatus} />
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        Draft
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{draft.focusArea}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{draft.topRisk}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatDateTime(draft.generatedAt)}
                    </p>
                  </div>
                ))}

                {data.incidentEvents.map((eventRecord) => (
                  <div
                    key={eventRecord.id}
                    className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        {eventRecord.eventType.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                        {incidentStatusLabel(eventRecord.status)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{eventRecord.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {eventRecord.summary}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatDateTime(eventRecord.createdAt)}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
