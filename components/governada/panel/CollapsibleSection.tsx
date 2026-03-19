'use client';

/**
 * CollapsibleSection — Arc Browser-style compress/expand section.
 *
 * Sections default to compressed state (one-line summary).
 * Click to expand and see full content.
 * Smooth height animation with reduced-motion fallback.
 */

import { useState, useCallback, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** One-line summary shown in compressed state */
  summary?: string;
  /** Sentiment indicator color */
  sentiment?: 'positive' | 'neutral' | 'negative';
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
  /** Content to show when expanded */
  children: React.ReactNode;
  /** Additional class names for the wrapper */
  className?: string;
}

const SENTIMENT_COLORS = {
  positive: 'bg-emerald-500',
  neutral: 'bg-amber-500',
  negative: 'bg-red-500',
} as const;

export function CollapsibleSection({
  title,
  summary,
  sentiment,
  defaultExpanded = false,
  children,
  className,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const prefersReducedMotion = useReducedMotion();
  const contentId = useId();
  const headerId = useId();

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  return (
    <div className={cn('border-b border-border/10 last:border-b-0', className)}>
      {/* Header — always visible */}
      <button
        id={headerId}
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        className={cn(
          'w-full flex items-center gap-2 py-2 px-3 text-left transition-colors',
          'hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
          'group',
        )}
      >
        {/* Chevron */}
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200',
            expanded && 'rotate-90',
          )}
          aria-hidden="true"
        />

        {/* Sentiment dot */}
        {sentiment && (
          <span
            className={cn('h-1.5 w-1.5 rounded-full shrink-0', SENTIMENT_COLORS[sentiment])}
            aria-hidden="true"
          />
        )}

        {/* Title + summary */}
        <span className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground/80">{title}</span>
          {!expanded && summary && (
            <span className="text-xs text-muted-foreground/60 ml-2 truncate">{summary}</span>
          )}
        </span>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={headerId}
            initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
