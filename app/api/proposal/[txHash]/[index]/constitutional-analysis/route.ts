import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const segments = request.nextUrl.pathname.split('/');
  const txHash = segments[3];
  const index = parseInt(segments[4], 10);

  if (!txHash || isNaN(index)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const supabase = createClient();
  const { data } = await supabase
    .from('proposal_classifications')
    .select('constitutional_analysis')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', index)
    .single();

  return NextResponse.json({
    analysis: data?.constitutional_analysis ?? null,
  });
});
