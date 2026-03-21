'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicBriefingData {
  epoch: number;
  headline: {
    title: string;
    description: string;
    type?: string;
  } | null;
  epochStats: {
    activeProposals: number;
    totalDReps: number;
    treasuryBalance?: number;
  };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPublicBriefing(): Promise<PublicBriefingData | null> {
  const res = await fetch('/api/briefing/public');
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * IntelligencePreview — Shows one real AI headline from the latest epoch
 * briefing on the anonymous landing page.
 *
 * Gives visitors a free taste of the intelligence layer: a real governance
 * headline derived from on-chain data, with a link to explore further.
 */
export function IntelligencePreview() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-briefing'],
    queryFn: fetchPublicBriefing,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <IntelligencePreviewSkeleton />;
  }

  // Don't render if no headline available
  if (!data?.headline) {
    return null;
  }

  return (
    <Link
      href="/governance/briefing"
      className="block rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-xl p-4 space-y-3 transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary/90 uppercase tracking-wider">
          This week in governance
        </span>
      </div>

      {/* Headline */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground leading-snug">{data.headline.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {data.headline.description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
          Epoch {data.epoch}
        </Badge>
        <span className="text-xs text-primary/80 flex items-center gap-1">
          See the full briefing
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function IntelligencePreviewSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}
