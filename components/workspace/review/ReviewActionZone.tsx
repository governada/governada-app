'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  FileText,
  Shield,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWallet } from '@/utils/wallet';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useVote } from '@/hooks/useVote';
import type { VoteChoice, VoterRole } from '@/lib/voting';

interface ReviewActionZoneProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  proposalAbstract?: string | null;
  proposalType?: string | null;
  aiSummary?: string | null;
  onVoteSuccess: (vote: VoteChoice) => void;
}

const VOTE_OPTIONS: {
  value: VoteChoice;
  label: string;
  shortcut: string;
  icon: typeof CheckCircle2;
  color: string;
  selectedColor: string;
  bgColor: string;
}[] = [
  {
    value: 'Yes',
    label: 'Yes',
    shortcut: 'Y',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    selectedColor: 'ring-emerald-500/50',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60',
  },
  {
    value: 'No',
    label: 'No',
    shortcut: 'N',
    icon: XCircle,
    color: 'text-rose-500',
    selectedColor: 'ring-rose-500/50',
    bgColor: 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60',
  },
  {
    value: 'Abstain',
    label: 'Abstain',
    shortcut: 'A',
    icon: MinusCircle,
    color: 'text-muted-foreground',
    selectedColor: 'ring-muted-foreground/50',
    bgColor: 'bg-muted/30 border-border hover:border-muted-foreground/40',
  },
];

/**
 * ReviewActionZone — vote buttons + rationale editor + submit flow.
 * Reuses the useVote hook for all voting logic.
 */
