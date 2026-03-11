'use client';

import { useSearchParams } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { HubCardRenderer } from './HubCardRenderer';
import { AnonymousLanding } from './AnonymousLanding';
import { HubCardSkeleton } from './cards/HubCard';
import { ConstellationScene } from '@/components/ConstellationScene';

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
 * Background exploration: use ?bg=globe or ?bg=gradient to compare styles.
 * Remove the exploration code once a decision is made.
 */
export function HubHomePage({ pulseData }: HubHomePageProps) {
  const { segment, isLoading } = useSegment();
  const searchParams = useSearchParams();
  const bgMode = searchParams.get('bg');

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

  // Authenticated homepage — optional background exploration
  if (bgMode === 'globe') {
    return (
      <div className="relative min-h-[calc(100vh-4rem)]">
        {/* Globe offset past sidebar: left-0 mobile, left-60 desktop (sidebar w-60) */}
        <div className="fixed top-14 bottom-0 left-0 right-0 sm:left-60 pointer-events-none opacity-25">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>
        <div className="relative z-10">
          <HubCardRenderer persona={segment} />
        </div>
      </div>
    );
  }

  if (bgMode === 'gradient') {
    return (
      <div className="relative min-h-[calc(100vh-4rem)]">
        {/* Aurora gradient offset past sidebar */}
        <div className="fixed top-14 bottom-0 left-0 right-0 sm:left-60 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 animate-[spin_120s_linear_infinite]">
            <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-primary/30 blur-[150px]" />
            <div className="absolute top-[40%] right-[10%] w-[450px] h-[450px] rounded-full bg-emerald-500/25 blur-[130px]" />
            <div className="absolute bottom-[5%] left-[30%] w-[400px] h-[400px] rounded-full bg-violet-500/20 blur-[130px]" />
          </div>
        </div>
        <div className="relative z-10">
          <HubCardRenderer persona={segment} />
        </div>
      </div>
    );
  }

  // Default — no background (current behavior)
  return <HubCardRenderer persona={segment} />;
}
