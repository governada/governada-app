import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { z } from 'zod';
import { SessionTokenSchema } from '@/lib/api/schemas/common';

export const dynamic = 'force-dynamic';

const GeneralStatementSchema = z.object({
  sessionToken: SessionTokenSchema,
  statementText: z.string().min(1, 'statementText is required').max(5000),
});

/**
 * GET /api/drep/[drepId]/statements
 * Returns general (non-proposal-specific) position statements for a DRep.
 * These are stored in position_statements with proposal_tx_hash = 'general'.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('position_statements')
    .select('id, drep_id, statement_text, created_at')
    .eq('drep_id', drepId)
    .eq('proposal_tx_hash', 'general')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(data || []);
}

/**
 * POST /api/drep/[drepId]/statements
 * Creates a general governance statement (not tied to a specific proposal).
 * Only the DRep owner (claimed DRep) can post statements.
 */
export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const drepId = decodeURIComponent(request.nextUrl.pathname.split('/')[3]);
    const body = await request.json();
    const { sessionToken, statementText } = GeneralStatementSchema.parse(body);

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
      return NextResponse.json({ error: 'Not authorized for this DRep' }, { status: 403 });
    }

    // Use 'general' as sentinel tx_hash and a unique index per statement
    // to avoid upsert conflicts with proposal-specific statements
    const uniqueIndex = Date.now() % 2147483647; // fits in int4

    const { data, error } = await supabase
      .from('position_statements')
      .insert({
        drep_id: drepId,
        proposal_tx_hash: 'general',
        proposal_index: uniqueIndex,
        statement_text: statementText.trim(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating general statement', {
        context: 'drep-statements',
        error: error?.message,
      });
      return NextResponse.json({ error: 'Failed to save statement' }, { status: 500 });
    }

    captureServerEvent('drep_statement_created', { drep_id: drepId }, drepId);

    return NextResponse.json(data, { status: 201 });
  },
  { auth: 'none', rateLimit: { max: 10, window: 60 } },
);
