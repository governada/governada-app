/**
 * /g/drep/[drepId] — Globe focused on a DRep.
 * SSR renders semantic content for crawlers; visual experience is the globe.
 */

import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const getCachedDRep = cache((id: string) => getDRepById(id));

interface PageProps {
  params: Promise<{ drepId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { drepId } = await params;
  const decodedId = decodeURIComponent(drepId);
  const drep = await getCachedDRep(decodedId);

  if (!drep) {
    return { title: 'DRep Not Found — Governada' };
  }

  const name = getDRepPrimaryName(drep);
  const title = `${name} — Constellation — Governada`;
  const description = `Governance score: ${drep.drepScore}/100. Participation: ${drep.effectiveParticipation}%. Rationale quality: ${drep.rationaleRate}%.`;
  const ogImageUrl = `${BASE_URL}/api/og/drep/${encodeURIComponent(drepId)}`;

  return {
    title,
    description,
    openGraph: {
      title: `${name} — Governada`,
      description,
      type: 'profile',
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `${BASE_URL}/g/drep/${encodeURIComponent(drepId)}`,
    },
  };
}

export default async function GlobeDRepPage({ params }: PageProps) {
  const { drepId } = await params;
  const decodedId = decodeURIComponent(drepId);
  const drep = await getCachedDRep(decodedId);

  if (!drep) notFound();

  const name = getDRepPrimaryName(drep);

  return (
    <article itemScope itemType="https://schema.org/Person">
      <h1 itemProp="name">{name}</h1>
      <p itemProp="description">
        Delegated representative in Cardano governance with a score of {drep.drepScore}/100.
      </p>
      <dl>
        <dt>Governance Score</dt>
        <dd>{drep.drepScore}/100</dd>
        <dt>Status</dt>
        <dd>{drep.isActive ? 'Active' : 'Inactive'}</dd>
        <dt>Participation</dt>
        <dd>{drep.effectiveParticipation}%</dd>
        <dt>Rationale Quality</dt>
        <dd>{drep.rationaleRate}%</dd>
        <dt>Voting Power</dt>
        <dd>
          {drep.votingPower
            ? `${(Number(drep.votingPower) / 1_000_000).toFixed(0)} ADA`
            : 'Unknown'}
        </dd>
      </dl>
      <a href={`/drep/${encodeURIComponent(drepId)}`}>View full DRep profile</a>
    </article>
  );
}
