'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { HubCardRenderer } from './HubCardRenderer';
import { AnonymousLanding } from './AnonymousLanding';

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

interface HubHomePageProps {
  pulseData: PulseData;
}

/**
 * HubHomePage — The new home page dispatcher.
 *
 * Anonymous: Clean conversion landing page.
 * Authenticated: Hub card renderer based on persona.
 *
 * The citizen Hub should feel like opening Apple Health —
 * one glance tells you everything is fine (or what needs attention).
 */
export function HubHomePage({ pulseData }: HubHomePageProps) {
  const { segment, isLoading } = useSegment();

  // While detecting segment, show anonymous landing (avoids layout shift)
  if (isLoading || segment === 'anonymous') {
    return <AnonymousLanding pulseData={pulseData} />;
  }

  return <HubCardRenderer persona={segment} />;
}
