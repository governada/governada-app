/**
 * /g/cc/[ccHotId] — Globe focused on a Constitutional Committee member.
 * SSR renders semantic content for crawlers; visual experience is the globe.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ccHotId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ccHotId } = await params;
  const supabase = createClient();
  const { data: member } = await supabase
    .from('cc_members')
    .select('name, fidelity_grade')
    .eq('cc_hot_id', ccHotId)
    .maybeSingle();

  const name = member?.name || `CC Member ${ccHotId.slice(0, 12)}`;
  const title = `${name} — Constellation — Governada`;
  const description = member
    ? `Constitutional Committee member ${name}. Fidelity grade: ${member.fidelity_grade || 'N/A'}.`
    : 'Constitutional Committee member details on Governada.';

  return {
    title,
    description,
    openGraph: {
      title: `${name} — Governada`,
      description,
    },
    alternates: {
      canonical: `${BASE_URL}/g/cc/${encodeURIComponent(ccHotId)}`,
    },
  };
}

export default async function GlobeCCPage({ params }: PageProps) {
  const { ccHotId } = await params;
  const supabase = createClient();

  const { data: member } = await supabase
    .from('cc_members')
    .select('cc_hot_id, name, fidelity_grade, status, votes_cast, votes_total')
    .eq('cc_hot_id', ccHotId)
    .maybeSingle();

  if (!member) notFound();

  const name = member.name || `CC Member ${ccHotId.slice(0, 12)}`;

  return (
    <article itemScope itemType="https://schema.org/Person">
      <h1 itemProp="name">{name}</h1>
      <p itemProp="description">
        Member of the Cardano Constitutional Committee responsible for constitutional review of
        governance proposals.
      </p>
      <dl>
        <dt>Fidelity Grade</dt>
        <dd>{member.fidelity_grade || 'N/A'}</dd>
        <dt>Status</dt>
        <dd>{member.status || 'Active'}</dd>
        <dt>Votes Cast</dt>
        <dd>
          {member.votes_cast ?? 0} of {member.votes_total ?? 0}
        </dd>
      </dl>
      <a href={`/committee/${encodeURIComponent(ccHotId)}`}>View full CC member profile</a>
    </article>
  );
}
