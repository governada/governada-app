'use client';

/**
 * SectionSentimentWidget — Compact sentiment voting widget for constitution section headers.
 *
 * Shows a proportional bar (support/oppose/neutral), total vote count, and a
 * "Weigh in" popover with radio + optional comment for casting a vote.
 * Designed to fit inline in a ConstitutionSection header row.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, Minus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SectionSentiment } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SectionSentimentWidgetProps {
  draftId: string;
  sectionId: string;
  sentiment?: SectionSentiment;
  onVote: (sentiment: 'support' | 'oppose' | 'neutral', comment?: string) => void;
  isVoting?: boolean;
}

// ---------------------------------------------------------------------------
// Proportion bar
// ---------------------------------------------------------------------------

function SentimentBar({ sentiment }: { sentiment: SectionSentiment }) {
  const { support, oppose, neutral, total } = sentiment;
  if (total === 0) return null;

  const supportPct = (support / total) * 100;
  const opposePct = (oppose / total) * 100;
  const neutralPct = (neutral / total) * 100;

  return (
    <div
      className="flex h-1.5 w-16 rounded-full overflow-hidden bg-muted/40"
      title={`${support} support, ${oppose} oppose, ${neutral} neutral`}
    >
      {supportPct > 0 && (
        <div
          className="bg-emerald-500 transition-all duration-300"
          style={{ width: `${supportPct}%` }}
        />
      )}
      {opposePct > 0 && (
        <div
          className="bg-red-500 transition-all duration-300"
          style={{ width: `${opposePct}%` }}
        />
      )}
      {neutralPct > 0 && (
        <div
          className="bg-muted-foreground/30 transition-all duration-300"
          style={{ width: `${neutralPct}%` }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------

export function SectionSentimentWidget({
  draftId: _draftId,
  sectionId: _sectionId,
  sentiment,
  onVote,
  isVoting = false,
}: SectionSentimentWidgetProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<'support' | 'oppose' | 'neutral' | null>(null);
  const [comment, setComment] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const total = sentiment?.total ?? 0;

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSubmit = useCallback(() => {
    if (!selected) return;
    onVote(selected, comment.trim() || undefined);
    setOpen(false);
    setSelected(null);
    setComment('');
  }, [selected, comment, onVote]);

  const CHOICES = [
    { value: 'support' as const, label: 'Support', Icon: ThumbsUp, color: 'text-emerald-400' },
    { value: 'oppose' as const, label: 'Oppose', Icon: ThumbsDown, color: 'text-red-400' },
    { value: 'neutral' as const, label: 'Neutral', Icon: Minus, color: 'text-muted-foreground' },
  ];

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {/* Proportional bar */}
      {sentiment && total > 0 && <SentimentBar sentiment={sentiment} />}

      {/* Vote count badge */}
      {total > 0 && (
        <span className="text-[9px] tabular-nums text-muted-foreground/60 font-medium">
          {total}
        </span>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer',
          'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50',
          open && 'bg-muted/50 text-foreground',
        )}
      >
        Weigh in
        <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 z-50 mt-1.5 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg"
        >
          <p className="text-[11px] font-medium text-foreground mb-2">
            How do you feel about this section?
          </p>

          {/* Radio choices */}
          <div className="space-y-1 mb-2">
            {CHOICES.map(({ value, label, Icon, color }) => (
              <button
                key={value}
                onClick={() => setSelected(value)}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer',
                  selected === value
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center h-4 w-4 rounded-full border',
                    selected === value ? 'border-primary bg-primary' : 'border-border',
                  )}
                >
                  {selected === value && (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <Icon className={cn('h-3 w-3', color)} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Optional comment */}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment..."
            rows={2}
            className="text-xs resize-none mb-2"
            maxLength={2000}
          />

          {/* Submit */}
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!selected || isVoting}
              onClick={handleSubmit}
            >
              {isVoting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
