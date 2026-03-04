import { NextRequest, NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase';
import { getSpendingEffectiveness } from '@/lib/treasury';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const txHash = searchParams.get('txHash');
  const index = searchParams.get('index');

  if (txHash && index) {
    const supabase = createClient();

    const [pollResult, responsesResult] = await Promise.all([
      supabase
        .from('treasury_accountability_polls')
        .select('*')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', parseInt(index))
        .order('cycle_number', { ascending: true }),
      supabase
        .from('treasury_accountability_responses')
        .select('cycle_number, delivered_rating, would_approve_again, evidence_text, created_at')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', parseInt(index))
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      polls: pollResult.data || [],
      responses: responsesResult.data || [],
    });
  }

  const effectiveness = await getSpendingEffectiveness();
  return NextResponse.json(effectiveness);
});

export const POST = withRouteHandler(async (request: NextRequest) => {
  const body = await request.json();
  const {
    txHash,
    index,
    cycleNumber,
    userAddress,
    deliveredRating,
    wouldApproveAgain,
    evidenceText,
  } = body;

  if (
    !txHash ||
    index === undefined ||
    !cycleNumber ||
    !userAddress ||
    !deliveredRating ||
    !wouldApproveAgain
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const validRatings = ['delivered', 'partial', 'not_delivered', 'too_early'];
  const validApproval = ['yes', 'no', 'unsure'];

  if (!validRatings.includes(deliveredRating) || !validApproval.includes(wouldApproveAgain)) {
    return NextResponse.json({ error: 'Invalid rating values' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: poll } = await supabase
    .from('treasury_accountability_polls')
    .select('status')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', index)
    .eq('cycle_number', cycleNumber)
    .single();

  if (!poll || poll.status !== 'open') {
    return NextResponse.json({ error: 'Poll is not currently open' }, { status: 400 });
  }

  const { error } = await supabase.from('treasury_accountability_responses').upsert(
    {
      proposal_tx_hash: txHash,
      proposal_index: index,
      cycle_number: cycleNumber,
      user_address: userAddress,
      delivered_rating: deliveredRating,
      would_approve_again: wouldApproveAgain,
      evidence_text: evidenceText?.slice(0, 500) || null,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'proposal_tx_hash,proposal_index,cycle_number,user_address' },
  );

  if (error) {
    logger.error('Failed to submit accountability response', {
      context: 'treasury/accountability',
      error: error.message,
      txHash,
      index,
    });
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
  }

  captureServerEvent(
    'treasury_accountability_vote_submitted',
    {
      proposal_tx_hash: txHash,
      proposal_index: index,
      cycle_number: cycleNumber,
      delivered_rating: deliveredRating,
      would_approve_again: wouldApproveAgain,
    },
    userAddress,
  );

  return NextResponse.json({ success: true });
});
