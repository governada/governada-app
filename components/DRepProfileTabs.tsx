'use client';

import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { Vote, BarChart3, TrendingUp, Users } from 'lucide-react';
import type { ReactNode } from 'react';

interface DRepProfileTabsProps {
  drepId?: string;
  votingRecordContent: ReactNode;
  scoreAnalysisContent: ReactNode;
  trajectoryContent: ReactNode;
  communityContent: ReactNode;
}

export function DRepProfileTabs({
  drepId,
  votingRecordContent,
  scoreAnalysisContent,
  trajectoryContent,
  communityContent,
}: DRepProfileTabsProps) {
  const tabs: TabDefinition[] = [
    {
      id: 'voting',
      label: 'Voting Record',
      icon: Vote,
      content: votingRecordContent,
    },
    {
      id: 'score',
      label: 'Score Analysis',
      icon: BarChart3,
      content: scoreAnalysisContent,
    },
    {
      id: 'trajectory',
      label: 'Alignment Trajectory',
      icon: TrendingUp,
      content: trajectoryContent,
    },
    {
      id: 'community',
      label: 'Community',
      icon: Users,
      content: communityContent,
    },
  ];

  return (
    <AnimatedTabs
      tabs={tabs}
      defaultTab="voting"
      stickyOffset={64}
      trackingContext={drepId ? { drepId } : undefined}
    />
  );
}
