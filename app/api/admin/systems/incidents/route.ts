export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  buildSystemsIncidentPayload,
  buildSystemsIncidentTarget,
  SYSTEMS_INCIDENT_LOG_ACTION,
} from '@/lib/admin/systemsIncidents';

export async function logSystemsIncident(request: NextRequest, ctx: RouteContext) {
  if (!isAdminWallet(ctx.wallet!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = buildSystemsIncidentPayload(await request.json());
  const target = buildSystemsIncidentTarget(payload);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('admin_audit_log').insert({
    user_id: ctx.wallet,
    action: SYSTEMS_INCIDENT_LOG_ACTION,
    target,
    payload,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to log systems incident' }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: target,
      entryType: payload.entryType,
      title: payload.title,
    },
    { status: 201 },
  );
}

export const POST = withRouteHandler(logSystemsIncident, {
  auth: 'required',
  rateLimit: { max: 20, window: 60 },
});
