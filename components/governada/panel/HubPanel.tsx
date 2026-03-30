'use client';

/**
 * HubPanel — Intelligence panel content for the Hub/home page.
 *
 * When seneca_globe_discovery flag is ON: shows live activity cards with globe commands.
 * When flag is OFF: shows existing AI governance briefing.
 */

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useFeatureFlag } from '@/components/FeatureGate';
import { CollapsibleSection } from './CollapsibleSection';
import { CitedClaim } from './CitedClaim';
import { PanelSkeleton } from './PanelSkeleton';
import type { ContextSynthesisResult } from '@/lib/intelligence/context';
import type { ActivityEvent } from '@/lib/intelligence/idleActivity';
import { ArrowRight, Vote, Users, Trophy, Activity, Target } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { dispatchGlobeCommand } from '@/lib/globe/globeCommandBus';
import posthog from 'posthog-js';

// ---------------------------------------------------------------------------
// Activity icon mapping
// ---------------------------------------------------------------------------

const ACTIVITY_ICONS: Record<ActivityEvent['icon'], typeof Vote> = {
  vote: Vote,
  delegation: Users,
  milestone: Trophy,
  health: Activity,
  threshold: Target,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HubPanel() {
  const { stakeAddress } = useSegment();
  const discoveryFlag = useFeatureFlag('seneca_globe_discovery');

  if (discoveryFlag === true) {
    return <ActivityCards />;
  }

  // Default: existing AI briefing
  return <BriefingCards stakeAddress={stakeAddress} />;
}

// ---------------------------------------------------------------------------
// Activity cards (discovery mode)
// ---------------------------------------------------------------------------

function ActivityCards() {
  const { data: events, isLoading } = useQuery<ActivityEvent[]>({
    queryKey: ['governance-activity-recent'],
    queryFn: async () => {
      const res = await fetch('/api/governance/activity/recent');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <PanelSkeleton sections={2} />;

  if (!events || events.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground/60">
        No recent governance activity to show.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {events.slice(0, 3).map((event, i) => {
        const Icon = ACTIVITY_ICONS[event.icon] || Activity;
        return (
          <button
            key={`${event.type}-${i}`}
            type="button"
            onClick={() => {
              if (event.globeCommand) {
                dispatchGlobeCommand(event.globeCommand);
              }
              posthog.capture('activity_card_tapped', {
                event_type: event.type,
                entity_id: event.entityId,
              });
            }}
            className={cn(
              'w-full flex items-start gap-2.5 px-3 py-2.5 text-left',
              'hover:bg-white/[0.04] transition-colors group',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
            )}
          >
            <div className="shrink-0 mt-0.5 p-1 rounded-md bg-white/[0.04]">
              <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground/80 leading-snug line-clamp-2">
                {event.headline}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{event.subLabel}</p>
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing cards (existing behavior, flag OFF)
// ---------------------------------------------------------------------------

function BriefingCards({ stakeAddress }: { stakeAddress: string | null }) {
  const { data, isLoading, error } = useQuery<ContextSynthesisResult>({
    queryKey: ['intelligence-context', '/', stakeAddress],
    queryFn: async () => {
      const params = new URLSearchParams({ path: '/' });
      if (stakeAddress) params.set('stakeAddress', stakeAddress);
      const res = await fetch(`/api/intelligence/context?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch hub context');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <PanelSkeleton sections={3} />;

  if (error || !data) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground/60">
        Unable to load governance briefing. Try refreshing.
      </div>
    );
  }

  return (
    <div>
      {data.briefing && (
        <CollapsibleSection title="Governance Briefing" defaultExpanded>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            <CitedClaim citations={[{ label: 'On-chain data', href: '/governance/proposals' }]}>
              {data.briefing}
            </CitedClaim>
          </p>
        </CollapsibleSection>
      )}

      {data.highlights.length > 0 && (
        <CollapsibleSection
          title="Key Signals"
          summary={data.highlights.map((h) => h.value).join(' · ')}
        >
          <div className="space-y-1.5">
            {data.highlights.map((highlight, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">{highlight.label}</span>
                <span
                  className={cn(
                    'font-medium',
                    highlight.sentiment === 'positive' && 'text-emerald-400',
                    highlight.sentiment === 'negative' && 'text-red-400',
                    highlight.sentiment === 'neutral' && 'text-foreground/80',
                  )}
                >
                  {highlight.value}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {data.suggestedActions.length > 0 && (
        <CollapsibleSection
          title="Priority Actions"
          summary={`${data.suggestedActions.length} actions`}
        >
          <div className="space-y-1">
            {data.suggestedActions.map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className={cn(
                  'flex items-center justify-between py-1.5 px-2 rounded-md text-xs',
                  'hover:bg-accent/30 transition-colors group',
                  action.priority === 'high' && 'text-amber-300',
                  action.priority === 'medium' && 'text-foreground/80',
                  action.priority === 'low' && 'text-muted-foreground/70',
                )}
              >
                <span>{action.label}</span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
