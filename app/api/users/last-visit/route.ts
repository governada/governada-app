import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ lastVisit: null });
  }

  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select('last_visit_at')
    .eq('wallet_address', wallet)
    .single();

  return NextResponse.json({ lastVisit: data?.last_visit_at || null });
});
