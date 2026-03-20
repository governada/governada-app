'use client';

/**
 * RelevanceBadge — "Relevant to you" badge for list page items.
 *
 * Shows on proposals/DReps that match the user's alignment profile.
 * Includes a brief reasoning link on hover/expand.
 *
 * Pattern: Spotify "Made for you" indicators — subtle, earned, data-driven.
 */

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeatureFlag } from '@/components/FeatureGate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface RelevanceData {
  /** Relevance score (0-100) */
  score: number;
  /** Brief reason for relevance */
  reason: string;
  /** Link to detailed alignment view */
  href?: string;
}

interface RelevanceBadgeProps {
  relevance: RelevanceData | null | undefined;
  /** Minimum score to show the badge (default: 60) */
  threshold?: number;
  className?: string;
}

export function RelevanceBadge({ relevance, threshold = 60, className }: RelevanceBadgeProps) {
  const flagEnabled = useFeatureFlag('ambient_annotations');
  if (flagEnabled === false || !relevance) return null;
  if (relevance.score < threshold) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              'text-[10px] font-medium',
              'border border-primary/20 bg-primary/5 text-primary/70',
              'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
              className,
            )}
            data-testid="relevance-badge"
          >
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            <span>Relevant to you</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          <p>{relevance.reason}</p>
          <p className="mt-1 text-muted-foreground text-[10px]">
            Match: {relevance.score}% based on your alignment profile
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
