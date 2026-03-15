'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, ChevronDown, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCCPredictions } from '@/hooks/queries';
import type { CCPrediction } from '@/hooks/queries';
import { fadeInUp, staggerContainer } from '@/lib/animations';

// ---------------------------------------------------------------------------
// Outcome styling
// ---------------------------------------------------------------------------

const OUTCOME_CONFIG: Record<string, { label: string; class: string }> = {
  approve: {
    label: 'Approve',
    class: 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10',
  },
  reject: {
    label: 'Reject',
    class: 'text-rose-500 border-rose-500/40 bg-rose-500/10',
  },
  split: {
    label: 'Split',
    class: 'text-amber-500 border-amber-500/40 bg-amber-500/10',
  },
};

function confidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-emerald-500';
  if (confidence >= 50) return 'text-amber-500';
  return 'text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Vote Split Circles — 7 small dots showing predicted member votes
// ---------------------------------------------------------------------------

function VoteSplitDots({ split }: { split: Record<string, string[]> | null }) {
  if (!split) return null;
  const yes = split.yes ?? [];
  const no = split.no ?? [];
  const uncertain = split.uncertain ?? [];
  const total = yes.length + no.length + uncertain.length;
  if (total === 0) return null;

  return (
    <div
      className="flex items-center gap-0.5"
      title={`${yes.length} Yes, ${no.length} No, ${uncertain.length} Uncertain`}
    >
      {yes.map((_, i) => (
        <span key={`y-${i}`} className="h-2 w-2 rounded-full bg-emerald-500" />
      ))}
      {no.map((_, i) => (
        <span key={`n-${i}`} className="h-2 w-2 rounded-full bg-rose-500" />
      ))}
      {uncertain.map((_, i) => (
        <span key={`u-${i}`} className="h-2 w-2 rounded-full bg-muted-foreground/40" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prediction Card
// ---------------------------------------------------------------------------

function PredictionCard({ prediction }: { prediction: CCPrediction }) {
  const [expanded, setExpanded] = useState(false);
  const outcome = OUTCOME_CONFIG[prediction.predictedOutcome] ?? OUTCOME_CONFIG.split;
  const displayTitle = prediction.proposalTitle ?? `${prediction.proposalTxHash.slice(0, 16)}…`;

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
      >
        {/* Outcome badge */}
        <Badge variant="outline" className={cn('shrink-0', outcome.class)}>
          {outcome.label}
        </Badge>

        {/* Proposal title + split dots */}
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={`/proposal/${prediction.proposalTxHash}/${prediction.proposalIndex}`}
            className="text-sm font-medium truncate block hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {displayTitle}
          </Link>
          <div className="flex items-center gap-2">
            <VoteSplitDots split={prediction.predictedSplit} />
            {prediction.proposalType && (
              <span className="text-[10px] text-muted-foreground">{prediction.proposalType}</span>
            )}
          </div>
        </div>

        {/* Confidence */}
        <span
          className={cn(
            'shrink-0 font-mono text-xs tabular-nums',
            confidenceColor(prediction.confidence),
          )}
        >
          {prediction.confidence}%
        </span>

        {/* Tension flag */}
        {prediction.tensionFlag && (
          <span title="CC-DRep tension predicted">
            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          </span>
        )}

        {/* Expand */}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform shrink-0',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-3 space-y-2">
          {prediction.reasoning && (
            <p className="text-xs text-muted-foreground leading-relaxed">{prediction.reasoning}</p>
          )}
          {prediction.keyArticle && (
            <p className="text-[10px] text-muted-foreground">
              Key article:{' '}
              <span className="font-medium text-foreground">{prediction.keyArticle}</span>
            </p>
          )}
          {prediction.tensionFlag && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              Predicted CC outcome diverges from likely DRep majority
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CCPredictions() {
  const { data, isLoading } = useCCPredictions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        <div className="h-20 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  const predictions = data?.predictions ?? [];
  const accuracy = data?.accuracy;

  // Don't show until we have at least some predictions
  if (predictions.length === 0) return null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Target className="h-4 w-4" />
          Predicted CC Votes
        </h2>
        {accuracy && accuracy.totalPredictions > 0 && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <TrendingUp className="h-3 w-3" />
            {accuracy.accuracyPct != null ? `${accuracy.accuracyPct}% accurate` : '—'} on{' '}
            {accuracy.totalPredictions} prediction{accuracy.totalPredictions !== 1 ? 's' : ''}
          </Badge>
        )}
      </motion.div>

      {/* Prediction cards */}
      <motion.div variants={fadeInUp} className="space-y-2">
        {predictions.map((p) => (
          <PredictionCard key={`${p.proposalTxHash}-${p.proposalIndex}`} prediction={p} />
        ))}
      </motion.div>

      {/* Disclaimer */}
      <motion.p variants={fadeInUp} className="text-[10px] text-muted-foreground/60">
        Predictions based on historical voting patterns and constitutional interpretation analysis.
        Confidence reflects data availability, not certainty.
      </motion.p>
    </motion.div>
  );
}
