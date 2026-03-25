/**
 * POST /api/intelligence/research — SSE endpoint for deep research (Seneca Tier 3).
 *
 * Decomposes a governance question into sub-queries, executes each step
 * via focused AI calls, and streams progress + final synthesis.
 *
 * Rate limit: 5 per hour per IP.
 * Feature-flagged: `seneca_deep_research`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFeatureFlag } from '@/lib/featureFlags';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAnthropicStream } from '@/lib/ai';
import { buildSenecaPrompt } from '@/lib/ai/senecaPersona';
import { planResearch, type ResearchStep } from '@/lib/intelligence/deepResearch';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const ResearchRequestSchema = z.object({
  question: z.string().min(10).max(2000),
  context: z.object({
    pageContext: z.string().optional(),
    entityId: z.string().optional(),
    persona: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Rate limiting — 5 per hour per IP
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour

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

function evictStaleEntries() {
  if (rateLimitMap.size > 200) {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Step execution helpers
// ---------------------------------------------------------------------------

/** Build a focused sub-prompt for a specific research step. */
function buildStepPrompt(step: ResearchStep, question: string, governanceData: string): string {
  const baseContext = [
    `The user asked: "${question}"`,
    '',
    'Current governance data:',
    governanceData,
    '',
  ].join('\n');

  switch (step.id) {
    case 'gather-context':
      return [
        baseContext,
        'Your task: Gather and summarize the key governance context relevant to this question.',
        'List the most important facts, numbers, and entities involved.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'comparison':
      return [
        baseContext,
        'Your task: Compare the entities or positions mentioned in the question.',
        'Highlight key similarities and differences. Use concrete data points.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'treasury':
      return [
        baseContext,
        'Your task: Analyze the treasury implications of this question.',
        'Consider ADA amounts, withdrawal proposals, budget impact, and fiscal sustainability.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'constitutional':
      return [
        baseContext,
        'Your task: Check constitutional alignment for the topics in this question.',
        'Reference relevant guardrails, constitutional constraints, or compliance issues.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'entity-analysis':
      return [
        baseContext,
        'Your task: Analyze the governance entity (DRep, SPO, CC member) relevant to this question.',
        'Cover their voting record, score, delegation, and notable positions.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'voting-patterns':
      return [
        baseContext,
        'Your task: Review voting patterns relevant to this question.',
        'Note participation rates, alignment trends, and any notable votes.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'proposal-analysis':
      return [
        baseContext,
        'Your task: Analyze the proposal(s) relevant to this question.',
        'Cover type, status, voting breakdown, and key arguments for/against.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'analyze-data':
      return [
        baseContext,
        'Your task: Analyze the governance data relevant to this question.',
        'Identify patterns, outliers, or notable trends.',
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
    case 'synthesize':
      return ''; // Synthesis handled separately with full context
    default:
      return [
        baseContext,
        `Your task: Address the "${step.label}" aspect of this question.`,
        'Be concise — 2-3 sentences maximum.',
      ].join('\n');
  }
}

/** Collect the full text from a FAST model non-streaming call for a step. */
async function executeStep(stepPrompt: string, signal?: AbortSignal): Promise<string> {
  const systemPrompt = buildSenecaPrompt(
    'advisor',
    [
      '## Research Mode',
      'You are executing one step of a multi-step deep research analysis.',
      'Be precise, factual, and concise. No pleasantries or filler.',
      'If you lack data, say so explicitly rather than speculating.',
    ].join('\n'),
  );

  const stream = await createAnthropicStream('', {
    model: 'HAIKU', // Fast model for sub-queries
    maxTokens: 300,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: 'user', content: stepPrompt }],
  });

  if (!stream) {
    throw new Error('AI client not available');
  }

  let result = '';
  for await (const event of stream as AsyncIterable<{
    type: string;
    delta?: { type?: string; text?: string };
  }>) {
    if (signal?.aborted) throw new Error('Aborted');
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      event.delta.text
    ) {
      result += event.delta.text;
    }
  }

  return result.trim();
}

// ---------------------------------------------------------------------------
// Governance snapshot (reused from advisor)
// ---------------------------------------------------------------------------

async function buildGovernanceSnapshot(): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
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
        lines.push(`- [${p.type}] "${p.title}" (${p.status})`);
      }
    }
    return lines.join('\n') || 'No active proposals.';
  } catch {
    return 'Governance data unavailable.';
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // --- Feature flag ---
    const enabled = await getFeatureFlag('seneca_deep_research', false);
    if (!enabled) {
      return NextResponse.json({ error: 'Deep research is not enabled' }, { status: 403 });
    }

    // --- Rate limit ---
    evictStaleEntries();
    const rateLimitKey =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Research limit reached (5 per hour). Please try again later.' },
        { status: 429 },
      );
    }

    // --- Parse request ---
    const body = await request.json();
    const parsed = ResearchRequestSchema.parse(body);

    // --- Optional auth ---
    let personalContext: string | undefined;
    const auth = request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      try {
        const session = await validateSessionToken(auth.slice(7));
        if (session) {
          const { assemblePersonalContext, formatPersonalContext } =
            await import('@/lib/ai/context');
          const ctx = await assemblePersonalContext(session.walletAddress, 'citizen');
          personalContext = formatPersonalContext(ctx);
        }
      } catch {
        // Non-critical
      }
    }

    // --- Plan research ---
    const plan = planResearch(parsed.question, parsed.context);
    const governanceData = await buildGovernanceSnapshot();

    // --- Stream execution ---
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Emit the plan
        emit({ type: 'plan', steps: plan.steps.map((s) => ({ id: s.id, label: s.label })) });

        const stepSummaries: Array<{ label: string; summary: string }> = [];

        for (const step of plan.steps) {
          // Skip synthesis step — handled separately at the end
          if (step.id === 'synthesize') continue;

          emit({ type: 'step_start', stepId: step.id, label: step.label });

          try {
            const prompt = buildStepPrompt(step, parsed.question, governanceData);
            const summary = await executeStep(prompt);
            stepSummaries.push({ label: step.label, summary });
            emit({ type: 'step_done', stepId: step.id, summary });
          } catch (err) {
            logger.warn('[Research] Step failed', { stepId: step.id, error: err });
            emit({ type: 'step_error', stepId: step.id, error: 'Step failed' });
            // Continue to synthesis regardless
          }
        }

        // --- Synthesis (stream the final answer) ---
        const synthesizeStep = plan.steps.find((s) => s.id === 'synthesize');
        if (synthesizeStep) {
          emit({ type: 'step_start', stepId: 'synthesize', label: synthesizeStep.label });
        }

        try {
          const synthesisContext = [
            `Original question: "${parsed.question}"`,
            '',
            '## Research findings:',
            ...stepSummaries.map((s, i) => `### Step ${i + 1}: ${s.label}\n${s.summary}`),
            '',
            personalContext ? `## User context:\n${personalContext}` : '',
            '',
            '## Instructions:',
            'Synthesize the research findings into a comprehensive, actionable answer.',
            'Reference specific data points from the steps.',
            'Structure with clear sections if the answer is complex.',
            'End with 1-2 actionable next steps the user can take.',
          ].join('\n');

          const systemPrompt = buildSenecaPrompt(
            'advisor',
            [
              '## Deep Research Synthesis',
              'You are delivering the final synthesis of a multi-step research analysis.',
              'Be thorough but structured. Use markdown formatting.',
              'Ground every claim in the research findings provided.',
            ].join('\n'),
          );

          const synthesisStream = await createAnthropicStream('', {
            model: 'FAST', // Main model for final synthesis
            maxTokens: 1500,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: synthesisContext }],
          });

          if (synthesisStream) {
            for await (const event of synthesisStream as AsyncIterable<{
              type: string;
              delta?: { type?: string; text?: string };
            }>) {
              if (
                event.type === 'content_block_delta' &&
                event.delta?.type === 'text_delta' &&
                event.delta.text
              ) {
                emit({ type: 'synthesis', content: event.delta.text });
              }
            }
          }

          if (synthesizeStep) {
            emit({ type: 'step_done', stepId: 'synthesize', summary: 'Synthesis complete' });
          }
        } catch (err) {
          logger.error('[Research] Synthesis failed', { error: err });
          emit({
            type: 'synthesis',
            content: 'Research synthesis failed. Please review the individual step findings above.',
          });
          if (synthesizeStep) {
            emit({ type: 'step_error', stepId: 'synthesize', error: 'Synthesis failed' });
          }
        }

        emit({ type: 'done' });
        controller.close();
      },
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

    logger.error('[Research] Request error', { error: err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
