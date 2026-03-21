export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

/**
 * GET /api/intelligence/cross-body-alignment
 *
 * Returns per-dimension alignment averages for each governance body
 * (citizens, DReps, SPOs, CC members) to reveal representation gaps.
 *
 * Feature-gated behind `community_intelligence`.
 */

const DIMENSION_KEYS = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_DB_COLS = [
  'alignment_treasury_conservative',
  'alignment_treasury_growth',
  'alignment_decentralization',
  'alignment_security',
  'alignment_innovation',
  'alignment_transparency',
] as const;

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120',
};

export const GET = withRouteHandler(async () => {
  const enabled = await getFeatureFlag('community_intelligence', false);
  if (!enabled) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
  }

  const supabase = createClient();
  const epoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // 1. Citizen centroid from match_preferences snapshot
  const { data: prefsSnapshot } = await supabase
    .from('community_intelligence_snapshots')
    .select('data')
    .eq('snapshot_type', 'match_preferences')
    .eq('epoch', epoch)
    .single();

  const citizenCentroid = (prefsSnapshot?.data as { communityCentroid?: number[] } | null)
    ?.communityCentroid ?? [50, 50, 50, 50, 50, 50];

  // 2. DRep average alignment — compute from dreps table
  const { data: dreps } = await supabase
    .from('dreps')
    .select(DIMENSION_DB_COLS.join(', '))
    .not('alignment_treasury_conservative', 'is', null);

  const drepSums = [0, 0, 0, 0, 0, 0];
  let drepCount = 0;

  if (dreps) {
    for (const drep of dreps) {
      const row = drep as unknown as Record<string, number | null>;
      const hasAny = DIMENSION_DB_COLS.some((col) => row[col] != null);
      if (!hasAny) continue;

      for (let i = 0; i < DIMENSION_DB_COLS.length; i++) {
        drepSums[i] += (row[DIMENSION_DB_COLS[i]] as number) ?? 50;
      }
      drepCount++;
    }
  }

  const drepAvg = drepCount > 0 ? drepSums.map((sum) => Math.round(sum / drepCount)) : null;

  // 3. SPO alignment — check if alignment columns exist on SPO governance scores
  // SPOs don't have alignment columns in the current schema, so return null
  const spoAvg: number[] | null = null;

  // 4. CC members — not yet tracked in the schema, return null
  const ccAvg: number[] | null = null;

  // Build per-dimension response
  const dimensions = DIMENSION_KEYS.map((dim, i) => ({
    dimension: dim,
    label: DIMENSION_LABELS[dim],
    citizenAvg: citizenCentroid[i] ?? 50,
    drepAvg: drepAvg ? drepAvg[i] : null,
    spoAvg: spoAvg ? spoAvg[i] : null,
    ccAvg: ccAvg ? ccAvg[i] : null,
  }));

  // Compute overall alignment (average absolute difference between citizen and DRep)
  let overallAlignment = 0;
  if (drepAvg) {
    let totalDiff = 0;
    for (let i = 0; i < 6; i++) {
      totalDiff += Math.abs(citizenCentroid[i] - drepAvg[i]);
    }
    // Convert average difference (0-100) to alignment score (100 = perfect, 0 = max divergence)
    overallAlignment = Math.round(100 - totalDiff / 6);
  }

  // Find biggest gap
  let biggestGap: { dimension: string; bodies: string[]; gap: number } = {
    dimension: DIMENSION_KEYS[0],
    bodies: ['Citizens', 'DReps'],
    gap: 0,
  };

  if (drepAvg) {
    for (let i = 0; i < 6; i++) {
      const gap = Math.abs(citizenCentroid[i] - drepAvg[i]);
      if (gap > biggestGap.gap) {
        biggestGap = {
          dimension: DIMENSION_LABELS[DIMENSION_KEYS[i]],
          bodies: ['Citizens', 'DReps'],
          gap: Math.round(gap),
        };
      }
    }
  }

  return NextResponse.json(
    {
      dimensions,
      overallAlignment,
      biggestGap,
      drepCount,
      epoch,
    },
    { headers: CACHE_HEADERS },
  );
});
