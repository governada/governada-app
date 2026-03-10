import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const { searchParams } = new URL(request.url);
    const proposalTxHash = searchParams.get('proposalTxHash');
    const proposalIndexStr = searchParams.get('proposalIndex');

    if (!proposalTxHash || !proposalIndexStr) {
      return NextResponse.json(
        { error: 'proposalTxHash and proposalIndex required' },
        { status: 400 },
      );
    }

    const proposalIndex = parseInt(proposalIndexStr, 10);
    if (isNaN(proposalIndex)) {
      return NextResponse.json({ error: 'proposalIndex must be a number' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: allTags, error } = await supabase
      .from('citizen_impact_tags')
      .select('awareness, rating, user_id')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex);

    if (error) {
      logger.error('Impact tags query error', {
        context: 'engagement/impact/results',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }

    const rows = allTags || [];

    const awareness: Record<string, number> = {
      i_use_this: 0,
      i_tried_it: 0,
      didnt_know_about_it: 0,
    };
    const ratings: Record<string, number> = {
      essential: 0,
      useful: 0,
      okay: 0,
      disappointing: 0,
    };

    for (const row of rows) {
      awareness[row.awareness] = (awareness[row.awareness] || 0) + 1;
      ratings[row.rating] = (ratings[row.rating] || 0) + 1;
    }

    const userRow = userId ? rows.find((r) => r.user_id === userId) : null;
    const userTag = userRow ? { awareness: userRow.awareness, rating: userRow.rating } : null;

    return NextResponse.json({
      awareness,
      ratings,
      total: rows.length,
      userTag,
    });
  },
  { auth: 'optional' },
);
