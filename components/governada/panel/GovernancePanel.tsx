'use client';

/**
 * GovernancePanel — Intelligence panel content for governance list pages.
 *
 * Used on /governance/proposals, /governance/representatives, /governance/health.
 * Shows temperature, trending signals, alignment-matched content.
 * Fetches from GET /api/intelligence/context?path=[pathname]
 */

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { CollapsibleSection } from './CollapsibleSection';
import { CitedClaim } from './CitedClaim';
import { PanelSkeleton } from './PanelSkeleton';
import type { ContextSynthesisResult } from '@/lib/intelligence/context';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PanelRoute } from '@/hooks/useSenecaThread';

interface GovernancePanelProps {
  panelRoute: PanelRoute;
}

const PANEL_TITLES: Record<string, string> = {
  'proposals-list': 'Proposals Overview',
  'representatives-list': 'Representatives Overview',
  health: 'Governance Health',
  workspace: 'Workspace Intelligence',
};

const PANEL_PATHS: Record<string, string> = {
  'proposals-list': '/governance/proposals',
  'representatives-list': '/governance/representatives',
  health: '/governance/health',
  workspace: '/workspace',
};

export function GovernancePanel({ panelRoute }: GovernancePanelProps) {
  const { stakeAddress } = useSegment();
  const contextPath = PANEL_PATHS[panelRoute] ?? '/governance';
  const title = PANEL_TITLES[panelRoute] ?? 'Governance';

  const { data, isLoading, error } = useQuery<ContextSynthesisResult>({
    queryKey: ['intelligence-context', contextPath, stakeAddress],
    queryFn: async () => {
      const params = new URLSearchParams({ path: contextPath });
      if (stakeAddress) params.set('stakeAddress', stakeAddress);
      const res = await fetch(`/api/intelligence/context?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch governance context');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <PanelSkeleton sections={2} />;

  if (error || !data) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground/60">
        Unable to load governance intelligence.
      </div>
    );
  }

  return (
    <div>
      {/* Briefing */}
      {data.briefing && (
        <CollapsibleSection title={title} defaultExpanded>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            <CitedClaim citations={[{ label: 'Governance data', href: contextPath }]}>
              {data.briefing}
            </CitedClaim>
          </p>
        </CollapsibleSection>
      )}

      {/* Highlights */}
      {data.highlights.length > 0 && (
        <CollapsibleSection
          title="Signals"
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

      {/* Suggested Actions */}
      {data.suggestedActions.length > 0 && (
        <CollapsibleSection title="Suggested" summary={`${data.suggestedActions.length} actions`}>
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
