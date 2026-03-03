import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: questions, error } = await supabase
    .from('drep_questions')
    .select('id, drep_id, asker_wallet, question_text, created_at, status')
    .eq('drep_id', drepId)
    .neq('status', 'hidden')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Q&A list error:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }

  const questionIds = (questions || []).map((q) => q.id);
  let responses: any[] = [];
  if (questionIds.length > 0) {
    const { data } = await supabase
      .from('drep_responses')
      .select('id, question_id, drep_id, response_text, created_at')
      .in('question_id', questionIds);
    responses = data || [];
  }

  const responseMap = new Map<string, any>();
  for (const r of responses) {
    responseMap.set(r.question_id, r);
  }

  const result = (questions || []).map((q) => ({
    ...q,
    askerWallet: q.asker_wallet,
    questionText: q.question_text,
    createdAt: q.created_at,
    response: responseMap.get(q.id) || null,
  }));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { sessionToken, drepId, questionText } = await request.json();

    if (!sessionToken || !drepId || !questionText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (questionText.length > 500) {
      return NextResponse.json({ error: 'Question too long (max 500 chars)' }, { status: 400 });
    }

    const parsed = parseSessionToken(sessionToken);
    if (!parsed || isSessionExpired(parsed)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = parsed.walletAddress;
    const supabase = getSupabaseAdmin();

    // Rate limit: 3 questions per day per wallet per DRep
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
      })
      .select()
      .single();

    if (error) {
      console.error('Q&A insert error:', error);
      return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 });
    }

    captureServerEvent('question_submitted', {
      drep_id: drepId,
      question_id: data.id,
      wallet,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Q&A POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
