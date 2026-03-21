export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

/**
 * GET /api/governance/matching-topics
 *
 * Returns enabled matching topics sorted by source (static first) then
 * selection_count descending. Includes trending flag for community-detected
 * topics that are rising in popularity.
 */
export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('matching_topics')
    .select('id, slug, display_text, source, trending, selection_count')
    .eq('enabled', true)
    .order('source', { ascending: true }) // 'static' before 'community'
    .order('selection_count', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }

  const topics = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    displayText: row.display_text,
    source: row.source,
    trending: row.trending,
    selectionCount: row.selection_count,
  }));

  return NextResponse.json(
    { topics },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
  );
});
