'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { DepthGate } from '@/components/providers/DepthGate';
import { HubCardRenderer } from './HubCardRenderer';
import { AnonymousLanding } from './AnonymousLanding';
import { CitizenHub } from './CitizenHub';
import { HubHero } from './HubHero';
import { HubCardSkeleton } from './cards/HubCard';
import { DRepCockpit } from '@/components/workspace/DRepCockpit';
import { CompetitiveContext } from '@/components/workspace/CompetitiveContext';
import { ProfileShareToolkit } from '@/components/workspace/ProfileShareToolkit';
import { SPOCockpit } from '@/components/workspace/SPOCockpit';
import { ActionQueueCard } from '@/components/governada/ActionQueueCard';
import { useFeatureFlag } from '@/components/FeatureGate';
import { InhabitedConstellation } from './InhabitedConstellation';

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
 * All authenticated personas get the Governance Rings hero.
 * Anonymous: Clean conversion landing page with hero + social proof.
 * Citizen: Hero + onboarding checklist + consequence story Hub.
 * DRep/SPO: Hero + cockpit dashboards.
 * CC: Hero + hub cards.
 */
export function HubHomePage({ pulseData }: HubHomePageProps) {
  const { segment, isLoading, drepId, poolId } = useSegment();
  const globeHomepage = useFeatureFlag('globe_homepage_v2');

  // While detecting segment, show skeleton cards to prevent CLS flash
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-[var(--space-md)] py-[var(--space-lg)]">
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

  // Inhabited Constellation: globe-centric homepage for authenticated users
  if (globeHomepage) {
    return <InhabitedConstellation />;
  }

  // Citizens get the full Browse mode experience
  if (segment === 'citizen') {
    return (
      <>
        <HubHero pulseData={pulseData} />
        <div className="mx-auto w-full max-w-2xl px-[var(--space-md)] space-y-[var(--space-card-gap)]">
          <ActionQueueCard />
        </div>
        <CitizenHub />
      </>
    );
  }

  // DReps get the Governance Cockpit as their homepage
  if (segment === 'drep') {
    return (
      <>
        <HubHero pulseData={pulseData} />
        <div className="mx-auto w-full max-w-2xl px-[var(--space-md)] py-[var(--space-lg)] space-y-[var(--space-lg)]">
          <ActionQueueCard />
          <h2
            className="text-xl font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-governada-display)' }}
          >
            Governance Cockpit
          </h2>
          <DRepCockpit />
          <DepthGate minDepth="engaged">
            <CompetitiveContext />
          </DepthGate>
          <DepthGate minDepth="engaged">
            {drepId && (
              <ProfileShareToolkit
                entityType="drep"
                entityId={drepId}
                entityName="My DRep Profile"
              />
            )}
          </DepthGate>
        </div>
      </>
    );
  }

  // SPOs get their Governance Overview cockpit as homepage
  if (segment === 'spo') {
    return (
      <>
        <HubHero pulseData={pulseData} />
        <div className="mx-auto w-full max-w-2xl px-[var(--space-md)] py-[var(--space-lg)] space-y-[var(--space-lg)]">
          <ActionQueueCard />
          <h2
            className="text-xl font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-governada-display)' }}
          >
            Governance Overview
          </h2>
          <SPOCockpit />
          <DepthGate minDepth="engaged">
            {poolId && (
              <ProfileShareToolkit
                entityType="spo"
                entityId={poolId}
                entityName="My Pool Profile"
              />
            )}
          </DepthGate>
        </div>
      </>
    );
  }

  // CC and other authenticated personas — hero + hub cards
  return (
    <>
      <HubHero pulseData={pulseData} />
      <HubCardRenderer persona={segment} />
    </>
  );
}
