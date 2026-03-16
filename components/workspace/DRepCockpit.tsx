'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { useWorkspaceCockpit } from '@/hooks/queries';
import { DepthGate } from '@/components/providers/DepthGate';
import { CockpitScoreHero } from './CockpitScoreHero';
import { GovernanceReadiness } from './GovernanceReadiness';
import { ActionFeed } from './ActionFeed';
import { CockpitHeatmap } from './CockpitHeatmap';
import { DelegationHealth } from './DelegationHealth';
import { CockpitSkeleton } from './CockpitSkeleton';
import { DelegatorMovementCard } from './DelegatorMovementCard';
import {
  AlertCircle,
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { DepthUpgradeNudge } from '@/components/shared/DepthUpgradeNudge';
import type { CockpitData } from '@/hooks/queries';

/**
 * DRep Governance Cockpit — single-page command center.
 *
 * Depth-adaptive layout:
 * - Hands-Off: Pending votes + delegation health (to-do widget)
 * - Informed:  + Score hero (score change visibility)
 * - Engaged:   + Action feed + heatmap (full workspace, current default)
 * - Deep:      + delegator analytics (delegation health, growth, retention)
 *
 * DRep default depth = deep, so existing users see no change.
 */

function formatAdaCompact(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

/** Delegator analytics card — shown at deep depth using snapshot data. */
function DelegatorAnalytics({ delegation }: { delegation: CockpitData['delegation'] }) {
  const { currentDelegators, snapshots } = delegation;
  const delegators = currentDelegators ?? 0;
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const votingPowerAda = latestSnapshot?.votingPowerAda ?? 0;
  const avgDelegation = delegators > 0 ? votingPowerAda / delegators : 0;

  // Growth trend: compare latest vs 3 epochs ago (or earliest available)
  const comparisonIdx = Math.max(0, snapshots.length - 4);
  const olderSnapshot = snapshots.length >= 2 ? snapshots[comparisonIdx] : null;
  const growthPct =
    olderSnapshot && olderSnapshot.votingPowerAda > 0
      ? ((votingPowerAda - olderSnapshot.votingPowerAda) / olderSnapshot.votingPowerAda) * 100
      : null;
  const epochSpan = olderSnapshot ? latestSnapshot!.epoch - olderSnapshot.epoch : 0;

  // Retention: earliest epoch in snapshots where delegator count is tracked
  const retentionEpoch = snapshots.length > 0 ? snapshots[0].epoch : null;
  const retentionSpan =
    retentionEpoch && latestSnapshot ? latestSnapshot.epoch - retentionEpoch : 0;

  const GrowthIcon =
    growthPct !== null && growthPct > 0
      ? TrendingUp
      : growthPct !== null && growthPct < 0
        ? TrendingDown
        : Minus;
  const growthColor =
    growthPct !== null && growthPct > 0
      ? 'text-emerald-500'
      : growthPct !== null && growthPct < 0
        ? 'text-rose-500'
        : 'text-muted-foreground';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Delegation Health
        </h3>
        <Link
          href="/workspace/delegators"
          className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
        >
          Details
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Average delegation size */}
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">
            {avgDelegation > 0 ? `${formatAdaCompact(avgDelegation)}` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Avg Delegation (₳)</p>
        </div>

        {/* Growth trend */}
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          {growthPct !== null ? (
            <>
              <p className={`text-lg font-bold tabular-nums ${growthColor}`}>
                <GrowthIcon className="inline h-3.5 w-3.5 mr-0.5 -mt-0.5" />
                {growthPct > 0 ? '+' : ''}
                {growthPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                VP {epochSpan > 0 ? `last ${epochSpan} epochs` : 'trend'}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold tabular-nums text-muted-foreground">—</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">VP Trend</p>
            </>
          )}
        </div>

        {/* Retention */}
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">
            <Users className="inline h-3.5 w-3.5 mr-0.5 -mt-0.5 text-muted-foreground" />
            {delegators}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {retentionSpan > 0 ? `Tracked ${retentionSpan} epochs` : 'Delegators'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DRepCockpit() {
  const { drepId } = useSegment();
  const { data, isLoading, error } = useWorkspaceCockpit(drepId);

  if (isLoading) return <CockpitSkeleton />;

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center space-y-2">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <p className="text-base font-semibold text-foreground">Failed to load cockpit</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Please try refreshing the page.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300" data-discovery="ws-cockpit">
      {/* Score Hero — informed+ (hands-off only needs pending votes) */}
      <DepthGate minDepth="informed">
        <CockpitScoreHero score={data.score} scoreStory={data.scoreStory} />
      </DepthGate>

      {/* Review Proposals — primary action CTA */}
      <Link
        href="/governance/proposals"
        className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 hover:bg-primary/10 transition-colors group"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Review Proposals</p>
          <p className="text-xs text-muted-foreground">
            {data.actionFeed.pendingCount > 0
              ? `${data.actionFeed.pendingCount} proposal${data.actionFeed.pendingCount === 1 ? '' : 's'} awaiting your vote`
              : 'Review active governance proposals'}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </Link>

      {/* Governance Readiness (pending votes) — all depths */}
      <div data-discovery="drep-voting-queue">
        <GovernanceReadiness data={data} />
      </div>

      {/* Action Feed — engaged+ (full workspace) */}
      <DepthGate minDepth="engaged">
        <ActionFeed actionFeed={data.actionFeed} />
      </DepthGate>

      {/* Delegator movement alert — surfaces significant changes */}
      <DelegatorMovementCard
        currentDelegators={data.delegation.currentDelegators ?? 0}
        delegatorDelta={data.delegation.delegatorDelta}
        snapshotDelegators={
          data.delegation.snapshots.length >= 2
            ? data.delegation.snapshots[data.delegation.snapshots.length - 2]?.delegatorCount
            : undefined
        }
      />

      {/* Bottom row: Delegation visible at all depths, Heatmap engaged+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-discovery="drep-delegators">
          <DelegationHealth delegation={data.delegation} />
        </div>
        <DepthGate minDepth="engaged">
          <CockpitHeatmap heatmap={data.activityHeatmap} />
        </DepthGate>
      </div>

      {/* Deep: delegator analytics */}
      <DepthGate minDepth="deep">
        <DelegatorAnalytics delegation={data.delegation} />
      </DepthGate>

      {/* Depth upgrade nudge — always at the bottom */}
      <DepthUpgradeNudge
        feature="delegator analytics and competitive intelligence"
        requiredDepth="deep"
      />
    </div>
  );
}
