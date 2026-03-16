/**
 * Perspective Clusters API — fetch clustered perspectives for a proposal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { PerspectiveClustersData } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — fetch perspective clusters for a proposal
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(async (request: NextRequest) => {
  const txHash = request.nextUrl.searchParams.get('txHash');
  const indexParam = request.nextUrl.searchParams.get('index');

  if (!txHash || indexParam == null) {
    return NextResponse.json({ error: 'Missing txHash or index query parameter' }, { status: 400 });
  }

  const proposalIndex = parseInt(indexParam, 10);
  if (isNaN(proposalIndex) || proposalIndex < 0) {
    return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('perspective_clusters')
    .select('*')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch perspective clusters' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ data: null });
  }

  const result: PerspectiveClustersData = {
    proposalTxHash: data.proposal_tx_hash,
    proposalIndex: data.proposal_index,
    clusters: data.clusters ?? [],
    minorityPerspectives: (data.clusters ?? []).filter(
      (c: { isMinority?: boolean }) => c.isMinority,
    ),
    bridgingPoints: data.bridging_points ?? [],
    rationaleCount: data.rationale_count ?? 0,
    generatedAt: data.created_at,
  };

  return NextResponse.json({ data: result });
});
