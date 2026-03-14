'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle2, AlertCircle, User, Trophy } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDRepReportCard, useDashboardCompetitive } from '@/hooks/queries';
import { computeTierProgress, type PillarBreakdown } from '@/lib/scoring/tiers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GovernancePhilosophyEditor } from '@/components/GovernancePhilosophyEditor';

interface ProfileCheckItem {
  label: string;
  complete: boolean;
  tip: string;
}

/**
 * PublicProfileView — Shows DReps how their profile appears to delegators,
 * with a profile completeness checklist and link to their public profile.
 */
export function PublicProfileView() {
  const { segment, drepId, poolId } = useSegment();
  const isDRep = segment === 'drep';
  const isSPO = segment === 'spo';
  const { data: reportRaw, isLoading } = useDRepReportCard(isDRep ? drepId : null);
  const { data: compRaw } = useDashboardCompetitive(isDRep ? drepId : null);

  if (!isDRep && !isSPO) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12 text-center space-y-4">
        <p className="text-muted-foreground">
          Public profile management is available for DReps and SPOs.
        </p>
        <Button asChild>
          <Link href="/">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const report = reportRaw as Record<string, unknown> | undefined;
  const competitive = compRaw as Record<string, unknown> | undefined;
  const score = Math.round((report?.score as number) ?? 0);
  const percentile = Math.round((competitive?.percentile as number) ?? 0);
  const rationaleRate = (report?.rationaleRate as number) ?? 0;
  const participation = (report?.participationRate as number) ?? 0;
  const reliability = (report?.reliabilityScore as number) ?? (report?.reliability as number) ?? 0;
  const profileCompleteness = (report?.profileCompleteness as number) ?? 0;

  const pillarBreakdown: PillarBreakdown = {
    engagementQuality: rationaleRate,
    effectiveParticipation: participation,
    reliability: reliability * 100,
    governanceIdentity: profileCompleteness * 100,
  };
  const tierProgress = computeTierProgress(score, pillarBreakdown);

  const profileId = isDRep ? drepId : poolId;
  const profileUrl = isDRep
    ? `/drep/${encodeURIComponent(profileId ?? '')}`
    : `/pool/${encodeURIComponent(profileId ?? '')}`;

  // Profile checklist based on what we can infer from the report card
  const checks: ProfileCheckItem[] = [
    {
      label: 'Governance profile registered on-chain',
      complete: !!profileId,
      tip: 'Register as a DRep through your wallet to create your on-chain profile.',
    },
    {
      label: 'Has voting activity',
      complete: participation > 0,
      tip: 'Cast votes on governance proposals to show delegators you are active.',
    },
    {
      label: 'Provides vote rationales',
      complete: rationaleRate > 25,
      tip: 'Submit CIP-100 rationales when voting to explain your reasoning to delegators.',
    },
    {
      label: 'Consistent voting record',
      complete: reliability > 0.5,
      tip: 'Vote regularly across epochs to build a reliable track record.',
    },
    {
      label: 'Profile metadata complete',
      complete: profileCompleteness > 0.5,
      tip: 'Update your on-chain metadata with a governance statement, social links, and profile image.',
    },
  ];

  const completedCount = checks.filter((c) => c.complete).length;
  const completionPct = Math.round((completedCount / checks.length) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/workspace"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Public Profile</h1>
      </div>

      {/* Profile preview card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-3">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {profileId ? `${profileId.slice(0, 16)}...` : 'Not registered'}
              </p>
              <div className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {tierProgress.currentTier} &middot; Score {score}
                </span>
              </div>
            </div>
          </div>
          {profileId && (
            <Button asChild variant="outline" size="sm">
              <Link href={profileUrl}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View as delegator
              </Link>
            </Button>
          )}
        </div>

        {/* What delegators see — score and percentile */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{score}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Score</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">
              {percentile > 0 ? `${percentile}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Percentile</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{completionPct}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Profile</p>
          </div>
        </div>
      </div>

      {/* Profile completeness checklist */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Profile Completeness
        </h3>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {checks.map((check) => (
            <div key={check.label} className="flex items-start gap-3 p-3">
              {check.complete ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p
                  className={`text-sm font-medium ${check.complete ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {check.label}
                </p>
                {!check.complete && <p className="text-xs text-muted-foreground">{check.tip}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Governance philosophy editor */}
      {profileId && <GovernancePhilosophyEditor drepId={profileId} />}

      {/* Info about on-chain profiles */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Your governance profile is stored on the Cardano blockchain. To update your display name,
          governance statement, or social links, use your wallet&apos;s DRep metadata update
          feature. Changes will appear on Governada after the next sync.
        </p>
      </div>
    </div>
  );
}
