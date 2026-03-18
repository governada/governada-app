'use client';

import { type ReactNode } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VotePanelProps {
  selectedVote: 'Yes' | 'No' | 'Abstain' | null;
  onVoteChange: (vote: 'Yes' | 'No' | 'Abstain') => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  rationale: string;
  onRationaleChange: (text: string) => void;
  onAIDraft: () => void;
  isDraftingRationale: boolean;
  estimatedFee?: string;
  scoreImpact?: ReactNode;
  proposalTitle: string;
  drepId: string;
  voterRole: string;
}

const VOTE_OPTIONS: Array<{
  value: 'Yes' | 'No' | 'Abstain';
  label: string;
  Icon: typeof CheckCircle2;
  activeColor: string;
}> = [
  {
    value: 'Yes',
    label: 'Yes',
    Icon: CheckCircle2,
    activeColor: 'text-teal-400 border-teal-500/50 bg-teal-500/10',
  },
  {
    value: 'No',
    label: 'No',
    Icon: XCircle,
    activeColor: 'text-amber-500 border-amber-600/50 bg-amber-600/10',
  },
  {
    value: 'Abstain',
    label: 'Abstain',
    Icon: MinusCircle,
    activeColor: 'text-zinc-400 border-zinc-500/50 bg-zinc-500/10',
  },
];

const MAX_RATIONALE = 5000;

export function VotePanel({
  selectedVote,
  onVoteChange,
  onSubmit,
  onCancel,
  isSubmitting,
  rationale,
  onRationaleChange,
  onAIDraft,
  isDraftingRationale,
  estimatedFee,
  scoreImpact,
  proposalTitle,
  drepId,
  voterRole,
}: VotePanelProps) {
  const charCount = rationale.length;

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-foreground">Cast Vote</h3>
        <p className="text-[11px] text-muted-foreground truncate">{proposalTitle}</p>
        <p className="text-[10px] text-muted-foreground/60">
          Voting as <span className="font-medium text-muted-foreground">{voterRole}</span>
          {drepId && (
            <>
              {' '}
              &middot; <span className="tabular-nums">{drepId.slice(0, 12)}...</span>
            </>
          )}
        </p>
      </div>

      {/* Vote selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Vote
        </label>
        <div className="flex gap-1.5">
          {VOTE_OPTIONS.map(({ value, label, Icon, activeColor }) => (
            <button
              key={value}
              onClick={() => onVoteChange(value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs rounded border transition-colors cursor-pointer',
                selectedVote === value
                  ? activeColor
                  : 'text-muted-foreground border-border hover:border-muted-foreground/40',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rationale editor */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Vote Rationale (CIP-100)
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
          value={rationale}
          onChange={(e) => onRationaleChange(e.target.value)}
          placeholder="Explain your vote rationale for on-chain transparency..."
          rows={6}
          className="w-full rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground/50">
            Rationale is published on-chain via CIP-100 metadata
          </span>
          <span
            className={cn(
              'tabular-nums',
              charCount > MAX_RATIONALE ? 'text-red-400 font-medium' : 'text-muted-foreground/50',
            )}
          >
            {charCount.toLocaleString()} / {MAX_RATIONALE.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Score impact preview */}
      {scoreImpact && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Score Impact
          </label>
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            {scoreImpact}
          </div>
        </div>
      )}

      {/* Estimated fee */}
      {estimatedFee && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Estimated fee</span>
          <span className="font-medium text-foreground tabular-nums">{estimatedFee}</span>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={isSubmitting || !selectedVote}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
          selectedVote
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
          isSubmitting && 'opacity-60 cursor-not-allowed',
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit Vote'
        )}
      </button>

      {/* Cancel link */}
      <button
        onClick={onCancel}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
      >
        Cancel
      </button>
    </div>
  );
}
