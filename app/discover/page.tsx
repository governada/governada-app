import { Metadata } from 'next';
import { getAllDReps } from '@/lib/data';
import { PageViewTracker } from '@/components/PageViewTracker';
import { CivicaDiscover } from '@/components/civica/discover/CivicaDiscover';
import { createClient } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Governada — Discover',
  description:
    'Find and compare Cardano DReps, governance-active stake pools, and Constitutional Committee members. Filter by score, tier, and alignment.',
  openGraph: {
    title: 'Governada — Discover Governance',
    description:
      'Browse every DRep, stake pool, and Constitutional Committee member participating in Cardano governance.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Discover Governance',
    description: 'Find the representative that matches your governance values.',
  },
};

export const dynamic = 'force-dynamic';

async function getProposalCount(): Promise<number> {
  try {
    const supabase = createClient();
    const { count } = await supabase.from('proposals').select('*', { count: 'exact', head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getCCMemberCount(): Promise<number> {
  try {
    const supabase = createClient();
    const { count } = await supabase.from('cc_members').select('*', { count: 'exact', head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getSPOCount(): Promise<number> {
  try {
    const supabase = createClient();
    const { count } = await supabase
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .gt('governance_score', 0);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function DiscoverPage() {
  const [{ allDReps, totalAvailable }, proposalCount, ccMemberCount, spoCount] = await Promise.all([
    getAllDReps(),
    getProposalCount(),
    getCCMemberCount(),
    getSPOCount(),
  ]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <PageViewTracker event="discover_page_viewed" />
      <CivicaDiscover
        dreps={allDReps}
        totalAvailable={totalAvailable}
        proposalCount={proposalCount}
        ccMemberCount={ccMemberCount}
        spoCount={spoCount}
      />
    </div>
  );
}
