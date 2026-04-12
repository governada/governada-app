import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { HomePageShell } from '@/components/hub/HomePageShell';
import { buildHomepageMatchPath } from '@/lib/matching/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governada â€” Cardano Governance Intelligence',
  description:
    'Cardano has a government. Know who represents you. Build your governance team, track proposals, and participate in on-chain democracy.',
  openGraph: {
    title: 'Governada â€” Cardano Governance Intelligence',
    description:
      'Know who represents your ADA in Cardano governance. Build your governance team, track proposals, and take action.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada â€” Cardano Governance Intelligence',
    description: 'Cardano has a government. Know who represents you.',
  },
};

interface HomePageProps {
  searchParams: Promise<{
    filter?: string;
    entity?: string;
    match?: string;
    mode?: string;
    sort?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  await connection();
  const params = await searchParams;

  if (params.match === 'true') {
    redirect(buildHomepageMatchPath(params));
  }

  return (
    <HomePageShell
      filter={params.filter}
      entity={params.entity}
      mode={params.mode}
      sort={params.sort}
    />
  );
}
