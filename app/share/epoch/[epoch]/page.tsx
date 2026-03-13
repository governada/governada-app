import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ epoch: string }>;
  searchParams: Promise<{
    stake?: string;
    headline?: string;
    decisions?: string;
    ada?: string;
    streak?: string;
    drep?: string;
  }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { epoch } = await params;
  const sp = await searchParams;
  const headline = sp.headline || `Epoch ${epoch} Governance Report`;

  const ogParams = new URLSearchParams({
    epoch,
    headline,
    decisions: sp.decisions || '0',
    ada: sp.ada || '0',
    streak: sp.streak || '0',
    ...(sp.drep ? { drep: sp.drep } : {}),
  });

  const ogImageUrl = `${BASE_URL}/api/og/epoch-report?${ogParams.toString()}`;

  return {
    title: `Epoch ${epoch} Report | Governada`,
    description: headline,
    openGraph: {
      title: `Epoch ${epoch} Governance Report`,
      description: headline,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Epoch ${epoch} Governance Report`,
      description: headline,
      images: [ogImageUrl],
    },
  };
}

export default async function ShareEpochPage({ params }: Props) {
  const { epoch } = await params;
  // Redirect to main Hub — the share page only exists for OG metadata
  redirect(`/?epoch=${epoch}`);
}
