import { NextRequest, NextResponse } from 'next/server';
import { computeInterBodyAlignment, getSystemAlignment } from '@/lib/interBodyAlignment';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const proposal = request.nextUrl.searchParams.get('proposal');

    if (proposal) {
      const parts = proposal.split('-');
      if (parts.length < 2) {
        return NextResponse.json(
          { error: 'proposal must be in format txHash-index' },
          { status: 400 },
        );
      }
      const index = parseInt(parts.pop()!);
      const txHash = parts.join('-');

      const alignment = await computeInterBodyAlignment(txHash, index);
      return NextResponse.json(alignment, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    const system = await getSystemAlignment();
    return NextResponse.json(system, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('[governance/inter-body] Error:', error);
    return NextResponse.json({ error: 'Failed to compute alignment' }, { status: 500 });
  }
}
