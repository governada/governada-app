'use client';

/**
 * DRepPanel — Intelligence panel content for individual DRep pages.
 *
 * Shows alignment match, score trajectory, key divergences.
 * Fetches from GET /api/intelligence/context?path=/dreps/[id]
 */

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { CollapsibleSection } from './CollapsibleSection';
import { CitedClaim } from './CitedClaim';
import { PanelSkeleton } from './PanelSkeleton';
import type { ContextSynthesisResult } from '@/lib/intelligence/context';
import { cn } from '@/lib/utils';

interface DRepPanelProps {
  entityId?: string;
}

export function DRepPanel({ entityId }: DRepPanelProps) {
  const { stakeAddress } = useSegment();

  const { data, isLoading, error } = useQuery<ContextSynthesisResult>({
    queryKey: ['intelligence-context', 'drep', entityId, stakeAddress],
    queryFn: async () => {
      const params = new URLSearchParams({ path: `/dreps/${entityId}` });
      if (stakeAddress) params.set('stakeAddress', stakeAddress);
      if (entityId) params.set('entityId', entityId);
      const res = await fetch(`/api/intelligence/context?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch DRep context');
      return res.json();
    },
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!entityId) {
    return <div className="px-3 py-4 text-xs text-muted-foreground/60">No DRep selected.</div>;
  }

  if (isLoading) return <PanelSkeleton sections={3} />;

  if (error || !data) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground/60">
        Unable to load DRep intelligence.
      </div>
    );
  }

  return (
    <div>
      {/* DRep Intelligence */}
      {data.briefing && (
        <CollapsibleSection title="DRep Intelligence" defaultExpanded>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            <CitedClaim
              citations={[
                { label: 'DRep profile', href: `/drep/${encodeURIComponent(entityId)}` },
                { label: 'Scoring engine' },
              ]}
            >
              {data.briefing}
            </CitedClaim>
          </p>
        </CollapsibleSection>
      )}

      {/* Metrics */}
      {data.highlights.length > 0 && (
        <CollapsibleSection
          title="Performance Signals"
          summary={data.highlights
            .map((h) => h.value)
            .slice(0, 3)
            .join(' · ')}
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
    </div>
  );
}
