'use client';

/**
 * DefaultPanel — Fallback intelligence panel content.
 *
 * Shows a generic governance state overview when no route-specific
 * panel is available. Uses the governance-state API for basic signals.
 */

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { CollapsibleSection } from './CollapsibleSection';
import { PanelSkeleton } from './PanelSkeleton';
import type { GovernanceStateResult } from '@/lib/intelligence/governance-state';
import { cn } from '@/lib/utils';

export function DefaultPanel() {
  const { stakeAddress } = useSegment();

  const { data, isLoading } = useQuery<GovernanceStateResult>({
    queryKey: ['governance-state', stakeAddress],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stakeAddress) params.set('stakeAddress', stakeAddress);
      const res = await fetch(`/api/intelligence/governance-state?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch governance state');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) return <PanelSkeleton sections={2} />;

  return (
    <div>
      <CollapsibleSection title="Governance Overview" defaultExpanded>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/70">Active Proposals</span>
            <span className="font-medium text-foreground/80">{data.epoch.activeProposalCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/70">Epoch</span>
            <span className="font-medium text-foreground/80">{data.epoch.currentEpoch}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/70">Epoch Progress</span>
            <span className="font-medium text-foreground/80">
              {Math.round(data.epoch.progress * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/70">Temperature</span>
            <span
              className={cn(
                'font-medium',
                data.temperature >= 70
                  ? 'text-red-400'
                  : data.temperature >= 40
                    ? 'text-amber-400'
                    : 'text-emerald-400',
              )}
            >
              {data.temperature}/100
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {data.userState && (
        <CollapsibleSection
          title="Your Status"
          summary={data.userState.hasPendingActions ? 'Actions pending' : 'Up to date'}
        >
          <div className="space-y-1.5">
            {data.userState.pendingVotes > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">Pending Votes</span>
                <span className="font-medium text-amber-400">{data.userState.pendingVotes}</span>
              </div>
            )}
            {data.userState.drepScore != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">DRep Score</span>
                <span className="font-medium text-foreground/80">
                  {data.userState.drepScore}/100
                </span>
              </div>
            )}
            {data.userState.drepRank != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">Rank</span>
                <span className="font-medium text-foreground/80">#{data.userState.drepRank}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70">Delegation</span>
              <span
                className={cn(
                  'font-medium',
                  data.userState.delegatedDrepId ? 'text-emerald-400' : 'text-muted-foreground/60',
                )}
              >
                {data.userState.delegatedDrepId ? 'Active' : 'None'}
              </span>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
