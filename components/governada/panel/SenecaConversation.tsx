'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, Microscope } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { AIResponse } from '@/components/commandpalette/AIResponse';
import { SenecaInput } from './SenecaInput';
import { readAdvisorStream } from '@/lib/intelligence/streamAdvisor';
import type { AdvisorMessage } from '@/lib/intelligence/streamAdvisor';
import { useSenecaThread, type PanelRoute } from '@/hooks/useSenecaThread';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import { cn } from '@/lib/utils';

/** Heuristic: show "Go deeper" if response is substantive and query implies analysis. */
const DEEP_QUERY_PATTERNS = /\b(compare|analyz|research|explain|how|why)\b/i;

function shouldShowGoDeeper(responseContent: string, userQuery: string): boolean {
  if (responseContent.length < 200) return false;
  if (!userQuery) return false;
  return DEEP_QUERY_PATTERNS.test(userQuery);
}

interface SenecaConversationProps {
  initialQuery?: string;
  onBack: () => void;
  panelRoute: PanelRoute;
  entityId?: string;
  /** Called when user clicks an entity link in a response */
  onEntityFocus?: (entityType: string, entityId: string) => void;
}

export function SenecaConversation({
  initialQuery,
  onBack,
  panelRoute,
  entityId,
  onEntityFocus,
}: SenecaConversationProps) {
  const prefersReducedMotion = useReducedMotion();
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamContentRef = useRef('');
  const didSendInitial = useRef(false);

  const router = useRouter();
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const { segment } = useSegment();
  const { startResearch, executeIntent } = useSenecaThread();
  const daysRemaining = totalDays - day;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      // --- Intent detection: dispatch globe actions before/alongside AI ---
      const intent = executeIntent(text.trim());

      // For 'reset' intent, just acknowledge without AI call
      if (intent?.type === 'reset') {
        const resetUser: AdvisorMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: text.trim(),
        };
        const resetAssistant: AdvisorMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: 'Done — constellation reset to the full view.',
        };
        setMessages((prev) => [...prev, resetUser, resetAssistant]);
        return;
      }

      // For 'match' intent, the hook already started the match flow — no AI needed
      if (intent?.type === 'match') {
        return;
      }

      // For other intents (browse, focus, filter, votesplit, temporal),
      // the globe action is dispatched AND we still stream an AI response
      // so Seneca can contextualize what the user is seeing.

      const userMsg: AdvisorMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
      };

      const assistantMsg: AdvisorMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setStreamError(null);
      streamContentRef.current = '';

      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const abort = new AbortController();
      abortRef.current = abort;

      readAdvisorStream(
        allMessages,
        {
          epoch,
          daysRemaining,
          activeProposalCount: activeProposalCount ?? 0,
          segment,
          pageContext: panelRoute,
          entityId,
        },
        (delta) => {
          streamContentRef.current += delta;
          const currentContent = streamContentRef.current;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: currentContent };
            }
            return updated;
          });
        },
        (error) => {
          setStreamError(error);
          setIsStreaming(false);
        },
        () => {
          setIsStreaming(false);
        },
        abort.signal,
        // Globe commands — dispatch via CustomEvent so globe listeners receive them
        (cmd) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('senecaGlobeCommand', { detail: cmd }));
          }
        },
        (actionPayload) => {
          // Parse parameterized actions: "startMatch", "navigate:/path", "research:query"
          const colonIdx = actionPayload.indexOf(':');
          const actionType = colonIdx > 0 ? actionPayload.slice(0, colonIdx) : actionPayload;
          const payload = colonIdx > 0 ? actionPayload.slice(colonIdx + 1) : '';

          switch (actionType) {
            case 'startMatch':
              abortRef.current?.abort();
              setIsStreaming(false);
              useSenecaThreadStore.getState().startMatch();
              break;
            case 'navigate':
              if (payload) router.push(payload);
              break;
            case 'research':
              if (payload) startResearch(payload);
              break;
          }
        },
      );
    },
    [
      messages,
      isStreaming,
      epoch,
      daysRemaining,
      activeProposalCount,
      segment,
      panelRoute,
      entityId,
      executeIntent,
    ],
  );

  useEffect(() => {
    if (initialQuery && !didSendInitial.current && messages.length === 0) {
      didSendInitial.current = true;
      sendMessage(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isStreaming) {
          abortRef.current?.abort();
          setIsStreaming(false);
        } else {
          onBack();
        }
      }
    },
    [isStreaming, onBack],
  );

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      setMessages((prev) => prev.slice(0, -1));
      setStreamError(null);
      sendMessage(lastUserMsg.content);
    }
  }, [messages, sendMessage]);

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col flex-1 min-h-0"
      onKeyDown={handleKeyDown}
    >
      {/* Conversation header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/10 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'flex items-center gap-1 text-xs text-muted-foreground/60',
            'hover:text-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm',
          )}
          aria-label="Back to briefing"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Briefing</span>
        </button>
        {streamError && (
          <button
            type="button"
            onClick={handleRetry}
            className="ml-auto p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Retry"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent"
      >
        {messages.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end px-3 py-2">
                <div
                  className={cn(
                    'max-w-[85%] px-3 py-1.5 rounded-2xl rounded-br-sm',
                    'bg-primary/15 text-foreground/90 text-sm leading-relaxed',
                  )}
                >
                  {msg.content}
                </div>
              </div>
            );
          }

          const isLast = idx === messages.length - 1;
          const isLastAssistant = isLast && !isStreaming && !streamError;
          // Find the user query that prompted this response
          const precedingUserMsg = idx > 0 ? messages[idx - 1] : undefined;
          const userQuery = precedingUserMsg?.role === 'user' ? precedingUserMsg.content : '';
          const showGoDeeper = isLastAssistant && shouldShowGoDeeper(msg.content, userQuery);

          return (
            <div key={msg.id}>
              <AIResponse
                content={msg.content}
                isStreaming={isLast && isStreaming}
                error={isLast ? (streamError ?? undefined) : undefined}
                onEntityFocus={onEntityFocus}
              />
              {showGoDeeper && (
                <div className="px-3 pb-2">
                  <button
                    type="button"
                    onClick={() => startResearch(userQuery)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md',
                      'text-[11px] font-medium text-primary/80',
                      'bg-primary/5 hover:bg-primary/10 border border-primary/15 hover:border-primary/25',
                      'transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    )}
                  >
                    <Microscope className="h-3 w-3" />
                    Go deeper
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <SenecaInput panelRoute={panelRoute} onSubmit={sendMessage} disabled={isStreaming} />
    </motion.div>
  );
}
