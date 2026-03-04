import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (_request, { requestId }) => {
    const supabase = createClient();

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

    const members = Array.from(memberMap.entries())
      .map(([ccHotId, counts]) => {
        const total = counts.yes + counts.no + counts.abstain;
        return {
          ccHotId,
          voteCount: total,
          yesCount: counts.yes,
          noCount: counts.no,
          abstainCount: counts.abstain,
          approvalRate: total > 0 ? Math.round((counts.yes / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.voteCount - a.voteCount);

    return NextResponse.json(
      { members },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
        },
      },
    );
});
