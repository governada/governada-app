'use client';

/**
 * ProposalPanel — Intelligence panel content for individual proposal pages.
 *
 * Shows constitutional concerns, sentiment, DRep position, precedent.
 * Fetches from GET /api/intelligence/context using the current proposal route.
 */

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { parseRoutePath } from '@/lib/entity/entityId';
import { CollapsibleSection } from './CollapsibleSection';
import { CitedClaim } from './CitedClaim';
import { PanelSkeleton } from './PanelSkeleton';
import type { ContextSynthesisResult } from '@/lib/intelligence/context';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface ProposalPanelProps {
  entityId?: string;
}

function toProposalRef(txHash: string, proposalIndex?: string): string {
  return proposalIndex != null ? `${txHash}#${proposalIndex}` : txHash;
}

function toProposalHref(proposalRef: string): string {
  const [txHash, proposalIndex = '0'] = proposalRef.split('#');
  return `/proposal/${txHash}/${proposalIndex}`;
}

export function ProposalPanel({ entityId }: ProposalPanelProps) {
  const pathname = usePathname();
  const { stakeAddress } = useSegment();
  const routeEntity = parseRoutePath(pathname);
  const proposalRef =
    routeEntity?.type === 'proposal'
      ? toProposalRef(routeEntity.id, routeEntity.secondaryId)
      : entityId;
  const proposalHref = proposalRef ? toProposalHref(proposalRef) : undefined;

  const { data, isLoading, error } = useQuery<ContextSynthesisResult>({
    queryKey: ['intelligence-context', 'proposal', proposalRef, stakeAddress],
    queryFn: async () => {
      const params = new URLSearchParams({ path: pathname });
      if (stakeAddress) params.set('stakeAddress', stakeAddress);
      if (proposalRef) params.set('entityId', proposalRef);
      const res = await fetch(`/api/intelligence/context?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch proposal context');
      return res.json();
    },
    enabled: !!proposalRef,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!proposalRef) {
    return <div className="px-3 py-4 text-xs text-muted-foreground/60">No proposal selected.</div>;
  }

  if (isLoading) return <PanelSkeleton sections={3} />;

  if (error || !data) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground/60">
        Unable to load proposal intelligence.
      </div>
    );
  }

  return (
    <div>
      {/* AI Briefing */}
      {data.briefing && (
        <CollapsibleSection title="Proposal Intelligence" defaultExpanded>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            <CitedClaim
              citations={[
                { label: 'Proposal data', href: proposalHref },
                { label: 'Vote aggregation' },
              ]}
            >
              {data.briefing}
            </CitedClaim>
          </p>
        </CollapsibleSection>
      )}

      {/* Key Metrics */}
      {data.highlights.length > 0 && (
        <CollapsibleSection
          title="Key Metrics"
          summary={data.highlights
            .map((h) => `${h.label}: ${h.value}`)
            .slice(0, 2)
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

      {/* Actions */}
      {data.suggestedActions.length > 0 && (
        <CollapsibleSection title="Next Steps" summary={`${data.suggestedActions.length} actions`}>
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
