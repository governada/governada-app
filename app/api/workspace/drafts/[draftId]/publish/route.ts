/**
 * CIP-108 Metadata Publish API
 * POST: Publishes the CIP-108 governance proposal metadata document for a draft.
 *
 * Auth: required (must be the draft owner).
 * Flow:
 *   1. Validate draft is in 'final_comment' or 'submitted' status
 *   2. Build CIP-108 JSON-LD from draft content
 *   3. Store as content-addressable row in cip108_documents
 *   4. Return { anchorUrl, anchorHash, document }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildCip108Document, hashCip108 } from '@/lib/workspace/cip108';
import { BASE_URL } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest, { requestId, wallet }: RouteContext) => {
    // Extract draftId from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    // Path: /api/workspace/drafts/[draftId]/publish
    const draftIdIndex = segments.indexOf('drafts') + 1;
    const draftId = segments[draftIdIndex];

    if (!draftId || draftId === 'publish') {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the draft and verify ownership
    const { data: draft, error: fetchError } = await supabase
      .from('proposal_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify the authenticated wallet owns this draft
    if (draft.owner_stake_address !== wallet) {
      return NextResponse.json({ error: 'Not authorized to publish this draft' }, { status: 403 });
    }

    // Validate draft status
    const allowedStatuses = ['final_comment', 'submitted'];
    if (!allowedStatuses.includes(draft.status)) {
      return NextResponse.json(
        {
          error: `Draft must be in 'final_comment' or 'submitted' status to publish. Current status: ${draft.status}`,
        },
        { status: 400 },
      );
    }

    // Build CIP-108 document
    const document = buildCip108Document({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
    });
    const contentHash = hashCip108(document);

    const anchorUrl = `${BASE_URL}/api/workspace/cip108/${contentHash}`;

    // Store the CIP-108 document (upsert: if same content hash exists, reuse)
    const { error: storeError } = await supabase.from('cip108_documents').upsert(
      {
        content_hash: contentHash,
        draft_id: draftId,
        owner_stake_address: draft.owner_stake_address,
        document,
      },
      { onConflict: 'content_hash' },
    );

    if (storeError) {
      logger.error('[CIP-108] Failed to store document', {
        error: storeError,
        draftId,
        requestId,
      });
      return NextResponse.json({ error: 'Failed to store CIP-108 document' }, { status: 500 });
    }

    // Update the draft with anchor info
    const { error: updateError } = await supabase
      .from('proposal_drafts')
      .update({
        submitted_anchor_url: anchorUrl,
        submitted_anchor_hash: contentHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    if (updateError) {
      logger.warn('[CIP-108] Document stored but draft update failed', {
        error: updateError,
        draftId,
        requestId,
      });
    }

    logger.info('[CIP-108] Document published', {
      contentHash,
      draftId,
      requestId,
    });

    captureServerEvent(
      'governance_action_published',
      {
        draft_id: draftId,
        content_hash: contentHash,
        proposal_type: draft.proposal_type,
        title_length: draft.title.length,
      },
      draft.owner_stake_address,
    );

    return NextResponse.json({
      anchorUrl,
      anchorHash: contentHash,
      document,
    });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
