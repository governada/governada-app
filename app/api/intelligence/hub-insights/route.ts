/**
 * GET /api/intelligence/hub-insights
 *
 * Returns AI-generated one-line insights for Hub cards.
 * Optional query param: ?stakeAddress=stake1...
 */

import { NextResponse } from 'next/server';
import { generateHubInsights } from '@/lib/intelligence/hub-insights';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stakeAddress = searchParams.get('stakeAddress') ?? undefined;

  try {
    const result = await generateHubInsights(stakeAddress);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { insights: [], cardOrder: [], computedAt: new Date().toISOString() },
      { status: 200 },
    );
  }
}
