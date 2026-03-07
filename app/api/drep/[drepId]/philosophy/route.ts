import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { DrepPhilosophySchema } from '@/lib/api/schemas/drep';
import { buildAndHashRationale } from '@/lib/rationale';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('governance_philosophy')
    .select('philosophy_text, updated_at, anchor_hash')
    .eq('drep_id', drepId)
    .single();

  const anchorUrl = data?.anchor_hash ? `${BASE_URL}/api/rationale/${data.anchor_hash}` : null;

  return NextResponse.json({
    philosophy_text: data?.philosophy_text ?? null,
    updated_at: data?.updated_at ?? null,
    anchor_url: anchorUrl,
    anchor_hash: data?.anchor_hash ?? null,
  });
}

export const POST = withRouteHandler(
  async (request: NextRequest, { requestId }: RouteContext) => {
    const drepId = request.nextUrl.pathname.split('/')[3];
    const body = await request.json();
    const { sessionToken, philosophyText } = DrepPhilosophySchema.parse(body);

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

    // Build CIP-100 document and store it
    const { document, contentHash } = buildAndHashRationale(philosophyText, drepId);
    const anchorUrl = `${BASE_URL}/api/rationale/${contentHash}`;

    // Store CIP-100 document (idempotent by content hash)
    await supabase.from('rationale_documents').upsert(
      {
        content_hash: contentHash,
        drep_id: drepId,
        proposal_tx_hash: 'governance_statement',
        proposal_index: 0,
        document,
        rationale_text: philosophyText,
      },
      { onConflict: 'content_hash' },
    );

    // Save philosophy with anchor reference
    const { data, error } = await supabase
      .from('governance_philosophy')
      .upsert(
        {
          drep_id: drepId,
          philosophy_text: philosophyText,
          anchor_hash: contentHash,
        },
        { onConflict: 'drep_id' },
      )
      .select()
      .single();

    if (error) {
      logger.error('Error', { context: 'philosophy-post', error: error?.message });
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    captureServerEvent('philosophy_updated', { drep_id: drepId, anchor_hash: contentHash }, drepId);

    return NextResponse.json({
      ...data,
      anchor_url: anchorUrl,
      anchor_hash: contentHash,
    });
  },
  { auth: 'none', rateLimit: { max: 20, window: 60 } },
);
