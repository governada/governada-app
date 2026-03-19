'use client';

/**
 * HubPanel — Intelligence panel content for the Hub/home page.
 *
 * Shows personalized governance briefing with priority actions.
 * Fetches from GET /api/intelligence/context?path=/
 */

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { CollapsibleSection } from './CollapsibleSection';
import { CitedClaim } from './CitedClaim';
import { PanelSkeleton } from './PanelSkeleton';
import type { ContextSynthesisResult } from '@/lib/intelligence/context';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function HubPanel() {
  const { stakeAddress } = useSegment();

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
      {/* Briefing */}
      {data.briefing && (
        <CollapsibleSection title="Governance Briefing" defaultExpanded>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            <CitedClaim citations={[{ label: 'On-chain data', href: '/governance/proposals' }]}>
              {data.briefing}
            </CitedClaim>
          </p>
        </CollapsibleSection>
      )}

      {/* Highlights */}
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

      {/* Suggested Actions */}
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
