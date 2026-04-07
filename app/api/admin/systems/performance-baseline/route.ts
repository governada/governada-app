export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import {
  buildSystemsPerformanceBaselinePayload,
  buildSystemsPerformanceBaselineTarget,
  SYSTEMS_PERFORMANCE_BASELINE_ACTION,
} from '@/lib/admin/systemsPerformance';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function logSystemsPerformanceBaseline(request: NextRequest, ctx: RouteContext) {
  if (!isAdminWallet(ctx.wallet!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = buildSystemsPerformanceBaselinePayload({
    ...(await request.json()),
    actorType: 'manual',
  });
  const target = buildSystemsPerformanceBaselineTarget(payload);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('admin_audit_log').insert({
    user_id: ctx.wallet,
    action: SYSTEMS_PERFORMANCE_BASELINE_ACTION,
    target,
    payload,
  });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to log systems performance baseline' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      id: target,
      baselineDate: payload.baselineDate,
      overallStatus: payload.overallStatus,
      scenarioLabel: payload.scenarioLabel,
    },
    { status: 201 },
  );
}

export const POST = withRouteHandler(logSystemsPerformanceBaseline, {
  auth: 'required',
  rateLimit: { max: 20, window: 60 },
});
