/**
 * POST /api/workspace/agent -- Streaming SSE endpoint for the governance agent.
 *
 * Authenticates the user, loads conversation history, assembles governance
 * context, calls Claude messages API with streaming + tool_use, and emits
 * typed AgentSSEEvent objects as Server-Sent Events.
 *
 * Event types:
 *   text_delta      -- streaming chat text
 *   tool_call       -- agent invoking a tool (started/completed)
 *   tool_result     -- tool execution result
 *   edit_proposal   -- proposed diff for the editor
 *   draft_comment   -- proposed inline comment
 *   done            -- stream complete
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { assembleGovernanceContext } from '@/lib/workspace/agent/context';
import { buildSystemPrompt } from '@/lib/workspace/agent/system-prompt';
import { getToolDefinitions, executeTool } from '@/lib/workspace/agent/tools';
import { MODELS } from '@/lib/ai';
import { logger } from '@/lib/logger';
import type { AgentMessage } from '@/lib/workspace/agent/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const AgentRequestSchema = z.object({
  proposalId: z.string().min(1),
  conversationId: z.string().min(1),
  message: z.string().min(1).max(4000),
  editorContext: z
    .object({
      selectedText: z.string().optional(),
      cursorSection: z.enum(['title', 'abstract', 'motivation', 'rationale']).optional(),
      currentContent: z.object({
        title: z.string(),
        abstract: z.string(),
        motivation: z.string(),
        rationale: z.string(),
      }),
      mode: z.enum(['edit', 'review', 'diff']),
    })
    .optional(),
  userRole: z.enum(['proposer', 'reviewer', 'cc_member']),
});

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory, per-user)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Evict stale entries periodically
function evictStaleEntries() {
  if (rateLimitMap.size > 1000) {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // --- Auth ---
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { userId, wallet } = authResult;

    // --- Rate limit ---
    evictStaleEntries();
    if (!checkRateLimit(userId ?? wallet)) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Parse request ---
    const body = await request.json();
    const parsed = AgentRequestSchema.parse(body);

    // --- Build the streaming response ---
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await handleAgentStream(controller, parsed, userId, wallet);
        } catch (err) {
          logger.error('[Agent] Stream error', { error: err });
          controller.enqueue(
            new TextEncoder().encode(
              sseEvent({
                type: 'text_delta',
                content: '\n\n[Error: Agent encountered an issue. Please try again.]',
              }),
            ),
          );
          controller.enqueue(new TextEncoder().encode(sseEvent({ type: 'done' })));
          controller.close();
        }
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
      const fields = err.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`);
      return new Response(JSON.stringify({ error: 'Validation failed', details: fields }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.error('[Agent] Request error', { error: err });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ---------------------------------------------------------------------------
// Core streaming logic
// ---------------------------------------------------------------------------

async function handleAgentStream(
  controller: ReadableStreamDefaultController,
  parsed: z.infer<typeof AgentRequestSchema>,
  userId: string | undefined,
  wallet: string,
): Promise<void> {
  const encoder = new TextEncoder();
  const emit = (data: Record<string, unknown>) => {
    controller.enqueue(encoder.encode(sseEvent(data)));
  };

  const supabase = getSupabaseAdmin();

  // 1. Load or create conversation
  const conversation = await loadConversation(
    supabase,
    parsed.conversationId,
    parsed.proposalId,
    userId,
  );

  // 2. Assemble governance context
  const context = await assembleGovernanceContext(parsed.proposalId, userId ?? wallet, wallet);

  // If editor context provides current content, overlay it onto the context
  // (the editor may have unsaved changes not yet in DB)
  if (parsed.editorContext?.currentContent) {
    context.proposal.title = parsed.editorContext.currentContent.title || context.proposal.title;
    context.proposal.abstract =
      parsed.editorContext.currentContent.abstract || context.proposal.abstract;
    context.proposal.motivation =
      parsed.editorContext.currentContent.motivation || context.proposal.motivation;
    context.proposal.rationale =
      parsed.editorContext.currentContent.rationale || context.proposal.rationale;
  }

  // 3. Build system prompt
  const systemPrompt = buildSystemPrompt(context, parsed.userRole);

  // 4. Build messages array from conversation history
  const messages = buildMessagesArray(conversation.messages, parsed.message, parsed.editorContext);

  // 5. Get tool definitions for this role
  const tools = getToolDefinitions(parsed.userRole);

  // 6. Resolve API key (BYOK or platform)
  const apiKey = await resolveApiKey(supabase, userId);
  if (!apiKey) {
    emit({
      type: 'text_delta',
      content: 'AI is not configured. Please check your API key settings.',
    });
    emit({ type: 'done' });
    controller.close();
    return;
  }

  // 7. Call Claude with streaming
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  // Accumulate assistant response for persistence
  let fullAssistantText = '';
  const toolCallResults: AgentMessage['toolCalls'] = [];
  const proposedEdits: AgentMessage['proposedEdits'] = [];
  const proposedComments: AgentMessage['proposedComments'] = [];

  // Claude messages API with tools -- use iterative tool loop
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = messages;
  let continueLoop = true;
  const MAX_TOOL_ITERATIONS = 5;
  let iteration = 0;

  while (continueLoop && iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const response = await client.messages.create({
      model: MODELS.FAST,
      max_tokens: 4096,
      system: systemPrompt,
      messages: currentMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any[],
      stream: true,
    });

    let stopReason: string | null = null;
    const toolUseBlocks: Array<{ id: string; name: string; input: string }> = [];
    let currentToolId = '';
    let currentToolName = '';
    let currentToolInput = '';
    let inToolInput = false;

    for await (const event of response) {
      switch (event.type) {
        case 'content_block_start': {
          const block = event.content_block;
          if (block.type === 'text') {
            // Text block starting
          } else if (block.type === 'tool_use') {
            currentToolId = block.id;
            currentToolName = block.name;
            currentToolInput = '';
            inToolInput = true;
            emit({ type: 'tool_call', toolName: currentToolName, status: 'started' });
          }
          break;
        }

        case 'content_block_delta': {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            fullAssistantText += delta.text;
            emit({ type: 'text_delta', content: delta.text });
          } else if (delta.type === 'input_json_delta') {
            currentToolInput += delta.partial_json;
          }
          break;
        }

        case 'content_block_stop': {
          if (inToolInput && currentToolId) {
            toolUseBlocks.push({
              id: currentToolId,
              name: currentToolName,
              input: currentToolInput,
            });
            inToolInput = false;
          }
          break;
        }

        case 'message_delta': {
          if (event.delta.stop_reason) {
            stopReason = event.delta.stop_reason;
          }
          break;
        }
      }
    }

    // Process tool calls if the model stopped for tool use
    if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolBlock of toolUseBlocks) {
        let toolInput: Record<string, unknown> = {};
        try {
          toolInput = toolBlock.input ? JSON.parse(toolBlock.input) : {};
        } catch {
          toolInput = {};
        }

        // Execute the tool
        const result = await executeTool(toolBlock.name, toolInput, context, parsed.userRole);

        // Emit tool completion
        emit({ type: 'tool_call', toolName: toolBlock.name, status: 'completed' });

        // Emit tool result
        emit({
          type: 'tool_result',
          toolName: toolBlock.name,
          summary: result.summary,
          data: result.data,
        });

        // Emit proposed edits/comments
        if (result.proposedEdit) {
          emit({ type: 'edit_proposal', edit: result.proposedEdit });
          proposedEdits.push(result.proposedEdit);
        }
        if (result.proposedComment) {
          emit({ type: 'draft_comment', comment: result.proposedComment });
          proposedComments.push(result.proposedComment);
        }

        // Track for persistence
        toolCallResults.push({
          toolName: toolBlock.name,
          input: toolInput,
          result: result.data,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result.data),
        });
      }

      // Build the assistant message content blocks for the next iteration
      const assistantContent: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      > = [];

      if (fullAssistantText) {
        assistantContent.push({ type: 'text', text: fullAssistantText });
      }

      for (const tb of toolUseBlocks) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = tb.input ? JSON.parse(tb.input) : {};
        } catch {
          parsedInput = {};
        }
        assistantContent.push({
          type: 'tool_use',
          id: tb.id,
          name: tb.name,
          input: parsedInput,
        });
      }

      // Continue the conversation with tool results
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: assistantContent },
        ...toolResults.map((tr) => ({
          role: 'user' as const,
          content: [tr],
        })),
      ];

      // Reset text accumulator for next iteration
      fullAssistantText = '';
    } else {
      // No more tool calls -- we're done
      continueLoop = false;
    }
  }

  // 8. Emit done
  emit({ type: 'done' });

  // 9. Persist conversation
  const userMessage: AgentMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: parsed.message,
    timestamp: new Date().toISOString(),
  };

  const assistantMessage: AgentMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: fullAssistantText,
    timestamp: new Date().toISOString(),
    toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
    proposedEdits: proposedEdits.length > 0 ? proposedEdits : undefined,
    proposedComments: proposedComments.length > 0 ? proposedComments : undefined,
  };

  await persistConversation(supabase, parsed.conversationId, parsed.proposalId, userId, [
    ...conversation.messages,
    userMessage,
    assistantMessage,
  ]);

  // 10. Log activity for provenance
  await logAgentActivity(supabase, userId, wallet, parsed);

  controller.close();
}

// ---------------------------------------------------------------------------
// Conversation persistence
// ---------------------------------------------------------------------------

interface ConversationData {
  messages: AgentMessage[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function loadConversation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  conversationId: string,
  _proposalId: string,
  _userId: string | undefined,
): Promise<ConversationData> {
  try {
    const { data } = await supabase
      .from('agent_conversations')
      .select('messages')
      .eq('id', conversationId)
      .maybeSingle();

    if (data?.messages) {
      return { messages: data.messages as unknown as AgentMessage[] };
    }
  } catch {
    // Table may not exist yet -- that's ok
    logger.debug('[Agent] agent_conversations table not available, starting fresh');
  }

  return { messages: [] };
}

async function persistConversation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  conversationId: string,
  proposalId: string,
  userId: string | undefined,
  messages: AgentMessage[],
): Promise<void> {
  try {
    await supabase.from('agent_conversations').upsert(
      {
        id: conversationId,
        proposal_id: proposalId,
        user_id: userId ?? null,
        messages: messages as unknown as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  } catch (err) {
    // Non-blocking -- conversation history is best-effort
    logger.warn('[Agent] Failed to persist conversation', { error: err });
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Messages array builder
// ---------------------------------------------------------------------------

function buildMessagesArray(
  history: AgentMessage[],
  currentMessage: string,
  editorContext?: z.infer<typeof AgentRequestSchema>['editorContext'],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add conversation history (last 20 messages to stay within context limits)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Build current message with editor context
  let userContent = currentMessage;
  if (editorContext) {
    const contextParts: string[] = [];
    if (editorContext.selectedText) {
      contextParts.push(`[Selected text: "${editorContext.selectedText}"]`);
    }
    if (editorContext.cursorSection) {
      contextParts.push(`[Current section: ${editorContext.cursorSection}]`);
    }
    if (editorContext.mode) {
      contextParts.push(`[Editor mode: ${editorContext.mode}]`);
    }
    if (contextParts.length > 0) {
      userContent = `${contextParts.join(' ')}\n\n${currentMessage}`;
    }
  }

  messages.push({ role: 'user', content: userContent });

  return messages;
}

// ---------------------------------------------------------------------------
// API key resolution (BYOK support)
// ---------------------------------------------------------------------------

async function resolveApiKey(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string | undefined,
): Promise<string | null> {
  // Try BYOK first
  if (userId) {
    try {
      const { data: keyRow } = await supabase
        .from('encrypted_api_keys')
        .select('encrypted_key')
        .eq('user_id', userId)
        .eq('provider', 'anthropic')
        .maybeSingle();

      if (keyRow?.encrypted_key) {
        const { decryptApiKey } = await import('@/lib/ai/encryption');
        return decryptApiKey(keyRow.encrypted_key);
      }
    } catch {
      // Fall through to platform key
    }
  }

  return process.env.ANTHROPIC_API_KEY ?? null;
}

// ---------------------------------------------------------------------------
// Provenance logging
// ---------------------------------------------------------------------------

async function logAgentActivity(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string | undefined,
  wallet: string,
  parsed: z.infer<typeof AgentRequestSchema>,
): Promise<void> {
  try {
    await supabase.from('ai_activity_log').insert({
      user_id: userId ?? null,
      stake_address: wallet,
      skill_name: 'agent_conversation',
      draft_id: parsed.proposalId.includes('-') ? parsed.proposalId : null,
      proposal_tx_hash: !parsed.proposalId.includes('-') ? parsed.proposalId.split('#')[0] : null,
      model_used: MODELS.FAST,
      key_source: 'platform',
      input_summary: parsed.message.slice(0, 200),
    });
  } catch (err) {
    logger.warn('[Agent] Failed to log activity', { error: err });
  }
}
