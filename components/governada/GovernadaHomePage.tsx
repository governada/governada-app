'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { HomeAnonymous } from '@/components/governada/home/HomeAnonymous';
import { HomeCitizen } from '@/components/governada/home/HomeCitizen';
import { HomeDRep } from '@/components/governada/home/HomeDRep';
import { HomeSPO } from '@/components/governada/home/HomeSPO';

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  activeSpOs: number;
  ccMembers: number;
}

interface GovernadaHomePageProps {
  pulseData: PulseData;
  ssrHolderData?: Record<string, unknown>;
  ssrWalletAddress?: string | null;
}

/**
 * Governada home page dispatcher — selects the correct variant based on
 * detected user segment. Renders anonymously until segment is resolved.
 */
export function GovernadaHomePage({
  pulseData,
  ssrHolderData,
  ssrWalletAddress,
}: GovernadaHomePageProps) {
  const { segment, isLoading } = useSegment();

  // While detecting segment, show anonymous hero (avoids layout shift on cold load)
  if (isLoading) {
    return <HomeAnonymous pulseData={pulseData} />;
  }

  switch (segment) {
    case 'drep':
      return <HomeDRep />;

    case 'spo':
      return <HomeSPO />;

    case 'citizen':
    case 'cc':
      return (
        <HomeCitizen
          pulseData={pulseData}
          ssrHolderData={ssrHolderData}
          ssrWalletAddress={ssrWalletAddress}
        />
      );

    case 'anonymous':
    default:
      return <HomeAnonymous pulseData={pulseData} />;
  }
}
