import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { DrepPositionSchema } from '@/lib/api/schemas/drep';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('position_statements')
    .select('*')
    .eq('drep_id', drepId)
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const drepId = request.nextUrl.pathname.split('/')[3];
    const body = await request.json();
    const { sessionToken, proposalTxHash, proposalIndex, statementText } =
      DrepPositionSchema.parse(body);

    const parsed = await validateSessionToken(sessionToken);
    if (!parsed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('claimed_drep_id')
      .eq('wallet_address', parsed.walletAddress)
      .single();

    if (!user || user.claimed_drep_id !== drepId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('position_statements')
      .upsert(
        {
          drep_id: drepId,
          proposal_tx_hash: proposalTxHash,
          proposal_index: proposalIndex,
          statement_text: statementText,
        },
        { onConflict: 'drep_id,proposal_tx_hash,proposal_index' },
      )
      .select()
      .single();

    if (error) {
      logger.error('Error', { context: 'positions-post', error: error?.message });
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    captureServerEvent('position_statement_created', { drep_id: drepId }, drepId);

    return NextResponse.json(data);
  },
  { auth: 'none', rateLimit: { max: 20, window: 60 } },
);
