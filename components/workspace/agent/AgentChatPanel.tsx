'use client';

/**
 * AgentChatPanel -- streaming chat UI for the workspace right panel.
 *
 * Uses the `useAgent` hook to manage the SSE connection. Renders:
 * - Message list (user + assistant messages)
 * - Tool call indicators ("Checking constitution..." with spinner)
 * - ProposedEdit actions ("Apply edit to editor?" with preview)
 * - ProposedComment actions ("Add comment?" with preview)
 * - Message input with Cmd+Enter to send
 * - Streaming text as it arrives (delta updates)
 * - Conversation context indicator (shows "Conversation resumed" if returning)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  User,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle2,
  Pencil,
  MessageSquareText,
  Wrench,
  CornerDownLeft,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import type { AgentMessage } from '@/lib/workspace/agent/types';
import type { ProposedEdit, ProposedComment } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Tool name -> human label
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  check_constitution: 'Checking constitution...',
  search_precedent: 'Searching precedents...',
  get_voting_data: 'Fetching voting data...',
  get_community_feedback: 'Reading community feedback...',
  get_treasury_context: 'Analyzing treasury impact...',
  get_proposal_health: 'Evaluating proposal health...',
  compare_versions: 'Comparing versions...',
  get_revision_context: 'Loading revision context...',
  draft_justification: 'Drafting justification...',
  edit_proposal: 'Preparing edit suggestion...',
  draft_comment: 'Drafting comment...',
};

function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? `Running ${toolName}...`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const DEFAULT_STARTER_PROMPTS = [
  'What are the key risks of this proposal?',
  'Summarize the main arguments for and against',
  'Draft a rationale for voting Yes',
  'What questions should I ask the proposer?',
];

interface AgentChatPanelProps {
  /** Send message function from useAgent */
  sendMessage: (message: string) => Promise<void>;
  /** All messages in the conversation */
  messages: AgentMessage[];
  /** Whether the agent is currently streaming */
  isStreaming: boolean;
  /** Active tool call indicator */
  activeToolCall: { toolName: string; status: 'started' | 'completed' } | null;
  /** Error from the last request */
  error: string | null;
  /** Callback when user wants to apply a proposed edit */
  onApplyEdit?: (edit: ProposedEdit) => void;
  /** Callback when user wants to add a proposed comment */
  onApplyComment?: (comment: ProposedComment) => void;
  /** Context-specific starter prompts (defaults to review-oriented) */
  starterPrompts?: string[];
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToolCallIndicator({
  toolName,
  status,
}: {
  toolName: string;
  status: 'started' | 'completed';
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/40 text-xs text-muted-foreground">
      {status === 'started' ? (
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      ) : (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      )}
      <Wrench className="h-3 w-3" />
      <span>{toolLabel(toolName)}</span>
    </div>
  );
}

function ProposedEditCard({
  edit,
  onApply,
}: {
  edit: ProposedEdit;
  onApply?: (edit: ProposedEdit) => void;
}) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
        <Pencil className="h-3 w-3" />
        Suggested edit ({edit.field})
      </div>
      <div className="text-xs space-y-1">
        {edit.originalText && (
          <div className="rounded bg-rose-500/10 px-2 py-1 text-rose-400 line-through">
            {edit.originalText.length > 120
              ? `${edit.originalText.slice(0, 120)}...`
              : edit.originalText}
          </div>
        )}
        <div className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-400">
          {edit.proposedText.length > 120
            ? `${edit.proposedText.slice(0, 120)}...`
            : edit.proposedText}
        </div>
      </div>
      {edit.explanation && (
        <p className="text-[11px] text-muted-foreground italic">{edit.explanation}</p>
      )}
      {onApply && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          onClick={() => onApply(edit)}
        >
          Apply to editor
        </Button>
      )}
    </div>
  );
}

