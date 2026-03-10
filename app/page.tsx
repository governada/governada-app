import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { PageViewTracker } from '@/components/PageViewTracker';
import { HubHomePage } from '@/components/hub/HubHomePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governada — Cardano Governance Intelligence',
  description:
    'Cardano has a government. Know who represents you. Find your DRep, track governance proposals, and participate in on-chain democracy.',
  openGraph: {
    title: 'Governada — Cardano Governance Intelligence',
    description:
      'Know who represents your ADA in Cardano governance. Discover DReps, track proposals, and take action.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Cardano Governance Intelligence',
    description: 'Cardano has a government. Know who represents you.',
  },
};

/**
 * Lightweight SSR pulse data for the anonymous landing page.
 * Authenticated users get their data client-side via Hub cards + TanStack Query.
 */
async function getGovernancePulse() {
  const supabase = createClient();

  const [activeDRepsResult, totalDRepsResult, openProposalsResult] = await Promise.all([
    supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .eq('info->>isActive', 'true'),
    supabase.from('dreps').select('id', { count: 'exact', head: true }),
    supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
  ]);

  return {
    totalAdaGoverned: '',
    activeProposals: openProposalsResult.count ?? 0,
    activeDReps: activeDRepsResult.count ?? 0,
    totalDReps: totalDRepsResult.count ?? 0,
    votesThisWeek: 0,
    claimedDReps: 0,
    activeSpOs: 0,
    ccMembers: 0,
  };
}

export default async function HomePage() {
  const pulseData = await getGovernancePulse();

  return (
    <>
      <PageViewTracker event="homepage_viewed" />
      <HubHomePage pulseData={pulseData} />
    </>
  );
}
