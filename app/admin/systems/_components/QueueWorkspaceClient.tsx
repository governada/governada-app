'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, RefreshCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  automationTriggerLabel,
  buildInitialReviewForm,
  commitmentStatusLabel,
  createSystemsReview,
  fetchSystemsSection,
  followupStatusLabel,
  formatDate,
  generateSystemsReviewDraft,
  nextCommitmentStatus,
  runSystemsAutomationSweep,
  suggestCommitmentAction,
  updateSystemsAutomationFollowupStatus,
  updateSystemsCommitmentStatus,
  type ReviewFormState,
} from './systems-client';
import { EmptyState, SectionCard, StatusBadge, WorkspaceHero } from './systems-ui';

function invalidateSystems(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['systems'] });
}

export function QueueWorkspaceClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panel = searchParams.get('panel');
  const isReviewOpen = panel === 'review';
  const [reviewForm, setReviewForm] = useState<ReviewFormState | null>(null);

  const query = useQuery({
    queryKey: ['systems', 'queue'],
    queryFn: () => fetchSystemsSection('queue'),
  });

  useEffect(() => {
    if (isReviewOpen && !reviewForm && query.data) {
      setReviewForm(buildInitialReviewForm(query.data));
    }
  }, [isReviewOpen, query.data, reviewForm]);

  const sweepMutation = useMutation({
    mutationFn: runSystemsAutomationSweep,
    onSuccess: async () => {
      toast.success('Automation sweep completed');
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to run sweep');
    },
  });

  const draftMutation = useMutation({
    mutationFn: generateSystemsReviewDraft,
    onSuccess: async (result) => {
      if (query.data && result?.draft) {
        setReviewForm(
          buildInitialReviewForm({
            ...query.data,
            suggestedReviewDraft: result.draft,
          }),
        );
      }
      router.replace(`${pathname}?panel=review`, { scroll: false });
      toast.success('Review draft refreshed');
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to generate review draft');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: createSystemsReview,
    onSuccess: async () => {
      toast.success('Weekly systems review logged');
      setReviewForm(null);
      router.replace(pathname, { scroll: false });
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to log review');
    },
  });

  const followupMutation = useMutation({
    mutationFn: ({
      sourceKey,
      status,
    }: {
      sourceKey: string;
      status: 'open' | 'acknowledged' | 'resolved';
    }) => updateSystemsAutomationFollowupStatus(sourceKey, status),
    onSuccess: async () => {
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update follow-up');
    },
  });

  const commitmentMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'planned' | 'in_progress' | 'blocked' | 'done';
    }) => updateSystemsCommitmentStatus(id, status),
    onSuccess: async () => {
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update commitment');
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-3xl border border-border/60 bg-muted/25" />
        <div className="h-[32rem] animate-pulse rounded-3xl border border-border/60 bg-muted/25" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Queue unavailable"
        description={
          query.error instanceof Error
            ? query.error.message
            : 'The founder work queue could not be loaded.'
        }
      />
    );
  }

  const data = query.data;

  const openReviewPanel = () => {
    setReviewForm(buildInitialReviewForm(data));
    router.replace(`${pathname}?panel=review`, { scroll: false });
  };

  const closeReviewPanel = () => {
    setReviewForm(null);
    router.replace(pathname, { scroll: false });
  };

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!reviewForm) return;
    await reviewMutation.mutateAsync(reviewForm);
  };

  return (
    <div className="space-y-6">
      <WorkspaceHero summary={data.summary}>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => sweepMutation.mutate()} disabled={sweepMutation.isPending}>
            {sweepMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run sweep now
          </Button>
          <Button
            variant="outline"
            onClick={() => draftMutation.mutate()}
            disabled={draftMutation.isPending}
          >
            {draftMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh review draft
          </Button>
          <Button variant="outline" onClick={openReviewPanel}>
            <Sparkles className="mr-2 h-4 w-4" />
            Log weekly review
          </Button>
        </div>
      </WorkspaceHero>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Founder queue"
          description={data.automationSummary.summary}
          action={
            data.latestCommitmentShepherd ? (
              <StatusBadge
                status={data.latestCommitmentShepherd.status === 'focus' ? 'warning' : 'good'}
              />
            ) : undefined
          }
        >
          <div className="space-y-3">
            {data.automationFollowups.length === 0 ? (
              <EmptyState
                title="Queue is clear"
                description="No durable automation follow-ups are currently open."
              />
            ) : (
              data.automationFollowups.map((followup) => (
                <div
                  key={followup.sourceKey}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={followup.severity === 'critical' ? 'critical' : 'warning'}
                    />
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {followupStatusLabel(followup.status)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {automationTriggerLabel(followup.triggerType)}
                    </Badge>
                    <p className="text-sm font-semibold">{followup.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{followup.summary}</p>
                  <p className="mt-3 text-sm leading-6">{followup.recommendedAction}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {followup.status === 'open' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          followupMutation.mutate({
                            sourceKey: followup.sourceKey,
                            status: 'acknowledged',
                          })
                        }
                      >
                        Acknowledge
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          followupMutation.mutate({ sourceKey: followup.sourceKey, status: 'open' })
                        }
                      >
                        Reopen
                      </Button>
                    )}
                    {followup.status !== 'resolved' ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          followupMutation.mutate({
                            sourceKey: followup.sourceKey,
                            status: 'resolved',
                          })
                        }
                      >
                        Resolve
                      </Button>
                    ) : null}
                    {followup.actionHref ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={followup.actionHref}>Open source</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Weekly review" description={data.reviewDiscipline.summary}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={data.reviewDiscipline.status} />
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  {data.reviewDiscipline.currentValue}
                </Badge>
              </div>
              <p className="mt-3 text-base font-semibold">{data.reviewDiscipline.headline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {data.reviewDiscipline.summary}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Suggested draft
              </p>
              {data.suggestedReviewDraft ? (
                <>
                  <p className="mt-2 text-base font-semibold">
                    {data.suggestedReviewDraft.focusArea}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {data.suggestedReviewDraft.topRisk}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Commitment: {data.suggestedReviewDraft.hardeningCommitmentTitle}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  No review draft is stored yet. Refresh the draft or log a review directly.
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Open commitments" description="Keep the weekly hardening loop honest.">
          <div className="space-y-3">
            {data.openCommitments.length === 0 ? (
              <EmptyState
                title="No open commitments"
                description="The queue has no unresolved hardening commitments right now."
              />
            ) : (
              data.openCommitments.map((commitment) => (
                <div
                  key={commitment.id}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {commitmentStatusLabel(commitment.status)}
                    </Badge>
                    {commitment.isOverdue ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-200"
                      >
                        Overdue
                      </Badge>
                    ) : null}
                    <p className="text-sm font-semibold">{commitment.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {commitment.summary}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Owner: {commitment.owner} | Due {formatDate(commitment.dueDate)} | Age{' '}
                    {commitment.ageDays}d
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        commitmentMutation.mutate({
                          id: commitment.id,
                          status: nextCommitmentStatus(commitment),
                        })
                      }
                    >
                      {suggestCommitmentAction(commitment)}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        commitmentMutation.mutate({ id: commitment.id, status: 'done' })
                      }
                    >
                      Complete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Manual founder actions"
          description="These are still worth direct founder attention even when automation is healthy."
        >
          <div className="space-y-3">
            {data.actions.length === 0 ? (
              <EmptyState
                title="No manual actions"
                description="The queue currently has no additional founder-only actions."
              />
            ) : (
              data.actions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {action.priority}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {action.timeframe}
                    </Badge>
                  </div>
                  <p className="mt-3 text-base font-semibold">{action.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.summary}</p>
                  {action.href ? (
                    <Button asChild variant="ghost" className="mt-3 px-0">
                      <Link href={action.href}>Open action</Link>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <Sheet
        open={isReviewOpen}
        onOpenChange={(open) => (open ? openReviewPanel() : closeReviewPanel())}
      >
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Log weekly systems review</SheetTitle>
            <SheetDescription>
              Anchor the current launch posture in one honest review and one explicit hardening
              commitment.
            </SheetDescription>
          </SheetHeader>
          {reviewForm ? (
            <form
              onSubmit={submitReview}
              className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-date">Review date</Label>
                  <Input
                    id="review-date"
                    type="date"
                    value={reviewForm.reviewDate}
                    onChange={(event) =>
                      setReviewForm({ ...reviewForm, reviewDate: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-owner">Commitment owner</Label>
                  <Input
                    id="review-owner"
                    value={reviewForm.commitmentOwner}
                    onChange={(event) =>
                      setReviewForm({ ...reviewForm, commitmentOwner: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="focus-area">Focus area</Label>
                <Input
                  id="focus-area"
                  value={reviewForm.focusArea}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, focusArea: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="top-risk">Top risk</Label>
                <Textarea
                  id="top-risk"
                  rows={4}
                  value={reviewForm.topRisk}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, topRisk: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="change-notes">Change notes</Label>
                <Textarea
                  id="change-notes"
                  rows={6}
                  value={reviewForm.changeNotes}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, changeNotes: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commitment-title">Hardening commitment</Label>
                <Input
                  id="commitment-title"
                  value={reviewForm.hardeningCommitmentTitle}
                  onChange={(event) =>
                    setReviewForm({
                      ...reviewForm,
                      hardeningCommitmentTitle: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commitment-summary">Commitment summary</Label>
                <Textarea
                  id="commitment-summary"
                  rows={5}
                  value={reviewForm.hardeningCommitmentSummary}
                  onChange={(event) =>
                    setReviewForm({
                      ...reviewForm,
                      hardeningCommitmentSummary: event.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="commitment-due-date">Due date</Label>
                  <Input
                    id="commitment-due-date"
                    type="date"
                    value={reviewForm.commitmentDueDate}
                    onChange={(event) =>
                      setReviewForm({ ...reviewForm, commitmentDueDate: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linked-slos">Linked SLOs</Label>
                  <Input
                    id="linked-slos"
                    value={reviewForm.linkedSloIds.join(', ')}
                    onChange={(event) =>
                      setReviewForm({
                        ...reviewForm,
                        linkedSloIds: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={reviewMutation.isPending}>
                  {reviewMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save review
                </Button>
                <Button type="button" variant="outline" onClick={closeReviewPanel}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
