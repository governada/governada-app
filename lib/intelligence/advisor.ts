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
import {
  ADVISOR_TOOLS,
  executeAdvisorTool,
  getToolThinkingGlobeCommands,
} from '@/lib/intelligence/advisor-tools';

// ---------------------------------------------------------------------------
// Globe intent detection — intercepts user queries BEFORE the AI call
// ---------------------------------------------------------------------------

/**
 * Intent categories for Seneca → Globe routing.
 * When detected, these trigger immediate globe state changes
 * AND feed context into the AI response.
 */
export type GlobeIntentType =
  | 'browse' // "show me proposals" → open list overlay, filter
  | 'focus' // "show me drep_X" → flyTo node, open detail panel
  | 'compare' // "compare X and Y" → highlight both
  | 'filter' // "show tier 1 dreps" → filter list + globe
  | 'match' // "find my match" → start match flow
  | 'votesplit' // "how did people vote on X" → vote split viz
  | 'temporal' // "show me epoch 620" → temporal replay
  | 'reset'; // "reset" / "clear" / "start over" → reset globe

export interface GlobeIntent {
  type: GlobeIntentType;
  /** Entity filter for browse/filter intents */
  filter?: 'proposals' | 'dreps' | 'spos' | 'cc';
  /** Entity ID for focus intents */
  entityId?: string;
  /** Entity type for focus/compare intents */
  entityType?: 'drep' | 'proposal' | 'pool' | 'cc';
  /** Second entity for compare intents */
  compareWith?: { entityId: string; entityType: string };
  /** Proposal reference for votesplit intents */
  proposalRef?: string;
  /** Epoch number for temporal intents */
  epoch?: number;
  /** Tier filter */
  tier?: number;
  /** The original query text (passed through to AI for response) */
  query: string;
}

/**
 * Detect if user input maps to a globe action BEFORE hitting the AI.
 * Returns null if no intent is detected (query goes to AI as normal).
 *
 * Intent detection is fast keyword/pattern matching — no AI call needed.
 * Complex/ambiguous queries always fall through to the AI.
 */
