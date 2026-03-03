'use client';

import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { GovernanceInsight } from '@/lib/proposalIntelligence';

interface Props {
  proposalType: string;
}

const TYPE_INSIGHT_MAP: Record<string, string[]> = {
  TreasuryWithdrawals: ['treasury-contested', 'proposal-type-patterns'],
  ParameterChange: ['proposal-type-patterns', 'top-agreement'],
  HardForkInitiation: ['top-agreement', 'late-voting'],
  InfoAction: ['abstention-trend', 'late-voting'],
};

export function ProposalContextInsight({ proposalType }: Props) {
  const [insight, setInsight] = useState<GovernanceInsight | null>(null);

  useEffect(() => {
    const relevantIds = TYPE_INSIGHT_MAP[proposalType] ?? ['top-agreement'];

    fetch('/api/governance/insights')
      .then((r) => (r.ok ? r.json() : []))
      .then((insights: GovernanceInsight[]) => {
        const match = insights.find((i) => relevantIds.includes(i.id));
        if (match) setInsight(match);
      })
      .catch(() => {});
  }, [proposalType]);

  if (!insight) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
      <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-0.5">
          Did you know?
        </p>
        <p className="text-sm text-muted-foreground">{insight.description}</p>
      </div>
    </div>
  );
}
