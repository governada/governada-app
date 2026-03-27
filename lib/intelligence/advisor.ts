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
import { createAnthropicStream } from '@/lib/ai';
import { buildSenecaPrompt } from '@/lib/ai/senecaPersona';
import { PERSONAS, type PersonaId } from '@/lib/intelligence/senecaPersonas';

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
  /** Visitor onboarding mode */
  visitorMode?: 'onboarding' | 'exploring' | 'returning' | 'authenticated';
  /** Current page the user is viewing */
  pageContext?: string;
  /** Match quiz state */
  matchState?: 'idle' | 'matching' | 'matched' | 'delegated';
  /** Wallet detection and connection state */
  walletState?: 'none_detected' | 'detected' | 'connected' | 'has_ada' | 'no_ada';
  /** Active Seneca persona (determines personality modifier) */
  persona?: PersonaId;
  /** Briefing mode: concise, proactive, globe-synchronized */
  mode?: 'conversation' | 'briefing';
}

export function buildAdvisorSystemPrompt(ctx: AdvisorContext): string {
  // Build additional context from the advisor's structured data
  const contextParts: string[] = [
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
    '- End with actionable next steps when appropriate',
    '',
    '## Anti-patterns',
    '- Never fabricate proposal names, DRep names, or vote counts',
    '- If you lack data to answer, say so — speculation without evidence is beneath you',
    '- Do not produce generic blockchain explanations — users are governance participants',
    '- Do not recommend specific votes — present analysis, let citizens decide',
  ];

  const lines: string[] = [];

  // Page context awareness
  if (ctx.pageContext) {
    lines.push(
      '',
      `## Current Page Context`,
      `The user is currently viewing the "${ctx.pageContext}" section of Governada.`,
    );
  }

  // Onboarding mode: adjust tone, explain without jargon, celebrate actions
  if (ctx.visitorMode === 'onboarding') {
    lines.push(
      '',
      '## Onboarding Mode — Active',
      'This is a first-time visitor. Adjust your behavior:',
      '- Explain governance concepts simply, without jargon',
      '- Celebrate their first actions (completing the quiz, connecting a wallet)',
      '- Surface ONE clear next action — never a menu of options',
      '- Keep responses short and encouraging (under 150 words)',
      '- Reference what they can see on screen when relevant',
    );

    // Segment-specific guidance based on match + wallet state
    if (ctx.matchState === 'matched' && ctx.walletState) {
      lines.push('', '## Post-Match Guidance');
      switch (ctx.walletState) {
        case 'detected':
          lines.push(
            'The user has a wallet extension installed but not yet connected.',
            'Suggest connecting their detected wallet to delegate to their match. Emphasize it takes one click.',
          );
          break;
        case 'none_detected':
          lines.push(
            'No wallet extension was detected.',
            'Explain what a Cardano wallet is in one sentence. Recommend ONE wallet for their device (Eternl for desktop, Vespr for mobile).',
            'Reassure them their matches are saved and they can come back to delegate later.',
          );
          break;
        case 'connected':
          lines.push(
            'Wallet is connected. Guide them to delegate to their top match — it is one click away.',
          );
          break;
        case 'no_ada':
          lines.push(
            'Wallet is connected but has no ADA.',
            'Explain how to acquire ADA simply. Emphasize that ADA stays in their wallet during delegation — they are not giving it away.',
          );
          break;
        case 'has_ada':
          lines.push(
            'Wallet is connected and has ADA. They are ready to delegate.',
            'Guide them to delegate to their top match now. Emphasize it is a single action and their ADA remains in their wallet.',
          );
          break;
      }
    }
  }

  // Briefing mode: concise, personality-driven, with globe commands and follow-up chips
  if (ctx.mode === 'briefing') {
    lines.push(
      '',
      '## Briefing Mode — Active',
      'You are delivering a live governance briefing on the Governada homepage.',
      'The user just arrived. Their constellation globe is visible behind your text panel.',
      '',
      'RULES:',
      '- Keep the initial briefing to exactly 2-3 sentences. Be specific, not generic.',
      '- Lead with the most personally relevant item (based on their segment/delegation), not recency.',
      '- Mention specific entity names (DRep names, proposal titles) so the globe can react.',
      '- Use [[globe:flyTo:drep_<id>]] or [[globe:pulse:proposal_<hash>_<index>]] markers when referencing entities.',
      '- When discussing a contentious proposal (close vote margin or strong opinions), use [[globe:voteSplit:<txHash>_<index>]] to show the vote divide on the globe. Follow with [[globe:reset]] when moving to a new topic.',
      '- End with exactly 3 follow-up suggestions as [[chip:text]] on separate lines.',
      '- Chips should be short (3-6 words), actionable, and persona-specific.',
      '- Do NOT say "Good morning" or use generic greetings. Start with substance.',
      '- Speak as a governance companion, not an assistant. You notice things, you have opinions (within bounds).',
      '- If something is urgent or contentious, lead with that — create narrative tension.',
      '',
      'PERSONA-SPECIFIC BRIEFING FOCUS:',
      ctx.segment === 'drep'
        ? '- DRep: Lead with pending votes and deadline urgency. Mention delegation changes.'
        : ctx.segment === 'spo'
          ? '- SPO: Lead with governance score trend and any votes that need attention.'
          : ctx.segment === 'cc'
            ? '- CC: Lead with proposals requiring constitutional review.'
            : '- Citizen: Lead with what their DRep has been doing, or suggest finding a match if undelegated.',
    );
  }

  if (ctx.personalContext) {
    lines.push('', "## User's Governance Profile", ctx.personalContext);
  }

  if (ctx.governanceSnapshot) {
    lines.push('', '## Current Governance Data', ctx.governanceSnapshot);
  }

  // Append persona personality modifier if provided
  if (ctx.persona) {
    const persona = PERSONAS[ctx.persona];
    lines.push('', '## Seneca Persona Mode', persona.personalityModifier);
  }

  const additionalContext = [...contextParts, ...lines].join('\n');
  return buildSenecaPrompt('advisor', additionalContext);
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

  const anthropicMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Adjust temperature and max tokens for onboarding mode
  const isOnboarding = context.visitorMode === 'onboarding';
  const temperature = isOnboarding ? 0.4 : 0.3;
  const maxTokens = isOnboarding ? 512 : 1024;

  try {
    const stream = await createAnthropicStream('', {
      model: 'FAST',
      maxTokens,
      temperature,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    if (!stream) {
      logger.error('[Advisor] AI client not available');
      return createErrorStream('AI advisor is not configured. Please try again later.');
    }

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
