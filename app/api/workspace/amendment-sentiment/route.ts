/**
 * Amendment Section Sentiment API — per-section community sentiment on amendment drafts.
 *
 * GET:  aggregate sentiment counts grouped by section for a draft
 * POST: upsert the current user's sentiment on a specific section (auth required)
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { SubmitSentimentSchema } from '@/lib/api/schemas/workspace';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SectionSentiment } from '@/lib/constitution/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — aggregate sentiment for all sections of a draft
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
      .from('amendment_section_sentiment')
      .select('section_id, sentiment')
      .eq('draft_id', draftId);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch sentiment' }, { status: 500 });
    }

    // Aggregate counts in memory (table is scoped to a single draft)
    const sections: Record<string, SectionSentiment> = {};

    for (const row of data ?? []) {
      const sid = row.section_id as string;
      if (!sections[sid]) {
        sections[sid] = { sectionId: sid, support: 0, oppose: 0, neutral: 0, total: 0 };
      }
      const s = row.sentiment as string;
      if (s === 'support') sections[sid].support++;
      else if (s === 'oppose') sections[sid].oppose++;
      else if (s === 'neutral') sections[sid].neutral++;
      sections[sid].total++;
    }

    return NextResponse.json({ sections });
  },
  { auth: 'optional' },
);

// ---------------------------------------------------------------------------
// POST — upsert user's sentiment for a section
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = SubmitSentimentSchema.parse(body);

    const admin = getSupabaseAdmin();

    // Upsert: ON CONFLICT (draft_id, section_id, user_id) DO UPDATE
    const { data, error } = await admin
      .from('amendment_section_sentiment')
      .upsert(
        {
          draft_id: parsed.draftId,
          section_id: parsed.sectionId,
          user_id: userId,
          sentiment: parsed.sentiment,
          comment: parsed.comment ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'draft_id,section_id,user_id' },
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save sentiment' }, { status: 500 });
    }

    return NextResponse.json({
      sentiment: {
        id: data.id as string,
        draftId: data.draft_id as string,
        sectionId: data.section_id as string,
        userId: data.user_id as string,
        sentiment: data.sentiment as string,
        comment: (data.comment as string) ?? null,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
      },
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
