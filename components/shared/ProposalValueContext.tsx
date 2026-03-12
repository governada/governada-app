'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { ProposalHistoricalContext } from '@/lib/proposalContext';

interface ProposalValueContextProps {
  txHash: string;
  proposalIndex: number;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

const VALUE_TYPE_COLORS: Record<string, string> = {
  infrastructure: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  ecosystem: 'text-green-400 bg-green-500/10 border-green-500/20',
  'direct-utility': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  governance: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

async function fetchContext(txHash: string, index: number) {
  const res = await fetch(`/api/proposal/context?txHash=${txHash}&index=${index}`);
  if (!res.ok) return null;
  return res.json() as Promise<ProposalHistoricalContext>;
}

export function ProposalValueContext({ txHash, proposalIndex }: ProposalValueContextProps) {
  const { data: ctx, isLoading } = useQuery({
    queryKey: ['proposal-context', txHash, proposalIndex],
    queryFn: () => fetchContext(txHash, proposalIndex),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading || !ctx) return null;

  const {
    amountPercentile,
    medianWithdrawalAda,
    totalTreasuryProposals,
    similarOutcomes,
    valueType,
  } = ctx;
  const colorCls = VALUE_TYPE_COLORS[valueType.type] || VALUE_TYPE_COLORS.infrastructure;

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
      {/* Value Type Badge + Description */}
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5',
            colorCls,
          )}
        >
          {valueType.label}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground leading-relaxed cursor-help inline-flex items-center gap-1">
                {valueType.description}
                <Info className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs font-medium">{valueType.evaluationLens}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Historical Comparison */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {totalTreasuryProposals > 1 && (
          <span>
            Larger than <span className="font-medium text-foreground">{amountPercentile}%</span> of
            treasury withdrawals
            <span className="ml-1">(median: ₳{formatAda(medianWithdrawalAda)})</span>
          </span>
        )}

        {similarOutcomes && similarOutcomes.enactedCount > 0 && (
          <span>
            {similarOutcomes.enactedCount} similar enacted →{' '}
            <span className="font-medium text-foreground">
              {similarOutcomes.deliveredCount} delivered
            </span>
            {similarOutcomes.partialCount > 0 && `, ${similarOutcomes.partialCount} partial`}
            {similarOutcomes.inProgressCount > 0 &&
              `, ${similarOutcomes.inProgressCount} in progress`}
            {similarOutcomes.avgDeliveryScore != null && (
              <span className="ml-1">(avg score: {similarOutcomes.avgDeliveryScore}/100)</span>
            )}
          </span>
        )}

        {similarOutcomes &&
          similarOutcomes.enactedCount === 0 &&
          similarOutcomes.totalSimilar > 0 && (
            <span>{similarOutcomes.totalSimilar} similar proposals found — none enacted yet</span>
          )}

        {!similarOutcomes && totalTreasuryProposals <= 1 && (
          <span>One of the first proposals in this category</span>
        )}
      </div>
    </div>
  );
}
