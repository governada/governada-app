'use client';

/**
 * useAdvisor -- Client hook for the governance AI advisor chat.
 *
 * Manages the SSE connection to /api/intelligence/advisor, parses streaming
 * text_delta / done / error events, and exposes a clean conversational API.
 *
 * Features:
 * - Streaming text deltas accumulated into messages
 * - AbortController-based cancellation on unmount or new message
 * - Client-side rate limiting (10 messages/day via localStorage)
 * - Optional auth token forwarding for personalized responses
 */

import { useCallback, useRef, useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseAdvisorOptions {
  /** Page-specific context to include */
  pageContext?: string;
}

export interface UseAdvisorReturn {
  messages: AdvisorMessage[];
  sendMessage: (text: string) => void;
  isStreaming: boolean;
  error: string | null;
  clearMessages: () => void;
}

// ---------------------------------------------------------------------------
// Rate limiting helpers (10 messages per calendar day)
// ---------------------------------------------------------------------------

const USAGE_STORAGE_KEY = 'governada_advisor_usage';
const MAX_MESSAGES_PER_DAY = 10;

interface UsageRecord {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number;
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(): UsageRecord {
  if (typeof window === 'undefined') return { date: getTodayDateString(), count: 0 };

  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    if (raw) {
      const parsed: UsageRecord = JSON.parse(raw);
      if (parsed.date === getTodayDateString()) return parsed;
    }
  } catch {
    // Corrupted storage -- reset
  }
  return { date: getTodayDateString(), count: 0 };
}

function incrementUsage(): UsageRecord {
  const usage = getUsage();
  const updated: UsageRecord = { date: getTodayDateString(), count: usage.count + 1 };
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage full -- best effort
  }
  return updated;
}

/** Returns remaining messages for today. */
export function getRemainingMessages(): number {
  return Math.max(0, MAX_MESSAGES_PER_DAY - getUsage().count);
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (typeof window === 'undefined') return headers;

  const session = localStorage.getItem('governada_session');
  if (session) {
    try {
      const parsed = JSON.parse(session) as { access_token?: string };
      if (parsed.access_token) {
        headers['Authorization'] = `Bearer ${parsed.access_token}`;
      }
    } catch {
      // Malformed session -- skip auth
    }
  }

  return headers;
}

// ---------------------------------------------------------------------------
// SSE event types (from the advisor API)
// ---------------------------------------------------------------------------

interface TextDeltaEvent {
  type: 'text_delta';
  content: string;
}

interface DoneEvent {
  type: 'done';
}

interface ErrorEvent {
  type: 'error';
  content: string;
}

type AdvisorSSEEvent = TextDeltaEvent | DoneEvent | ErrorEvent;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAdvisor(options?: UseAdvisorOptions): UseAdvisorReturn {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // --- Client-side rate limit ---
      if (getRemainingMessages() <= 0) {
        setError('Daily question limit reached (10/10). Try again tomorrow.');
        return;
      }

      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      setError(null);
      setIsStreaming(true);

      // Add user message immediately
      const userMsg: AdvisorMessage = { role: 'user', content: trimmed };
      const assistantMsg: AdvisorMessage = { role: 'assistant', content: '' };

      setMessages((prev) => {
        const updated = [...prev, userMsg, assistantMsg];
        // Fire the async fetch with the full conversation history
        void fetchStream(updated, abortController);
        return updated;
      });

      // Increment usage counter
      incrementUsage();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options?.pageContext],
  );

  async function fetchStream(
    allMessages: AdvisorMessage[],
    abortController: AbortController,
  ): Promise<void> {
    try {
      // Build the messages payload (exclude the empty assistant placeholder)
      const conversationMessages = allMessages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content.length > 0))
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/intelligence/advisor', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          messages: conversationMessages,
          context: {
            segment: 'citizen',
            epoch: 0, // Server will enrich with real epoch data
            daysRemaining: 0,
            activeProposalCount: 0,
            ...(options?.pageContext && { pageContext: options.pageContext }),
          },
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMsg = `Request failed (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText) as { error?: string };
          errorMsg = errorJson.error ?? errorMsg;
        } catch {
          // Use default message
        }
        setError(errorMsg);
        setIsStreaming(false);
        return;
      }

      if (!response.body) {
        setError('No response body received.');
        setIsStreaming(false);
        return;
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (data: {...}\n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const eventStr of events) {
          const dataLine = eventStr.trim();
          if (!dataLine.startsWith('data: ')) continue;

          try {
            const eventData = JSON.parse(dataLine.slice(6)) as AdvisorSSEEvent;

            switch (eventData.type) {
              case 'text_delta':
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + eventData.content,
                    };
                  }
                  return updated;
                });
                break;

              case 'error':
                setError(eventData.content);
                break;

              case 'done':
                // Streaming complete -- handled in finally block
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was cancelled -- not an error
        return;
      }
      setError(err instanceof Error ? err.message : 'Connection failed.');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  const clearMessages = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    sendMessage,
    isStreaming,
    error,
    clearMessages,
  };
}
