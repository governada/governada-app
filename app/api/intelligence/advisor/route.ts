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
    conversationMemory: z.string().optional(),
    navigationEvent: z
      .object({
        from: z.string(),
        to: z.string(),
        entityId: z.string().optional(),
      })
      .optional(),
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

    // Run 5 parallel queries for comprehensive governance context
    // Wrap each in a standalone async function so .catch() works on a real Promise
    const [proposalsResult, drepResult, treasuryResult, ghiResult, ccResult] = await Promise.all([
      // 1. Active proposals
      (async () => {
        const { data } = await supabase
          .from('proposals')
          .select('title, proposal_type, tx_hash, proposal_index')
          .is('ratified_epoch', null)
          .is('enacted_epoch', null)
          .is('dropped_epoch', null)
          .is('expired_epoch', null)
          .order('block_time', { ascending: false })
          .limit(20);
        return data;
      })().catch(() => null),

      // 2. DRep landscape aggregate
      (async () => {
        const { data } = await supabase
          .from('dreps')
          .select('drep_id, info, score, participation_rate')
          .not('info', 'is', null)
          .gt('info->votingPowerLovelace', '0')
          .order('score', { ascending: false })
          .limit(500);
        return data;
      })().catch(() => null),

      // 3. Treasury latest snapshot
      (async () => {
        const { data } = await supabase
          .from('treasury_snapshots')
          .select('balance_lovelace, epoch_no')
          .order('epoch_no', { ascending: false })
          .limit(1);
        return data?.[0] ?? null;
      })().catch(() => null),

      // 4. GHI latest snapshot
      (async () => {
        const { data } = await supabase
          .from('ghi_snapshots')
          .select('epoch_no, score, band, components')
          .order('epoch_no', { ascending: false })
          .limit(1);
        return data?.[0] ?? null;
      })().catch(() => null),

      // 5. CC fidelity summary (latest epoch)
      (async () => {
        const { data } = await supabase
          .from('cc_fidelity_snapshots')
          .select('cc_hot_id, fidelity_score, epoch_no')
          .order('epoch_no', { ascending: false })
          .limit(20);
        return data;
      })().catch(() => null),
    ]);

    const lines: string[] = [];

    // -- Proposals section --
    if (proposalsResult && proposalsResult.length > 0) {
      lines.push(`Active proposals (${proposalsResult.length}):`);
      for (const p of proposalsResult) {
        lines.push(
          `- [${p.proposal_type}] "${p.title}" — /governance/proposals/${p.tx_hash}#${p.proposal_index}`,
        );
      }
    } else {
      lines.push(`Active proposals: ${ctx.activeProposalCount} (details unavailable)`);
    }

    // -- DRep landscape section --
    if (drepResult && drepResult.length > 0) {
      type DRepRow = {
        drep_id: string;
        info: Record<string, unknown> | null;
        score: number | null;
        participation_rate: number | null;
      };
      const activeDreps = drepResult as DRepRow[];
      const avgScore = Math.round(
        activeDreps.reduce((sum: number, d: DRepRow) => sum + (d.score ?? 0), 0) /
          activeDreps.length,
      );
      const drepsWithParticipation = activeDreps.filter(
        (d: DRepRow) => d.participation_rate != null,
      );
      const avgParticipation =
        drepsWithParticipation.length > 0
          ? Math.round(
              drepsWithParticipation.reduce(
                (sum: number, d: DRepRow) => sum + (d.participation_rate ?? 0),
                0,
              ) / drepsWithParticipation.length,
            )
          : 0;

      // Tier distribution by score bands
      const diamond = activeDreps.filter((d: DRepRow) => (d.score ?? 0) >= 85).length;
      const gold = activeDreps.filter(
        (d: DRepRow) => (d.score ?? 0) >= 70 && (d.score ?? 0) < 85,
      ).length;
      const silver = activeDreps.filter(
        (d: DRepRow) => (d.score ?? 0) >= 50 && (d.score ?? 0) < 70,
      ).length;
      const emerging = activeDreps.filter((d: DRepRow) => (d.score ?? 0) < 50).length;

      // Top 5 with IDs for globe references
      const top5 = activeDreps.slice(0, 5).map((d: DRepRow) => {
        const info = d.info;
        const name =
          (info?.givenName as string) || (info?.name as string) || d.drep_id.slice(0, 12) + '...';
        return `${name} (${d.score ?? 0}, id:${d.drep_id.slice(0, 20)})`;
      });

      lines.push('');
      lines.push(
        `DRep landscape: ${activeDreps.length} active | Avg score: ${avgScore} | Avg participation: ${avgParticipation}%`,
      );
      lines.push(
        `Tiers: ${diamond} Diamond+, ${gold} Gold, ${silver} Silver, ${emerging} Emerging`,
      );
      lines.push(`Top 5: ${top5.join(', ')}`);
    }

    // -- Treasury section --
    if (treasuryResult) {
      const balanceAda = Math.round(
        Number(BigInt(treasuryResult.balance_lovelace ?? 0) / BigInt(1_000_000)),
      );
      const balanceFormatted =
        balanceAda >= 1_000_000_000
          ? `${(balanceAda / 1_000_000_000).toFixed(2)}B`
          : balanceAda >= 1_000_000
            ? `${(balanceAda / 1_000_000).toFixed(1)}M`
            : balanceAda.toLocaleString();

      // Count pending treasury proposals from the active proposals we already fetched
      type ProposalRow = {
        title: string | null;
        proposal_type: string | null;
        tx_hash: string;
        proposal_index: number;
      };
      const pendingTreasury =
        (proposalsResult as ProposalRow[] | null)?.filter(
          (p: ProposalRow) => p.proposal_type === 'TreasuryWithdrawals',
        ).length ?? 0;

      lines.push('');
      lines.push(
        `Treasury: ${balanceFormatted} ADA | Pending: ${pendingTreasury} treasury proposals`,
      );
    }

    // -- GHI section --
    if (ghiResult) {
      const components = (ghiResult.components as Array<{ name: string; value: number }>) ?? [];
      const topComponents = components
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map((c) => `${c.name} ${Math.round(c.value)}`)
        .join(', ');

      lines.push('');
      lines.push(
        `Governance Health (GHI): ${Math.round(ghiResult.score)}/100 (${ghiResult.band})${topComponents ? ` — ${topComponents}` : ''}`,
      );
    }

    // -- CC section --
    if (ccResult && ccResult.length > 0) {
      type CCRow = { cc_hot_id: string; fidelity_score: number | null; epoch_no: number };
      const ccRows = ccResult as CCRow[];
      // Get latest epoch's members only
      const latestEpoch = Math.max(...ccRows.map((c: CCRow) => c.epoch_no));
      const latestMembers = ccRows.filter((c: CCRow) => c.epoch_no === latestEpoch);
      const avgFidelity = Math.round(
        latestMembers.reduce((sum: number, c: CCRow) => sum + (c.fidelity_score ?? 0), 0) /
          latestMembers.length,
      );

      lines.push('');
      lines.push(
        `Constitutional Committee: ${latestMembers.length} members | Avg fidelity: ${avgFidelity}%`,
      );
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
      conversationMemory: parsed.context.conversationMemory,
      navigationEvent: parsed.context.navigationEvent,
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
