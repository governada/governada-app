import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const supabase = createClient();

  const [claimedResult, totalResult] = await Promise.all([
    supabase
      .from('users')
      .select('wallet_address', { count: 'exact', head: true })
      .not('claimed_drep_id', 'is', null),
    supabase.from('dreps').select('id', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    claimedCount: claimedResult.count ?? 0,
    totalDReps: totalResult.count ?? 0,
  });
});
