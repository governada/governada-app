'use client';

import { CheckCircle2, Clock, AlertTriangle, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReviewQueueItem, QueueItemStatus } from '@/lib/workspace/types';

interface ReviewQueueProps {
  items: ReviewQueueItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  getStatus: (txHash: string, proposalIndex: number) => QueueItemStatus;
  progress: { reviewed: number; total: number };
}

function StatusIndicator({
  status,
  existingVote,
}: {
  status: QueueItemStatus;
  existingVote: string | null;
}) {
  if (status === 'voted' || existingVote) {
    const voteColor =
      existingVote === 'Yes'
        ? 'text-emerald-500'
        : existingVote === 'No'
          ? 'text-rose-500'
          : 'text-muted-foreground';
    return <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', voteColor)} />;
  }
  if (status === 'snoozed') {
    return <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />;
  }
  return null;
}

/**
 * ReviewQueue — left rail (desktop) or horizontal scroll (mobile).
 * Shows all proposals in the queue with visual status indicators.
 */
export function ReviewQueue({
  items,
  selectedIndex,
  onSelect,
  getStatus,
  progress,
}: ReviewQueueProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-3 py-2.5 border-b border-border space-y-1.5 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            {progress.reviewed} of {progress.total} reviewed
          </span>
          <span className="text-muted-foreground tabular-nums">
            {progress.total > 0 ? Math.round((progress.reviewed / progress.total) * 100) : 0}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${progress.total > 0 ? (progress.reviewed / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Desktop: vertical list */}
      <div className="hidden md:block flex-1 overflow-y-auto">
        <div className="py-1">
          {items.map((item, idx) => {
            const status = getStatus(item.txHash, item.proposalIndex);
            const isSelected = idx === selectedIndex;
            const isSnoozed = status === 'snoozed';
            const isVoted = status === 'voted' || !!item.existingVote;

            return (
              <button
                key={`${item.txHash}-${item.proposalIndex}`}
                onClick={() => onSelect(idx)}
                className={cn(
                  'w-full text-left px-3 py-2.5 transition-colors border-l-2',
                  isSelected
                    ? 'bg-accent border-l-primary'
                    : 'border-l-transparent hover:bg-accent/50',
                  isSnoozed && 'opacity-50',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p
                      className={cn(
                        'text-sm truncate',
                        isVoted ? 'text-muted-foreground' : 'font-medium text-foreground',
                      )}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {item.proposalType}
                      </Badge>
                      {item.epochsRemaining !== null && (
                        <span
                          className={cn(
                            'text-[10px] font-medium flex items-center gap-0.5',
                            item.isUrgent
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground',
                          )}
                        >
                          {item.isUrgent && <AlertTriangle className="h-2.5 w-2.5" />}
                          {item.epochsRemaining === 0 ? (
                            'Expires this epoch'
                          ) : (
                            <>
                              <Clock className="h-2.5 w-2.5" />
                              {item.epochsRemaining}e
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusIndicator status={status} existingVote={item.existingVote} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: horizontal scroll pills */}
      <div className="md:hidden overflow-x-auto">
        <div className="flex gap-2 px-3 py-2">
          {items.map((item, idx) => {
            const status = getStatus(item.txHash, item.proposalIndex);
            const isSelected = idx === selectedIndex;
            const isVoted = status === 'voted' || !!item.existingVote;

            return (
              <button
                key={`${item.txHash}-${item.proposalIndex}`}
                onClick={() => onSelect(idx)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs border transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : isVoted
                      ? 'bg-muted text-muted-foreground border-border'
                      : 'bg-background text-foreground border-border hover:border-primary/40',
                  status === 'snoozed' && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-1.5 max-w-[140px]">
                  <span className="truncate">{item.title}</span>
                  {item.isUrgent && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
