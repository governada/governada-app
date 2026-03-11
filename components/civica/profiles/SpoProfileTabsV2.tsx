'use client';

import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { Vote, BarChart3, Network } from 'lucide-react';
import type { ReactNode } from 'react';

interface SpoProfileTabsV2Props {
  poolId?: string;
  votingRecordContent: ReactNode;
  scoreAnalysisContent: ReactNode;
  alignmentContent: ReactNode;
}

export function SpoProfileTabsV2({
  poolId,
  votingRecordContent,
  scoreAnalysisContent,
  alignmentContent,
}: SpoProfileTabsV2Props) {
  const tabs: TabDefinition[] = [
    { id: 'voting', label: 'Voting Record', icon: Vote, content: votingRecordContent },
    { id: 'score', label: 'Score Analysis', icon: BarChart3, content: scoreAnalysisContent },
    { id: 'alignment', label: 'Governance Alignment', icon: Network, content: alignmentContent },
  ];

  return (
    <AnimatedTabs
      tabs={tabs}
      defaultTab="voting"
      stickyOffset={64}
      trackingContext={poolId ? { poolId } : undefined}
    />
  );
}
