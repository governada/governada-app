'use client';

import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { Vote, BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface DRepProfileTabsV2Props {
  drepId?: string;
  votingRecordContent: ReactNode;
  scoreAnalysisContent: ReactNode;
  trajectoryContent: ReactNode;
  communityContent: ReactNode;
  /** Pass statementsContent to show the Statements tab (only when drep_communication flag is on) */
  statementsContent?: ReactNode;
  /**
   * When set (and this DRep is viewing their own profile), shows a "Wrapped ✨" badge
   * near the Voting Record tab header linking to /my-gov/wrapped/[period].
   */
  wrappedAvailablePeriod?: string;
}

/**
 * Civica VP2 tabs — same as DRepProfileTabs but with Phase B "Statements" tab scaffold.
 * The Statements tab is conditionally rendered (caller gates it with drep_communication flag).
 */
export function DRepProfileTabsV2({
  drepId,
  votingRecordContent,
  scoreAnalysisContent,
  trajectoryContent,
  communityContent,
  statementsContent,
  wrappedAvailablePeriod,
}: DRepProfileTabsV2Props) {
  const votingLabel = wrappedAvailablePeriod ? (
    <span className="flex items-center gap-1.5">
      Voting Record
      <Link href={`/my-gov/wrapped/${wrappedAvailablePeriod}`} onClick={(e) => e.stopPropagation()}>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-950/20 hover:bg-amber-950/40 transition-colors"
        >
          Wrapped ✨
        </Badge>
      </Link>
    </span>
  ) : (
    'Voting Record'
  );

  const tabs: TabDefinition[] = [
    {
      id: 'voting',
      label: votingLabel,
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
      label: 'Trajectory',
      icon: TrendingUp,
      content: trajectoryContent,
    },
    {
      id: 'community',
      label: 'Community',
      icon: Users,
      content: communityContent,
    },
    // Phase B scaffold: only shown when drep_communication flag is on
    ...(statementsContent != null
      ? [
          {
            id: 'statements',
            label: 'Statements',
            icon: MessageSquare,
            content: statementsContent,
          } satisfies TabDefinition,
        ]
      : []),
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
