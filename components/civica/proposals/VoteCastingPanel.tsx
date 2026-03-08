'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWallet } from '@/utils/wallet';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useVote, type VotePhase } from '@/hooks/useVote';
import { useFeatureFlag } from '@/components/FeatureGate';
import type { VoteChoice, VoterRole } from '@/lib/voting';

interface VoteCastingPanelProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  /** Optional context for AI rationale drafting */
  proposalAbstract?: string | null;
  proposalType?: string | null;
  aiSummary?: string | null;
}

const VOTE_OPTIONS: {
  value: VoteChoice;
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
}[] = [
  {
    value: 'Yes',
    label: 'Yes',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60',
  },
  {
    value: 'No',
    label: 'No',
    icon: XCircle,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60',
  },
  {
    value: 'Abstain',
    label: 'Abstain',
    icon: MinusCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30 border-border hover:border-muted-foreground/40',
  },
];

function PhaseIndicator({ phase }: { phase: VotePhase }) {
  if (phase.status === 'preflight') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking eligibility...
      </div>
    );
  }
  if (phase.status === 'building') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Building transaction...
      </div>
    );
  }
  if (phase.status === 'signing') {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Waiting for wallet signature...
      </div>
    );
  }
  if (phase.status === 'submitting') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Submitting to chain...
      </div>
    );
  }
  if (phase.status === 'success') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          Vote submitted! {phase.confirmed ? 'Confirmed on-chain.' : 'Awaiting confirmation...'}
        </div>
        <a
          href={`https://cardanoscan.io/transaction/${phase.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View transaction
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }
  if (phase.status === 'error') {
    return (
      <div className="flex items-start gap-2 text-sm text-rose-500">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{phase.hint}</p>
          {phase.code !== 'unknown' && (
            <p className="text-xs text-muted-foreground mt-0.5">{phase.code}</p>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function VoteCastingPanel({
  txHash,
  proposalIndex,
  title,
  isOpen,
  proposalAbstract,
  proposalType,
  aiSummary,
}: VoteCastingPanelProps) {
  const { connected, ownDRepId } = useWallet();
  const { segment, poolId } = useSegment();
  const { phase, startVote, confirmVote, reset, isProcessing } = useVote();
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [showRationale, setShowRationale] = useState(true);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const voteCastingEnabled = useFeatureFlag('governance_vote_casting');

  // Determine voter role and credential from segment
  const voterRole: VoterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId;
  const canVote = connected && !!voterId;

  // Don't show for closed proposals
  if (!isOpen) return null;

  // Don't show if not a DRep or SPO
  if (!connected || !voterId) return null;

  // Gated behind feature flag
  if (voteCastingEnabled === null || !voteCastingEnabled) return null;

  const isConfirming = phase.status === 'confirming';
  const isDone = phase.status === 'success';
  const hasError = phase.status === 'error';

  const roleLabel = voterRole === 'spo' ? 'SPO' : 'DRep';
  const scoringHint =
    voterRole === 'spo'
      ? 'SPOs who explain votes score higher on Deliberation Quality (25% weight)'
      : 'DReps who explain votes score higher on Engagement (25% weight)';

  const handleVoteSelect = (vote: VoteChoice) => {
    if (isProcessing || isDone) return;
    setSelectedVote(vote);

    if (hasError) reset();

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

  const handleConfirm = async () => {
    if (!selectedVote || !voterId) return;

    let anchorUrl: string | undefined;
    let anchorHash: string | undefined;

    // Publish rationale if provided
    if (rationaleText.trim()) {
      setIsPublishing(true);
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
      } finally {
        setIsPublishing(false);
      }
    }

    confirmVote(selectedVote, anchorUrl, anchorHash);
  };

  const handleReset = () => {
    setSelectedVote(null);
    setRationaleText('');
    setShowRationale(false);
    reset();
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Cast Your {roleLabel} Vote</p>
          {(isDone || hasError) && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
              {isDone ? 'Vote again' : 'Try again'}
            </Button>
          )}
        </div>

        {/* Vote buttons */}
        {!isDone && (
          <div className="grid grid-cols-3 gap-2">
            {VOTE_OPTIONS.map(({ value, label, icon: Icon, color, bgColor }) => {
              const isSelected = selectedVote === value;
              return (
                <button
                  key={value}
                  onClick={() => handleVoteSelect(value)}
                  disabled={isProcessing || isPublishing}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all',
                    isSelected
                      ? `${bgColor} ring-2 ring-offset-1 ring-offset-background`
                      : 'border-border hover:bg-muted/30',
                    (isProcessing || isPublishing) && 'opacity-50 cursor-not-allowed',
                    isSelected && value === 'Yes' && 'ring-emerald-500/50',
                    isSelected && value === 'No' && 'ring-rose-500/50',
                    isSelected && value === 'Abstain' && 'ring-muted-foreground/50',
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
                </button>
              );
            })}
          </div>
        )}

        {/* Confirmation step */}
        {isConfirming && selectedVote && (
          <div className="space-y-3 pt-1">
            {phase.preflight.hasExistingVote && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                You already voted on this proposal. This will replace your previous vote.
              </div>
            )}

            {/* Rationale section */}
            {showRationale ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Vote Rationale (CIP-100)
                  </label>
                  <div className="flex items-center gap-1">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={() => setShowRationale(false)}
                    >
                      Hide
                    </Button>
                  </div>
                </div>
                <textarea
                  value={rationaleText}
                  onChange={(e) => setRationaleText(e.target.value)}
                  placeholder="Explain your vote. This will be published as a CIP-100 document anchored to your on-chain vote."
                  className="w-full min-h-[120px] p-3 text-sm border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={10000}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">{scoringHint}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {rationaleText.length.toLocaleString()} / 10,000
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRationale(true)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Add rationale (optional)
              </button>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated fee</span>
              <span className="font-medium">{phase.preflight.estimatedFee}</span>
            </div>
            <Button onClick={handleConfirm} className="w-full" disabled={!canVote || isPublishing}>
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Publishing rationale...
                </>
              ) : (
                <>Confirm &amp; Sign</>
              )}
            </Button>
          </div>
        )}

        {/* Phase indicator */}
        <PhaseIndicator phase={phase} />
      </CardContent>
    </Card>
  );
}
