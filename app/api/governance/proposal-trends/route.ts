import { NextResponse } from 'next/server';
import { detectProposalTrends } from '@/lib/proposalTrends';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  try {
    const trends = await detectProposalTrends();
    return NextResponse.json(trends);
  } catch (err) {
    console.error('[ProposalTrends]', err);
    return NextResponse.json({ trends: [], epochRange: { start: 0, end: 0 }, totalProposals: 0 });
  }
}
