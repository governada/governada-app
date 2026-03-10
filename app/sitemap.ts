import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const BASE_URL = 'https://governada.io';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();

  const [drepsResult, proposalsResult] = await Promise.all([
    supabase.from('dreps').select('id, updated_at').order('score', { ascending: false }),
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, updated_at')
      .order('updated_at', { ascending: false }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    {
      url: `${BASE_URL}/governance`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/proposals`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    { url: `${BASE_URL}/pulse`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    {
      url: `${BASE_URL}/treasury`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/compare`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  const drepPages: MetadataRoute.Sitemap = (drepsResult.data ?? []).map((drep) => ({
    url: `${BASE_URL}/drep/${encodeURIComponent(drep.id)}`,
    lastModified: drep.updated_at ? new Date(drep.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const proposalPages: MetadataRoute.Sitemap = (proposalsResult.data ?? []).map((p) => ({
    url: `${BASE_URL}/proposals/${encodeURIComponent(p.tx_hash)}/${p.proposal_index}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...drepPages, ...proposalPages];
}
