'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useSimilarDReps } from '@/hooks/queries';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/governada/cards/tierStyles';

interface SimilarDRepsProps {
  drepId: string;
}

export function SimilarDReps({ drepId }: SimilarDRepsProps) {
  const { data: raw, isLoading } = useSimilarDReps(drepId);
  const similar: Record<string, unknown>[] =
    ((raw as Record<string, unknown> | undefined)?.similar as Record<string, unknown>[]) ?? [];

  if (isLoading) {
    return (
      <section className="border-t pt-8 mt-8">
        <h3 className="text-lg font-semibold mb-4">Similar DReps</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (similar.length === 0) {
    return (
      <section className="border-t pt-8 mt-8">
        <h3 className="text-lg font-semibold mb-4">Similar DReps</h3>
        <p className="text-sm text-muted-foreground">
          Similar DReps will appear as more representatives provide their governance metadata.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t pt-8 mt-8">
      <h3 className="text-lg font-semibold mb-4">Similar DReps</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {similar.map((d) => {
          const tier = tierKey(computeTier((d.score as number) ?? 0));
          const displayName = (d.name as string) || `${(d.drepId as string).slice(0, 16)}\u2026`;
          return (
            <Link
              key={d.drepId as string}
              href={`/drep/${encodeURIComponent(d.drepId as string)}`}
              className="group flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      TIER_BADGE_BG[tier],
                      TIER_SCORE_COLOR[tier],
                    )}
                  >
                    {d.score as React.ReactNode}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {d.similarity as React.ReactNode}% similar
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
