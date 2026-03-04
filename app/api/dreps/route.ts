/**
 * DRep Data API Route
 * Serves full DRep data from Supabase cache with Koios fallback
 * Avoids Next.js 128KB server component prop limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getAllDReps, getDRepById } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const { searchParams } = new URL(request.url);
  const checkId = searchParams.get('id');

  if (checkId && searchParams.get('check') === '1') {
    const drep = await getDRepById(checkId);
    return NextResponse.json({ exists: drep !== null });
  }

  const { dreps, allDReps, error, totalAvailable } = await getAllDReps();

  return NextResponse.json(
    {
      dreps,
      allDReps,
      error,
      totalAvailable,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
    },
  );
});
