'use client';

import { Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TreasuryImpactChipProps {
  withdrawalAda: number;
  burnRatePerEpoch: number;
  runwayMonths: number;
  size?: 'sm' | 'md';
}

export function TreasuryImpactChip({
  withdrawalAda,
  burnRatePerEpoch,
  runwayMonths,
  size = 'sm',
}: TreasuryImpactChipProps) {
  if (withdrawalAda <= 0 || burnRatePerEpoch <= 0) return null;

  const deltaMonths = Math.round((withdrawalAda / burnRatePerEpoch) * (5 / 30.44));
  if (deltaMonths <= 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full font-mono font-semibold tabular-nums',
              size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1',
              'bg-amber-500/10 text-amber-400 border border-amber-500/20',
            )}
            role="status"
            aria-label={`Treasury runway decreases by approximately ${deltaMonths} months`}
          >
            <Landmark
              className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')}
              aria-hidden="true"
            />
            -{deltaMonths}mo runway
          </span>
        </TooltipTrigger>
        <TooltipContent>
          If enacted, treasury runway decreases by ~{deltaMonths} months
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
