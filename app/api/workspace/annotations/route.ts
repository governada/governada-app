/**
 * Proposal Annotations API — inline text annotations on proposal content.
 *
 * GET:    fetch annotations for a proposal (own + public)
 * POST:   create annotation (auth required)
 * PATCH:  update annotation (auth required, own only)
 * DELETE: delete annotation (auth required, own only)
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { CreateAnnotationSchema, UpdateAnnotationSchema } from '@/lib/api/schemas/workspace';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ProposalAnnotation } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToAnnotation(row: Record<string, unknown>): ProposalAnnotation {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    proposalTxHash: row.proposal_tx_hash as string,
    proposalIndex: row.proposal_index as number,
    anchorStart: row.anchor_start as number,
    anchorEnd: row.anchor_end as number,
    anchorField: row.anchor_field as ProposalAnnotation['anchorField'],
    annotationText: row.annotation_text as string,
    annotationType: row.annotation_type as ProposalAnnotation['annotationType'],
    color: (row.color as string) ?? null,
    isPublic: row.is_public as boolean,
    upvoteCount: (row.upvote_count as number) ?? 0,
    suggestedText: (row.suggested_text as ProposalAnnotation['suggestedText']) ?? null,
    status: (row.status as ProposalAnnotation['status']) ?? 'active',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// GET — fetch annotations for a proposal (own + public)
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request, ctx) => {
    const { searchParams } = request.nextUrl;
    const proposalTxHash = searchParams.get('proposalTxHash');
    const proposalIndex = searchParams.get('proposalIndex');

    if (!proposalTxHash || proposalIndex === null) {
      return NextResponse.json(
        { error: 'Missing proposalTxHash or proposalIndex' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const idx = Number(proposalIndex);

    // Build query: own annotations + public from others
    if (ctx.userId) {
      // Authenticated: own + public
      const { data, error } = await admin
        .from('proposal_annotations')
        .select('*')
        .eq('proposal_tx_hash', proposalTxHash)
        .eq('proposal_index', idx)
        .or(`user_id.eq.${ctx.userId},is_public.eq.true`)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
      }

      return NextResponse.json({
        annotations: (data ?? []).map(rowToAnnotation),
      });
    }

    // Unauthenticated: public only
    const { data, error } = await admin
      .from('proposal_annotations')
      .select('*')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', idx)
      .eq('is_public', true)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
    }

    return NextResponse.json({
      annotations: (data ?? []).map(rowToAnnotation),
    });
  },
  { auth: 'optional' },
);

// ---------------------------------------------------------------------------
// POST — create annotation
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateAnnotationSchema.parse(body);

    const admin = getSupabaseAdmin();

    // Suggestion annotations default to public (visible to proposer)
    const isPublic = parsed.isPublic ?? (parsed.annotationType === 'suggestion' ? true : false);

    const insertRow: Record<string, unknown> = {
      user_id: userId,
      proposal_tx_hash: parsed.proposalTxHash,
      proposal_index: parsed.proposalIndex,
      anchor_start: parsed.anchorStart,
      anchor_end: parsed.anchorEnd,
      anchor_field: parsed.anchorField,
      annotation_text: parsed.annotationText,
      annotation_type: parsed.annotationType,
      color: parsed.color ?? null,
      is_public: isPublic,
    };

    if (parsed.suggestedText) {
      insertRow.suggested_text = parsed.suggestedText;
    }

    const { data, error } = await admin
      .from('proposal_annotations')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
    }

    return NextResponse.json({ annotation: rowToAnnotation(data) }, { status: 201 });
  },
  { auth: 'required', rateLimit: { max: 60, window: 60 } },
);

// ---------------------------------------------------------------------------
// PATCH — update own annotation
// ---------------------------------------------------------------------------

export const PATCH = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdateAnnotationSchema.parse(body);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.annotationText !== undefined) updates.annotation_text = parsed.annotationText;
    if (parsed.isPublic !== undefined) updates.is_public = parsed.isPublic;
    if (parsed.color !== undefined) updates.color = parsed.color;
    if (parsed.status !== undefined) updates.status = parsed.status;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('proposal_annotations')
      .update(updates)
      .eq('id', parsed.id)
      .eq('user_id', userId) // enforce ownership
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update annotation' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Annotation not found or not owned' }, { status: 404 });
    }

    return NextResponse.json({ annotation: rowToAnnotation(data) });
  },
  { auth: 'required' },
);

// ---------------------------------------------------------------------------
// DELETE — delete own annotation
// ---------------------------------------------------------------------------

export const DELETE = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing annotation id' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error, count } = await admin
      .from('proposal_annotations')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId); // enforce ownership

    if (error) {
      return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Annotation not found or not owned' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  },
  { auth: 'required' },
);
