export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import {
  buildSystemsTrustSurfaceReviewPayload,
  buildSystemsTrustSurfaceReviewTarget,
  SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
} from '@/lib/admin/systemsTrustSurface';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function logSystemsTrustSurfaceReview(request: NextRequest, ctx: RouteContext) {
  if (!isAdminWallet(ctx.wallet!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = buildSystemsTrustSurfaceReviewPayload({
    ...(await request.json()),
    actorType: 'manual',
  });
  const target = buildSystemsTrustSurfaceReviewTarget(payload);
  const supabase = getSupabaseAdmin();

  const { data: review, error: reviewError } = await supabase
    .from('systems_trust_surface_reviews')
    .insert({
      actor_type: payload.actorType,
      wallet_address: ctx.wallet!,
      review_date: payload.reviewDate,
      overall_status: payload.overallStatus,
      linked_slo_ids: payload.linkedSloIds,
      reviewed_surfaces: payload.reviewedSurfaces,
      summary: payload.summary,
      current_user_state: payload.currentUserState,
      honesty_gap: payload.honestyGap,
      next_fix: payload.nextFix,
      owner: payload.owner,
      artifact_url: payload.artifactUrl ?? null,
      notes: payload.notes ?? null,
    })
    .select('id')
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: 'Failed to log trust-surface review' }, { status: 500 });
  }

  const { error } = await supabase.from('admin_audit_log').insert({
    user_id: ctx.wallet,
    action: SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
    target,
    payload,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to log trust-surface review' }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: review.id,
      reviewDate: payload.reviewDate,
      overallStatus: payload.overallStatus,
      reviewedSurfaces: payload.reviewedSurfaces,
    },
    { status: 201 },
  );
}

export const POST = withRouteHandler(logSystemsTrustSurfaceReview, {
  auth: 'required',
  rateLimit: { max: 20, window: 60 },
});
