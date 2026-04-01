import { getStoredSession } from '@/lib/supabaseAuth';

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AdvisorContext {
  epoch: number;
  daysRemaining: number;
  activeProposalCount: number;
  segment: string;
  pageContext?: string;
  entityId?: string;
  persona?: 'navigator' | 'analyst' | 'partner' | 'guide';
  conversationMemory?: string;
  /** Navigation event — set when user navigates mid-conversation */
  navigationEvent?: { from: string; to: string; entityId?: string };
  /** Which world the user is in — determines available tools and behavior */
  world?: 'home' | 'workspace' | 'you';
}

export interface GlobeStreamCommand {
  type: string;
  nodeId?: string;
  alignment?: number[];
  threshold?: number;
  /** @deprecated Use `type` instead — kept for backward compat with server SSE */
  cmd?: string;
  /** @deprecated Use `nodeId` instead */
  target?: string;
}

// ---------------------------------------------------------------------------
// Topic detection for conversation-aware globe choreography
// ---------------------------------------------------------------------------

export type WarmTopic =
  | 'treasury'
  | 'participation'
  | 'delegation'
  | 'proposals'
  | 'contested'
  | 'conservative';

const TOPIC_PATTERNS: Array<{ topic: WarmTopic; pattern: RegExp }> = [
  { topic: 'treasury', pattern: /\b(treasury|withdrawal|funding|budget|ADA balance|spending)\b/i },
  {
    topic: 'participation',
    pattern: /\b(participation|quorum|voter turnout|governance health|GHI)\b/i,
  },
  {
    topic: 'delegation',
    pattern: /\b(delegat(?:ion|ed|or|e)|represent(?:ative|ation)|your DRep)\b/i,
  },
  { topic: 'proposals', pattern: /\b(proposal|governance action|parameter change|hard fork)\b/i },
  {
    topic: 'contested',
    pattern: /\b(controversial|contested|divisive|split|polariz(?:ed|ing)|contentious)\b/i,
  },
  {
    topic: 'conservative',
    pattern: /\b(conservative|cautious|risk.averse|fiscal(?:ly)? responsible|protect)\b/i,
  },
];

/**
 * Detect the dominant governance topic in a text chunk.
 * Returns the topic to warm on the globe, or null if no strong signal.
 * Tracks which topics have already been warmed to avoid repetition.
 */
export function detectStreamTopic(text: string, warmedTopics: Set<WarmTopic>): WarmTopic | null {
  for (const { topic, pattern } of TOPIC_PATTERNS) {
    if (warmedTopics.has(topic)) continue;
    if (pattern.test(text)) return topic;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Marker extraction — pure functions for testability
// ---------------------------------------------------------------------------

/** Extract [[action:payload]] markers from text, returning clean text and actions */
export function extractActionMarkers(text: string): { cleanText: string; actions: string[] } {
  const actions: string[] = [];
  const cleanText = text.replace(/\[\[action:([^\]]+)\]\]/g, (_, action) => {
    actions.push(action);
    return '';
  });
  return { cleanText, actions };
}

/** Extract [[globe:cmd:target]] markers from text, returning clean text and commands */
export function extractGlobeMarkers(text: string): {
  cleanText: string;
  commands: GlobeStreamCommand[];
} {
  const commands: GlobeStreamCommand[] = [];
  const cleanText = text.replace(/\[\[globe:(\w+):?([^\]]*)\]\]/g, (_, cmd, target) => {
    commands.push({ type: cmd, nodeId: target || undefined });
    return '';
  });
  return { cleanText, commands };
}

export async function readAdvisorStream(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: AdvisorContext & { mode?: 'conversation' | 'briefing' },
  onDelta: (text: string) => void,
  onError: (error: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
  onGlobeCommand?: (command: GlobeStreamCommand) => void,
  onAction?: (action: string) => void,
  onToolStatus?: (status: string) => void,
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = getStoredSession();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/intelligence/advisor', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        context: { ...context, mode: context.mode ?? 'conversation' },
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      onError(err.error ?? `Request failed (${res.status})`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError('No response stream available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6)) as {
            type: string;
            content?: string;
          };

          if (data.type === 'text_delta' && data.content) {
            // Extract action markers
            const actionResult = extractActionMarkers(data.content);
            let cleanText = actionResult.cleanText;
            for (const action of actionResult.actions) {
              if (onAction) onAction(action);
            }

            // Extract globe markers
            if (onGlobeCommand) {
              const globeResult = extractGlobeMarkers(cleanText);
              cleanText = globeResult.cleanText;
              for (const cmd of globeResult.commands) {
                onGlobeCommand(cmd);
              }
            }

            if (cleanText) onDelta(cleanText);
          } else if (data.type === 'globe_command') {
            // Direct globe commands injected by the server (from tool execution)
            const cmdData = data as unknown as {
              type: string;
              command?: GlobeStreamCommand & { cmd?: string; target?: string };
            };
            if (onGlobeCommand && cmdData.command) {
              // Normalize server-emitted commands to bridge format
              const c = cmdData.command;
              onGlobeCommand({
                type: c.type ?? c.cmd ?? 'reset',
                nodeId: c.nodeId ?? c.target,
                alignment: c.alignment,
                threshold: c.threshold,
              });
            }
          } else if (data.type === 'tool_status' && data.content) {
            // Tool execution status indicator (e.g., "Searching representatives...")
            if (onToolStatus) onToolStatus(data.content);
          } else if (data.type === 'error' && data.content) {
            onError(data.content);
          } else if (data.type === 'done') {
            onDone();
            return;
          }
        } catch {
          // Skip malformed SSE events
        }
      }
    }

    onDone();
  } catch (err) {
    if (signal?.aborted) return;
    onError(err instanceof Error ? err.message : 'Connection failed');
  }
}
