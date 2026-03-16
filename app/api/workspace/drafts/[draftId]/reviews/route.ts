/**
 * Draft Reviews API — list and submit structured community reviews for a draft.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SubmitReviewSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import type { DraftReview } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDraftId(pathname: string): string | null {
  // /api/workspace/drafts/[draftId]/reviews
  const match = pathname.match(/\/drafts\/([^/]+)\/reviews/);
  return match?.[1] ?? null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapReviewRow(row: any): DraftReview {
  return {
    id: row.id,
    draftId: row.draft_id,
    reviewerStakeAddress: row.reviewer_stake_address,
    impactScore: row.impact_score,
    feasibilityScore: row.feasibility_score,
    constitutionalScore: row.constitutional_score,
    valueScore: row.value_score,
    feedbackText: row.feedback_text,
    feedbackThemes: row.feedback_themes ?? [],
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// GET — list reviews for a draft with aggregate scores
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(async (request: NextRequest) => {
  const draftId = extractDraftId(request.nextUrl.pathname);
  if (!draftId) {
    return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('draft_reviews')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  const reviews: DraftReview[] = (data ?? []).map(mapReviewRow);

  // Compute aggregate scores
  const scores = { impact: 0, feasibility: 0, constitutional: 0, value: 0 };
  const counts = { impact: 0, feasibility: 0, constitutional: 0, value: 0 };

  for (const r of reviews) {
    if (r.impactScore != null) {
      scores.impact += r.impactScore;
      counts.impact++;
    }
    if (r.feasibilityScore != null) {
      scores.feasibility += r.feasibilityScore;
      counts.feasibility++;
    }
    if (r.constitutionalScore != null) {
      scores.constitutional += r.constitutionalScore;
      counts.constitutional++;
    }
    if (r.valueScore != null) {
      scores.value += r.valueScore;
      counts.value++;
    }
  }

  const aggregateScores = {
    impact: counts.impact > 0 ? +(scores.impact / counts.impact).toFixed(1) : null,
    feasibility:
      counts.feasibility > 0 ? +(scores.feasibility / counts.feasibility).toFixed(1) : null,
    constitutional:
      counts.constitutional > 0
        ? +(scores.constitutional / counts.constitutional).toFixed(1)
        : null,
    value: counts.value > 0 ? +(scores.value / counts.value).toFixed(1) : null,
  };

  // Also fetch responses for each review
  const reviewIds = reviews.map((r) => r.id);
  let responsesByReview: Record<
    string,
    Array<{ id: string; responseType: string; responseText: string; createdAt: string }>
  > = {};

  if (reviewIds.length > 0) {
    const { data: responses } = await admin
      .from('draft_review_responses')
      .select('*')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true });

    if (responses) {
      responsesByReview = {};
      for (const resp of responses) {
        const key = resp.review_id as string;
        if (!responsesByReview[key]) responsesByReview[key] = [];
        responsesByReview[key].push({
          id: resp.id,
          responseType: resp.response_type,
          responseText: resp.response_text,
          createdAt: resp.created_at,
        });
      }
    }
  }

  return NextResponse.json({
    reviews,
    aggregateScores,
    responsesByReview,
    total: reviews.length,
  });
});

// ---------------------------------------------------------------------------
// POST — submit a structured review
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const draftId = extractDraftId(request.nextUrl.pathname);
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const body = SubmitReviewSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Verify draft exists and is in community_review stage
    const { data: draft } = await admin
      .from('proposal_drafts')
      .select('id, owner_stake_address, status')
      .eq('id', draftId)
      .single();

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status !== 'community_review') {
      return NextResponse.json(
        { error: 'Draft is not in community review stage' },
        { status: 400 },
      );
    }

    // Verify reviewer is NOT the draft owner
    if (body.reviewerStakeAddress === draft.owner_stake_address) {
      return NextResponse.json({ error: 'Cannot review your own draft' }, { status: 403 });
    }

    // Check for duplicate review
    const { data: existing } = await admin
      .from('draft_reviews')
      .select('id')
      .eq('draft_id', draftId)
      .eq('reviewer_stake_address', body.reviewerStakeAddress)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already submitted a review for this draft' },
        { status: 409 },
      );
    }

    // Insert review
    const { data: review, error: insertError } = await admin
      .from('draft_reviews')
      .insert({
        draft_id: draftId,
        reviewer_stake_address: body.reviewerStakeAddress,
        impact_score: body.impactScore ?? null,
        feasibility_score: body.feasibilityScore ?? null,
        constitutional_score: body.constitutionalScore ?? null,
        value_score: body.valueScore ?? null,
        feedback_text: body.feedbackText,
        feedback_themes: body.feedbackThemes ?? [],
      })
      .select()
      .single();

    if (insertError || !review) {
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    captureServerEvent(
      'author_review_submitted',
      {
        draft_id: draftId,
        review_id: review.id,
        reviewer: body.reviewerStakeAddress,
        has_scores:
          body.impactScore != null ||
          body.feasibilityScore != null ||
          body.constitutionalScore != null ||
          body.valueScore != null,
        theme_count: (body.feedbackThemes ?? []).length,
      },
      ctx.wallet ?? body.reviewerStakeAddress,
    );

    return NextResponse.json({ review: mapReviewRow(review) }, { status: 201 });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
