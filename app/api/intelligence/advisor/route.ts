/**
 * POST /api/intelligence/advisor — Streaming SSE endpoint for the governance advisor.
 *
 * Accepts a conversation history and governance context, streams an AI-generated
 * response with entity references and actionable insights.
 *
 * Authentication is optional — anonymous users get generic responses,
 * authenticated users get personalized governance intelligence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFeatureFlag } from '@/lib/featureFlags';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  streamAdvisorResponse,
  type ConversationMessage,
  type AdvisorContext,
} from '@/lib/intelligence/advisor';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const AdvisorRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
  context: z.object({
    epoch: z.number(),
    daysRemaining: z.number(),
    activeProposalCount: z.number(),
    segment: z.string(),
    visitorMode: z.enum(['onboarding', 'exploring', 'returning', 'authenticated']).optional(),
    pageContext: z.string().optional(),
    matchState: z.enum(['idle', 'matching', 'matched', 'delegated']).optional(),
    walletState: z.enum(['none_detected', 'detected', 'connected', 'has_ada', 'no_ada']).optional(),
    persona: z.enum(['navigator', 'analyst', 'partner', 'guide']).optional(),
    mode: z.enum(['conversation', 'briefing']).optional(),
  }),
});

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory, per-IP or per-user)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // 20 advisor queries per minute
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Evict stale entries periodically
function evictStaleEntries() {
  if (rateLimitMap.size > 500) {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Governance snapshot builder
// ---------------------------------------------------------------------------

async function buildGovernanceSnapshot(ctx: {
  epoch: number;
  activeProposalCount: number;
}): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();

    // Fetch active proposals summary
    const { data: proposals } = await supabase
      .from('proposals')
      .select('title, type, status, tx_hash, index')
      .in('status', ['active', 'voting'])
      .order('created_at', { ascending: false })
      .limit(20);

    const lines: string[] = [];

    if (proposals && proposals.length > 0) {
      lines.push(`Active proposals (${proposals.length}):`);
      for (const p of proposals) {
        lines.push(
          `- [${p.type}] "${p.title}" (${p.status}) — /governance/proposals/${p.tx_hash}#${p.index}`,
        );
      }
    } else {
      lines.push(`Active proposals: ${ctx.activeProposalCount} (details unavailable)`);
    }

    return lines.join('\n');
  } catch (err) {
    logger.warn('[Advisor] Failed to build governance snapshot', { error: err });
    return `Current epoch: ${ctx.epoch}. Active proposals: ${ctx.activeProposalCount}.`;
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // --- Feature flag check ---
    const enabled = await getFeatureFlag('conversational_nav', false);
    if (!enabled) {
      return NextResponse.json(
        { error: 'Conversational navigation is not enabled' },
        { status: 403 },
      );
    }

    // --- Rate limit ---
    evictStaleEntries();
    const rateLimitKey =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.' },
        { status: 429 },
      );
    }

    // --- Parse request ---
    const body = await request.json();
    const parsed = AdvisorRequestSchema.parse(body);

    // --- Optional auth for personalization ---
    let personalContext: string | undefined;
    const auth = request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      try {
        const session = await validateSessionToken(auth.slice(7));
        if (session) {
          const { assemblePersonalContext, formatPersonalContext } =
            await import('@/lib/ai/context');
          const ctx = await assemblePersonalContext(
            session.walletAddress,
            parsed.context.segment as 'drep' | 'spo' | 'citizen',
          );
          personalContext = formatPersonalContext(ctx);
        }
      } catch {
        // Non-critical: continue without personal context
      }
    }

    // --- Build governance snapshot ---
    const governanceSnapshot = await buildGovernanceSnapshot(parsed.context);

    // --- Build advisor context ---
    const advisorContext: AdvisorContext = {
      epoch: parsed.context.epoch,
      daysRemaining: parsed.context.daysRemaining,
      activeProposalCount: parsed.context.activeProposalCount,
      segment: parsed.context.segment,
      personalContext,
      governanceSnapshot,
      visitorMode: parsed.context.visitorMode,
      pageContext: parsed.context.pageContext,
      matchState: parsed.context.matchState,
      walletState: parsed.context.walletState,
      persona: parsed.context.persona,
    };

    // --- Stream response ---
    const stream = await streamAdvisorResponse({
      messages: parsed.messages as ConversationMessage[],
      context: advisorContext,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: err.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    logger.error('[Advisor] Request error', { error: err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
