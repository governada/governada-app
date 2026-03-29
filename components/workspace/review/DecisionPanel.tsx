'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import { RationaleCitations } from './RationaleCitations';
import type { VotePhase } from '@/hooks/useVote';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RationaleCitationData {
  citations: Array<{ article: string; section?: string; relevance: string }>;
  precedentRefs: Array<{ title: string; outcome: string; relevance: string }>;
  keyQuotes: Array<{ text: string; field: string }>;
}

interface DecisionPanelProps {
  /** Current user's selected vote */
  selectedVote: 'Yes' | 'No' | 'Abstain' | null;
  onVoteChange: (vote: 'Yes' | 'No' | 'Abstain') => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** Whether the user has already voted on this proposal */
  hasVoted: boolean;
  currentVoteChoice: string | null;
  /** Rationale */
  rationale: string;
  onRationaleChange: (text: string) => void;
  onAIDraft: () => void;
  isDraftingRationale: boolean;
  /** Context */
  proposalTitle: string;
  voterId: string;
  voterRole: string;
  /** Intelligence content (rendered as accordion sections) */
  intelContent?: ReactNode;
  /** Optional citations generated alongside the rationale co-draft */
  rationaleCitations?: RationaleCitationData | null;
  /** Vote transaction phase — shows inline submission progress */
  votePhase?: VotePhase;
}

// ---------------------------------------------------------------------------
// Vote selector
// ---------------------------------------------------------------------------

const VOTE_OPTIONS: Array<{
  value: 'Yes' | 'No' | 'Abstain';
  label: string;
  Icon: typeof CheckCircle2;
  activeColor: string;
  hoverColor: string;
}> = [
  {
    value: 'Yes',
    label: 'Yes',
    Icon: CheckCircle2,
    activeColor:
      'text-[var(--vote-affirm)] border-[var(--vote-affirm)]/50 bg-[var(--vote-affirm)]/10',
    hoverColor: 'hover:border-[var(--vote-affirm)]/30',
  },
  {
    value: 'No',
    label: 'No',
    Icon: XCircle,
    activeColor:
      'text-[var(--vote-oppose)] border-[var(--vote-oppose)]/50 bg-[var(--vote-oppose)]/10',
    hoverColor: 'hover:border-[var(--vote-oppose)]/30',
  },
  {
    value: 'Abstain',
    label: 'Abstain',
    Icon: MinusCircle,
    activeColor:
      'text-[var(--vote-reserve)] border-[var(--vote-reserve)]/50 bg-[var(--vote-reserve)]/10',
    hoverColor: 'hover:border-[var(--vote-reserve)]/30',
  },
];

const MAX_RATIONALE = 5000;

// ---------------------------------------------------------------------------
// Collapsible section for intelligence
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DecisionPanel — always-visible right panel for vote decisions
// ---------------------------------------------------------------------------

