export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

const journeyVerificationSchema = z.object({
  verificationType: z.enum(['ci', 'manual']).default('ci'),
  workflowName: z.string().trim().min(1).max(160),
  jobName: z.string().trim().max(160).nullable().optional(),
  commitSha: z.string().trim().max(80).nullable().optional(),
  runUrl: z.string().trim().url().nullable().optional(),
  executedAt: z.string().datetime(),
  journeys: z
    .array(
      z.object({
        journeyId: z.string().trim().min(1).max(24),
        status: z.enum(['passed', 'failed']),
        details: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
});

function resolveVerificationActor(
  request: NextRequest,
  ctx: RouteContext,
): { wallet: string; allowed: boolean } {
  const authHeader = request.headers.get('authorization');
  const verificationToken = process.env.SYSTEMS_JOURNEY_VERIFICATION_TOKEN?.trim();
  if (verificationToken && authHeader === `Bearer ${verificationToken}`) {
    return { wallet: 'system:journey-verifications', allowed: true };
  }

  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { wallet: 'system:journey-verifications', allowed: true };
  }

  if (ctx.wallet && isAdminWallet(ctx.wallet)) {
    return { wallet: ctx.wallet, allowed: true };
  }

  return { wallet: '', allowed: false };
}

export const loadSystemsJourneyVerifications = async (_request: NextRequest, ctx: RouteContext) => {
  if (!isAdminWallet(ctx.wallet!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('systems_journey_verifications')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to load journey verifications' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
};

export const GET = withRouteHandler(loadSystemsJourneyVerifications, {
  auth: 'required',
  rateLimit: { max: 20, window: 60 },
});

export const recordSystemsJourneyVerifications = async (
  request: NextRequest,
  ctx: RouteContext,
) => {
  const actor = resolveVerificationActor(request, ctx);
  if (!actor.allowed) {
    return NextResponse.json(
      { error: ctx.wallet ? 'Forbidden' : 'Unauthorized' },
      { status: ctx.wallet ? 403 : 401 },
    );
  }

  const body = journeyVerificationSchema.parse(await request.json());
  const supabase = getSupabaseAdmin();
  const rows = body.journeys.map((journey) => ({
    journey_id: journey.journeyId,
    verification_type: body.verificationType,
    status: journey.status,
    workflow_name: body.workflowName,
    job_name: body.jobName ?? null,
    commit_sha: body.commitSha ?? null,
    run_url: body.runUrl ?? null,
    executed_at: body.executedAt,
    details: journey.details ?? {},
    wallet_address: actor.wallet,
  }));

  const { error } = await supabase.from('systems_journey_verifications').insert(rows);
  if (error) {
    return NextResponse.json({ error: 'Failed to persist journey verifications' }, { status: 500 });
  }

  return NextResponse.json({ inserted: rows.length }, { status: 201 });
};

export const POST = withRouteHandler(recordSystemsJourneyVerifications, {
  auth: 'optional',
  rateLimit: { max: 20, window: 60 },
});
