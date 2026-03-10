'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { HubCardRenderer } from './HubCardRenderer';
import { AnonymousLanding } from './AnonymousLanding';
import { HubCardSkeleton } from './cards/HubCard';

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

  // While detecting segment, show skeleton cards to prevent CLS flash
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">
        <HubCardSkeleton />
        <HubCardSkeleton />
        <HubCardSkeleton />
        <HubCardSkeleton />
      </div>
    );
  }

  if (segment === 'anonymous') {
    return <AnonymousLanding pulseData={pulseData} />;
  }

  return <HubCardRenderer persona={segment} />;
}
