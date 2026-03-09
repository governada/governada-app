import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { loadActivePCA } from '@/lib/alignment/pca';
import { cosineSimilarity } from '@/lib/representationMatch';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const url = new URL(request.url);
  const drepId = decodeURIComponent(url.pathname.split('/dreps/')[1].split('/similar')[0]);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '6', 10), 20);

  const pca = await loadActivePCA();
  if (!pca) {
    return NextResponse.json({ similar: [] });
  }

  const supabase = createClient();

  const { data: coordRows } = await supabase
    .from('drep_pca_coordinates')
    .select('drep_id, coordinates')
    .eq('run_id', pca.runId);

  if (!coordRows?.length) {
    return NextResponse.json({ similar: [] });
  }

  const targetRow = coordRows.find((r) => r.drep_id === drepId);
  if (!targetRow) {
    return NextResponse.json({ similar: [] });
  }

  const targetCoords = targetRow.coordinates as number[];

  const similarities = coordRows
    .filter((r) => r.drep_id !== drepId)
    .map((r) => ({
      drepId: r.drep_id as string,
      similarity: cosineSimilarity(targetCoords, r.coordinates as number[]),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  if (similarities.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  const { data: drepRows } = await supabase
    .from('dreps')
    .select('id, info, score, is_active, delegator_count')
    .in(
      'id',
      similarities.map((s) => s.drepId),
    );

  const infoMap = new Map<
    string,
    { name: string | null; score: number; isActive: boolean; delegatorCount: number }
  >();
  if (drepRows) {
    for (const d of drepRows) {
      infoMap.set(d.id, {
        name: ((d.info as Record<string, unknown>)?.name as string) || null,
        score: Number(d.score) || 0,
        isActive: d.is_active ?? true,
        delegatorCount: d.delegator_count ?? 0,
      });
    }
  }

  // Filter to DReps with metadata names for quality results
  const namedSimilarities = similarities.filter((s) => {
    const info = infoMap.get(s.drepId);
    return info?.name != null;
  });
  const finalSimilarities = namedSimilarities.length >= 3 ? namedSimilarities : similarities;

  const similar = finalSimilarities.map((s) => {
    const info = infoMap.get(s.drepId);
    return {
      drepId: s.drepId,
      similarity: Math.round(s.similarity * 100),
      name: info?.name || null,
      score: info?.score || 0,
      isActive: info?.isActive ?? true,
      delegatorCount: info?.delegatorCount ?? 0,
    };
  });

  return NextResponse.json(
    { similar },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
  );
});
