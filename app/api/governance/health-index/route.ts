import { NextResponse } from 'next/server';
import { computeGHI } from '@/lib/ghi';

let cachedResult: { data: Awaited<ReturnType<typeof computeGHI>>; ts: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
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
  } catch (error) {
    console.error('[GHI] Failed to compute:', error);
    return NextResponse.json({ error: 'Failed to compute GHI' }, { status: 500 });
  }
}
