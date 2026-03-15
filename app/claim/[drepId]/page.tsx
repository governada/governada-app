import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDRepById, isDRepClaimed } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { BASE_URL } from '@/lib/constants';
import { ClaimPageClient } from './ClaimPageClient';

interface ClaimPageProps {
  params: Promise<{ drepId: string }>;
}

export async function generateMetadata({ params }: ClaimPageProps): Promise<Metadata> {
  const { drepId } = await params;
  const drep = await getDRepById(decodeURIComponent(drepId));

  if (!drep) {
    return { title: 'DRep Not Found — Governada' };
  }

  const name = getDRepPrimaryName(drep);
  const title = `Claim your Governada profile — ${name} scored ${drep.drepScore}/100`;
  const description = `${name} is ranked among Cardano DReps. Claim your profile to access your dashboard, governance inbox, and score tracking.`;
  const ogImageUrl = `${BASE_URL}/api/og/drep/${encodeURIComponent(drepId)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${name} Governada card` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ClaimPage({ params }: ClaimPageProps) {
  const { drepId } = await params;
  const decodedId = decodeURIComponent(drepId);
  const [drep, claimed] = await Promise.all([getDRepById(decodedId), isDRepClaimed(decodedId)]);

  if (!drep) {
    notFound();
  }

  const name = getDRepPrimaryName(drep);

  return (
    <ClaimPageClient
      drepId={drep.drepId}
      name={name}
      score={drep.drepScore}
      engagement={drep.engagementQuality ?? drep.rationaleRate}
      participation={drep.effectiveParticipationV3 ?? drep.effectiveParticipation}
      reliability={drep.reliabilityV3 ?? drep.reliabilityScore}
      identity={drep.governanceIdentity ?? drep.profileCompleteness}
      isClaimed={claimed}
    />
  );
}
