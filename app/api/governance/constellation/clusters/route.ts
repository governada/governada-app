import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { cached } from '@/lib/redis';
import { extractAlignments, alignmentsToArray, getDominantDimension } from '@/lib/drepIdentity';
import { detectClusters } from '@/lib/globe/clusterDetection';
import { nameAllClusters, type ClusterName } from '@/lib/globe/clusterNaming';
import { getFeatureFlag } from '@/lib/featureFlags';
import type { LayoutInput } from '@/lib/constellation/globe-layout';

export const dynamic = 'force-dynamic';

interface ClusterResponse {
  id: string;
  name: string;
  description: string;
  centroid6D: number[];
  centroidSphere: [number, number];
  centroid3D: [number, number, number];
  memberCount: number;
  dominantDimension: string;
  memberIds: string[];
}

interface ClustersPayload {
  clusters: ClusterResponse[];
  silhouetteScore: number;
  k: number;
}

const CACHE_KEY = 'clusters:constellation:latest';
const CACHE_TTL = 3600; // 1 hour

export const GET = withRouteHandler(async () => {
  const enabled = await getFeatureFlag('globe_alignment_layout', false);
  if (!enabled) {
    return NextResponse.json({ clusters: [], silhouetteScore: 0, k: 0 });
  }

  const payload = await cached<ClustersPayload>(CACHE_KEY, CACHE_TTL, async () => {
    return computeClusters();
  });

  return NextResponse.json(payload);
});

async function computeClusters(): Promise<ClustersPayload> {
  const supabase = createClient();

  const { data: dreps } = await supabase
    .from('dreps')
    .select(
      'id, score, info, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .gt('info->>votingPowerLovelace', '0')
    .order('id')
    .limit(700);

  if (!dreps || dreps.length === 0) {
    return { clusters: [], silhouetteScore: 0, k: 0 };
  }

  const maxPower = Math.max(
    ...dreps.map((d) => {
      const info = d.info as Record<string, unknown> | null;
      return parseInt((info?.votingPowerLovelace as string) || '0', 10) || 0;
    }),
    1,
  );

  const inputs: LayoutInput[] = dreps.map((d) => {
    const info = d.info as Record<string, unknown> | null;
    const raw = parseInt((info?.votingPowerLovelace as string) || '0', 10) || 0;
    const alignments = extractAlignments(d);
    const arr = alignmentsToArray(alignments);
    return {
      id: (d.id as string).slice(0, 16),
      fullId: d.id as string,
      name: (info?.name as string) || (info?.ticker as string) || (info?.handle as string) || null,
      power: raw / maxPower,
      score: d.score || 0,
      dominant: getDominantDimension(alignments),
      alignments: arr,
      nodeType: 'drep' as const,
    };
  });

  const result = detectClusters(inputs);

  // Name clusters via AI (fallback to dimension-based names)
  const names = await nameAllClusters(result.clusters);

  const clusters: ClusterResponse[] = result.clusters.map((c) => {
    const n: ClusterName = names.get(c.id) ?? {
      name: `${c.dominantDimension} Faction`,
      description: `A group of ${c.memberCount} DReps.`,
    };
    return {
      id: c.id,
      name: n.name,
      description: n.description,
      centroid6D: c.centroid6D,
      centroidSphere: c.centroidSphere,
      centroid3D: c.centroid3D,
      memberCount: c.memberCount,
      dominantDimension: c.dominantDimension,
      memberIds: c.memberIds,
    };
  });

  return {
    clusters,
    silhouetteScore: result.silhouetteScore,
    k: result.k,
  };
}
