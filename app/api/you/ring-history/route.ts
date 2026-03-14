import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '20'), 50);

    const supabase = createClient();
    const { data, error } = await supabase
      .from('citizen_ring_snapshots')
      .select('epoch, delegation_ring, coverage_ring, engagement_ring, pulse')
      .eq('user_id', userId!)
      .order('epoch', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to load ring history' }, { status: 500 });
    }

    return NextResponse.json({ snapshots: data ?? [] });
  },
  { auth: 'required' },
);
