'use client';

import { cn } from '@/lib/utils';
import { TIER_BADGE_BG, type TierKey } from './tierStyles';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Short, citizen-friendly descriptions for each score tier.
 * Displayed in a tooltip when users hover or tap the tier badge.
 */
const TIER_DESCRIPTIONS: Record<TierKey, string> = {
  Emerging: 'New or low-activity participant. Building their governance track record.',
  Bronze: 'Showing early governance engagement with room to grow.',
  Silver: 'Solid contributor with consistent participation and some rationale.',
  Gold: 'Strong governance track record across participation, reliability, and identity.',
  Diamond: 'Top-tier participant with excellent scores across all governance dimensions.',
  Legendary: 'Exceptional — among the very best in the Cardano governance ecosystem.',
};

interface TierBadgeProps {
  tier: TierKey;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-block cursor-help',
              TIER_BADGE_BG[tier],
              className,
            )}
          >
            {tier}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56">
          <p className="font-semibold">{tier} Tier</p>
          <p className="text-[11px] opacity-90">{TIER_DESCRIPTIONS[tier]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
