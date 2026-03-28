/**
 * /g/pool/[poolId] — Globe focused on a stake pool.
 * SSR renders semantic content for crawlers; visual experience is the globe.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ poolId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { poolId } = await params;
  const supabase = createClient();
  const { data: pool } = await supabase
    .from('pools')
    .select('pool_name, ticker, governance_score')
    .eq('pool_id', poolId)
    .maybeSingle();

  const name = pool?.pool_name || pool?.ticker || `Pool ${poolId.slice(0, 12)}`;
  const title = `${name} — Constellation — Governada`;
  const description = pool
    ? `Stake pool ${name} governance score: ${pool.governance_score}/100.`
    : 'Stake pool governance details on Governada.';

  return {
    title,
    description,
    openGraph: {
      title: `${name} — Governada`,
      description,
      images: [`${BASE_URL}/api/og/pool/${encodeURIComponent(poolId)}`],
    },
    alternates: {
      canonical: `${BASE_URL}/g/pool/${encodeURIComponent(poolId)}`,
    },
  };
}

export default async function GlobePoolPage({ params }: PageProps) {
  const { poolId } = await params;
  const supabase = createClient();

  const { data: pool } = await supabase
    .from('pools')
    .select('pool_id, pool_name, ticker, governance_score, vote_count, live_stake_lovelace')
    .eq('pool_id', poolId)
    .maybeSingle();

  if (!pool) notFound();

  const name = pool.pool_name || pool.ticker || `Pool ${poolId.slice(0, 12)}`;

  return (
    <article itemScope itemType="https://schema.org/Organization">
      <h1 itemProp="name">
        {name} {pool.ticker ? `[${pool.ticker}]` : ''}
      </h1>
      <p itemProp="description">
        Stake pool operator participating in Cardano governance with a score of{' '}
        {pool.governance_score}/100.
      </p>
      <dl>
        <dt>Governance Score</dt>
        <dd>{pool.governance_score}/100</dd>
        <dt>Votes Cast</dt>
        <dd>{pool.vote_count ?? 0}</dd>
        <dt>Active Stake</dt>
        <dd>
          {pool.live_stake_lovelace
            ? `${(Number(pool.live_stake_lovelace) / 1_000_000).toFixed(0)} ADA`
            : 'Unknown'}
        </dd>
      </dl>
      <a href={`/pool/${encodeURIComponent(poolId)}`}>View full pool profile</a>
    </article>
  );
}
