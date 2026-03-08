import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { QuestionSchema } from '@/lib/api/schemas/governance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: questions, error } = await supabase
    .from('drep_questions')
    .select(
      'id, drep_id, asker_wallet, question_text, created_at, status, proposal_tx_hash, proposal_index',
    )
    .eq('drep_id', drepId)
    .neq('status', 'hidden')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('Q&A list error', { context: 'governance/questions', error: error?.message });
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }

  const questionIds = (questions || []).map((q) => q.id);
  let responses: {
    id: string;
    question_id: string;
    drep_id: string;
    response_text: string;
    created_at: string;
  }[] = [];
  if (questionIds.length > 0) {
    const { data } = await supabase
      .from('drep_responses')
      .select('id, question_id, drep_id, response_text, created_at')
      .in('question_id', questionIds);
    responses = data || [];
  }

  const responseMap = new Map<string, (typeof responses)[number]>();
  for (const r of responses) {
    responseMap.set(r.question_id, r);
  }

  const result = (questions || []).map((q) => ({
    ...q,
    askerWallet: q.asker_wallet,
    questionText: q.question_text,
    createdAt: q.created_at,
    proposalTxHash: q.proposal_tx_hash || null,
    proposalIndex: q.proposal_index ?? null,
    response: responseMap.get(q.id) || null,
  }));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const { sessionToken, drepId, questionText, proposalTxHash, proposalIndex } =
      QuestionSchema.parse(body);

    const parsed = await validateSessionToken(sessionToken);
    if (!parsed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = parsed.walletAddress;
    const supabase = getSupabaseAdmin();

    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from('drep_questions')
      .select('id', { count: 'exact', head: true })
      .eq('asker_wallet', wallet)
      .eq('drep_id', drepId)
      .gte('created_at', dayAgo);

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Rate limit: max 3 questions per day per DRep' },
        { status: 429 },
      );
    }

    const { data, error } = await supabase
      .from('drep_questions')
      .insert({
        drep_id: drepId,
        asker_wallet: wallet,
        question_text: questionText.trim(),
        user_id: parsed.userId || null,
        ...(proposalTxHash && { proposal_tx_hash: proposalTxHash }),
        ...(proposalIndex != null && { proposal_index: proposalIndex }),
      })
      .select()
      .single();

    if (error) {
      logger.error('Q&A insert error', { context: 'governance/questions', error: error?.message });
      return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 });
    }

    captureServerEvent('question_submitted', {
      drep_id: drepId,
      question_id: data.id,
      wallet,
    });

    return NextResponse.json(data, { status: 201 });
  },
  { auth: 'none' },
);
