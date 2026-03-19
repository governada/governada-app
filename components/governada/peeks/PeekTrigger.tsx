'use client';

/**
 * PeekTrigger — subtle eye icon that appears on hover to open the peek drawer.
 *
 * Place this inside entity cards/rows. It stops click propagation so
 * the parent Link doesn't navigate.
 */

import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PeekTriggerProps {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  ariaLabel?: string;
}

export function PeekTrigger({ onClick, className, ariaLabel }: PeekTriggerProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        'p-1.5 rounded-md transition-all duration-150',
        'text-muted-foreground/50 hover:text-foreground hover:bg-muted/50',
        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'shrink-0',
        className,
      )}
      aria-label={ariaLabel ?? 'Preview'}
      title="Quick preview"
    >
      <Eye className="h-3.5 w-3.5" />
    </button>
  );
}
