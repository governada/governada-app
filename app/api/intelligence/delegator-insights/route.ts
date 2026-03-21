export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

/**
 * GET /api/intelligence/delegator-insights?drepId=drep1...
 * GET /api/intelligence/delegator-insights?spoId=pool1...
 *
 * Returns intelligence about a DRep's matched delegators or an SPO's stakers:
 * - Topics their citizens care about
 * - Archetype distribution
 * - Representation gap (citizen centroid vs entity alignment)
 * - Demand signals (underserved topics)
 *
 * Feature-gated behind `community_intelligence`.
 */

const DIMENSION_LABELS: Record<string, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_DB_KEYS: Record<string, string> = {
  treasuryConservative: 'alignment_treasury_conservative',
  treasuryGrowth: 'alignment_treasury_growth',
  decentralization: 'alignment_decentralization',
  security: 'alignment_security',
  innovation: 'alignment_innovation',
  transparency: 'alignment_transparency',
};

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

export const GET = withRouteHandler(async (request: NextRequest) => {
  const enabled = await getFeatureFlag('community_intelligence', false);
  if (!enabled) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const drepId = searchParams.get('drepId');
  const spoId = searchParams.get('spoId');

  if (!drepId && !spoId) {
    return NextResponse.json({ error: 'Missing drepId or spoId query parameter' }, { status: 400 });
  }

  const entityId = drepId ?? spoId!;
  const entityType = drepId ? 'drep' : 'spo';
  const epoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  const supabase = createClient();

  // Fetch all match_signal snapshots for this epoch
  const { data: allSignals } = await supabase
    .from('community_intelligence_snapshots')
    .select('data')
    .eq('snapshot_type', 'match_signal')
    .eq('epoch', epoch);

  if (!allSignals || allSignals.length === 0) {
    // No match signals at all — return null-safe empty response
    return NextResponse.json(
      {
        entityId,
        entityType,
        matchedCitizenCount: 0,
        citizenTopics: [],
        citizenArchetypes: [],
        citizenCentroid: [50, 50, 50, 50, 50, 50],
        drepAlignment: [],
        representationGap: [],
        demandSignals: [],
      },
      { headers: CACHE_HEADERS },
    );
  }

  // Filter signals where matchedDrepIds contains the requested entity
  const matchedSignals = allSignals.filter((row) => {
    const d = row.data as {
      matchedDrepIds?: string[];
    };
    return d.matchedDrepIds?.includes(entityId) ?? false;
  });

  // Aggregate topic frequency from matched signals
  const topicCounts: Record<string, number> = {};
  const archetypeCounts: Record<string, number> = {};
  const alignmentSums = [0, 0, 0, 0, 0, 0];
  let alignmentCount = 0;

  for (const row of matchedSignals) {
    const d = row.data as {
      topicSelections?: Record<string, boolean>;
      archetype?: string;
      alignmentVector?: number[];
    };

    // Topics
    if (d.topicSelections) {
      for (const [topic, selected] of Object.entries(d.topicSelections)) {
        if (selected) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      }
    }

    // Archetypes
    if (d.archetype) {
      archetypeCounts[d.archetype] = (archetypeCounts[d.archetype] || 0) + 1;
    }

    // Alignment centroid
    if (d.alignmentVector && d.alignmentVector.length === 6) {
      for (let i = 0; i < 6; i++) {
        alignmentSums[i] += d.alignmentVector[i];
      }
      alignmentCount++;
    }
  }

  const matchedCitizenCount = matchedSignals.length;

  // Build sorted topic list
  const totalTopicSelections = Object.values(topicCounts).reduce((sum, n) => sum + n, 0);
  const citizenTopics = Object.entries(topicCounts)
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: totalTopicSelections > 0 ? Math.round((count / totalTopicSelections) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Build archetype distribution
  const citizenArchetypes = Object.entries(archetypeCounts)
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((a, b) => b.count - a.count);

  // Citizen centroid (average alignment of matched citizens)
  const citizenCentroid =
    alignmentCount > 0
      ? alignmentSums.map((sum) => Math.round(sum / alignmentCount))
      : [50, 50, 50, 50, 50, 50];

  // Fetch entity alignment for representation gap
  let drepAlignment: number[] = [];
  const representationGap: Array<{
    dimension: string;
    citizenAvg: number;
    drepScore: number;
    gap: number;
  }> = [];

  if (entityType === 'drep') {
    const { data: drep } = await supabase
      .from('dreps')
      .select(
        'alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .eq('id', entityId)
      .single();

    if (drep) {
      const dimKeys = Object.keys(DIMENSION_DB_KEYS);
      drepAlignment = dimKeys.map(
        (k) => (drep[DIMENSION_DB_KEYS[k] as keyof typeof drep] as number) ?? 50,
      );

      // Compute representation gap per dimension
      if (alignmentCount > 0) {
        dimKeys.forEach((dim, i) => {
          const citizenAvg = citizenCentroid[i];
          const drepScore = drepAlignment[i];
          const gap = Math.abs(citizenAvg - drepScore);
          representationGap.push({
            dimension: DIMENSION_LABELS[dim] ?? dim,
            citizenAvg,
            drepScore,
            gap: Math.round(gap),
          });
        });
      }
    }
  }

  // Demand signals: topics where many citizens care but few DReps serve
  // Compare citizen topic frequency vs community-wide DRep topic coverage
  const { data: prefsSnapshot } = await supabase
    .from('community_intelligence_snapshots')
    .select('data')
    .eq('snapshot_type', 'match_preferences')
    .eq('epoch', epoch)
    .single();

  const communityTopicFreq =
    (prefsSnapshot?.data as { topicFrequency?: Record<string, number> } | null)?.topicFrequency ??
    {};
  const communityTotal = Object.values(communityTopicFreq).reduce((sum, n) => sum + n, 0);

  const demandSignals = citizenTopics
    .filter((t) => t.count >= 2) // Need minimum signal
    .map((t) => {
      const communityCount = communityTopicFreq[t.topic] ?? 0;
      const communityPct =
        communityTotal > 0 ? Math.round((communityCount / communityTotal) * 100) : 0;

      // "demand" = how much this DRep's citizens want it (local %)
      // "supply" = how much the overall community wants it (global %)
      // High local demand with low global supply = niche opportunity
      const demand = t.percentage;
      const supply = communityPct;

      let opportunity: string;
      if (demand > supply + 15) {
        opportunity = 'niche';
      } else if (demand > supply + 5) {
        opportunity = 'growing';
      } else {
        opportunity = 'served';
      }

      return {
        topic: t.topic,
        demand,
        supply,
        opportunity,
      };
    })
    .filter((d) => d.opportunity !== 'served')
    .sort((a, b) => b.demand - b.supply - (a.demand - a.supply));

  return NextResponse.json(
    {
      entityId,
      entityType,
      matchedCitizenCount,
      citizenTopics,
      citizenArchetypes,
      citizenCentroid,
      drepAlignment,
      representationGap,
      demandSignals,
    },
    { headers: CACHE_HEADERS },
  );
});
