import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  // Fetch vote aggregation
  const { data: votes, error } = await supabase.from('cc_votes').select('cc_hot_id, vote');

  if (error) {
    logger.error('Supabase error', { context: 'governance/committee', error: error?.message });
    return NextResponse.json({ members: [] });
  }

  if (!votes?.length) {
    return NextResponse.json({ members: [] });
  }

  const memberMap = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const v of votes) {
    const existing = memberMap.get(v.cc_hot_id) || { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') existing.yes++;
    else if (v.vote === 'No') existing.no++;
    else existing.abstain++;
    memberMap.set(v.cc_hot_id, existing);
  }

  // Fetch CC member metadata (names + transparency grades)
  const ccIds = Array.from(memberMap.keys());
  const { data: memberMeta } = await supabase
    .from('cc_members')
    .select('cc_hot_id, author_name, transparency_grade, transparency_index')
    .in('cc_hot_id', ccIds);

  const metaMap = new Map<
    string,
    { name: string | null; grade: string | null; index: number | null }
  >();
  for (const m of memberMeta || []) {
    metaMap.set(m.cc_hot_id, {
      name: m.author_name,
      grade: m.transparency_grade,
      index: m.transparency_index,
    });
  }

  const members = Array.from(memberMap.entries())
    .map(([ccHotId, counts]) => {
      const total = counts.yes + counts.no + counts.abstain;
      const meta = metaMap.get(ccHotId);
      return {
        ccHotId,
        name: meta?.name ?? null,
        transparencyGrade: meta?.grade ?? null,
        transparencyIndex: meta?.index ?? null,
        voteCount: total,
        yesCount: counts.yes,
        noCount: counts.no,
        abstainCount: counts.abstain,
        approvalRate: total > 0 ? Math.round((counts.yes / total) * 100) : 0,
      };
    })
    .sort((a, b) => {
      // Sort by transparency index (descending) if available, then by vote count
      if (a.transparencyIndex != null && b.transparencyIndex != null) {
        return b.transparencyIndex - a.transparencyIndex;
      }
      return b.voteCount - a.voteCount;
    });

  return NextResponse.json(
    { members },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
      },
    },
  );
});
