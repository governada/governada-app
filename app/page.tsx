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

  const [drepsResult, proposalsResult] = await Promise.all([
    supabase.from('dreps').select('info', { count: 'exact' }).range(0, 9999),
    supabase
      .from('proposals')
      .select('tx_hash, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch'),
  ]);

  const dreps = drepsResult.data || [];
  const proposals = proposalsResult.data || [];
  const activeDReps = dreps.filter((d) => (d.info as Record<string, unknown> | null)?.isActive);

  const openProposals = proposals.filter(
    (p) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
  );

  return {
    totalAdaGoverned: '',
    activeProposals: openProposals.length,
    activeDReps: activeDReps.length,
    totalDReps: drepsResult.count ?? dreps.length,
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
