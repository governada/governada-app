/**
 * Draft Stage Transition API — move a draft through its lifecycle stages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { StageTransitionSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import type { DraftStatus } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMUNITY_REVIEW_MIN_HOURS = 48;
const FCP_MIN_HOURS = 72;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDraftId(pathname: string): string | null {
  // /api/workspace/drafts/[draftId]/stage
  const match = pathname.match(/\/drafts\/([^/]+)\/stage/);
  return match?.[1] ?? null;
}

function hoursSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff / (1000 * 60 * 60);
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateTransition(
  currentStage: DraftStatus,
  targetStage: DraftStatus,
  draft: {
    title: string | null;
    abstract: string | null;
    motivation: string | null;
    rationale: string | null;
    community_review_started_at: string | null;
    fcp_started_at: string | null;
  },
  reviewCount: number,
  unrespondedCount: number,
): ValidationResult {
  const errors: string[] = [];

  // Archived is always allowed
  if (targetStage === 'archived') {
    return { valid: true, errors: [] };
  }

  // Validate: draft -> community_review
  if (currentStage === 'draft' && targetStage === 'community_review') {
    if (!draft.title?.trim()) errors.push('Title is required');
    if (!draft.abstract?.trim()) errors.push('Abstract is required');
    if (!draft.motivation?.trim()) errors.push('Motivation is required');
    if (!draft.rationale?.trim()) errors.push('Rationale is required');
    return { valid: errors.length === 0, errors };
  }

  // Validate: community_review -> response_revision
  if (currentStage === 'community_review' && targetStage === 'response_revision') {
    const hoursAtReview = hoursSince(draft.community_review_started_at);
    if (hoursAtReview < COMMUNITY_REVIEW_MIN_HOURS) {
      const remaining = Math.ceil(COMMUNITY_REVIEW_MIN_HOURS - hoursAtReview);
      errors.push(
        `Minimum ${COMMUNITY_REVIEW_MIN_HOURS}h at Community Review not met (${remaining}h remaining)`,
      );
    }
    if (reviewCount === 0) {
      errors.push('At least one community review is required');
    }
    return { valid: errors.length === 0, errors };
  }

  // Validate: response_revision -> final_comment
  if (currentStage === 'response_revision' && targetStage === 'final_comment') {
    if (unrespondedCount > 0) {
      errors.push(`${unrespondedCount} review(s) still need a response`);
    }
    return { valid: errors.length === 0, errors };
  }

  // Validate: final_comment -> submitted
  if (currentStage === 'final_comment' && targetStage === 'submitted') {
    const hoursAtFcp = hoursSince(draft.fcp_started_at);
    if (hoursAtFcp < FCP_MIN_HOURS) {
      const remaining = Math.ceil(FCP_MIN_HOURS - hoursAtFcp);
      errors.push(
        `Minimum ${FCP_MIN_HOURS}h at Final Comment Period not met (${remaining}h remaining)`,
      );
    }
    return { valid: errors.length === 0, errors };
  }

  errors.push(`Invalid transition: ${currentStage} -> ${targetStage}`);
  return { valid: false, errors };
}

// ---------------------------------------------------------------------------
// POST — transition draft to next stage
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const draftId = extractDraftId(request.nextUrl.pathname);
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const body = StageTransitionSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Fetch current draft
    const { data: draft } = await admin
      .from('proposal_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify caller is the draft owner
    if (!ctx.wallet || ctx.wallet !== draft.owner_stake_address) {
      return NextResponse.json(
        { error: 'Only the draft owner can transition stages' },
        { status: 403 },
      );
    }

    const currentStage = draft.status as DraftStatus;
    const targetStage = body.targetStage as DraftStatus;

    // Count reviews and unresponded reviews for validation
    let reviewCount = 0;
    let unrespondedCount = 0;

    if (currentStage === 'community_review' || currentStage === 'response_revision') {
      const { data: reviews } = await admin
        .from('draft_reviews')
        .select('id')
        .eq('draft_id', draftId);

      reviewCount = reviews?.length ?? 0;

      if (reviewCount > 0) {
        const reviewIds = (reviews ?? []).map((r) => r.id);
        const { data: responses } = await admin
          .from('draft_review_responses')
          .select('review_id')
          .in('review_id', reviewIds);

        const respondedIds = new Set((responses ?? []).map((r) => r.review_id));
        unrespondedCount = reviewIds.filter((id) => !respondedIds.has(id)).length;
      }
    }

    // Validate transition
    const validation = validateTransition(
      currentStage,
      targetStage,
      draft,
      reviewCount,
      unrespondedCount,
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Transition validation failed', details: validation.errors },
        { status: 400 },
      );
    }

    // Build update fields
    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = {
      status: targetStage,
      stage_entered_at: now,
      updated_at: now,
    };

    if (targetStage === 'community_review') {
      updateFields.community_review_started_at = now;
    }

    if (targetStage === 'final_comment') {
      updateFields.fcp_started_at = now;
    }

    const { data: updated, error: updateError } = await admin
      .from('proposal_drafts')
      .update(updateFields)
      .eq('id', draftId)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Failed to update draft stage' }, { status: 500 });
    }

    captureServerEvent(
      'author_stage_transitioned',
      {
        draft_id: draftId,
        from_stage: currentStage,
        to_stage: targetStage,
      },
      ctx.wallet,
    );

    return NextResponse.json({
      success: true,
      previousStage: currentStage,
      currentStage: targetStage,
      stageEnteredAt: now,
    });
  },
  { auth: 'required' },
);