export function ReviewActionZone({
  txHash,
  proposalIndex,
  title,
  isOpen,
  proposalAbstract,
  proposalType,
  aiSummary,
  onVoteSuccess,
}: ReviewActionZoneProps) {
  const { connected, ownDRepId } = useWallet();
  const { segment, poolId, isViewingAs, drepId: overrideDrepId } = useSegment();
  const { phase, startVote, confirmVote, reset, isProcessing, canVote } = useVote();

  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const voterRole: VoterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId || (isViewingAs ? overrideDrepId : null);
  const previewMode = isViewingAs && !connected;

  // Reset state when proposal changes
  useEffect(() => {
    setSelectedVote(null);
    setRationaleText('');
    setShowRationale(false);
    setIsSubmitting(false);
    reset();
  }, [txHash, proposalIndex, reset]);

  // Detect vote success
  useEffect(() => {
    if (phase.status === 'success' && isSubmitting && selectedVote) {
      setIsSubmitting(false);

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('review_vote_cast', {
            gov_action_tx_hash: txHash,
            gov_action_index: proposalIndex,
            vote: selectedVote,
            voter_role: voterRole,
            had_rationale: rationaleText.trim().length > 0,
          });
        })
        .catch(() => {});

      onVoteSuccess(selectedVote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.status]);

  if (!isOpen) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Voting on this proposal has closed.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!connected && !isViewingAs) {
    return (
      <Card className="border-primary/20">
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">Cast Your Vote</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Connect your wallet to vote on this proposal.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!voterId) return null;

  const handleVoteSelect = (vote: VoteChoice) => {
    if (previewMode || isProcessing) return;
    setSelectedVote(vote);
    if (phase.status === 'error') reset();
    startVote({ txHash, txIndex: proposalIndex, title }, voterRole, voterId);
  };

  const handleAiDraft = async () => {
    if (!voterId) return;
    setIsDrafting(true);
    try {
      const res = await fetch('/api/rationale/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drepId: voterId,
          voterRole,
          proposalTitle: title,
          proposalAbstract: proposalAbstract || undefined,
          proposalType: proposalType || undefined,
          aiSummary: aiSummary || undefined,
        }),
      });
      if (res.ok) {
        const { draft } = await res.json();
        if (draft) setRationaleText(draft);
      }
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSubmitVote = async (withRationale: boolean) => {
    if (!selectedVote || !voterId) return;
    setIsSubmitting(true);

    let anchorUrl: string | undefined;
    let anchorHash: string | undefined;

    if (withRationale && rationaleText.trim()) {
      try {
        const res = await fetch('/api/rationale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drepId: voterId,
            proposalTxHash: txHash,
            proposalIndex,
            rationaleText: rationaleText.trim(),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          anchorUrl = data.anchorUrl;
          anchorHash = data.anchorHash;
        }
      } catch {
        // Continue without anchor
      }
    }

    confirmVote(selectedVote, anchorUrl, anchorHash);
  };

  const handleQuickVote = () => {
    handleSubmitVote(false);
  };

  const isConfirming = phase.status === 'confirming';
  const hasExistingVote = isConfirming && phase.preflight.hasExistingVote;

  // Success state
  if (phase.status === 'success') {
    return (
      <Card className="border-emerald-500/20">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-500 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Vote submitted!{' '}
            {phase.confirmed ? 'Confirmed on-chain.' : 'Awaiting confirmation (~1-2 min)...'}
          </div>
          <a
            href={`https://cardanoscan.io/transaction/${phase.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on CardanoScan
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4 space-y-4">
        {/* Preview mode warning */}
        {previewMode && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Preview mode -- voting disabled
          </div>
        )}

        {/* Error display */}
        {phase.status === 'error' && (
          <div className="flex items-start gap-2 text-sm text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{phase.hint}</p>
              {phase.code !== 'unknown' && (
                <p className="text-xs text-muted-foreground mt-0.5">{phase.code}</p>
              )}
            </div>
          </div>
        )}

        {/* Vote buttons */}
        <div className="grid grid-cols-3 gap-2">
          {VOTE_OPTIONS.map(
            ({ value, label, shortcut, icon: Icon, color, selectedColor, bgColor }) => {
              const isSelected = selectedVote === value;
              return (
                <button
                  key={value}
                  onClick={() => handleVoteSelect(value)}
                  disabled={previewMode || isProcessing || isSubmitting}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all',
                    isSelected
                      ? `${bgColor} ring-2 ring-offset-1 ring-offset-background ${selectedColor}`
                      : 'border-border hover:bg-muted/30',
                    (previewMode || isProcessing || isSubmitting) &&
                      'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Icon className={cn('h-5 w-5', isSelected ? color : 'text-muted-foreground')} />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isSelected ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                  </span>
                  <kbd className="text-[9px] text-muted-foreground/60 font-mono">{shortcut}</kbd>
                </button>
              );
            },
          )}
        </div>

        {/* Preflight loading */}
        {phase.status === 'preflight' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking eligibility...
          </div>
        )}

        {/* Processing states */}
        {(phase.status === 'building' ||
          phase.status === 'signing' ||
          phase.status === 'submitting') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase.status === 'building'
              ? 'Building transaction...'
              : phase.status === 'signing'
                ? 'Waiting for wallet signature...'
                : 'Submitting to chain...'}
          </div>
        )}

        {/* Post-preflight actions */}
        {isConfirming && selectedVote && !isSubmitting && (
          <div className="space-y-3">
            {hasExistingVote && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                You already voted. This will replace your previous vote.
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated fee</span>
              <span className="font-medium tabular-nums">{phase.preflight.estimatedFee}</span>
            </div>

            {/* Rationale editor */}
            {showRationale ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="review-rationale-editor"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Vote Rationale (CIP-100)
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={handleAiDraft}
                    disabled={isDrafting}
                  >
                    {isDrafting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {isDrafting ? 'Drafting...' : 'AI Draft'}
                  </Button>
                </div>
                <textarea
                  id="review-rationale-editor"
                  value={rationaleText}
                  onChange={(e) => setRationaleText(e.target.value)}
                  placeholder="Explain your vote. Published as a CIP-100 document anchored to your on-chain vote."
                  className="w-full min-h-[120px] p-3 text-sm border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={10000}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    Published on-chain as a CIP-100 metadata anchor
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {rationaleText.length.toLocaleString()} / 10,000
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSubmitVote(true)}
                    className="flex-1 gap-2"
                    disabled={!canVote || isSubmitting}
                  >
                    <Shield className="h-4 w-4" />
                    Submit Vote with Rationale
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowRationale(true)}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Add Rationale
                </Button>
                <Button
                  onClick={handleQuickVote}
                  className="flex-1 gap-2"
                  disabled={!canVote || isSubmitting}
                >
                  <Zap className="h-4 w-4" />
                  Quick Vote
                </Button>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              {voterRole === 'spo'
                ? 'SPOs who explain votes score higher on Deliberation Quality'
                : 'DReps who explain votes score higher on Engagement'}{' '}
              <kbd className="font-mono text-[9px]">Ctrl+Enter</kbd> to submit
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
