'use client';

import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type VerdictLevel = 'strong_match' | 'good_option' | 'consider_alternatives';

interface VerdictConfig {
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  icon: typeof CheckCircle2;
}

const VERDICT_CONFIG: Record<VerdictLevel, VerdictConfig> = {
  strong_match: {
    label: 'Strong match',
    color: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-500/5',
    icon: CheckCircle2,
  },
  good_option: {
    label: 'Good option',
    color: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-500/5',
    icon: ThumbsUp,
  },
  consider_alternatives: {
    label: 'Consider alternatives',
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-l-amber-500',
    bgColor: 'bg-amber-500/5',
    icon: AlertTriangle,
  },
};

const VERDICT_ORDER: VerdictLevel[] = ['consider_alternatives', 'good_option', 'strong_match'];

function computeBaseVerdict(score: number, participationRate: number): VerdictLevel {
  if (score >= 70 && participationRate >= 70) return 'strong_match';
  if (score >= 50 && participationRate >= 50) return 'good_option';
  return 'consider_alternatives';
}

function upgradeVerdict(base: VerdictLevel): VerdictLevel {
  const idx = VERDICT_ORDER.indexOf(base);
  const upgraded = Math.min(idx + 1, VERDICT_ORDER.length - 1);
  return VERDICT_ORDER[upgraded];
}

function buildExplanation(
  verdict: VerdictLevel,
  participationRate: number,
  score: number,
  alignmentScore: number | undefined,
  tier: string,
): string {
  const participationDesc =
    participationRate >= 70
      ? 'votes consistently'
      : participationRate >= 50
        ? 'votes regularly'
        : 'has limited voting activity';

  const alignmentNote =
    alignmentScore != null && alignmentScore >= 75
      ? ' Their governance values align well with yours.'
      : alignmentScore != null && alignmentScore >= 50
        ? ' Their governance values partially align with yours.'
        : '';

  if (verdict === 'strong_match') {
    return `This DRep is a strong match. They ${participationDesc} and rank as ${tier}.${alignmentNote}`;
  }
  if (verdict === 'good_option') {
    return `This DRep is a reasonable option. They ${participationDesc} with a score of ${score}.${alignmentNote}`;
  }
  // consider_alternatives
  if (score < 50 && participationRate < 30) {
    return `This DRep has low participation and a below-average score. You may want to explore other representatives.${alignmentNote}`;
  }
  if (participationRate < 30) {
    return `This DRep has limited voting activity, which may affect your representation.${alignmentNote}`;
  }
  return `This DRep scores below average. Consider comparing with other representatives.${alignmentNote}`;
}

export interface AIDelegationVerdictProps {
  drepId: string;
  alignmentScore?: number;
  participationRate: number;
  tier: string;
  score: number;
  rationales: number;
}

export function AIDelegationVerdict({
  drepId: _drepId,
  alignmentScore,
  participationRate,
  tier,
  score,
  rationales: _rationales,
}: AIDelegationVerdictProps) {
  const {
    verdict: _verdict,
    config,
    explanation,
  } = useMemo(() => {
    let base = computeBaseVerdict(score, participationRate);

    // Upgrade if alignment is strong
    if (alignmentScore != null && alignmentScore >= 75) {
      base = upgradeVerdict(base);
    }

    const cfg = VERDICT_CONFIG[base];
    const exp = buildExplanation(base, participationRate, score, alignmentScore, tier);
    return { verdict: base, config: cfg, explanation: exp };
  }, [score, participationRate, alignmentScore, tier]);

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 border border-border p-4',
        config.borderColor,
        config.bgColor,
      )}
      role="region"
      aria-label={`Delegation verdict: ${config.label}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', config.color)} />
        <div className="space-y-1 min-w-0">
          <p className={cn('text-sm font-semibold', config.color)}>{config.label}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>
          {alignmentScore == null && (
            <p className="text-xs text-muted-foreground/70 italic">
              Take the governance quiz to see how well this DRep aligns with your values.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
