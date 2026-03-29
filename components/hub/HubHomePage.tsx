'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { AnonymousLanding } from './AnonymousLanding';
import { HubCardSkeleton } from './cards/HubCard';
import { SynapticHomePage } from '@/components/synaptic/SynapticHomePage';

interface PulseData {
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  totalDelegators: number;
}

interface HubHomePageProps {
  pulseData: PulseData;
  filter?: string;
  entity?: string;
  match?: boolean;
  sort?: string;
}

/**
 * HubHomePage — The home page dispatcher.
 *
 * Anonymous: Clean conversion landing page with globe + social proof.
 * All authenticated: Synaptic Brief — full-viewport constellation with
 * Seneca AI briefing panel.
 *
 * URL params (?filter=, ?entity=, ?match=) are forwarded to both surfaces
 * to enable deep-linking into discovery, entity detail, and match flow.
 */
export function HubHomePage({ pulseData, filter, entity, match, sort }: HubHomePageProps) {
  const { segment, isLoading } = useSegment();

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
    return <AnonymousLanding pulseData={pulseData} filter={filter} entity={entity} match={match} />;
  }

  // All authenticated personas: Synaptic Brief
  return <SynapticHomePage filter={filter} entity={entity} match={match} sort={sort} />;
}
