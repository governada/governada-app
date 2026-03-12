'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { useWorkspaceCockpit } from '@/hooks/queries';
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
 * Layout (mobile-first, single column → 2-col on md):
 * 1. Score Hero (full width)
 * 2. Governance Readiness (full width)
 * 3. Action Feed (full width)
 * 4. Delegation Health | Activity Heatmap (side by side on md)
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
      {/* Score Hero */}
      <CockpitScoreHero score={data.score} scoreStory={data.scoreStory} />

      {/* Governance Readiness */}
      <div data-discovery="drep-voting-queue">
        <GovernanceReadiness data={data} />
      </div>

      {/* Action Feed */}
      <ActionFeed actionFeed={data.actionFeed} />

      {/* Bottom row: Delegation + Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-discovery="drep-delegators">
          <DelegationHealth delegation={data.delegation} />
        </div>
        <CockpitHeatmap heatmap={data.activityHeatmap} />
      </div>
    </div>
  );
}
