'use client';

/**
 * ScoreExplainer — AI-generated "why" tooltip for score displays.
 *
 * Shows a brief explanation of what's driving a score up or down,
 * with provenance chain linking to source data.
 *
 * Pattern: Perplexity inline annotation — appears as a subtle
 * info marker next to score numbers.
 */

import { Info } from 'lucide-react';
import { AnnotationBase, type ProvenanceStep } from './AnnotationBase';
import { useFeatureFlag } from '@/components/FeatureGate';

export interface ScoreExplanation {
  /** What's driving the score */
  reason: string;
  /** Score trend direction */
  trend: 'improving' | 'declining' | 'stable';
  /** Specific factors */
  factors: ScoreFactor[];
  /** Provenance chain */
  provenance: ProvenanceStep[];
}

export interface ScoreFactor {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

interface ScoreExplainerProps {
  explanation: ScoreExplanation | null | undefined;
  className?: string;
}

export function ScoreExplainer({ explanation, className }: ScoreExplainerProps) {
  const flagEnabled = useFeatureFlag('ambient_annotations');
  if (flagEnabled === false || !explanation) return null;

  const variant =
    explanation.trend === 'improving'
      ? 'success'
      : explanation.trend === 'declining'
        ? 'warning'
        : 'neutral';

  return (
    <AnnotationBase
      icon={<Info className="h-3.5 w-3.5" />}
      text={explanation.reason}
      variant={variant as 'info' | 'warning' | 'success' | 'neutral'}
      provenance={explanation.provenance}
      className={className}
      data-testid="score-explainer-annotation"
    />
  );
}

/**
 * Generate a score explanation from DRep scoring data.
 *
 * Analyzes participation, rationale quality, and score momentum
 * to produce a human-readable explanation.
 */
export function generateScoreExplanation(data: {
  score: number;
  scoreMomentum?: number | null;
  effectiveParticipation?: number | null;
  rationaleRate?: number | null;
  previousScore?: number | null;
}): ScoreExplanation | null {
  const factors: ScoreFactor[] = [];
  const provenance: ProvenanceStep[] = [];
  const reasons: string[] = [];

  // Participation factor
  if (data.effectiveParticipation != null) {
    const pct = Math.round(data.effectiveParticipation);
    if (pct >= 80) {
      factors.push({
        label: 'Participation',
        impact: 'positive',
        detail: `${pct}% voting participation`,
      });
    } else if (pct < 40) {
      factors.push({
        label: 'Participation',
        impact: 'negative',
        detail: `${pct}% voting participation (below 40% threshold)`,
      });
    } else {
      factors.push({
        label: 'Participation',
        impact: 'neutral',
        detail: `${pct}% voting participation`,
      });
    }
    provenance.push({
      label: 'Participation rate',
      detail: `${pct}% of eligible proposals voted on`,
    });
  }

  // Rationale quality factor
  if (data.rationaleRate != null) {
    const rate = Math.round(data.rationaleRate);
    if (rate >= 60) {
      factors.push({
        label: 'Rationale quality',
        impact: 'positive',
        detail: `${rate}% of votes include rationales`,
      });
    } else if (rate < 20) {
      factors.push({
        label: 'Rationale quality',
        impact: 'negative',
        detail: `Only ${rate}% of votes include rationales`,
      });
      reasons.push('adding reasoning to votes would improve the score');
    }
    provenance.push({
      label: 'Rationale coverage',
      detail: `${rate}% of votes have published rationales`,
    });
  }

  // Score momentum
  const trend: ScoreExplanation['trend'] =
    (data.scoreMomentum ?? 0) > 1
      ? 'improving'
      : (data.scoreMomentum ?? 0) < -1
        ? 'declining'
        : 'stable';

  if (data.scoreMomentum != null && Math.abs(data.scoreMomentum) > 0.5) {
    provenance.push({
      label: 'Score trajectory',
      detail: `${data.scoreMomentum > 0 ? '+' : ''}${Math.round(data.scoreMomentum)} point trend`,
    });
  }

  // Build main reason text
  let reason: string;
  const positiveFactors = factors.filter((f) => f.impact === 'positive');
  const negativeFactors = factors.filter((f) => f.impact === 'negative');

  if (trend === 'improving' && positiveFactors.length > 0) {
    reason = `Score improving because ${positiveFactors.map((f) => f.detail.toLowerCase()).join(' and ')}`;
  } else if (trend === 'declining' && negativeFactors.length > 0) {
    reason = `Score declining — ${negativeFactors.map((f) => f.detail.toLowerCase()).join(' and ')}`;
  } else if (reasons.length > 0) {
    reason = `Score at ${data.score}/100 — ${reasons.join(', ')}`;
  } else {
    reason = `Score at ${data.score}/100 based on participation and governance quality metrics`;
  }

  provenance.push({
    label: 'Overall assessment',
    detail: reason,
  });

  return {
    reason,
    trend,
    factors,
    provenance,
  };
}
