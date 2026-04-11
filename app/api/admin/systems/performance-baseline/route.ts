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

  const { data: baseline, error: baselineError } = await supabase
    .from('systems_performance_baselines')
    .insert({
      actor_type: payload.actorType,
      wallet_address: ctx.wallet!,
      baseline_date: payload.baselineDate,
      environment: payload.environment,
      scenario_label: payload.scenarioLabel,
      concurrency_profile: payload.concurrencyProfile,
      overall_status: payload.overallStatus,
      summary: payload.summary,
      bottleneck: payload.bottleneck,
      mitigation_owner: payload.mitigationOwner,
      next_step: payload.nextStep,
      artifact_url: payload.artifactUrl ?? null,
      notes: payload.notes ?? null,
      api_health_p95_ms: payload.apiHealthP95Ms,
      api_dreps_p95_ms: payload.apiDrepsP95Ms,
      api_v1_dreps_p95_ms: payload.apiV1DrepsP95Ms,
      governance_health_p95_ms: payload.governanceHealthP95Ms,
      error_rate_pct: payload.errorRatePct,
    })
    .select('id')
    .single();

  if (baselineError || !baseline) {
    return NextResponse.json(
      { error: 'Failed to log systems performance baseline' },
      { status: 500 },
    );
  }

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
      id: baseline.id,
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
