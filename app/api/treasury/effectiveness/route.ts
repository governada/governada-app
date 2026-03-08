import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSpendingEffectiveness } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async () => {
  const effectiveness = await getSpendingEffectiveness();

  return NextResponse.json(effectiveness, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
});
