'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  FileText,
  ArrowRight,
  ArrowLeft,
  Zap,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWallet } from '@/utils/wallet';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useVote, type VotePhase } from '@/hooks/useVote';
import { useFeatureFlag } from '@/components/FeatureGate';
import type { VoteChoice, VoterRole } from '@/lib/voting';

interface VoteRationaleFlowProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  proposalAbstract?: string | null;
  proposalType?: string | null;
  aiSummary?: string | null;
}

type FlowStep = 'select' | 'rationale' | 'review' | 'submitting' | 'success';

const VOTE_OPTIONS: {
  value: VoteChoice;
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  selectedColor: string;
  bgColor: string;
}[] = [
  {
    value: 'Yes',
    label: 'Yes',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    selectedColor: 'ring-emerald-500/50',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60',
  },
  {
    value: 'No',
    label: 'No',
    icon: XCircle,
    color: 'text-rose-500',
    selectedColor: 'ring-rose-500/50',
    bgColor: 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60',
  },
  {
    value: 'Abstain',
    label: 'Abstain',
    icon: MinusCircle,
    color: 'text-muted-foreground',
    selectedColor: 'ring-muted-foreground/50',
    bgColor: 'bg-muted/30 border-border hover:border-muted-foreground/40',
  },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 'select' as const, label: 'Vote' },
  { key: 'rationale' as const, label: 'Rationale' },
  { key: 'review' as const, label: 'Review' },
  { key: 'submitting' as const, label: 'Submit' },
] as const;

