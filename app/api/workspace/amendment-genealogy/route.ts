/**
 * Amendment Genealogy API — tracks the lifecycle of each amendment change.
 *
 * GET:  fetch genealogy entries for a draft, ordered by created_at
 * POST: record a new genealogy event (auth required)
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { RecordGenealogySchema } from '@/lib/api/schemas/workspace';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { GenealogyEntry } from '@/lib/constitution/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEntry(row: Record<string, unknown>): GenealogyEntry {
  return {
    changeId: row.change_id as string,
    action: row.action as GenealogyEntry['action'],
    actionBy: row.action_by as string,
    actionReason: (row.action_reason as string) ?? undefined,
    sourceType: (row.source_type as GenealogyEntry['sourceType']) ?? undefined,
    timestamp: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// GET — fetch genealogy for a draft
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request) => {
    const { searchParams } = request.nextUrl;
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('amendment_genealogy')
      .select('*')
      .eq('draft_id', draftId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch genealogy' }, { status: 500 });
    }

    return NextResponse.json({
      entries: (data ?? []).map(rowToEntry),
    });
  },
  { auth: 'optional' },
);

// ---------------------------------------------------------------------------
// POST — record a genealogy event
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RecordGenealogySchema.parse(body);

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('amendment_genealogy')
      .insert({
        draft_id: parsed.draftId,
        change_id: parsed.changeId,
        action: parsed.action,
        action_by: ctx.wallet ?? userId,
        action_reason: parsed.actionReason ?? null,
        source_type: parsed.sourceType ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to record genealogy' }, { status: 500 });
    }

    return NextResponse.json({ entry: rowToEntry(data) }, { status: 201 });
  },
  { auth: 'required', rateLimit: { max: 60, window: 60 } },
);
