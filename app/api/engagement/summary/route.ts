import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');

    if (!entityId) {
      return NextResponse.json({ error: 'entityId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: aggregations } = await supabase
      .from('engagement_signal_aggregations')
      .select('signal_type, data')
      .eq('entity_type', 'proposal')
      .eq('entity_id', entityId);

    const result: {
      sentiment: { support: number; oppose: number; unsure: number; total: number } | null;
      concerns: Record<string, number> | null;
      impact: { total: number; ratings: Record<string, number> } | null;
    } = {
      sentiment: null,
      concerns: null,
      impact: null,
    };

    for (const row of aggregations || []) {
      const data = row.data as Record<string, unknown>;
      if (row.signal_type === 'sentiment') {
        result.sentiment = data as typeof result.sentiment;
      } else if (row.signal_type === 'concern_flags') {
        result.concerns = data as Record<string, number>;
      } else if (row.signal_type === 'impact_tags') {
        result.impact = data as typeof result.impact;
      }
    }

    return NextResponse.json(result);
  },
  { auth: 'optional' },
);