function StepIndicator({ currentStep }: { currentStep: FlowStep }) {
  const stepIndex =
    currentStep === 'success' ? STEPS.length : STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isComplete = i < stepIndex;
        const isCurrent = i === stepIndex;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold transition-all',
                isComplete && 'bg-primary text-primary-foreground',
                isCurrent && 'bg-primary/20 text-primary ring-2 ring-primary/40',
                !isComplete && !isCurrent && 'bg-muted text-muted-foreground',
              )}
            >
              {isComplete ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px w-4', isComplete ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission progress
// ---------------------------------------------------------------------------

type SubmitSubPhase = 'publishing' | 'building' | 'signing' | 'submitting' | 'confirming';

function SubmissionTimeline({
  phase,
  subPhase,
  hasRationale,
}: {
  phase: VotePhase;
  subPhase: SubmitSubPhase;
  hasRationale: boolean;
}) {
  const steps: { key: SubmitSubPhase; label: string; icon: typeof Loader2 }[] = [
    ...(hasRationale
      ? [{ key: 'publishing' as const, label: 'Publishing rationale', icon: FileText }]
      : []),
    { key: 'building', label: 'Building transaction', icon: Shield },
    { key: 'signing', label: 'Waiting for wallet', icon: Clock },
    { key: 'submitting', label: 'Submitting to chain', icon: ArrowRight },
    { key: 'confirming', label: 'Awaiting confirmation', icon: CheckCircle2 },
  ];

  const currentIdx = steps.findIndex((s) => s.key === subPhase);

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isPending = i > currentIdx;

        return (
          <div key={step.key} className="flex items-center gap-3">
            <div
              className={cn(
                'flex items-center justify-center h-6 w-6 rounded-full',
                isComplete && 'bg-emerald-500/20',
                isCurrent && 'bg-primary/20',
                isPending && 'bg-muted',
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : isCurrent ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <span
              className={cn(
                'text-sm',
                isComplete && 'text-emerald-600 dark:text-emerald-400',
                isCurrent && 'text-foreground font-medium',
                isPending && 'text-muted-foreground',
              )}
            >
              {step.label}
              {isCurrent && step.key === 'signing' && (
                <span className="text-xs text-muted-foreground ml-1">(check your wallet)</span>
              )}
            </span>
          </div>
        );
      })}

      {phase.status === 'success' && (
        <div className="mt-3 space-y-2">
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VoteRationaleFlow({
  txHash,
  proposalIndex,
  title,
  isOpen,
  proposalAbstract,
  proposalType,
  aiSummary,
}: VoteRationaleFlowProps) {
  const { connected, ownDRepId } = useWallet();
  const { segment, poolId } = useSegment();
  const { phase, startVote, confirmVote, reset, isProcessing, canVote } = useVote();
  const voteCastingEnabled = useFeatureFlag('governance_vote_casting');

  const [flowStep, setFlowStep] = useState<FlowStep>('select');
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [submitSubPhase, setSubmitSubPhase] = useState<SubmitSubPhase>('building');
  const [showContext, setShowContext] = useState(false);

  // Determine voter role and credential based on segment
  const voterRole: VoterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId;
  const roleLabel = voterRole === 'spo' ? 'SPO' : 'DRep';

  // Detect success — transition flow step when vote succeeds
  useEffect(() => {
    if (phase.status === 'success' && flowStep === 'submitting') {
      setFlowStep('success');
    }
  }, [phase.status, flowStep]);

  // Gated behind feature flag
  if (voteCastingEnabled === null || !voteCastingEnabled) return null;

  // Proposal is closed — show informational message
  if (!isOpen) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Voting on this proposal has closed.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Wallet not connected — show connect CTA
  if (!connected) {
    return (
      <Card className="border-primary/20">
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm font-semibold text-foreground">Cast Your Vote</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            Connect your wallet to vote on this proposal as a DRep or SPO.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected but not a DRep or SPO
  if (!voterId) return null;

  const handleVoteSelect = (vote: VoteChoice) => {
    if (isProcessing) return;
    setSelectedVote(vote);

    if (phase.status === 'error') reset();

    // Run preflight in background
    startVote({ txHash, txIndex: proposalIndex, title }, voterRole, voterId);
  };

  const handleContinueToRationale = () => {
    if (!selectedVote || phase.status !== 'confirming') return;
    setFlowStep('rationale');
  };

  const handleQuickVote = () => {
    if (!selectedVote || phase.status !== 'confirming') return;
    // Skip rationale, go straight to review
    setRationaleText('');
    setFlowStep('review');
  };

  const handleContinueToReview = () => {
    setFlowStep('review');
  };

  const handleBackToSelect = () => {
    setFlowStep('select');
  };

  const handleBackToRationale = () => {
    setFlowStep('rationale');
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

  const handleSubmit = async () => {
    if (!selectedVote || !voterId) return;

    setFlowStep('submitting');

    let anchorUrl: string | undefined;
    let anchorHash: string | undefined;

    // Publish rationale first if provided
    if (rationaleText.trim()) {
      setSubmitSubPhase('publishing');
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
        // Continue without anchor — vote is still valuable
      }
    }

    setSubmitSubPhase('building');
    confirmVote(selectedVote, anchorUrl, anchorHash);
  };

  // Sync subPhase with vote hook phase
  const effectiveSubPhase: SubmitSubPhase =
    flowStep !== 'submitting' && flowStep !== 'success'
      ? submitSubPhase
      : phase.status === 'building'
        ? 'building'
        : phase.status === 'signing'
          ? 'signing'
          : phase.status === 'submitting'
            ? 'submitting'
            : phase.status === 'success'
              ? 'confirming'
              : submitSubPhase;

  const handleReset = () => {
    setFlowStep('select');
    setSelectedVote(null);
    setRationaleText('');
    setSubmitSubPhase('building');
    setShowContext(false);
    reset();
  };

  const hasRationale = rationaleText.trim().length > 0;
  const isConfirming = phase.status === 'confirming';
  const hasExistingVote = isConfirming && phase.preflight.hasExistingVote;

  // Vote choice display helper
  const selectedOption = VOTE_OPTIONS.find((o) => o.value === selectedVote);

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-foreground">
              {flowStep === 'success' ? 'Vote Submitted' : `Cast Your ${roleLabel} Vote`}
            </p>
            {flowStep !== 'select' && flowStep !== 'success' && (
              <StepIndicator currentStep={flowStep} />
            )}
          </div>
          {(flowStep === 'success' || phase.status === 'error') && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
              {flowStep === 'success' ? 'Vote again' : 'Try again'}
            </Button>
          )}
        </div>

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

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1: Select Vote                                                */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'select' && (
          <div className="space-y-3">
            {/* Vote buttons */}
            <div className="grid grid-cols-3 gap-2">
              {VOTE_OPTIONS.map(({ value, label, icon: Icon, color, selectedColor, bgColor }) => {
                const isSelected = selectedVote === value;
                return (
                  <button
                    key={value}
                    onClick={() => handleVoteSelect(value)}
                    disabled={isProcessing}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all',
                      isSelected
                        ? `${bgColor} ring-2 ring-offset-1 ring-offset-background ${selectedColor}`
                        : 'border-border hover:bg-muted/30',
                      isProcessing && 'opacity-50 cursor-not-allowed',
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

            {/* Preflight loading */}
            {phase.status === 'preflight' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking eligibility...
              </div>
            )}

            {/* Action buttons after preflight */}
            {isConfirming && selectedVote && (
              <div className="space-y-2">
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

                <div className="flex gap-2">
                  <Button onClick={handleContinueToRationale} className="flex-1 gap-2">
                    <FileText className="h-4 w-4" />
                    Add Rationale
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" onClick={handleQuickVote} className="gap-2">
                    <Zap className="h-4 w-4" />
                    Quick Vote
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  {voterRole === 'spo'
                    ? 'SPOs who explain votes score higher on Deliberation Quality (25% weight)'
                    : 'DReps who explain votes score higher on Engagement (25% weight)'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2: Write Rationale                                            */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'rationale' && selectedVote && (
          <div className="space-y-3">
            {/* Vote summary */}
            {selectedOption && (
              <div className="flex items-center gap-2 text-sm">
                <selectedOption.icon className={cn('h-4 w-4', selectedOption.color)} />
                <span className="font-medium">Voting {selectedOption.label}</span>
                <button
                  onClick={handleBackToSelect}
                  className="text-xs text-primary hover:underline ml-auto"
                >
                  Change
                </button>
              </div>
            )}

            {/* Proposal context toggle */}
            {(aiSummary || proposalAbstract) && (
              <button
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showContext ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {showContext ? 'Hide' : 'Show'} proposal context
              </button>
            )}
            {showContext && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 max-h-[150px] overflow-y-auto">
                {aiSummary || proposalAbstract || 'No summary available.'}
              </div>
            )}

            {/* Rationale editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="vote-rationale-editor"
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
                id="vote-rationale-editor"
                value={rationaleText}
                onChange={(e) => setRationaleText(e.target.value)}
                placeholder="Explain your vote. This will be published as a CIP-100 document anchored to your on-chain vote — making your reasoning transparent to delegators."
                className="w-full min-h-[160px] p-3 text-sm border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                maxLength={10000}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user just entered rationale step
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
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackToSelect} className="gap-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button onClick={handleContinueToReview} className="flex-1 gap-2">
                Review
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 3: Review & Confirm                                           */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'review' && selectedVote && (
          <div className="space-y-3">
            {/* Transaction summary */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Transaction Summary
              </p>

              {/* Vote */}
              {selectedOption && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vote</span>
                  <div className="flex items-center gap-1.5">
                    <selectedOption.icon className={cn('h-4 w-4', selectedOption.color)} />
                    <span className="text-sm font-medium">{selectedOption.label}</span>
                  </div>
                </div>
              )}

              {/* Rationale */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rationale</span>
                <span className="text-sm">
                  {hasRationale ? (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Included ({rationaleText.trim().length} chars)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </span>
              </div>

              {/* Fee */}
              {isConfirming && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated fee</span>
                  <span className="text-sm font-medium tabular-nums">
                    {phase.preflight.estimatedFee}
                  </span>
                </div>
              )}

              {/* What gets submitted */}
              <div className="pt-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">
                  {hasRationale
                    ? 'Your vote and CIP-100 rationale will be submitted in a single transaction.'
                    : 'Your vote will be submitted. You can add a rationale later.'}
                </p>
              </div>
            </div>

            {/* Rationale preview */}
            {hasRationale && (
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Rationale Preview</p>
                  <button
                    onClick={handleBackToRationale}
                    className="text-xs text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-sm text-foreground/80 line-clamp-4 whitespace-pre-wrap">
                  {rationaleText.trim()}
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={hasRationale ? handleBackToRationale : handleBackToSelect}
                className="gap-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button onClick={handleSubmit} className="flex-1 gap-2" disabled={!canVote}>
                <Shield className="h-4 w-4" />
                Confirm &amp; Sign
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 4: Submitting (progress timeline)                             */}
        {/* ------------------------------------------------------------------ */}
        {(flowStep === 'submitting' || flowStep === 'success') && (
          <SubmissionTimeline
            phase={phase}
            subPhase={effectiveSubPhase}
            hasRationale={hasRationale}
          />
        )}

        {/* Post-vote rationale fallback */}
        {flowStep === 'success' && !hasRationale && phase.status === 'success' && (
          <PostVoteRationale
            txHash={txHash}
            proposalIndex={proposalIndex}
            title={title}
            vote={phase.vote}
            proposalAbstract={proposalAbstract}
            proposalType={proposalType}
            aiSummary={aiSummary}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Post-vote rationale fallback
// ---------------------------------------------------------------------------

function PostVoteRationale({
  txHash,
  proposalIndex,
  title,
  vote,
  proposalAbstract,
  proposalType,
  aiSummary,
}: {
  txHash: string;
  proposalIndex: number;
  title: string;
  vote: VoteChoice;
  proposalAbstract?: string | null;
  proposalType?: string | null;
  aiSummary?: string | null;
}) {
  const { connected, ownDRepId } = useWallet();
  const { segment, poolId } = useSegment();
  const { phase, startVote, confirmVote, canVote } = useVote();

  const [expanded, setExpanded] = useState(false);
  const [rationaleText, setRationaleText] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Determine voter role and credential based on segment
  const postVoterRole: VoterRole = segment === 'spo' ? 'spo' : 'drep';
  const postVoterId = segment === 'spo' ? poolId : ownDRepId;

  // Pending anchor data: when set, we auto-confirm after preflight completes
  const pendingAnchorRef = useRef<{ url: string; hash: string } | null>(null);

  // Watch for phase to reach 'confirming' after we started a re-vote,
  // then auto-confirm with the pending anchor.
  useEffect(() => {
    if (phase.status === 'confirming' && pendingAnchorRef.current) {
      const { url, hash } = pendingAnchorRef.current;
      pendingAnchorRef.current = null;
      confirmVote(vote, url, hash);
    }
    if (phase.status === 'success' && isSubmitting) {
      setSubmitted(true);
      setIsSubmitting(false);
    }
    if (phase.status === 'error' && isSubmitting) {
      setIsSubmitting(false);
    }
  }, [phase.status, vote, confirmVote, isSubmitting]);

  if (!connected || !postVoterId) return null;
  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-500 mt-2 justify-center">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Rationale submitted! Your vote has been updated with a CIP-100 anchor.
      </div>
    );
  }

  const handleAiDraft = async () => {
    setIsDrafting(true);
    try {
      const res = await fetch('/api/rationale/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drepId: postVoterId,
          voterRole: postVoterRole,
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

  const handleSubmitRationale = async () => {
    if (!rationaleText.trim() || !postVoterId) return;

    setIsSubmitting(true);
    try {
      // 1. Publish the rationale document
      const res = await fetch('/api/rationale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drepId: postVoterId,
          proposalTxHash: txHash,
          proposalIndex,
          rationaleText: rationaleText.trim(),
        }),
      });

      if (!res.ok) {
        setIsSubmitting(false);
        return;
      }

      const { anchorUrl, anchorHash } = await res.json();

      // 2. Store anchor and start vote preflight.
      //    The useEffect above will auto-confirm when preflight completes.
      //    CIP-1694 allows re-voting, so this replaces the previous vote
      //    with the same choice but now including the metadata anchor.
      pendingAnchorRef.current = { url: anchorUrl, hash: anchorHash };
      startVote({ txHash, txIndex: proposalIndex, title }, postVoterRole, postVoterId);
    } catch {
      setIsSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-xs text-primary hover:underline mt-2 w-full justify-center"
      >
        <FileText className="h-3.5 w-3.5" />
        Add rationale to your vote (re-submits with CIP-100 anchor)
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Add Rationale (re-submits your {vote} vote with anchor)
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={handleAiDraft}
          disabled={isDrafting || isSubmitting}
        >
          {isDrafting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          AI Draft
        </Button>
      </div>
      <textarea
        value={rationaleText}
        onChange={(e) => setRationaleText(e.target.value)}
        placeholder="Explain your vote. This will re-submit your vote with a CIP-100 rationale anchor attached."
        className="w-full min-h-[120px] p-3 text-sm border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
        maxLength={10000}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user is adding rationale
        autoFocus
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Re-casts your vote with an on-chain rationale anchor
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {rationaleText.length.toLocaleString()} / 10,000
        </p>
      </div>

      {/* Submission progress */}
      {isSubmitting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {phase.status === 'preflight'
            ? 'Checking eligibility...'
            : phase.status === 'building'
              ? 'Building transaction...'
              : phase.status === 'signing'
                ? 'Waiting for wallet signature...'
                : phase.status === 'submitting'
                  ? 'Submitting to chain...'
                  : 'Publishing rationale...'}
        </div>
      )}

      {/* Error display */}
      {phase.status === 'error' && (
        <div className="flex items-start gap-2 text-xs text-rose-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{phase.hint}</span>
        </div>
      )}

      {!isSubmitting && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleSubmitRationale}
            disabled={!rationaleText.trim() || !canVote}
          >
            <FileText className="h-3.5 w-3.5" />
            Submit Rationale
          </Button>
        </div>
      )}
    </div>
  );
}
