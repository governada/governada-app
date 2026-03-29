import type { Metadata } from 'next';
import Script from 'next/script';
import { createClient } from '@/lib/supabase';
import { PageViewTracker } from '@/components/PageViewTracker';
import { HubHomePage } from '@/components/hub/HubHomePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governada — Cardano Governance Intelligence',
  description:
    'Cardano has a government. Know who represents you. Build your governance team, track proposals, and participate in on-chain democracy.',
  openGraph: {
    title: 'Governada — Cardano Governance Intelligence',
    description:
      'Know who represents your ADA in Cardano governance. Build your governance team, track proposals, and take action.',
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

  const [activeDRepsResult, totalDRepsResult, openProposalsResult, totalDelegatorsResult] =
    await Promise.all([
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
      // Count unique delegators from the dreps table (sum of delegator counts)
      supabase.from('dreps').select('info->delegatorCount'),
    ]);

  // Sum delegator counts across all DReps for social proof
  let totalDelegators = 0;
  if (totalDelegatorsResult.data) {
    for (const row of totalDelegatorsResult.data) {
      const count = (row as Record<string, unknown>).delegatorCount;
      if (typeof count === 'number') totalDelegators += count;
    }
  }

  return {
    activeProposals: openProposalsResult.count ?? 0,
    activeDReps: activeDRepsResult.count ?? 0,
    totalDReps: totalDRepsResult.count ?? 0,
    totalDelegators,
  };
}

interface HomePageProps {
  searchParams: Promise<{ filter?: string; entity?: string; match?: string; sort?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [pulseData, params] = await Promise.all([getGovernancePulse(), searchParams]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Governada',
    url: 'https://governada.io',
    description:
      'Governance intelligence for Cardano. Build your governance team, track proposals, and participate in on-chain democracy.',
    applicationCategory: 'GovernanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Governada',
      url: 'https://governada.io',
    },
  };

  return (
    <>
      <Script
        id="json-ld-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageViewTracker event="homepage_viewed" />
      <HubHomePage
        pulseData={pulseData}
        filter={params.filter}
        entity={params.entity}
        match={params.match === 'true'}
        sort={params.sort}
      />
    </>
  );
}
