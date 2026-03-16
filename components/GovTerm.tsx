'use client';

import { useState, useEffect, useRef } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getGovTerm, getWhyItMatters, type GovTermSegment } from '@/lib/microcopy';
import { useSegment } from '@/components/providers/SegmentProvider';

interface GovTermProps {
  /** Key into GOV_TERMS dictionary */
  term: string;
  /** If provided, overrides the term label as the trigger text */
  children?: React.ReactNode;
  /** Override segment for "why it matters" (defaults to detected segment) */
  segmentOverride?: GovTermSegment;
  className?: string;
}

const STORAGE_PREFIX = 'govterm_views_';
/** Number of times a term must be viewed before the pulsing hint auto-hides */
const AUTO_DISMISS_AFTER = 3;

function getViewCount(term: string): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_PREFIX + term) ?? '0', 10);
  } catch {
    return 0;
  }
}

function incrementViewCount(term: string): number {
  try {
    const next = getViewCount(term) + 1;
    localStorage.setItem(STORAGE_PREFIX + term, String(next));
    return next;
  } catch {
    return 1;
  }
}

/**
 * GovTerm — contextual education tooltip for Cardano governance terminology.
 *
 * - Wraps a trigger (children or the term's label) with a rich tooltip.
 * - Shows a pulsing hint indicator for the first AUTO_DISMISS_AFTER views.
 * - Segment-aware "Why it matters" framing via SegmentProvider.
 */
export function GovTerm({ term, children, segmentOverride, className }: GovTermProps) {
  const def = getGovTerm(term);
  const { segment } = useSegment();
  const effectiveSegment = segmentOverride ?? (segment !== 'anonymous' ? segment : null);

  const [showHint, setShowHint] = useState(false);
  const [open, setOpen] = useState(false);
  const didMount = useRef(false);

  // Determine hint visibility after hydration
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    const count = getViewCount(term);
    setShowHint(count < AUTO_DISMISS_AFTER);
  }, [term]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      const count = incrementViewCount(term);
      if (count >= AUTO_DISMISS_AFTER) {
        setShowHint(false);
      }
    }
  };

  if (!def) {
    return <span className={className}>{children ?? term}</span>;
  }

  const whyItMatters = getWhyItMatters(def, effectiveSegment as GovTermSegment);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 cursor-help',
              'border-b border-dashed border-muted-foreground/50 hover:border-primary/70',
              'transition-colors duration-150',
              className,
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpenChange(!open);
              }
            }}
            aria-label={`Explain: ${def.label}`}
          >
            {children ?? def.label}
            {showHint && (
              <span
                className={cn('relative inline-flex h-1.5 w-1.5 ml-0.5 -mt-1 shrink-0')}
                aria-hidden
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
            )}
          </span>
        </TooltipTrigger>

        <TooltipContent
          side="top"
          className={cn(
            'max-w-xs p-0 bg-popover text-popover-foreground border border-border',
            'shadow-lg rounded-lg overflow-hidden',
          )}
          sideOffset={6}
        >
          <div className="px-3 pt-3 pb-2 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">{def.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{def.definition}</p>
          </div>

          {whyItMatters && (
            <div className="border-t border-border/60 px-3 py-2 bg-muted/30">
              <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-0.5">
                Why it matters
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{whyItMatters}</p>
            </div>
          )}

          <div className="px-3 py-1.5 border-t border-border/40 flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-muted-foreground/70" />
            <span className="text-[10px] text-muted-foreground/70">Governada Glossary</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
