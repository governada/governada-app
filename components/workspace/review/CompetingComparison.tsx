'use client';

/**
 * CompetingComparison — side-by-side comparison when 2+ proposals of the
 * same type are active simultaneously.
 *
 * Shows in the intelligence section of ReviewBrief. Compares:
 * - Title
 * - Amount (for treasury proposals)
 * - Community sentiment score
 * - Constitutional check status
 * - Existing vote tallies
 */

import { useEffect } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReviewQueueItem } from '@/lib/workspace/types';

interface CompetingComparisonProps {
  currentItem: ReviewQueueItem;
  allItems: ReviewQueueItem[];
}

function getSentimentScore(item: ReviewQueueItem): number | null {
  if (!item.citizenSentiment || item.citizenSentiment.total === 0) return null;
  return Math.round((item.citizenSentiment.support / item.citizenSentiment.total) * 100);
}

function getDRepSupport(item: ReviewQueueItem): number {
  const drep = item.interBodyVotes.drep;
  const total = drep.yes + drep.no + drep.abstain;
  if (total === 0) return 0;
  return Math.round((drep.yes / total) * 100);
}

export function CompetingComparison({ currentItem, allItems }: CompetingComparisonProps) {
  const competitors = allItems.filter(
    (item) =>
      item.proposalType === currentItem.proposalType &&
      !(item.txHash === currentItem.txHash && item.proposalIndex === currentItem.proposalIndex),
  );

  // Track view event
  useEffect(() => {
    if (competitors.length === 0) return;
    import('@/lib/posthog')
      .then(({ posthog }) => {
        posthog.capture('review_comparison_viewed', {
          proposal_tx_hash: currentItem.txHash,
          proposal_index: currentItem.proposalIndex,
          competitor_count: competitors.length,
        });
      })
      .catch(() => {});
    // Only fire once per proposal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem.txHash, currentItem.proposalIndex]);

  // Only show when there are competitors
  if (competitors.length === 0) return null;

  // Show up to 3 competitors
  const shown = competitors.slice(0, 3);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium">Competing Proposals</span>
          <span className="text-xs text-muted-foreground">
            ({competitors.length} of same type active)
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left font-medium text-muted-foreground pb-2 pr-3 min-w-[120px]">
                  Proposal
                </th>
                {currentItem.proposalType === 'TreasuryWithdrawals' && (
                  <th className="text-right font-medium text-muted-foreground pb-2 px-2 whitespace-nowrap">
                    Amount
                  </th>
                )}
                <th className="text-right font-medium text-muted-foreground pb-2 px-2 whitespace-nowrap">
                  DRep Support
                </th>
                <th className="text-right font-medium text-muted-foreground pb-2 pl-2 whitespace-nowrap">
                  Citizen
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Current proposal row */}
              <ComparisonRow item={currentItem} isCurrent />
              {/* Competitor rows */}
              {shown.map((item) => (
                <ComparisonRow
                  key={`${item.txHash}-${item.proposalIndex}`}
                  item={item}
                  isCurrent={false}
                />
              ))}
            </tbody>
          </table>
        </div>

        {competitors.length > 3 && (
          <p className="text-[10px] text-muted-foreground text-center">
            +{competitors.length - 3} more competing proposals
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonRow({ item, isCurrent }: { item: ReviewQueueItem; isCurrent: boolean }) {
  const sentimentScore = getSentimentScore(item);
  const drepSupport = getDRepSupport(item);
  const isTreasury = item.proposalType === 'TreasuryWithdrawals';

  return (
    <tr className={cn('border-b border-border/20 last:border-0', isCurrent && 'bg-primary/5')}>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCurrent && (
            <Badge
              variant="outline"
              className="text-[8px] px-1 py-0 shrink-0 border-primary/40 text-primary"
            >
              Current
            </Badge>
          )}
          <span className={cn('truncate max-w-[160px]', isCurrent && 'font-medium')}>
            {item.title || 'Untitled'}
          </span>
        </div>
      </td>
      {isTreasury && (
        <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
          {item.withdrawalAmount != null
            ? `${(item.withdrawalAmount / 1_000_000).toLocaleString()} ADA`
            : '--'}
        </td>
      )}
      <td className="py-2 px-2 text-right">
        <span
          className={cn(
            'tabular-nums',
            drepSupport >= 60
              ? 'text-emerald-600 dark:text-emerald-400'
              : drepSupport <= 40
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground',
          )}
        >
          {drepSupport}%
        </span>
      </td>
      <td className="py-2 pl-2 text-right">
        {sentimentScore != null ? (
          <span
            className={cn(
              'tabular-nums',
              sentimentScore >= 60
                ? 'text-emerald-600 dark:text-emerald-400'
                : sentimentScore <= 40
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-muted-foreground',
            )}
          >
            {sentimentScore}%
          </span>
        ) : (
          <span className="text-muted-foreground/50">--</span>
        )}
      </td>
    </tr>
  );
}
