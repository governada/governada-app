import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/constants';
import { MatchResultClient } from './MatchResultClient';

export const dynamic = 'force-dynamic';

interface MatchResultPageProps {
  searchParams: Promise<{ profile?: string }>;
}

function parseProfile(encoded: string | undefined) {
  if (!encoded) return null;
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: MatchResultPageProps): Promise<Metadata> {
  const { profile: encoded } = await searchParams;
  const profile = parseProfile(encoded);

  const title = profile?.personality
    ? `I'm ${profile.personality} — Governada`
    : 'Governance Match Result — Governada';
  const description = profile?.narrative
    ? profile.narrative
    : 'Discover your governance identity on Cardano. Take the Quick Match quiz to find DReps and SPOs who share your values.';

  const ogImageUrl = encoded
    ? `${BASE_URL}/api/og/match?profile=${encodeURIComponent(encoded)}`
    : `${BASE_URL}/api/og/match`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Governance Identity' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function MatchResultPage({ searchParams }: MatchResultPageProps) {
  const { profile: encoded } = await searchParams;
  return <MatchResultClient encoded={encoded} />;
}
