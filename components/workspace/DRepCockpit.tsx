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
import { AlertCircle } from 'lucide-react';

/**
 * DRep Governance Cockpit — single-page command center.
 *
 * Depth-adaptive layout:
 * - Hands-Off: Pending votes + delegation health (to-do widget)
 * - Informed:  + Score hero (score change visibility)
 * - Engaged:   + Action feed + heatmap (full workspace, current default)
 * - Deep:      + competitive intelligence + delegator analytics (placeholders)
 *
 * DRep default depth = deep, so existing users see no change.
 */
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

      {/* Governance Readiness (pending votes) — all depths */}
      <div data-discovery="drep-voting-queue">
        <GovernanceReadiness data={data} />
      </div>

      {/* Action Feed — engaged+ (full workspace) */}
      <DepthGate minDepth="engaged">
        <ActionFeed actionFeed={data.actionFeed} />
      </DepthGate>

      {/* Bottom row: Delegation visible at all depths, Heatmap engaged+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-discovery="drep-delegators">
          <DelegationHealth delegation={data.delegation} />
        </div>
        <DepthGate minDepth="engaged">
          <CockpitHeatmap heatmap={data.activityHeatmap} />
        </DepthGate>
      </div>

      {/* Deep: placeholder for delegator analytics */}
      <DepthGate minDepth="deep">
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Delegator Analytics</p>
          <p className="text-xs text-muted-foreground/70">
            Detailed delegator demographics, retention trends, and growth insights — coming soon.
          </p>
        </div>
      </DepthGate>
    </div>
  );
}
