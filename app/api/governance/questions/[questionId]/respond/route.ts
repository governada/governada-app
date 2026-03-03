import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const { questionId } = await params;
    const { sessionToken, responseText } = await request.json();

    if (!sessionToken || !responseText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (responseText.length > 2000) {
      return NextResponse.json({ error: 'Response too long (max 2000 chars)' }, { status: 400 });
    }

    const parsed = parseSessionToken(sessionToken);
    if (!parsed || isSessionExpired(parsed)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the session user is the claimed DRep for this question
    const { data: question } = await supabase
      .from('drep_questions')
      .select('drep_id, status')
      .eq('id', questionId)
      .single();

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('claimed_drep_id')
      .eq('wallet_address', parsed.walletAddress)
      .single();

    if (!user || user.claimed_drep_id !== question.drep_id) {
      return NextResponse.json({ error: 'Only the claimed DRep can respond' }, { status: 403 });
    }

    // Check if already responded
    const { count } = await supabase
      .from('drep_responses')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', questionId);

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Already responded to this question' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('drep_responses')
      .insert({
        question_id: questionId,
        drep_id: question.drep_id,
        response_text: responseText.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Response insert error:', error);
      return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
    }

    // Update question status
    await supabase.from('drep_questions').update({ status: 'answered' }).eq('id', questionId);

    captureServerEvent('question_responded', {
      drep_id: question.drep_id,
      question_id: questionId,
      response_id: data.id,
      wallet: parsed.walletAddress,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Respond POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
