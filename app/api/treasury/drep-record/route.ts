import { NextRequest, NextResponse } from 'next/server';
import { getDRepTreasuryTrackRecord } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const drepId = request.nextUrl.searchParams.get('drepId');
    if (!drepId) {
      return NextResponse.json({ error: 'drepId parameter required' }, { status: 400 });
    }

    const record = await getDRepTreasuryTrackRecord(drepId);

    return NextResponse.json(record, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[treasury/drep-record] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch DRep treasury record' }, { status: 500 });
  }
}
