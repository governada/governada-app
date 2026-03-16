/**
 * Decision Journal API — per-user deliberation state for proposals.
 *
 * GET: fetch journal entry by userId + proposalTxHash + proposalIndex
 * POST: upsert journal entry, appending to position_history on updates
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { SaveJournalSchema } from '@/lib/api/schemas/workspace';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DecisionJournalEntry } from '@/lib/workspace/types';

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
      .from('decision_journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', Number(proposalIndex))
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch journal entry' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ entry: null });
    }

    const entry: DecisionJournalEntry = {
      id: data.id,
      userId: data.user_id,
      proposalTxHash: data.proposal_tx_hash,
      proposalIndex: data.proposal_index,
      position: data.position ?? 'undecided',
      confidence: data.confidence ?? 50,
      steelmanText: data.steelman_text ?? '',
      keyAssumptions: data.key_assumptions ?? '',
      whatWouldChangeMind: data.what_would_change_mind ?? '',
      positionHistory: data.position_history ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ entry });
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
    const parsed = SaveJournalSchema.parse(body);

    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Check if entry exists to build position_history
    const { data: existing } = await admin
      .from('decision_journal_entries')
      .select('position, position_history')
      .eq('user_id', userId)
      .eq('proposal_tx_hash', parsed.proposalTxHash)
      .eq('proposal_index', parsed.proposalIndex)
      .maybeSingle();

    let positionHistory: Array<{ position: string; timestamp: string }> = [];

    if (existing) {
      positionHistory = Array.isArray(existing.position_history)
        ? [...existing.position_history]
        : [];
      // Append new position if it changed
      if (existing.position !== parsed.position) {
        positionHistory.push({ position: parsed.position, timestamp: now });
      }
    } else {
      // New entry — record initial position
      positionHistory = [{ position: parsed.position, timestamp: now }];
    }

    const { data, error } = await admin
      .from('decision_journal_entries')
      .upsert(
        {
          user_id: userId,
          proposal_tx_hash: parsed.proposalTxHash,
          proposal_index: parsed.proposalIndex,
          position: parsed.position,
          confidence: parsed.confidence,
          steelman_text: parsed.steelmanText ?? '',
          key_assumptions: parsed.keyAssumptions ?? '',
          what_would_change_mind: parsed.whatWouldChangeMind ?? '',
          position_history: positionHistory,
          updated_at: now,
        },
        { onConflict: 'user_id,proposal_tx_hash,proposal_index' },
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save journal entry' }, { status: 500 });
    }

    const entry: DecisionJournalEntry = {
      id: data.id,
      userId: data.user_id,
      proposalTxHash: data.proposal_tx_hash,
      proposalIndex: data.proposal_index,
      position: data.position ?? 'undecided',
      confidence: data.confidence ?? 50,
      steelmanText: data.steelman_text ?? '',
      keyAssumptions: data.key_assumptions ?? '',
      whatWouldChangeMind: data.what_would_change_mind ?? '',
      positionHistory: data.position_history ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ entry });
  },
  { auth: 'required' },
);
