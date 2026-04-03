import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import {
  buildReviewDiscipline,
  createSystemsReviewSchema,
  summarizeReview,
  toSystemsCommitment,
  toSystemsReviewRecord,
} from '@/lib/admin/systemsReview';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const [reviewsResult, commitmentsResult] = await Promise.all([
      supabase
        .from('systems_reviews')
        .select(
          'id, review_date, reviewed_at, overall_status, focus_area, summary, top_risk, change_notes, linked_slo_ids',
        )
        .order('reviewed_at', { ascending: false })
        .limit(8),
      supabase
        .from('systems_commitments')
        .select(
          'id, review_id, title, summary, owner, status, due_date, linked_slo_ids, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(16),
    ]);

    const commitmentRows = commitmentsResult.data || [];
    const commitmentsByReview = new Map(
      commitmentRows.map((row) => [row.review_id, toSystemsCommitment(row)]),
    );
    const reviewHistory = (reviewsResult.data || []).map((row) =>
      toSystemsReviewRecord(row, commitmentsByReview.get(row.id) ?? null),
    );
    const openCommitments = commitmentRows
      .map(toSystemsCommitment)
      .filter((commitment) => commitment.status !== 'done');

    return NextResponse.json({
      reviewDiscipline: buildReviewDiscipline(reviewHistory, openCommitments),
      openCommitments,
      reviewHistory,
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);

export const POST = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = createSystemsReviewSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const reviewSummary = summarizeReview(body.topRisk, body.changeNotes);

    const { data: review, error: reviewError } = await supabase
      .from('systems_reviews')
      .insert({
        review_date: body.reviewDate,
        reviewed_at: new Date().toISOString(),
        wallet_address: ctx.wallet,
        overall_status: body.overallStatus,
        focus_area: body.focusArea,
        summary: reviewSummary,
        top_risk: body.topRisk,
        change_notes: body.changeNotes,
        linked_slo_ids: body.linkedSloIds,
      })
      .select('id')
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Failed to create systems review' }, { status: 500 });
    }

    const { data: commitment, error: commitmentError } = await supabase
      .from('systems_commitments')
      .insert({
        review_id: review.id,
        wallet_address: ctx.wallet,
        title: body.hardeningCommitmentTitle,
        summary: body.hardeningCommitmentSummary,
        owner: body.commitmentOwner,
        status: 'planned',
        due_date: body.commitmentDueDate ?? null,
        linked_slo_ids: body.linkedSloIds,
      })
      .select('id')
      .single();

    if (commitmentError || !commitment) {
      await supabase.from('systems_reviews').delete().eq('id', review.id);
      return NextResponse.json({ error: 'Failed to create hardening commitment' }, { status: 500 });
    }

    await logAdminAction(ctx.wallet!, 'log_systems_review', review.id, {
      commitmentId: commitment.id,
      overallStatus: body.overallStatus,
      focusArea: body.focusArea,
      linkedSloIds: body.linkedSloIds,
    });

    return NextResponse.json({ reviewId: review.id, commitmentId: commitment.id }, { status: 201 });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);
