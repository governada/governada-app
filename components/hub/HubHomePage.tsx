'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { DepthGate } from '@/components/providers/DepthGate';
import { HubCardRenderer } from './HubCardRenderer';
import { AnonymousLanding } from './AnonymousLanding';
import { CitizenHub } from './CitizenHub';
import { HubCardSkeleton } from './cards/HubCard';
import { OnboardingChecklist } from '@/components/funnel/OnboardingChecklist';
import { DRepCockpit } from '@/components/workspace/DRepCockpit';
import { CompetitiveContext } from '@/components/workspace/CompetitiveContext';
import { ProfileShareToolkit } from '@/components/workspace/ProfileShareToolkit';
import { SPOCockpit } from '@/components/workspace/SPOCockpit';
import { ActionQueueCard } from '@/components/governada/ActionQueueCard';

interface PulseData {
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
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
  const { segment, isLoading, drepId, poolId } = useSegment();

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
        <div className="mx-auto w-full max-w-2xl px-4 pt-6">
          <ActionQueueCard />
        </div>
        <OnboardingChecklist />
        <CitizenHub />
      </>
    );
  }

  // DReps get the Governance Cockpit as their homepage
  if (segment === 'drep') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        <ActionQueueCard />
        <h1 className="text-xl font-bold text-foreground">Governance Cockpit</h1>
        <DRepCockpit />
        {/* Competitive context — deep only (competitive intelligence) */}
        <DepthGate minDepth="deep">
          <CompetitiveContext />
        </DepthGate>
        {/* Profile sharing — engaged+ (workspace integration) */}
        <DepthGate minDepth="engaged">
          {drepId && (
            <ProfileShareToolkit entityType="drep" entityId={drepId} entityName="My DRep Profile" />
          )}
        </DepthGate>
      </div>
    );
  }

  // SPOs get their Governance Overview cockpit as homepage
  if (segment === 'spo') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        <ActionQueueCard />
        <h1 className="text-xl font-bold text-foreground">Governance Overview</h1>
        <SPOCockpit />
        {/* Profile sharing — engaged+ (workspace integration) */}
        <DepthGate minDepth="engaged">
          {poolId && (
            <ProfileShareToolkit entityType="spo" entityId={poolId} entityName="My Pool Profile" />
          )}
        </DepthGate>
      </div>
    );
  }

  // CC and other authenticated personas — hub cards
  return <HubCardRenderer persona={segment} />;
}
