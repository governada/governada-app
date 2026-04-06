/**
 * Voting Summary API — fetch the latest voting tallies for a proposal.
 *
 * GET /api/workspace/proposals/[txHash]/[index]/voting-summary
 * Returns aggregated vote counts and power by body (DRep, CC, SPO).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { fetchLatestProposalVotingSummary } from '@/lib/governance/proposalVotingSummary';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function extractParams(pathname: string): { txHash: string; index: number } | null {
  const match = pathname.match(/\/proposals\/([^/]+)\/(\d+)\/voting-summary/);
  if (!match) return null;
  return { txHash: match[1], index: parseInt(match[2], 10) };
}

export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const params = extractParams(request.nextUrl.pathname);
    if (!params) {
      return NextResponse.json({ error: 'Missing txHash or index' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch the most recent voting summary for this proposal
    const row = await fetchLatestProposalVotingSummary(
      admin,
      {
        txHash: params.txHash,
        proposalIndex: params.index,
      },
      '*',
      { throwOnError: true },
    );

    if (!row) {
      return NextResponse.json({ summary: null });
    }

    return NextResponse.json({
      summary: {
        drepYesPower: row.drep_yes_vote_power ?? 0,
        drepNoPower: row.drep_no_vote_power ?? 0,
        drepAbstainPower: row.drep_abstain_vote_power ?? 0,
        drepYesCount: row.drep_yes_votes_cast ?? 0,
        drepNoCount: row.drep_no_votes_cast ?? 0,
        drepAbstainCount: row.drep_abstain_votes_cast ?? 0,
        ccYesCount: row.committee_yes_votes_cast ?? 0,
        ccNoCount: row.committee_no_votes_cast ?? 0,
        ccAbstainCount: row.committee_abstain_votes_cast ?? 0,
        spoYesCount: row.pool_yes_votes_cast ?? 0,
        spoNoCount: row.pool_no_votes_cast ?? 0,
        spoAbstainCount: row.pool_abstain_votes_cast ?? 0,
      },
    });
  },
  { auth: 'optional' },
);
