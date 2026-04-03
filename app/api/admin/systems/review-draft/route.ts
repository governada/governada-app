export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildSystemsDashboardData } from '@/lib/admin/systemsDashboard';
import {
  buildSystemsReviewDraft,
  SYSTEMS_REVIEW_DRAFT_ACTION,
} from '@/lib/admin/systemsReviewDraft';

type ReviewDraftActor = {
  actor: string;
  actorType: 'manual' | 'cron';
};

function resolveReviewDraftActor(request: NextRequest, ctx: RouteContext): ReviewDraftActor | null {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { actor: 'system:systems-review-draft', actorType: 'cron' };
  }

  if (ctx.wallet && isAdminWallet(ctx.wallet)) {
    return { actor: ctx.wallet, actorType: 'manual' };
  }

  return null;
}

async function generateSystemsReviewDraftRoute(request: NextRequest, ctx: RouteContext) {
  const actor = resolveReviewDraftActor(request, ctx);
  if (!actor) {
    const status = ctx.wallet ? 403 : 401;
    const error = ctx.wallet ? 'Forbidden' : 'Unauthorized';
    return NextResponse.json({ error }, { status });
  }

  const dashboard = await buildSystemsDashboardData();
  const draft = buildSystemsReviewDraft(dashboard, actor.actorType);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('admin_audit_log').insert({
    user_id: actor.actor,
    action: SYSTEMS_REVIEW_DRAFT_ACTION,
    target: `systems-review:${draft.reviewDate}`,
    payload: draft,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to persist systems review draft' }, { status: 500 });
  }

  return NextResponse.json({
    draft,
    status: 'ok',
    message:
      actor.actorType === 'cron'
        ? 'Weekly systems review draft generated from the scheduled cadence.'
        : 'Weekly systems review draft refreshed.',
  });
}

export const GET = withRouteHandler(generateSystemsReviewDraftRoute, {
  auth: 'optional',
  rateLimit: { max: 12, window: 60 },
});

export const POST = withRouteHandler(generateSystemsReviewDraftRoute, {
  auth: 'optional',
  rateLimit: { max: 12, window: 60 },
});
