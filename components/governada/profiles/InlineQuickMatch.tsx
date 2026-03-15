'use client';

import { useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { usePostHog } from 'posthog-js/react';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { useQuickMatch } from '@/hooks/useQuickMatch';

/* ─── Types ─────────────────────────────────────────────── */

interface InlineQuickMatchProps {
  drepName: string;
  drepId: string;
  onMatchComplete: (alignment: AlignmentScores) => void;
  className?: string;
}

/* ─── Question definitions (compact) ────────────────────── */

interface InlineQuestion {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

const INLINE_QUESTIONS: InlineQuestion[] = [
  {
    id: 'treasury',
    label: 'Treasury management',
    options: [
      { value: 'conservative', label: 'Conservative' },
      { value: 'growth', label: 'Growth' },
      { value: 'balanced', label: 'Balanced' },
    ],
  },
  {
    id: 'protocol',
    label: 'Protocol changes should prioritize...',
    options: [
      { value: 'caution', label: 'Caution' },
      { value: 'innovation', label: 'Innovation' },
      { value: 'case_by_case', label: 'Case by case' },
    ],
  },
  {
    id: 'transparency',
    label: 'How important is DRep transparency?',
    options: [
      { value: 'essential', label: 'Essential' },
      { value: 'nice_to_have', label: 'Nice to have' },
      { value: 'doesnt_matter', label: "Doesn't matter" },
    ],
  },
  {
    id: 'decentralization',
    label: 'Voting power distribution',
    options: [
      { value: 'spread_widely', label: 'Spread widely' },
      { value: 'concentrated', label: 'Concentrated' },
      { value: 'current_fine', label: 'Current is fine' },
    ],
  },
];

/* ─── Component ─────────────────────────────────────────── */

export function InlineQuickMatch({
  drepName,
  drepId,
  onMatchComplete,
  className,
}: InlineQuickMatchProps) {
  const posthog = usePostHog();

  const { state, setAnswer, submit } = useQuickMatch({
    drepId,
    onComplete: (drepResult) => {
      posthog?.capture('quick_match_completed_inline', {
        source: 'drep_profile',
        drepId,
      });
      onMatchComplete(drepResult.userAlignments);
    },
  });

  const handleSubmit = useCallback(() => {
    submit();
  }, [submit]);

  return (
    <Card className={cn('border-border/50 bg-card/50', className)}>
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <p className="text-sm font-medium text-foreground">
          See how <span className="text-primary font-semibold">{drepName}</span> aligns with your
          governance values
        </p>

        {/* Questions */}
        <div className="space-y-4">
          {INLINE_QUESTIONS.map((q) => (
            <InlineQuestionRow
              key={q.id}
              question={q}
              selected={state.answers[q.id as keyof typeof state.answers] ?? null}
              onSelect={(value) => setAnswer(q.id, value)}
              disabled={state.isSubmitting}
            />
          ))}
        </div>

        {/* Error */}
        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!state.isComplete || state.isSubmitting}
          className="w-full"
          size="sm"
        >
          {state.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating alignment...
            </>
          ) : (
            <>See my alignment with {drepName} &rarr;</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Question row ──────────────────────────────────────── */

function InlineQuestionRow({
  question,
  selected,
  onSelect,
  disabled,
}: {
  question: InlineQuestion;
  selected: string | null;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-xs font-medium text-muted-foreground">{question.label}</legend>
      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={isSelected}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
