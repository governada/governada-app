/**
 * Governance Advisor — conversational AI orchestration for the command palette.
 *
 * Detects whether user input is a question/intent (route to AI) vs a command/search
 * (route to existing cmdk logic). When routed to AI, streams a governance-aware
 * response with embedded entity references.
 *
 * The advisor has access to:
 * - Active proposals and their status
 * - DRep information and scores
 * - Epoch context (current epoch, time remaining, active proposals)
 * - User's personal governance context (if authenticated)
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Question / intent detection
// ---------------------------------------------------------------------------

/**
 * Heuristic to detect if user input is a question or governance intent
 * rather than a search/command query.
 *
 * Questions: start with question words, end with "?", or are intent statements.
 * Commands/searches: short keywords, known command patterns, entity names.
 */
export function isConversationalQuery(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 8) return false;

  const lower = trimmed.toLowerCase();

  // Ends with question mark = question
  if (trimmed.endsWith('?')) return true;

  // Starts with question words
  const questionStarters = [
    'who ',
    'what ',
    'when ',
    'where ',
    'why ',
    'how ',
    'which ',
    'can ',
    'could ',
    'should ',
    'would ',
    'is ',
    'are ',
    'do ',
    'does ',
    'did ',
    'will ',
    'has ',
    'have ',
    'tell me',
    'show me',
    'explain',
    'help me',
    'prepare me',
    'find me',
    'compare',
    'summarize',
    'analyze',
    "what's",
    "who's",
    "how's",
  ];

  for (const starter of questionStarters) {
    if (lower.startsWith(starter)) return true;
  }

  // Intent patterns (imperative + governance context)
  const intentPatterns = [
    /^prepare\b/i,
    /^find\s+(dreps?|proposals?|votes?)\b/i,
    /^list\s+(all|active|recent)\b/i,
    /^give me\b/i,
    /^i (want|need|would like)\b/i,
    /^what('s| is| are)\b/i,
    /\baffect(s|ing)?\s+(treasury|budget|constitution)\b/i,
    /\bperform(ing|ance)?\b/i,
    /\balign(ed|ment)?\b/i,
    /\bvoting\s+(this|next|current)\b/i,
  ];

  for (const pattern of intentPatterns) {
    if (pattern.test(lower)) return true;
  }

  // If it has multiple words (4+) and reads like a sentence, likely conversational
  const words = trimmed.split(/\s+/);
  if (words.length >= 5) {
    // Check for sentence-like structure (contains a verb-like word)
    const verbIndicators = [
      'affect',
      'impact',
      'vote',
      'delegate',
      'perform',
      'change',
      'align',
      'support',
      'oppose',
      'recommend',
      'suggest',
      'think',
      'happen',
      'going',
    ];
    if (verbIndicators.some((v) => lower.includes(v))) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Advisor system prompt builder
// ---------------------------------------------------------------------------

export interface AdvisorContext {
  /** Current epoch number */
  epoch: number;
  /** Days remaining in epoch */
  daysRemaining: number;
  /** Number of active proposals */
  activeProposalCount: number;
  /** User's governance segment */
  segment: string;
  /** Personal context string (from AI context assembler) */
  personalContext?: string;
  /** Recent governance data summaries for grounding */
  governanceSnapshot?: string;
}

export function buildAdvisorSystemPrompt(ctx: AdvisorContext): string {
  const lines = [
    'You are the Governada Governance Advisor, an AI assistant embedded in the command palette of Governada — a governance intelligence platform for Cardano.',
    '',
    '## Your Role',
    '- Answer governance questions with accurate, data-grounded responses',
    '- Reference specific proposals, DReps, and governance actions by name when relevant',
    '- Help users understand governance context, prepare for voting, and analyze proposals',
    '- Be concise but thorough — users are in a command palette, not a chat window',
    '',
    '## Current Governance Context',
    `- Epoch: ${ctx.epoch}`,
    `- Days remaining: ${ctx.daysRemaining}`,
    `- Active proposals: ${ctx.activeProposalCount}`,
    `- User segment: ${ctx.segment}`,
    '',
    '## Response Format',
    'Format your responses with these conventions:',
    '- Use **bold** for entity names and key terms',
    '- Reference proposals as: [Proposal: <title>](/governance/proposals/<hash>#<index>)',
    '- Reference DReps as: [DRep: <name>](/governance/dreps/<id>)',
    '- Use bullet points for lists',
    '- Keep responses under 300 words unless the question demands detail',
    '- End with actionable next steps when appropriate',
    '',
    '## Anti-patterns',
    '- Never fabricate proposal names, DRep names, or vote counts',
    '- If you lack data to answer, say so and suggest where to look in Governada',
    '- Do not produce generic blockchain explanations — users are governance participants',
    '- Do not recommend specific votes — present analysis, let users decide',
  ];

  if (ctx.personalContext) {
    lines.push('', "## User's Governance Profile", ctx.personalContext);
  }

  if (ctx.governanceSnapshot) {
    lines.push('', '## Current Governance Data', ctx.governanceSnapshot);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Conversation message types
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// Streaming advisor call (used by the API route)
// ---------------------------------------------------------------------------

export interface AdvisorStreamOptions {
  messages: ConversationMessage[];
  context: AdvisorContext;
  signal?: AbortSignal;
}

/**
 * Stream a governance advisor response.
 * Returns a ReadableStream that emits SSE-formatted events.
 */
export async function streamAdvisorResponse(
  options: AdvisorStreamOptions,
): Promise<ReadableStream> {
  const { messages, context, signal } = options;
  const systemPrompt = buildAdvisorSystemPrompt(context);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.error('[Advisor] ANTHROPIC_API_KEY not configured');
    return createErrorStream('AI advisor is not configured. Please try again later.');
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const anthropicMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  try {
    const stream = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      temperature: 0.3,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    });

    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream as AsyncIterable<{
            type: string;
            delta?: { type?: string; text?: string };
            message?: { usage?: { output_tokens?: number } };
            usage?: { output_tokens?: number };
          }>) {
            if (signal?.aborted) {
              controller.close();
              return;
            }

            if (
              event.type === 'content_block_delta' &&
              event.delta?.type === 'text_delta' &&
              event.delta.text
            ) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'text_delta', content: event.delta.text })}\n\n`,
                ),
              );
            }

            if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            }
          }

          // Ensure we always send done
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (err) {
          logger.error('[Advisor] Stream processing error', { error: err });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', content: 'Stream interrupted. Please try again.' })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        }
      },
    });
  } catch (err) {
    logger.error('[Advisor] Failed to create stream', { error: err });
    return createErrorStream('Failed to connect to AI. Please try again.');
  }
}

function createErrorStream(message: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', content: message })}\n\n`),
      );
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
    },
  });
}
