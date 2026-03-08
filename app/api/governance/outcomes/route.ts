/**
 * Proposal Outcome Tracking API — WP-12
 *
 * GET /api/governance/outcomes?txHash=...&index=...  — single proposal outcome
 * GET /api/governance/outcomes?drepId=...             — DRep outcome summary
 * GET /api/governance/outcomes?status=delivered       — list by delivery status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProposalOutcome,
  getDRepOutcomeSummary,
  type DeliveryStatus,
} from '@/lib/proposalOutcomes';
import { createClient } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const txHash = searchParams.get('txHash');
  const index = searchParams.get('index');
  const drepId = searchParams.get('drepId');
  const status = searchParams.get('status') as DeliveryStatus | null;

  // Single proposal outcome
  if (txHash && index) {
    const outcome = await getProposalOutcome(txHash, parseInt(index, 10));
    if (!outcome) {
      return NextResponse.json({ error: 'No outcome data for this proposal' }, { status: 404 });
    }
    return NextResponse.json(outcome);
  }

  // DRep outcome summary
  if (drepId) {
    const summary = await getDRepOutcomeSummary(drepId);
    return NextResponse.json(summary);
  }

  // List outcomes by status
  if (status) {
    const validStatuses: DeliveryStatus[] = [
      'in_progress',
      'delivered',
      'partial',
      'not_delivered',
      'unknown',
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('proposal_outcomes')
      .select('*, proposals!fk_proposal(title, proposal_type, withdrawal_amount, treasury_tier)')
      .eq('delivery_status', status)
      .order('delivery_score', { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch outcomes' }, { status: 500 });
    }

    return NextResponse.json({ outcomes: data });
  }

  return NextResponse.json(
    { error: 'Provide txHash+index, drepId, or status parameter' },
    { status: 400 },
  );
});
