'use client';

import { cn } from '@/lib/utils';
import { ClipboardCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProactiveReviewerBadgeProps {
  /** Number of substantive reviews in the qualifying period. */
  reviewCount: number;
  /** Whether this badge is in "coming soon" mode (no data available yet). */
  comingSoon?: boolean;
  className?: string;
}

/**
 * Proactive Reviewer badge — Layer 2 signal (NOT in composite score).
 * Shows on DRep cards and profiles when a DRep has reviewed >= 3
 * proposals substantively in the last 90 days.
 *
 * Currently in "coming soon" state: review data is not yet linked to
 * DRep identities. The badge renders but is only shown when explicitly
 * enabled via feature flag `proactive_governance_badge`.
 */
export function ProactiveReviewerBadge({
  reviewCount,
  comingSoon = false,
  className,
}: ProactiveReviewerBadgeProps) {
  if (comingSoon) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
                'opacity-60 cursor-help',
                className,
              )}
            >
              <ClipboardCheck className="h-2.5 w-2.5" aria-hidden="true" />
              Proactive Reviewer
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-56">
            <p className="font-semibold">Proactive Reviewer</p>
            <p className="text-[11px] opacity-90">
              Coming soon — this badge will highlight DReps who proactively review proposals before
              voting.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (reviewCount < 3) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
              'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
              'cursor-help',
              className,
            )}
          >
            <ClipboardCheck className="h-2.5 w-2.5" aria-hidden="true" />
            Proactive Reviewer
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56">
          <p className="font-semibold">Proactive Reviewer</p>
          <p className="text-[11px] opacity-90">
            This DRep proactively reviews proposals before voting. Reviewed {reviewCount} proposals
            in the last 90 days.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
