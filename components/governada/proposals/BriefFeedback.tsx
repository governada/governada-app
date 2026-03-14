'use client';

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSegment } from '@/components/providers/SegmentProvider';
import { cn } from '@/lib/utils';

interface BriefFeedbackProps {
  briefId: string;
  helpfulCount: number;
  notHelpfulCount: number;
}

type FeedbackChoice = 'helpful' | 'not_helpful' | null;

export function BriefFeedback({
  briefId,
  helpfulCount: initialHelpful,
  notHelpfulCount: initialNotHelpful,
}: BriefFeedbackProps) {
  const { segment } = useSegment();
  const [choice, setChoice] = useState<FeedbackChoice>(null);
  const [helpfulCount, setHelpfulCount] = useState(initialHelpful);
  const [notHelpfulCount, setNotHelpfulCount] = useState(initialNotHelpful);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = useCallback(
    async (newChoice: 'helpful' | 'not_helpful') => {
      if (choice !== null || isSubmitting) return;

      // Optimistic update
      setChoice(newChoice);
      if (newChoice === 'helpful') {
        setHelpfulCount((c) => c + 1);
      } else {
        setNotHelpfulCount((c) => c + 1);
      }

      setIsSubmitting(true);

      try {
        const res = await fetch('/api/proposal/brief/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            briefId,
            feedback: newChoice,
          }),
        });

        if (!res.ok) {
          // Revert optimistic update on failure
          setChoice(null);
          if (newChoice === 'helpful') {
            setHelpfulCount((c) => c - 1);
          } else {
            setNotHelpfulCount((c) => c - 1);
          }
        }
      } catch {
        // Revert optimistic update
        setChoice(null);
        if (newChoice === 'helpful') {
          setHelpfulCount((c) => c - 1);
        } else {
          setNotHelpfulCount((c) => c - 1);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [briefId, choice, isSubmitting],
  );

  // Only show for authenticated users
  if (segment === 'anonymous') return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-3 border-t border-border/30">
      <span className="text-xs text-muted-foreground">Was this brief helpful?</span>

      <Button
        variant="ghost"
        size="sm"
        disabled={choice !== null}
        onClick={() => handleFeedback('helpful')}
        className={cn(
          'h-8 gap-1.5 text-xs',
          choice === 'helpful' && 'text-emerald-500 bg-emerald-500/10',
        )}
        aria-label="Helpful"
      >
        <ThumbsUp className={cn('h-3.5 w-3.5', choice === 'helpful' && 'fill-current')} />
        {helpfulCount > 0 && <span className="tabular-nums">{helpfulCount}</span>}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={choice !== null}
        onClick={() => handleFeedback('not_helpful')}
        className={cn(
          'h-8 gap-1.5 text-xs',
          choice === 'not_helpful' && 'text-red-500 bg-red-500/10',
        )}
        aria-label="Not helpful"
      >
        <ThumbsDown className={cn('h-3.5 w-3.5', choice === 'not_helpful' && 'fill-current')} />
        {notHelpfulCount > 0 && <span className="tabular-nums">{notHelpfulCount}</span>}
      </Button>
    </div>
  );
}
