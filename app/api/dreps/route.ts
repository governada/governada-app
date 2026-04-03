/**
 * DRep Data API Route
 * Serves full DRep data from the Supabase cache
 * Avoids Next.js 128KB server component prop limit
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { DRepCacheUnavailableError, getAllDReps, getDRepById } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const checkId = searchParams.get('id');

  if (checkId && searchParams.get('check') === '1') {
    const drep = await getDRepById(checkId);
    return NextResponse.json({ exists: drep !== null });
  }

  try {
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
  } catch (error) {
    if (error instanceof DRepCacheUnavailableError) {
      return NextResponse.json(
        {
          dreps: [],
          allDReps: [],
          error: true,
          totalAvailable: 0,
          message: error.message,
        },
        {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
        },
      );
    }

    throw error;
  }
});
