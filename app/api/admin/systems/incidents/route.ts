export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  buildSystemsIncidentPayload,
  updateSystemsIncidentSchema,
  SYSTEMS_INCIDENT_LOG_ACTION,
} from '@/lib/admin/systemsIncidents';
import { buildSystemsIncidentsViewData } from '@/lib/admin/systemsDashboard';

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(await buildSystemsIncidentsViewData());
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);

export async function logSystemsIncident(request: NextRequest, ctx: RouteContext) {
  if (!isAdminWallet(ctx.wallet!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = buildSystemsIncidentPayload(await request.json());
  const supabase = getSupabaseAdmin();
  const eventAt = new Date().toISOString();

  const { data: incident, error: incidentError } = await supabase
    .from('systems_incidents')
    .insert({
      incident_date: payload.incidentDate,
      entry_type: payload.entryType,
      severity: payload.severity,
      status: payload.status,
      title: payload.title,
      detected_by: payload.detectedBy,
      systems_affected: payload.systemsAffected,
      user_impact: payload.userImpact,
      root_cause: payload.rootCause,
      mitigation: payload.mitigation,
      permanent_fix: payload.permanentFix,
      follow_up_owner: payload.followUpOwner,
      time_to_acknowledge_minutes: payload.timeToAcknowledgeMinutes ?? null,
      time_to_mitigate_minutes: payload.timeToMitigateMinutes ?? null,
      time_to_resolve_minutes: payload.timeToResolveMinutes ?? null,
      created_by_wallet_address: ctx.wallet!,
      updated_by_wallet_address: ctx.wallet!,
      last_event_at: eventAt,
      closed_at: payload.status === 'resolved' ? eventAt : null,
    })
    .select('id, entry_type, title')
    .single();

  if (incidentError || !incident) {
    return NextResponse.json({ error: 'Failed to create systems incident' }, { status: 500 });
  }

  const { error: eventError } = await supabase.from('systems_incident_events').insert({
    incident_id: incident.id,
    event_type: 'created',
    status: payload.status,
    incident_snapshot: payload,
    actor_wallet_address: ctx.wallet!,
    created_at: eventAt,
  });

  if (eventError) {
    return NextResponse.json({ error: 'Failed to append incident event' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    user_id: ctx.wallet,
    action: SYSTEMS_INCIDENT_LOG_ACTION,
    target: incident.id,
    payload,
  });

  return NextResponse.json(
    {
      id: incident.id,
      entryType: incident.entry_type,
      title: incident.title,
    },
    { status: 201 },
  );
}

export async function updateSystemsIncident(request: NextRequest, ctx: RouteContext) {
  if (!isAdminWallet(ctx.wallet!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = updateSystemsIncidentSchema.parse(await request.json());
  const { id, ...input } = body;
  const payload = buildSystemsIncidentPayload(input);
  const supabase = getSupabaseAdmin();
  const eventAt = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from('systems_incidents')
    .select('id, status')
    .eq('id', id)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Systems incident not found' }, { status: 404 });
  }

  const { data: incident, error: updateError } = await supabase
    .from('systems_incidents')
    .update({
      incident_date: payload.incidentDate,
      entry_type: payload.entryType,
      severity: payload.severity,
      status: payload.status,
      title: payload.title,
      detected_by: payload.detectedBy,
      systems_affected: payload.systemsAffected,
      user_impact: payload.userImpact,
      root_cause: payload.rootCause,
      mitigation: payload.mitigation,
      permanent_fix: payload.permanentFix,
      follow_up_owner: payload.followUpOwner,
      time_to_acknowledge_minutes: payload.timeToAcknowledgeMinutes ?? null,
      time_to_mitigate_minutes: payload.timeToMitigateMinutes ?? null,
      time_to_resolve_minutes: payload.timeToResolveMinutes ?? null,
      updated_by_wallet_address: ctx.wallet!,
      last_event_at: eventAt,
      closed_at: payload.status === 'resolved' ? eventAt : null,
    })
    .eq('id', id)
    .select('id, entry_type, title, status')
    .single();

  if (updateError || !incident) {
    return NextResponse.json({ error: 'Failed to update systems incident' }, { status: 500 });
  }

  const { error: eventError } = await supabase.from('systems_incident_events').insert({
    incident_id: id,
    event_type: existing.status === payload.status ? 'updated' : 'status_changed',
    status: payload.status,
    incident_snapshot: payload,
    actor_wallet_address: ctx.wallet!,
    created_at: eventAt,
  });

  if (eventError) {
    return NextResponse.json({ error: 'Failed to append incident event' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    user_id: ctx.wallet,
    action: SYSTEMS_INCIDENT_LOG_ACTION,
    target: id,
    payload,
  });

  return NextResponse.json({
    id: incident.id,
    entryType: incident.entry_type,
    title: incident.title,
    status: incident.status,
  });
}

export const POST = withRouteHandler(logSystemsIncident, {
  auth: 'required',
  rateLimit: { max: 20, window: 60 },
});

export const PATCH = withRouteHandler(updateSystemsIncident, {
  auth: 'required',
  rateLimit: { max: 20, window: 60 },
});
