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
      id: target,
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