export function detectGlobeIntent(input: string): GlobeIntent | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const lower = trimmed.toLowerCase();

  // --- RESET ---
  if (/^(reset|clear|start over|go back|home)\s*$/.test(lower)) {
    return { type: 'reset', query: trimmed };
  }

  // --- MATCH ---
  if (
    /\b(find|start|begin|do)\b.*\b(match|matching|quiz)\b/i.test(lower) ||
    /^match\s*me$/i.test(lower) ||
    /^find\s+(my|a)\s+match$/i.test(lower)
  ) {
    return { type: 'match', query: trimmed };
  }

  // --- TEMPORAL ---
  const epochMatch = lower.match(/\bepoch\s+(\d+)\b/);
  if (epochMatch) {
    return { type: 'temporal', epoch: parseInt(epochMatch[1], 10), query: trimmed };
  }

  // --- VOTESPLIT ---
  if (
    /\bhow\s+(did|do)\s+(people|dreps?|spos?|they|voters?)\s+vote/i.test(lower) ||
    /\bvote\s*split\b/i.test(lower) ||
    /\bvoting\s+(breakdown|results?|split)\b/i.test(lower)
  ) {
    const proposalRefMatch = lower.match(/\b([a-f0-9]{8,})[_#](\d+)\b/);
    return {
      type: 'votesplit',
      proposalRef: proposalRefMatch ? `${proposalRefMatch[1]}_${proposalRefMatch[2]}` : undefined,
      query: trimmed,
    };
  }

  // --- FOCUS (specific entity) ---
  const drepFocusMatch = lower.match(
    /\b(?:show|tell|about|focus|go\s+to)\b.*\b(drep[_\s]?\w{5,})/i,
  );
  if (drepFocusMatch) {
    const id = drepFocusMatch[1].replace(/^drep[_\s]?/, '');
    return { type: 'focus', entityId: id, entityType: 'drep', query: trimmed };
  }

  const poolFocusMatch = lower.match(
    /\b(?:show|tell|about|focus|go\s+to)\b.*\b(pool[_\s]?\w{5,})/i,
  );
  if (poolFocusMatch) {
    const id = poolFocusMatch[1].replace(/^pool[_\s]?/, '');
    return { type: 'focus', entityId: id, entityType: 'pool', query: trimmed };
  }

  // --- COMPARE ---
  if (/\bcompare\b/i.test(lower)) {
    return { type: 'compare', query: trimmed };
  }

  // --- FILTER (with tier) ---
  const tierMatch = lower.match(/\btier\s*(\d)\b/);
  const tier = tierMatch ? parseInt(tierMatch[1], 10) : undefined;

  // --- BROWSE / FILTER ---
  if (
    /\b(show|list|browse|display|view|see|find|get)\b.*\b(all\s+)?(proposals?|actions?|gov\s*actions?)\b/i.test(lower)
  ) {
    return { type: 'browse', filter: 'proposals', tier, query: trimmed };
  }
  if (
    /\b(show|list|browse|display|view|see|find|get)\b.*\b(all\s+)?(dreps?|representatives?|delegates?)\b/i.test(lower)
  ) {
    return { type: 'browse', filter: 'dreps', tier, query: trimmed };
  }
  if (
    /\b(show|list|browse|display|view|see|find|get)\b.*\b(all\s+)?(spos?|pools?|stake\s*pools?)\b/i.test(lower)
  ) {
    return { type: 'browse', filter: 'spos', tier, query: trimmed };
  }
  if (
    /\b(show|list|browse|display|view|see|find|get)\b.*\b(all\s+)?(cc|committee|constitutional\s*committee)\b/i.test(lower)
  ) {
    return { type: 'browse', filter: 'cc', query: trimmed };
  }
  if (/\btreasury\b/i.test(lower) && /\b(show|list|browse|display|proposals?)\b/i.test(lower)) {
    return { type: 'browse', filter: 'proposals', query: trimmed };
  }

  return null;
}

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
    '## Tools',
    "You have access to tools that query Governada's governance database. USE THEM to answer specific questions.",
    'Available tools: search_dreps, get_drep_profile, get_drep_votes, get_leaderboard, get_proposal, list_proposals, get_treasury_status, get_governance_health.',
    'When the user asks about specific DReps, proposals, scores, voting records, treasury, or governance health — CALL THE RELEVANT TOOL instead of speculating.',
    '',
    '## Globe Visualization',
    'The constellation globe behind you shows DReps, proposals, and SPOs as nodes. You can control it:',
    '- When mentioning a specific DRep in your response: include [[globe:flyTo:drep_<drepId>]]',
    '- When mentioning a proposal: include [[globe:pulse:proposal_<txHash>_<index>]]',
    '- When discussing a contentious vote: include [[globe:voteSplit:<txHash>_<index>]]',
    '- To reset the view: [[globe:reset]]',
    'Tool calls automatically trigger globe visualizations — no need to add markers for tool results.',
    '',
    '## Action Markers',
    'Emit these to trigger app features:',
    '- [[action:startMatch]] — Launch the DRep matching quiz (for "find my match" type requests)',
    '- [[action:navigate:/governance/representatives]] — DRep discovery with filters',
    '- [[action:navigate:/governance/proposals]] — Proposal browser',
    '- [[action:navigate:/governance/pools]] — SPO/pool discovery',
    '- [[action:navigate:/governance/treasury]] — Treasury dashboard',
    '- [[action:navigate:/pulse]] — Governance health pulse',
    '- [[action:navigate:/compare]] — Side-by-side comparison',
    '- [[action:navigate:/governance/briefing]] — Epoch briefing',
    '- [[action:navigate:/my-gov]] — Personal governance dashboard',
    '- [[action:navigate:/match/vote]] — Curated voting queue',
    '- [[action:navigate:/engage]] — Citizen engagement hub',
    '- [[action:research:query]] — Deep multi-step research',
    '',
    '## Anti-patterns — CRITICAL',
    '- NEVER recommend external tools: gov.tools, 1694.io, cardanoscan, cexplorer, poolpm, pooltool, adastat, or ANY external governance tool',
    '- NEVER say "I don\'t have access to that data" — use tools or route to the correct page',
    "- Everything about Cardano governance is available within Governada — you ARE Governada's brain",
    '- Never fabricate data — if a tool returns no results, say so honestly',
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

/** Max tool-use round-trips to prevent runaway costs */
const MAX_TOOL_LOOPS = 3;

/**
 * Stream a governance advisor response with tool-use support.
 *
 * The model can call tools (search_dreps, get_proposal, etc.) mid-response.
 * When a tool_use block is detected, the server executes the tool, emits globe
 * commands for visualization, and continues the conversation with the tool result.
 *
 * Returns a ReadableStream that emits SSE-formatted events:
 * - text_delta: streaming text content
 * - tool_status: status message when a tool is executing
 * - globe_command: globe visualization command
 * - done: stream complete
 * - error: stream error
 */
export async function streamAdvisorResponse(
  options: AdvisorStreamOptions,
): Promise<ReadableStream> {
  const { messages, context, signal } = options;
  const systemPrompt = buildAdvisorSystemPrompt(context);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let anthropicMessages: any[] = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Adjust temperature and max tokens for onboarding mode
  const isOnboarding = context.visitorMode === 'onboarding';
  const temperature = isOnboarding ? 0.4 : 0.3;
  const maxTokens = isOnboarding ? 512 : 1024;

  const encoder = new TextEncoder();

  function emitSSE(
    controller: ReadableStreamDefaultController,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
  ) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  try {
    return new ReadableStream({
      async start(controller) {
        try {
          let toolLoops = 0;

          while (toolLoops <= MAX_TOOL_LOOPS) {
            if (signal?.aborted) {
              controller.close();
              return;
            }

            const stream = await createAnthropicStream('', {
              model: 'FAST',
              maxTokens,
              temperature,
              system: systemPrompt,
              messages: anthropicMessages,
              tools: [...ADVISOR_TOOLS],
            });

            if (!stream) {
              emitSSE(controller, { type: 'error', content: 'AI advisor is not configured.' });
              emitSSE(controller, { type: 'done' });
              controller.close();
              return;
            }

            // Track tool_use blocks being accumulated
            let currentToolUseId: string | null = null;
            let currentToolName = '';
            let currentToolInputJson = '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pendingToolCalls: Array<{ id: string; name: string; input: any }> = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assistantContentBlocks: any[] = [];
            let stopReason = 'end_turn';

            for await (const event of stream as AsyncIterable<{
              type: string;
              index?: number;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content_block?: any;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              delta?: any;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              message?: any;
            }>) {
              if (signal?.aborted) {
                controller.close();
                return;
              }

              // --- Text streaming ---
              if (
                event.type === 'content_block_delta' &&
                event.delta?.type === 'text_delta' &&
                event.delta.text
              ) {
                emitSSE(controller, { type: 'text_delta', content: event.delta.text });
              }

              // --- Tool use block start ---
              if (
                event.type === 'content_block_start' &&
                event.content_block?.type === 'tool_use'
              ) {
                currentToolUseId = event.content_block.id;
                currentToolName = event.content_block.name;
                currentToolInputJson = '';

                // Emit "thinking" globe commands while tool executes
                const thinkingCommands = getToolThinkingGlobeCommands(currentToolName, {});
                for (const cmd of thinkingCommands) {
                  emitSSE(controller, { type: 'globe_command', command: cmd });
                }
              }

              // --- Tool use input JSON accumulation ---
              if (
                event.type === 'content_block_delta' &&
                event.delta?.type === 'input_json_delta' &&
                event.delta.partial_json
              ) {
                currentToolInputJson += event.delta.partial_json;
              }

              // --- Tool use block end ---
              if (event.type === 'content_block_stop' && currentToolUseId) {
                let parsedInput = {};
                try {
                  parsedInput = currentToolInputJson ? JSON.parse(currentToolInputJson) : {};
                } catch {
                  logger.warn('[Advisor] Failed to parse tool input JSON', {
                    tool: currentToolName,
                    json: currentToolInputJson,
                  });
                }

                pendingToolCalls.push({
                  id: currentToolUseId,
                  name: currentToolName,
                  input: parsedInput,
                });

                assistantContentBlocks.push({
                  type: 'tool_use',
                  id: currentToolUseId,
                  name: currentToolName,
                  input: parsedInput,
                });

                currentToolUseId = null;
                currentToolName = '';
                currentToolInputJson = '';
              }

              // --- Text block tracking for message history ---
              if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
                assistantContentBlocks.push({ type: 'text', text: '' });
              }
              if (
                event.type === 'content_block_delta' &&
                event.delta?.type === 'text_delta' &&
                event.delta.text
              ) {
                const lastBlock = assistantContentBlocks[assistantContentBlocks.length - 1];
                if (lastBlock?.type === 'text') {
                  lastBlock.text += event.delta.text;
                }
              }

              // --- Message stop ---
              if (event.type === 'message_delta' && event.delta?.stop_reason) {
                stopReason = event.delta.stop_reason;
              }
            }

            // --- Handle tool calls ---
            if (
              stopReason === 'tool_use' &&
              pendingToolCalls.length > 0 &&
              toolLoops < MAX_TOOL_LOOPS
            ) {
              toolLoops++;

              // Execute tools and emit results
              const toolResults = [];
              for (const tc of pendingToolCalls) {
                // Emit status to client
                emitSSE(controller, { type: 'tool_status', content: `Looking up: ${tc.name}` });

                // Emit thinking globe commands with actual input
                const thinkingCmds = getToolThinkingGlobeCommands(tc.name, tc.input);
                for (const cmd of thinkingCmds) {
                  emitSSE(controller, { type: 'globe_command', command: cmd });
                }

                const result = await executeAdvisorTool(tc.name, tc.input);

                // Emit result globe commands
                for (const cmd of result.globeCommands) {
                  emitSSE(controller, { type: 'globe_command', command: cmd });
                }

                toolResults.push({
                  type: 'tool_result' as const,
                  tool_use_id: tc.id,
                  content: result.result,
                });
              }

              // Build updated messages for next iteration
              anthropicMessages = [
                ...anthropicMessages,
                { role: 'assistant', content: assistantContentBlocks },
                ...toolResults.map((tr) => ({ role: 'user', content: [tr] })),
              ];

              // Continue the loop — next iteration will call the API again
              continue;
            }

            // --- Normal end ---
            emitSSE(controller, { type: 'done' });
            controller.close();
            return;
          }
        } catch (err) {
          logger.error('[Advisor] Stream processing error', { error: err });
          emitSSE(controller, {
            type: 'error',
            content: 'Stream interrupted. Please try again.',
          });
          emitSSE(controller, { type: 'done' });
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
