/**
 * Seneca Conversation Memory
 *
 * GET  /api/intelligence/memory — Fetch last 3 conversation summaries for the user
 * POST /api/intelligence/memory — Store a 1-sentence conversation summary
 *
 * Summaries are AI-generated from conversation messages and injected into the
 * advisor system prompt so Seneca can reference prior interactions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentEpoch } from '@/lib/constants';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

// ── GET: Retrieve recent conversation summaries ───────────────────────────

export const GET = withRouteHandler(
  async (_request: NextRequest, { userId }: RouteContext) => {
    if (!userId) {
      return NextResponse.json({ summaries: [] });
    }

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('seneca_conversation_summaries')
      .select('summary, epoch, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      summaries: (data ?? []).map((s) => ({
        summary: s.summary,
        epoch: s.epoch,
        createdAt: s.created_at,
      })),
    });
  },
  { auth: 'optional' },
);

// ── POST: Generate and store a conversation summary ────────────────────────

interface SaveMemoryBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const POST = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as SaveMemoryBody;
    const { messages } = body;

    if (!messages || messages.length < 2) {
      return NextResponse.json({ error: 'At least 2 messages required' }, { status: 400 });
    }

    // Truncate to last 10 messages to keep summary generation fast and cheap
    const recentMessages = messages.slice(-10);

    // Generate 1-sentence summary via Claude
    const summary = await generateSummary(recentMessages);
    if (!summary) {
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();
    const epoch = getCurrentEpoch();

    // Store the summary
    const { error } = await supabase.from('seneca_conversation_summaries').insert({
      user_id: userId,
      summary,
      message_count: messages.length,
      epoch,
    });

    if (error) {
      console.error('[seneca-memory] Failed to store summary:', error.message);
      return NextResponse.json({ error: 'Failed to store summary' }, { status: 500 });
    }

    // Prune old summaries — keep max 10 per user
    const { data: allSummaries } = await supabase
      .from('seneca_conversation_summaries')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (allSummaries && allSummaries.length > 10) {
      const toDelete = allSummaries.slice(10).map((s) => s.id);
      await supabase.from('seneca_conversation_summaries').delete().in('id', toDelete);
    }

    return NextResponse.json({ summary, epoch });
  },
  {
    auth: 'required',
    rateLimit: { max: 10, window: 60 },
  },
);

// ── Summary generation ───────────────────────────────────────────────────

async function generateSummary(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const client = new Anthropic({ apiKey });

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Seneca'}: ${m.content.slice(0, 300)}`)
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Summarize this governance conversation in exactly one sentence (max 30 words). Focus on the topic discussed and any decisions or insights. Do not start with "The user" — use active voice.\n\nConversation:\n${transcript}`,
        },
      ],
    });

    const block = response.content[0];
    if (block.type === 'text') {
      return block.text.trim();
    }
    return null;
  } catch (err) {
    console.error('[seneca-memory] Summary generation failed:', err);
    return null;
  }
}
