'use client';

import { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import {
  matchProposalToInterests,
  type ProposalDimensions,
  type UserInterestProfile,
} from '@/lib/notifications/proposalAlerts';

interface ProposalAlertBadgeProps {
  /** Proposal classification dimensions (from proposal_classifications table). */
  proposalDimensions: ProposalDimensions | null;
  /** User's interest profile (derived from their alignment scores). */
  userProfile: UserInterestProfile | null;
  /** Whether the user has enabled interest matching. */
  enabled?: boolean;
}

/**
 * ProposalAlertBadge — small inline badge on ReviewQueue items that
 * match the user's interests.
 *
 * - High relevance (>70): gold star
 * - Medium relevance (40-70): silver star
 * - Low (<40): no badge
 */
export function ProposalAlertBadge({
  proposalDimensions,
  userProfile,
  enabled = true,
}: ProposalAlertBadgeProps) {
  const hasTracked = useRef(false);

  // Don't render if disabled, missing data, or dimensions are all zero
  const shouldCompute = enabled && proposalDimensions && userProfile;

  const match = shouldCompute ? matchProposalToInterests(proposalDimensions, userProfile) : null;

  const isHigh = match && match.relevanceScore > 70;
  const isMedium = match && match.relevanceScore > 40 && match.relevanceScore <= 70;
  const showBadge = isHigh || isMedium;

  // Track first render of a matched badge (once)
  useEffect(() => {
    if (showBadge && match && !hasTracked.current) {
      hasTracked.current = true;
      posthog.capture('proposal_alert_matched', {
        relevance_score: match.relevanceScore,
        matching_dimensions: match.matchingDimensions,
        tier: isHigh ? 'high' : 'medium',
      });
    }
  }, [showBadge, match, isHigh]);

  if (!showBadge || !match) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[9px] font-medium shrink-0',
        isHigh ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground/70',
      )}
      title={match.suggestedAlertText}
    >
      <Star
        className={cn(
          'h-2.5 w-2.5',
          isHigh ? 'fill-amber-500 dark:fill-amber-400' : 'fill-muted-foreground/40',
        )}
      />
    </span>
  );
}
