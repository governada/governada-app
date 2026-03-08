'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { HomeAnonymous } from '@/components/civica/home/HomeAnonymous';
import { HomeCitizen } from '@/components/civica/home/HomeCitizen';
import { HomeDRep } from '@/components/civica/home/HomeDRep';
import { HomeSPO } from '@/components/civica/home/HomeSPO';

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

interface CivicaHomePageProps {
  pulseData: PulseData;
  ssrHolderData?: Record<string, unknown>;
  ssrWalletAddress?: string | null;
}

/**
 * Civica home page dispatcher — selects the correct variant based on
 * detected user segment. Renders anonymously until segment is resolved.
 */
export function CivicaHomePage({
  pulseData,
  ssrHolderData,
  ssrWalletAddress,
}: CivicaHomePageProps) {
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
