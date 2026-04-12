import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { buildHomepageMatchPath } from '@/lib/matching/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quick Match - Governada',
  description:
    'Answer four questions about how you want Cardano governed and see the DReps and pools that best fit your values.',
  openGraph: {
    title: 'Quick Match - Governada',
    description:
      'Find the representatives and stake pools that best match your Cardano governance values.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quick Match - Governada',
    description: 'Find your Cardano governance fit inside Governadaâ€™s homepage discovery flow.',
  },
};

interface MatchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MatchPage({ searchParams }: MatchPageProps) {
  await connection();
  redirect(buildHomepageMatchPath(await searchParams));
}
