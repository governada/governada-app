import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { QuestionRespondSchema } from '@/lib/api/schemas/governance';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const questionId = request.nextUrl.pathname.split('/')[4];
    const body = await request.json();
    const { sessionToken, responseText } = QuestionRespondSchema.parse(body);

    const parsed = await validateSessionToken(sessionToken);
    if (!parsed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

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
      logger.error('Response insert error', {
        context: 'governance/questions/:questionId/respond',
        error: error?.message,
      });
      return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
    }

    await supabase.from('drep_questions').update({ status: 'answered' }).eq('id', questionId);

    captureServerEvent('question_responded', {
      drep_id: question.drep_id,
      question_id: questionId,
      response_id: data.id,
      wallet: parsed.walletAddress,
    });

    return NextResponse.json(data, { status: 201 });
  },
  { auth: 'none', rateLimit: { max: 20, window: 60 } },
);
