'use client';

import { cn } from '@/lib/utils';

interface StudioQueueProgressProps {
  current: number; // 1-indexed position
  total: number;
  onDotClick?: (index: number) => void;
  labels?: string[]; // Proposal titles for tooltips
  className?: string;
}

export function StudioQueueProgress({
  current,
  total,
  onDotClick,
  labels,
  className,
}: StudioQueueProgressProps) {
  const interactive = !!onDotClick;

  // When total > 10, show abbreviated dots
  const renderAbbreviated = total > 10;

  function renderDot(index: number) {
    const isCurrent = index + 1 === current;
    const isCompleted = index + 1 < current;

    return (
      <button
        key={index}
        type="button"
        onClick={interactive ? () => onDotClick(index) : undefined}
        disabled={!interactive}
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
          interactive && 'cursor-pointer hover:opacity-80',
          !interactive && 'cursor-default',
          isCurrent && 'bg-primary ring-2 ring-primary/30',
          isCompleted && !isCurrent && 'bg-primary',
          !isCompleted && !isCurrent && 'bg-muted-foreground/30',
        )}
        title={labels?.[index] || `Proposal ${index + 1}`}
        aria-label={`Item ${index + 1} of ${total}${isCurrent ? ' (current)' : ''}`}
      />
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {renderAbbreviated ? (
        <>
          {/* First 3 dots */}
          {Array.from({ length: Math.min(3, total) }, (_, i) => renderDot(i))}
          <span className="text-[10px] text-muted-foreground px-0.5">...</span>
          {/* Last 3 dots */}
          {Array.from({ length: Math.min(3, total) }, (_, i) => renderDot(total - 3 + i))}
        </>
      ) : (
        Array.from({ length: total }, (_, i) => renderDot(i))
      )}
      <span className="text-[10px] text-muted-foreground ml-1.5 tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}
