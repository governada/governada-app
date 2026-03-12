'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { HubCardRenderer } from './HubCardRenderer';
import { AnonymousLanding } from './AnonymousLanding';
import { CitizenHub } from './CitizenHub';
import { HubCardSkeleton } from './cards/HubCard';
import { OnboardingChecklist } from '@/components/funnel/OnboardingChecklist';

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  activeSpOs: number;
  ccMembers: number;
  totalDelegators: number;
}

interface HubHomePageProps {
  pulseData: PulseData;
}

/**
 * HubHomePage — The home page dispatcher.
 *
 * Anonymous: Clean conversion landing page with social proof.
 * Citizen: Onboarding checklist + consequence story Hub.
 * Other personas: Hub cards over constellation globe.
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

  // Citizens get the onboarding checklist + consequence story Hub
  if (segment === 'citizen') {
    return (
      <>
        <OnboardingChecklist />
        <CitizenHub />
      </>
    );
  }

  // Other authenticated personas — globe provided by CivicaShell, cards float on glass
  return <HubCardRenderer persona={segment} />;
}
