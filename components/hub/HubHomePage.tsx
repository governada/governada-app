'use client';

import { GlobeLayout } from '@/components/globe/GlobeLayout';

interface HubHomePageProps {
  pulseData: {
    activeProposals: number;
    activeDReps: number;
    totalDReps: number;
    totalDelegators: number;
  };
  filter?: string;
  entity?: string;
  match?: boolean;
  sort?: string;
}

/**
 * HubHomePage — Renders the unified globe homepage for all users.
 *
 * Both anonymous and authenticated users see the same full-viewport
 * interactive constellation. Seneca (AI companion) is provided by
 * GovernadaShell and adapts per persona.
 */
export function HubHomePage({ filter, entity, match, sort }: HubHomePageProps) {
  return (
    <GlobeLayout
      initialFilter={filter}
      initialEntity={entity}
      initialMatch={match}
      initialSort={sort}
    />
  );
}