export function DecisionPanel({
  selectedVote,
  onVoteChange,
  onSubmit,
  isSubmitting,
  hasVoted,
  currentVoteChoice,
  rationale,
  onRationaleChange,
  onAIDraft,
  isDraftingRationale,
  proposalTitle,
  voterId,
  voterRole,
  intelContent,
  rationaleCitations,
  votePhase,
}: DecisionPanelProps) {
  const charCount = rationale.length;
  const rationaleRef = useRef<HTMLTextAreaElement>(null);

  const handleVoteSelect = useCallback(
    (vote: 'Yes' | 'No' | 'Abstain') => {
      onVoteChange(vote);
      posthog.capture('decision_panel_vote_selected', { vote });
    },
    [onVoteChange],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-[var(--space-md)] pt-[var(--space-md)] pb-[var(--space-sm)] border-b border-border/30">
        <h3 className="text-xs font-semibold text-foreground">Your Decision</h3>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{proposalTitle}</p>
        <p className="text-[10px] text-muted-foreground/60">
          {voterRole} &middot; {voterId.slice(0, 12)}...
        </p>
      </div>

      {/* Already voted banner */}
      {hasVoted && currentVoteChoice && (
        <div className="shrink-0 mx-3 mt-2 rounded-md border border-[var(--compass-teal)]/30 bg-[var(--compass-teal)]/10 px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--compass-teal)]" />
            <span className="font-medium text-[var(--compass-teal)]">
              Voted: {currentVoteChoice}
            </span>
          </div>
        </div>
      )}

      {/* Vote selector */}
      {!hasVoted && (
        <div className="shrink-0 px-3 pt-3 space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Vote
          </label>
          <div className="flex gap-1.5">
            {VOTE_OPTIONS.map(({ value, label, Icon, activeColor, hoverColor }) => (
              <button
                key={value}
                onClick={() => handleVoteSelect(value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 min-h-[var(--min-tap-target)] text-xs rounded border transition-colors cursor-pointer',
                  selectedVote === value
                    ? activeColor
                    : `text-muted-foreground border-border ${hoverColor}`,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      {!hasVoted && (
        <div className="shrink-0 px-3 pt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Rationale
            </label>
            <button
              onClick={onAIDraft}
              disabled={isDraftingRationale}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors cursor-pointer',
                isDraftingRationale
                  ? 'opacity-50 cursor-not-allowed border-border text-muted-foreground'
                  : 'border-primary/30 text-primary hover:bg-primary/10',
              )}
            >
              {isDraftingRationale ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              AI Draft
            </button>
          </div>
          <textarea
            ref={rationaleRef}
            value={rationale}
            onChange={(e) => onRationaleChange(e.target.value)}
            placeholder={
              selectedVote
                ? 'Type bullet points — AI will expand into a structured rationale...'
                : 'Explain your reasoning...'
            }
            rows={4}
            className="w-full rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
          {rationaleCitations && (
            <RationaleCitations
              citations={rationaleCitations.citations}
              precedentRefs={rationaleCitations.precedentRefs}
              keyQuotes={rationaleCitations.keyQuotes}
              onInsertCitation={(text) => {
                // Insert citation at cursor position or append
                const el = rationaleRef.current;
                if (el) {
                  const start = el.selectionStart ?? rationale.length;
                  const before = rationale.slice(0, start);
                  const after = rationale.slice(start);
                  const newText = `${before} ${text} ${after}`.replace(/  +/g, ' ');
                  onRationaleChange(newText);
                } else {
                  onRationaleChange(`${rationale} ${text}`.trim());
                }
              }}
            />
          )}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground/50">Published on-chain (CIP-100)</span>
            <span
              className={cn(
                'tabular-nums',
                charCount > MAX_RATIONALE ? 'text-destructive' : 'text-muted-foreground/50',
              )}
            >
              {charCount.toLocaleString()}/{MAX_RATIONALE.toLocaleString()}
            </span>
          </div>

          {/* Submit + Phase Progress */}
          {votePhase?.status === 'success' ? (
            <div className="space-y-1.5 mt-1">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Vote submitted!
                {votePhase.confirmed ? ' Confirmed.' : ' Awaiting confirmation...'}
              </div>
              <a
                href={`https://cardanoscan.io/transaction/${votePhase.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                View on CardanoScan
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : votePhase?.status === 'error' ? (
            <div className="space-y-1.5 mt-1">
              <p className="text-xs text-red-400">{votePhase.message}</p>
              {votePhase.hint && (
                <p className="text-[10px] text-muted-foreground">{votePhase.hint}</p>
              )}
              <button
                onClick={onSubmit}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <button
              onClick={onSubmit}
              disabled={isSubmitting || !selectedVote}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer mt-1',
                selectedVote
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
                isSubmitting && 'opacity-60 cursor-not-allowed',
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {votePhase?.status === 'signing'
                    ? 'Check your wallet...'
                    : votePhase?.status === 'building'
                      ? 'Building transaction...'
                      : votePhase?.status === 'submitting'
                        ? 'Submitting to chain...'
                        : 'Processing...'}
                </>
              ) : (
                'Submit Vote'
              )}
            </button>
          )}
        </div>
      )}

      {/* Intelligence brief — scrollable area */}
      {intelContent && <div className="flex-1 mt-3 overflow-y-auto min-h-0">{intelContent}</div>}
    </div>
  );
}
