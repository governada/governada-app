/**
 * Review Response API — author responds to a community review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { RespondToReviewSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractIds(pathname: string): { draftId: string; reviewId: string } | null {
  // /api/workspace/drafts/[draftId]/reviews/[reviewId]/respond
  const match = pathname.match(/\/drafts\/([^/]+)\/reviews\/([^/]+)\/respond/);
  if (!match) return null;
  return { draftId: match[1], reviewId: match[2] };
}

// ---------------------------------------------------------------------------
// POST — author responds to a review
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const ids = extractIds(request.nextUrl.pathname);
    if (!ids) {
      return NextResponse.json({ error: 'Missing draftId or reviewId' }, { status: 400 });
    }

    const { draftId, reviewId } = ids;
    const body = RespondToReviewSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Verify draft exists and the responder IS the owner
    const { data: draft } = await admin
      .from('proposal_drafts')
      .select('id, owner_stake_address, status')
      .eq('id', draftId)
      .single();

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify the caller's wallet is the draft owner
    if (!ctx.wallet || ctx.wallet !== draft.owner_stake_address) {
      return NextResponse.json(
        { error: 'Only the draft owner can respond to reviews' },
        { status: 403 },
      );
    }

    // Verify the review belongs to this draft
    const { data: review } = await admin
      .from('draft_reviews')
      .select('id, draft_id')
      .eq('id', reviewId)
      .eq('draft_id', draftId)
      .single();

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Insert response
    const { data: response, error: insertError } = await admin
      .from('draft_review_responses')
      .insert({
        review_id: reviewId,
        response_type: body.responseType,
        response_text: body.responseText,
      })
      .select()
      .single();

    if (insertError || !response) {
      return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
    }

    captureServerEvent(
      'author_review_responded',
      {
        draft_id: draftId,
        review_id: reviewId,
        response_type: body.responseType,
      },
      ctx.wallet,
    );

    return NextResponse.json(
      {
        response: {
          id: response.id,
          reviewId: response.review_id,
          responseType: response.response_type,
          responseText: response.response_text,
          createdAt: response.created_at,
        },
      },
      { status: 201 },
    );
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);
