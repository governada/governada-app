'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { ConfidenceBar } from './ConfidenceBar';
import { Dna } from 'lucide-react';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { ConfidenceSource } from '@/lib/matching/confidence';

interface GovernanceIdentityCardProps {
  personalityLabel: string | null;
  votesUsed: number;
  confidence: number;
  alignmentScores: Record<string, number | null> | null;
  /** Progressive confidence source breakdown (optional, enhances display) */
  confidenceSources?: ConfidenceSource[] | null;
}

export function GovernanceIdentityCard({
  personalityLabel,
  votesUsed,
  confidence,
  alignmentScores,
  confidenceSources,
}: GovernanceIdentityCardProps) {
  if (!alignmentScores || !personalityLabel) return null;

  const scores = alignmentScores as unknown as AlignmentScores;
  const hasValues = Object.values(scores).some((v) => v !== null);
  if (!hasValues) return null;

  const hasSources = confidenceSources && confidenceSources.length > 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <GovernanceRadar alignments={scores} size="mini" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <Dna className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">Your governance identity</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {personalityLabel}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {votesUsed} vote{votesUsed !== 1 ? 's' : ''} · {confidence}% confidence
              </span>
            </div>
            {hasSources ? (
              <ConfidenceBar confidence={confidence} sources={confidenceSources} expandable />
            ) : (
              <ConfidenceBar votesUsed={votesUsed} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
