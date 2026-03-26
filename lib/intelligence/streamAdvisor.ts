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
}

export interface GlobeStreamCommand {
  cmd: string;
  target?: string;
  alignment?: number[];
  threshold?: number;
}

export async function readAdvisorStream(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: AdvisorContext & { mode?: 'conversation' | 'briefing' },
  onDelta: (text: string) => void,
  onError: (error: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
  onGlobeCommand?: (command: GlobeStreamCommand) => void,
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
            // Parse [[globe:cmd:target]] markers from briefing text
            if (onGlobeCommand) {
              const markerRe = /\[\[globe:(\w+):?([^\]]*)\]\]/g;
              let match: RegExpExecArray | null;
              let cleanText = data.content;
              while ((match = markerRe.exec(data.content)) !== null) {
                const [full, cmd, target] = match;
                cleanText = cleanText.replace(full, '');
                onGlobeCommand({ cmd, target: target || undefined });
              }
              if (cleanText) onDelta(cleanText);
            } else {
              onDelta(data.content);
            }
          } else if (data.type === 'globe_command') {
            // Direct globe commands injected by the server
            const cmdData = data as unknown as { type: string; command?: GlobeStreamCommand };
            if (onGlobeCommand && cmdData.command) {
              onGlobeCommand(cmdData.command);
            }
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
