/**
 * Rationale Submission API
 * POST: Accepts rationale text, builds CIP-100 JSON-LD, stores in Supabase,
 *       returns the anchor URL and Blake2b-256 hash for on-chain vote anchoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildAndHashRationale } from '@/lib/rationale';
import { BASE_URL } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { captureServerEvent } from '@/lib/posthog-server';
import { RationaleSubmitSchema } from '@/lib/api/schemas/governance';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest, { requestId }: RouteContext) => {
    const body = RationaleSubmitSchema.parse(await request.json());

    const { document, contentHash } = buildAndHashRationale(body.rationaleText, body.drepId);

    const anchorUrl = `${BASE_URL}/api/rationale/${contentHash}`;

    // Upsert: if same content hash exists, just return the URL
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('rationale_documents').upsert(
      {
        content_hash: contentHash,
        drep_id: body.drepId,
        proposal_tx_hash: body.proposalTxHash,
        proposal_index: body.proposalIndex,
        document,
        rationale_text: body.rationaleText,
      },
      { onConflict: 'content_hash' },
    );

    if (error) {
      logger.error('[Rationale] Failed to store document', { error, requestId });
      return NextResponse.json({ error: 'Failed to store rationale' }, { status: 500 });
    }

    logger.info('[Rationale] Document stored', {
      contentHash,
      drepId: body.drepId,
      proposalTxHash: body.proposalTxHash,
      requestId,
    });

    captureServerEvent(
      'rationale_submitted',
      {
        drep_id: body.drepId,
        proposal_tx_hash: body.proposalTxHash,
        proposal_index: body.proposalIndex,
        content_hash: contentHash,
        rationale_length: body.rationaleText.length,
      },
      body.drepId,
    );

    return NextResponse.json({
      anchorUrl,
      anchorHash: contentHash,
      contentHash,
    });
  },
  { auth: 'none', rateLimit: { max: 20, window: 60 } },
);
