import { NextResponse } from 'next/server';
import { computeInsights } from '@/lib/proposalInsights';

let cachedResult: { data: Awaited<ReturnType<typeof computeInsights>>; ts: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
  try {
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL_MS) {
      return NextResponse.json(cachedResult.data, {
        headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600' },
      });
    }

    const result = await computeInsights();
    cachedResult = { data: result, ts: Date.now() };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[Insights] API error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
