/**
 * Proposal Notes API — private per-user notes on proposals.
 *
 * GET: fetch note by userId + proposalTxHash + proposalIndex
 * POST: upsert note (create or update)
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { SaveNoteSchema } from '@/lib/api/schemas/workspace';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ProposalNote } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const { data, error } = await admin
      .from('proposal_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', Number(proposalIndex))
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ note: null });
    }

    const note: ProposalNote = {
      id: data.id,
      userId: data.user_id,
      proposalTxHash: data.proposal_tx_hash,
      proposalIndex: data.proposal_index,
      noteText: data.note_text ?? '',
      highlights: data.highlights ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ note });
  },
  { auth: 'required' },
);

export const POST = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = SaveNoteSchema.parse(body);

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('proposal_notes')
      .upsert(
        {
          user_id: userId,
          proposal_tx_hash: parsed.proposalTxHash,
          proposal_index: parsed.proposalIndex,
          note_text: parsed.noteText,
          highlights: parsed.highlights ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,proposal_tx_hash,proposal_index' },
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
    }

    const note: ProposalNote = {
      id: data.id,
      userId: data.user_id,
      proposalTxHash: data.proposal_tx_hash,
      proposalIndex: data.proposal_index,
      noteText: data.note_text ?? '',
      highlights: data.highlights ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ note });
  },
  { auth: 'required' },
);
