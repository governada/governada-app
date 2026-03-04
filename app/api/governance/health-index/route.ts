import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { computeGHI } from '@/lib/ghi';
import { logger } from '@/lib/logger';

let cachedResult: { data: Awaited<ReturnType<typeof computeGHI>>; ts: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export const GET = withRouteHandler(async (_request, { requestId }) => {
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL_MS) {
      return NextResponse.json(cachedResult.data, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
      });
    }

    const result = await computeGHI();
    cachedResult = { data: result, ts: Date.now() };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
    });
});
