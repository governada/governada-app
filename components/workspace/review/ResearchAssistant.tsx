'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FeatureGate } from '@/components/FeatureGate';
import { MarkdownContent } from '@/components/MarkdownContent';
import { useResearchConversation, useSendResearchMessage } from '@/hooks/useResearchAssistant';
import { posthog } from '@/lib/posthog';
import type { ResearchMessage } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Suggested starter questions
// ---------------------------------------------------------------------------

const STARTER_QUESTIONS = [
  'What similar proposals have been submitted before?',
  'Are there any constitutional concerns?',
  "What's the strongest case against this proposal?",
  'How does this proposal compare to the current treasury situation?',
];

// ---------------------------------------------------------------------------
// Message bubble components
// ---------------------------------------------------------------------------

function UserBubble({ message }: { message: ResearchMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <time className="mt-1 block text-xs opacity-60">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ResearchMessage }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // Split content into reasoning and main response
  const reasoningMatch = message.content.match(
    /Reasoning:\s*\n([\s\S]*?)(?=\n\n(?!-)|\n(?=[A-Z]))/,
  );
  const sourcesMatch = message.content.match(/Sources:\s*\n([\s\S]*?)$/);

  // Remove the sources section from the display content
  let displayContent = message.content;
  if (sourcesMatch) {
    displayContent = displayContent.replace(/\n*Sources:\s*\n[\s\S]*?$/, '').trim();
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5">
          <MarkdownContent content={displayContent} className="text-sm text-foreground" />
          <time className="mt-1 block text-xs text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>

        {/* Reasoning accordion */}
        {reasoningMatch && (
          <button
            onClick={() => setReasoningOpen(!reasoningOpen)}
            className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={reasoningOpen ? 'Hide reasoning' : 'Show reasoning'}
          >
            {reasoningOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Reasoning
          </button>
        )}
        {reasoningMatch && reasoningOpen && (
          <div className="ml-2 border-l-2 border-muted pl-3">
            <MarkdownContent
              content={reasoningMatch[1].trim()}
              className="text-xs text-muted-foreground"
            />
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.sources.map((source, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                <BookOpen className="size-2.5" />[{source.type}] {source.reference}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3">
        <div className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ResearchAssistantProps {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string;
}

function ResearchAssistantInner({
  proposalTxHash,
  proposalIndex,
  proposalTitle,
}: ResearchAssistantProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversation, isLoading: loadingConversation } = useResearchConversation(
    proposalTxHash,
    proposalIndex,
  );
  const { mutate: sendMessage, isPending: isSending } = useSendResearchMessage();

  const messages = conversation?.messages ?? [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    sendMessage({
      proposalTxHash,
      proposalIndex,
      message: trimmed,
    });

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      posthog?.capture('research_message_sent', {
        proposalTxHash,
        proposalIndex,
        messageLength: trimmed.length,
      });
    } catch {
      // Non-critical
    }
  }, [input, isSending, sendMessage, proposalTxHash, proposalIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleStarterClick = useCallback(
    (question: string) => {
      sendMessage({
        proposalTxHash,
        proposalIndex,
        message: question,
      });

      try {
        posthog?.capture('research_message_sent', {
          proposalTxHash,
          proposalIndex,
          messageLength: question.length,
          starter: true,
        });
      } catch {
        // Non-critical
      }
    },
    [sendMessage, proposalTxHash, proposalIndex],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Research Assistant</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Conversations are saved and contribute to your review provenance
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loadingConversation ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 && !isSending ? (
          /* Empty state with starter questions */
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <Sparkles className="mx-auto size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Ask anything about{' '}
                <span className="font-medium text-foreground">
                  {proposalTitle || 'this proposal'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground/70">
                Get grounded analysis with citations from proposal text, constitutional articles,
                and on-chain data.
              </p>
            </div>
            <div className="space-y-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleStarterClick(q)}
                  disabled={isSending}
                  className="block w-full rounded-lg border border-border bg-card p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <UserBubble key={i} message={msg} />
              ) : (
                <AssistantBubble key={i} message={msg} />
              ),
            )}
            {isSending && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this proposal..."
            rows={1}
            maxLength={2000}
            disabled={isSending}
            className="flex-1 resize-none"
            aria-label="Research question input"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="size-9 shrink-0"
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper with feature gate
// ---------------------------------------------------------------------------

export function ResearchAssistant(props: ResearchAssistantProps) {
  return (
    <FeatureGate flag="research_assistant">
      <ResearchAssistantInner {...props} />
    </FeatureGate>
  );
}
