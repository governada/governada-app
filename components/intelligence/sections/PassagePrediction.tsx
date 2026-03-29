'use client';

/**
 * PassagePrediction — visual passage probability gauge with factor breakdown.
 *
 * Renders pre-computed passage prediction data from the intelligence cache.
 * Color-coded: green >70%, amber 40-70%, red <40%.
 * Expandable factor table shows what's driving the prediction.
 */

import { useState, useEffect } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';

interface PassageFactor {
  name: string;
  weight: number;
  value: number;
  direction: 'positive' | 'negative' | 'neutral';
}

interface PassagePredictionProps {
  prediction: {
    probability: number;
    confidence: 'low' | 'medium' | 'high';
    factors: PassageFactor[];
    computedAt: string;
  } | null;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  low: 'Low confidence (few votes)',
  medium: 'Moderate confidence',
  high: 'High confidence',
};

const DIRECTION_ICONS = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
} as const;

export function PassagePrediction({ prediction }: PassagePredictionProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (prediction) {
      posthog.capture('passage_prediction_viewed', {
        probability: prediction.probability,
        confidence: prediction.confidence,
      });
    }
  }, [prediction]);

  if (!prediction) {
    return (
      <p className="text-xs text-muted-foreground/60 py-1">Passage prediction not yet computed</p>
    );
  }

  const { probability, confidence, factors } = prediction;

  const color =
    probability >= 70 ? 'text-emerald-400' : probability >= 40 ? 'text-amber-400' : 'text-red-400';
  const bgColor =
    probability >= 70 ? 'bg-emerald-400' : probability >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const trackColor =
    probability >= 70
      ? 'bg-emerald-400/15'
      : probability >= 40
        ? 'bg-amber-400/15'
        : 'bg-red-400/15';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-lg font-semibold tabular-nums', color)}>{probability}%</span>
            <span className="text-[10px] text-muted-foreground">passage probability</span>
          </div>
          <div className={cn('h-1.5 rounded-full w-full', trackColor)}>
            <div
              className={cn('h-full rounded-full transition-all duration-500', bgColor)}
              style={{ width: `${probability}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            confidence === 'high'
              ? 'bg-emerald-400'
              : confidence === 'medium'
                ? 'bg-amber-400'
                : 'bg-muted-foreground/40',
          )}
        />
        {CONFIDENCE_LABELS[confidence]}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
        {expanded ? 'Hide' : 'Show'} factors
      </button>

      {expanded && (
        <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {factors.map((factor) => {
            const Icon = DIRECTION_ICONS[factor.direction];
            return (
              <div key={factor.name} className="flex items-center gap-2 text-[10px] py-0.5">
                <Icon
                  className={cn(
                    'h-3 w-3 shrink-0',
                    factor.direction === 'positive' && 'text-emerald-400',
                    factor.direction === 'negative' && 'text-red-400',
                    factor.direction === 'neutral' && 'text-muted-foreground/50',
                  )}
                />
                <span className="flex-1 text-muted-foreground">{factor.name}</span>
                <span className="tabular-nums text-foreground/70">
                  {Math.round(factor.value * 100)}%
                </span>
                <span className="text-muted-foreground/40 tabular-nums w-8 text-right">
                  ×{factor.weight}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
