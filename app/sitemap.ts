import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const BASE_URL = 'https://governada.io';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();

  const [drepsResult, proposalsResult, poolsResult] = await Promise.all([
    supabase.from('dreps').select('id, updated_at').order('score', { ascending: false }),
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('pools')
      .select('pool_id, updated_at')
      .order('gov_score', { ascending: false })
      .limit(5000),
  ]);

  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    {
      url: `${BASE_URL}/match`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/governance`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/governance/health`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/governance/representatives`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/governance/proposals`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/governance/pools`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/governance/treasury`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/help/glossary`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/help/methodology`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  const drepPages: MetadataRoute.Sitemap = (drepsResult.data ?? []).map((drep) => ({
    url: `${BASE_URL}/drep/${encodeURIComponent(drep.id)}`,
    lastModified: drep.updated_at ? new Date(drep.updated_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const proposalPages: MetadataRoute.Sitemap = (proposalsResult.data ?? []).map((p) => ({
    url: `${BASE_URL}/governance/proposals/${encodeURIComponent(p.tx_hash)}/${p.proposal_index}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'daily' as const,
    priority: 0.5,
  }));

  const poolPages: MetadataRoute.Sitemap = (poolsResult.data ?? []).map(
    (pool: { pool_id: string; updated_at: string | null }) => ({
      url: `${BASE_URL}/pool/${encodeURIComponent(pool.pool_id)}`,
      lastModified: pool.updated_at ? new Date(pool.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }),
  );

  return [...staticPages, ...drepPages, ...proposalPages, ...poolPages];
}
