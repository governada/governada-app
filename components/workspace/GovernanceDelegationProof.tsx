'use client';

interface GovernanceDelegationProofProps {
  /** SPO's governance participation rate as a percentage (0-100) */
  participationRate: number;
  /** Optional governance score for additional context */
  governanceScore?: number;
}

/**
 * GovernanceDelegationProof — Shows SPOs that governance participation drives delegation.
 *
 * Compact insight card with a single stat, one insight, and one line of encouragement.
 * Color-coded framing based on participation level:
 * - High (80%+): green — "Your governance participation puts you ahead"
 * - Medium (50-79%): neutral — stat with room to grow
 * - Low (<50%): amber — "Pools voting regularly attract more delegation"
 */
export function GovernanceDelegationProof({
  participationRate,
  governanceScore,
}: GovernanceDelegationProofProps) {
  const rate = Math.min(100, Math.max(0, participationRate));
  const { borderColor, bgColor, textColor, headline, detail } = getFraming(rate, governanceScore);

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 space-y-1`}>
      <p className={`text-sm font-medium ${textColor}`}>{headline}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
    </div>
  );
}

function getFraming(
  rate: number,
  score?: number,
): {
  borderColor: string;
  bgColor: string;
  textColor: string;
  headline: string;
  detail: string;
} {
  if (rate >= 80) {
    return {
      borderColor: 'border-emerald-500/20',
      bgColor: 'bg-emerald-950/10',
      textColor: 'text-emerald-400',
      headline: 'Your governance participation puts you ahead',
      detail: `Pools that vote on 80%+ of proposals attract more delegation than non-voters. You\u2019re at ${rate}%${score != null ? ` with a governance score of ${score}` : ''} \u2014 keep it up.`,
    };
  }

  if (rate >= 50) {
    return {
      borderColor: 'border-border',
      bgColor: 'bg-card',
      textColor: 'text-foreground',
      headline: 'Governance participation drives delegation growth',
      detail: `Pools voting on 80%+ of proposals attract more delegation. You\u2019re at ${rate}% \u2014 closing the gap.`,
    };
  }

  // Low participation (<50%)
  return {
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-950/10',
    textColor: 'text-amber-400',
    headline: 'Pools voting regularly attract more delegation',
    detail:
      rate === 0
        ? 'Pools that vote on 80%+ of proposals attract more delegation than non-voters. Cast your first vote to start building your governance reputation.'
        : `Pools that vote on 80%+ of proposals attract more delegation. You\u2019re at ${rate}% \u2014 room to grow.`,
  };
}
