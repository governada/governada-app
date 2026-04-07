import type { Metadata } from 'next';
import { HomePageShell } from '@/components/hub/HomePageShell';

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

interface HomePageProps {
  searchParams: Promise<{ filter?: string; entity?: string; match?: string; sort?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  return (
    <HomePageShell
      filter={params.filter}
      entity={params.entity}
      match={params.match === 'true'}
      sort={params.sort}
    />
  );
}