function ProposedCommentCard({
  comment,
  onApply,
}: {
  comment: ProposedComment;
  onApply?: (comment: ProposedComment) => void;
}) {
  const categoryColors: Record<string, string> = {
    note: 'text-blue-400 bg-blue-500/10',
    concern: 'text-amber-400 bg-amber-500/10',
    question: 'text-purple-400 bg-purple-500/10',
    suggestion: 'text-emerald-400 bg-emerald-500/10',
  };
  const colorClass = categoryColors[comment.category] ?? 'text-muted-foreground bg-muted';

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
        <MessageSquareText className="h-3 w-3" />
        Suggested comment ({comment.field})
      </div>
      <Badge variant="outline" className={cn('text-[10px] capitalize', colorClass)}>
        {comment.category}
      </Badge>
      {comment.anchorText && (
        <div className="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground italic">
          &ldquo;
          {comment.anchorText.length > 80
            ? `${comment.anchorText.slice(0, 80)}...`
            : comment.anchorText}
          &rdquo;
        </div>
      )}
      <p className="text-xs">{comment.commentText}</p>
      {onApply && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          onClick={() => onApply(comment)}
        >
          Add comment
        </Button>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isLatest,
  onApplyEdit,
  onApplyComment,
}: {
  message: AgentMessage;
  isLatest: boolean;
  onApplyEdit?: (edit: ProposedEdit) => void;
  onApplyComment?: (comment: ProposedComment) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] mt-0.5',
          isUser ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Message content */}
      <div className={cn('flex-1 min-w-0 space-y-2', isUser ? 'text-right' : 'text-left')}>
        {/* Text content */}
        {(message.content || isLatest) && (
          <div
            className={cn(
              'block max-w-full break-words rounded-lg px-3 py-2 text-sm leading-relaxed',
              isUser ? 'bg-primary/10 text-foreground' : 'bg-card text-foreground',
              // If streaming and empty, show a pulse
              !message.content && isLatest && 'animate-pulse',
            )}
          >
            {message.content ? (
              <MarkdownRenderer content={message.content} compact />
            ) : isLatest ? (
              '...'
            ) : null}
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1">
            {message.toolCalls.map((tc, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Used {tc.toolName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Proposed edits */}
        {message.proposedEdits?.map((edit, i) => (
          <ProposedEditCard key={`edit-${i}`} edit={edit} onApply={onApplyEdit} />
        ))}

        {/* Proposed comments */}
        {message.proposedComments?.map((comment, i) => (
          <ProposedCommentCard key={`comment-${i}`} comment={comment} onApply={onApplyComment} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentChatPanel({
  sendMessage,
  messages,
  isStreaming,
  activeToolCall,
  error,
  onApplyEdit,
  onApplyComment,
  starterPrompts,
  className,
}: AgentChatPanelProps) {
  const prompts = starterPrompts ?? DEFAULT_STARTER_PROMPTS;
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResumed = messages.length > 0 && !isStreaming;

  // Auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeToolCall]);

  // Send message handler
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    await sendMessage(trimmed);
  }, [input, isStreaming, sendMessage]);

  // Keyboard handler for the input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Agent</span>
        {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
      </div>

      {/* Messages area — scrolls independently, never pushes input off-screen */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Conversation resumed indicator */}
        {isResumed && messages.length > 2 && (
          <div className="flex items-center justify-center gap-1.5 py-2">
            <RefreshCw className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[11px] text-muted-foreground/50">Conversation resumed</span>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 space-y-3">
            <Bot className="h-8 w-8 text-muted-foreground/30" />
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Governance Agent</p>
              <p className="text-xs text-muted-foreground/60 max-w-[240px]">
                Ask about risks, request a rationale draft, or explore arguments for and against
                this proposal.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-[280px]">
              {prompts.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  disabled={isStreaming}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLatest={i === messages.length - 1}
            onApplyEdit={onApplyEdit}
            onApplyComment={onApplyComment}
          />
        ))}

        {/* Active tool call indicator */}
        {activeToolCall && (
          <div className="pl-8">
            <ToolCallIndicator toolName={activeToolCall.toolName} status={activeToolCall.status} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive shrink-0">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 min-w-0">{error}</span>
        </div>
      )}

      {/* Input area — always pinned at bottom */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the governance agent..."
            disabled={isStreaming}
            rows={1}
            className={cn(
              'w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 pr-10',
              'text-sm placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-1 focus:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[40px] max-h-[120px]',
            )}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={cn(
              'absolute right-2 bottom-2 p-1.5 rounded-md transition-colors',
              input.trim() && !isStreaming
                ? 'text-primary hover:bg-primary/10'
                : 'text-muted-foreground/30',
            )}
            title="Send (Cmd+Enter)"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/40">
          <CornerDownLeft className="h-2.5 w-2.5" />
          <span>Cmd+Enter to send</span>
        </div>
      </div>
    </div>
  );
}
