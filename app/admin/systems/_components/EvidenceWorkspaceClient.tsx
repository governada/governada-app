'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Gauge, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  buildInitialPerformanceBaselineForm,
  buildInitialTrustSurfaceReviewForm,
  createSystemsPerformanceBaseline,
  createSystemsTrustSurfaceReview,
  evidenceCoverageLabel,
  fetchSystemsSection,
  formatDateTime,
  performanceEnvironmentLabel,
  statusLabel,
  type PerformanceBaselineFormState,
  type TrustSurfaceReviewFormState,
} from './systems-client';
import { EmptyState, SectionCard, StatusBadge, WorkspaceHero } from './systems-ui';

function invalidateSystems(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['systems'] });
}

export function EvidenceWorkspaceClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const panel = searchParams.get('panel');
  const isPanelOpen = panel === 'performance' || panel === 'trust';
  const [performanceForm, setPerformanceForm] = useState<PerformanceBaselineFormState | null>(null);
  const [trustForm, setTrustForm] = useState<TrustSurfaceReviewFormState | null>(null);

  const query = useQuery({
    queryKey: ['systems', 'evidence'],
    queryFn: () => fetchSystemsSection('evidence'),
  });

  useEffect(() => {
    if (!query.data) return;
    if (panel === 'performance' && !performanceForm) {
      setPerformanceForm(buildInitialPerformanceBaselineForm(query.data.latestPerformanceBaseline));
    }
    if (panel === 'trust' && !trustForm) {
      setTrustForm(
        buildInitialTrustSurfaceReviewForm({
          latest: query.data.latestTrustSurfaceReview,
          linkedSloIds: query.data.trustSurfaceReviewSummary.linkedSloIds,
        }),
      );
    }
  }, [panel, performanceForm, query.data, trustForm]);

  const performanceMutation = useMutation({
    mutationFn: createSystemsPerformanceBaseline,
    onSuccess: async () => {
      toast.success('Performance baseline logged');
      setPerformanceForm(null);
      router.replace(pathname, { scroll: false });
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to log performance baseline');
    },
  });

  const trustMutation = useMutation({
    mutationFn: createSystemsTrustSurfaceReview,
    onSuccess: async () => {
      toast.success('Trust-surface review logged');
      setTrustForm(null);
      router.replace(pathname, { scroll: false });
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to log trust review');
    },
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
        title="Evidence workspace unavailable"
        description={
          query.error instanceof Error
            ? query.error.message
            : 'The evidence workspace could not be loaded.'
        }
      />
    );
  }

  const data = query.data;

  const openPerformancePanel = () => {
    setPerformanceForm(buildInitialPerformanceBaselineForm(data.latestPerformanceBaseline));
    router.replace(`${pathname}?panel=performance`, { scroll: false });
  };

  const openTrustPanel = () => {
    setTrustForm(
      buildInitialTrustSurfaceReviewForm({
        latest: data.latestTrustSurfaceReview,
        linkedSloIds: data.trustSurfaceReviewSummary.linkedSloIds,
      }),
    );
    router.replace(`${pathname}?panel=trust`, { scroll: false });
  };

  const closePanel = () => {
    setPerformanceForm(null);
    setTrustForm(null);
    router.replace(pathname, { scroll: false });
  };

  const submitPerformance = async (event: FormEvent) => {
    event.preventDefault();
    if (!performanceForm) return;
    await performanceMutation.mutateAsync(performanceForm);
  };

  const submitTrust = async (event: FormEvent) => {
    event.preventDefault();
    if (!trustForm) return;
    await trustMutation.mutateAsync(trustForm);
  };

  return (
    <div className="space-y-6">
      <WorkspaceHero summary={data.summary}>
        <div className="flex flex-wrap gap-3">
          <Button onClick={openPerformancePanel}>
            <Gauge className="mr-2 h-4 w-4" />
            Record baseline
          </Button>
          <Button variant="outline" onClick={openTrustPanel}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Log trust review
          </Button>
        </div>
      </WorkspaceHero>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Operational SLOs"
          description="These are the durable operating promises behind the launch call."
        >
          <div className="space-y-3">
            {data.slos.map((slo) => (
              <div key={slo.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={slo.status} />
                  <p className="text-sm font-semibold">{slo.title}</p>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {slo.currentValue}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{slo.summary}</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Objective:</span> {slo.objective}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Target:</span> {slo.target}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Alert:</span> {slo.alertThreshold}
                  </p>
                </div>
                {slo.actionHref ? (
                  <Button asChild variant="ghost" className="mt-3 px-0">
                    <Link href={slo.actionHref}>{slo.actionLabel}</Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Critical journey proof"
          description="Static definitions set expectations; persisted verification runs determine current truth."
        >
          <div className="space-y-3">
            {data.journeys.map((journey) => (
              <div key={journey.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    {journey.id}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    {journey.gateLevel}
                  </Badge>
                  <StatusBadge
                    status={
                      journey.verificationStatus === 'passed'
                        ? 'good'
                        : journey.verificationStatus === 'failed'
                          ? 'critical'
                          : 'warning'
                    }
                  />
                </div>
                <p className="mt-3 text-base font-semibold">{journey.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {journey.currentEvidence}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Coverage:</span>{' '}
                    {evidenceCoverageLabel(journey)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Gap:</span> {journey.gap}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Next step:</span>{' '}
                    {journey.nextStep}
                  </p>
                </div>
                {journey.runUrl ? (
                  <Button asChild variant="ghost" className="mt-3 px-0">
                    <Link href={journey.runUrl}>
                      Open verification run
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Performance baseline"
          description={data.performanceBaselineSummary.summary}
        >
          <div className="space-y-3">
            <SummaryPanel
              title={data.performanceBaselineSummary.headline}
              status={data.performanceBaselineSummary.status}
              value={data.performanceBaselineSummary.currentValue}
              footer={
                data.latestPerformanceBaseline
                  ? `Last recorded ${formatDateTime(data.latestPerformanceBaseline.loggedAt)}`
                  : 'No baseline logged yet'
              }
            />
            {data.latestPerformanceBaseline ? (
              <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-semibold">
                  {data.latestPerformanceBaseline.scenarioLabel}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {data.latestPerformanceBaseline.summary}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>Slowest p95: {data.latestPerformanceBaseline.maxObservedP95Ms}ms</p>
                  <p>Error rate: {data.latestPerformanceBaseline.errorRatePct}%</p>
                  <p>Bottleneck owner: {data.latestPerformanceBaseline.mitigationOwner}</p>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Trust-surface review"
          description={data.trustSurfaceReviewSummary.summary}
        >
          <div className="space-y-3">
            <SummaryPanel
              title={data.trustSurfaceReviewSummary.headline}
              status={data.trustSurfaceReviewSummary.status}
              value={data.trustSurfaceReviewSummary.currentValue}
              footer={
                data.latestTrustSurfaceReview
                  ? `Last reviewed ${formatDateTime(data.latestTrustSurfaceReview.loggedAt)}`
                  : 'No trust review logged yet'
              }
            />
            {data.latestTrustSurfaceReview ? (
              <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-semibold">{data.latestTrustSurfaceReview.summary}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {data.latestTrustSurfaceReview.honestyGap}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>
                    Reviewed surfaces: {data.latestTrustSurfaceReview.reviewedSurfaces.join(', ')}
                  </p>
                  <p>Owner: {data.latestTrustSurfaceReview.owner}</p>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Scorecard sync"
          description="The weekly review history should feed the scorecard without hidden windowing assumptions."
        >
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={data.scorecardSync.status} />
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                {data.scorecardSync.currentValue}
              </Badge>
            </div>
            <p className="mt-3 text-base font-semibold">{data.scorecardSync.headline}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {data.scorecardSync.summary}
            </p>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <p>Reviews logged: {data.scorecardSync.reviewCount}</p>
              <p>Weekly streak: {data.scorecardSync.weeklyStreak}</p>
              <p>Last reviewed: {formatDateTime(data.scorecardSync.lastReviewedAt)}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Verification history"
          description="Persisted journey verification runs are the evidence feed for launch-control."
        >
          <div className="space-y-3">
            {data.journeyVerifications.length === 0 ? (
              <EmptyState
                title="No journey verifications"
                description="CI proof has not been ingested into the cockpit yet."
              />
            ) : (
              data.journeyVerifications.map((verification) => (
                <div
                  key={verification.id}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {verification.journeyId}
                    </Badge>
                    <StatusBadge status={verification.status === 'passed' ? 'good' : 'critical'} />
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {verification.workflowName}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {formatDateTime(verification.executedAt)}
                    {verification.commitSha ? ` • ${verification.commitSha.slice(0, 8)}` : ''}
                  </p>
                  {verification.runUrl ? (
                    <Button asChild variant="ghost" className="mt-2 px-0">
                      <Link href={verification.runUrl}>
                        Open run
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <Sheet
        open={isPanelOpen}
        onOpenChange={(open) =>
          open ? (panel === 'trust' ? openTrustPanel() : openPerformancePanel()) : closePanel()
        }
      >
        <SheetContent className="w-full sm:max-w-2xl">
          {panel === 'trust' ? (
            <>
              <SheetHeader>
                <SheetTitle>Log trust-surface review</SheetTitle>
                <SheetDescription>
                  Record how the product currently communicates degraded state to the founder and
                  public.
                </SheetDescription>
              </SheetHeader>
              {trustForm ? (
                <form
                  onSubmit={submitTrust}
                  className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-6"
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="trust-review-date">Review date</Label>
                      <Input
                        id="trust-review-date"
                        type="date"
                        value={trustForm.reviewDate}
                        onChange={(event) =>
                          setTrustForm({ ...trustForm, reviewDate: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trust-owner">Owner</Label>
                      <Input
                        id="trust-owner"
                        value={trustForm.owner}
                        onChange={(event) =>
                          setTrustForm({ ...trustForm, owner: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trust-status">Review status</Label>
                      <Select
                        value={trustForm.overallStatus}
                        onValueChange={(value) =>
                          setTrustForm({
                            ...trustForm,
                            overallStatus: value as TrustSurfaceReviewFormState['overallStatus'],
                          })
                        }
                      >
                        <SelectTrigger id="trust-status" className="w-full">
                          <SelectValue placeholder="Choose review status" />
                        </SelectTrigger>
                        <SelectContent>
                          {(['good', 'warning', 'critical'] as const).map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trust-slos">Linked SLOs</Label>
                    <Input
                      id="trust-slos"
                      value={trustForm.linkedSloIds.join(', ')}
                      onChange={(event) =>
                        setTrustForm({
                          ...trustForm,
                          linkedSloIds: event.target.value
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reviewed-surfaces">Reviewed surfaces</Label>
                    <Textarea
                      id="reviewed-surfaces"
                      rows={4}
                      value={trustForm.reviewedSurfaces}
                      onChange={(event) =>
                        setTrustForm({ ...trustForm, reviewedSurfaces: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trust-summary">Summary</Label>
                    <Textarea
                      id="trust-summary"
                      rows={4}
                      value={trustForm.summary}
                      onChange={(event) =>
                        setTrustForm({ ...trustForm, summary: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current-state">Current user state</Label>
                    <Textarea
                      id="current-state"
                      rows={4}
                      value={trustForm.currentUserState}
                      onChange={(event) =>
                        setTrustForm({ ...trustForm, currentUserState: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="honesty-gap">Honesty gap</Label>
                    <Textarea
                      id="honesty-gap"
                      rows={4}
                      value={trustForm.honestyGap}
                      onChange={(event) =>
                        setTrustForm({ ...trustForm, honestyGap: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="next-fix">Next fix</Label>
                    <Textarea
                      id="next-fix"
                      rows={4}
                      value={trustForm.nextFix}
                      onChange={(event) =>
                        setTrustForm({ ...trustForm, nextFix: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trust-artifact">Artifact URL</Label>
                    <Input
                      id="trust-artifact"
                      value={trustForm.artifactUrl}
                      onChange={(event) =>
                        setTrustForm({ ...trustForm, artifactUrl: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trust-notes">Notes</Label>
                    <Textarea
                      id="trust-notes"
                      rows={4}
                      value={trustForm.notes}
                      onChange={(event) =>
                        setTrustForm({ ...trustForm, notes: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={trustMutation.isPending}>
                      {trustMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save review
                    </Button>
                    <Button type="button" variant="outline" onClick={closePanel}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>Record performance baseline</SheetTitle>
                <SheetDescription>
                  Store a durable baseline so launch-control can distinguish live performance from
                  the evidence trail.
                </SheetDescription>
              </SheetHeader>
              {performanceForm ? (
                <form
                  onSubmit={submitPerformance}
                  className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-6"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="baseline-date">Baseline date</Label>
                      <Input
                        id="baseline-date"
                        type="date"
                        value={performanceForm.baselineDate}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            baselineDate: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baseline-environment">Environment</Label>
                      <Select
                        value={performanceForm.environment}
                        onValueChange={(value) =>
                          setPerformanceForm({
                            ...performanceForm,
                            environment: value as PerformanceBaselineFormState['environment'],
                          })
                        }
                      >
                        <SelectTrigger id="baseline-environment" className="w-full">
                          <SelectValue placeholder="Choose environment" />
                        </SelectTrigger>
                        <SelectContent>
                          {(['production', 'preview', 'local'] as const).map((environment) => (
                            <SelectItem key={environment} value={environment}>
                              {performanceEnvironmentLabel(environment)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scenario-label">Scenario</Label>
                    <Input
                      id="scenario-label"
                      value={performanceForm.scenarioLabel}
                      onChange={(event) =>
                        setPerformanceForm({
                          ...performanceForm,
                          scenarioLabel: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="concurrency-profile">Concurrency profile</Label>
                    <Input
                      id="concurrency-profile"
                      value={performanceForm.concurrencyProfile}
                      onChange={(event) =>
                        setPerformanceForm({
                          ...performanceForm,
                          concurrencyProfile: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="performance-summary">Summary</Label>
                    <Textarea
                      id="performance-summary"
                      rows={4}
                      value={performanceForm.summary}
                      onChange={(event) =>
                        setPerformanceForm({ ...performanceForm, summary: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bottleneck">Bottleneck</Label>
                    <Textarea
                      id="bottleneck"
                      rows={4}
                      value={performanceForm.bottleneck}
                      onChange={(event) =>
                        setPerformanceForm({ ...performanceForm, bottleneck: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="mitigation-owner">Mitigation owner</Label>
                      <Input
                        id="mitigation-owner"
                        value={performanceForm.mitigationOwner}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            mitigationOwner: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="artifact-url">Artifact URL</Label>
                      <Input
                        id="artifact-url"
                        value={performanceForm.artifactUrl}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            artifactUrl: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="next-step">Next step</Label>
                    <Textarea
                      id="next-step"
                      rows={4}
                      value={performanceForm.nextStep}
                      onChange={(event) =>
                        setPerformanceForm({ ...performanceForm, nextStep: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="health-p95">/api/health p95</Label>
                      <Input
                        id="health-p95"
                        type="number"
                        min="0"
                        step="1"
                        value={performanceForm.apiHealthP95Ms}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            apiHealthP95Ms: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dreps-p95">/api/dreps p95</Label>
                      <Input
                        id="dreps-p95"
                        type="number"
                        min="0"
                        step="1"
                        value={performanceForm.apiDrepsP95Ms}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            apiDrepsP95Ms: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="v1-dreps-p95">/api/v1/dreps p95</Label>
                      <Input
                        id="v1-dreps-p95"
                        type="number"
                        min="0"
                        step="1"
                        value={performanceForm.apiV1DrepsP95Ms}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            apiV1DrepsP95Ms: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="governance-health-p95">Governance health p95</Label>
                      <Input
                        id="governance-health-p95"
                        type="number"
                        min="0"
                        step="1"
                        value={performanceForm.governanceHealthP95Ms}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            governanceHealthP95Ms: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="error-rate">Error rate %</Label>
                      <Input
                        id="error-rate"
                        type="number"
                        min="0"
                        step="0.1"
                        value={performanceForm.errorRatePct}
                        onChange={(event) =>
                          setPerformanceForm({
                            ...performanceForm,
                            errorRatePct: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="performance-notes">Notes</Label>
                      <Textarea
                        id="performance-notes"
                        rows={4}
                        value={performanceForm.notes}
                        onChange={(event) =>
                          setPerformanceForm({ ...performanceForm, notes: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={performanceMutation.isPending}>
                      {performanceMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save baseline
                    </Button>
                    <Button type="button" variant="outline" onClick={closePanel}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SummaryPanel({
  title,
  status,
  value,
  footer,
}: {
  title: string;
  status: 'good' | 'warning' | 'critical' | 'bootstrap';
  value: string;
  footer: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
          {value}
        </Badge>
      </div>
      <p className="mt-3 text-base font-semibold">{title}</p>
      <p className="mt-2 text-xs text-muted-foreground">{footer}</p>
    </div>
  );
}
