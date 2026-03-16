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
import type { VoteChoice, VoterRole } from '@/lib/voting';
import { QuestionGate, hasSubmittedQuestion } from './QuestionGate';
import { ContributionOverlapBanner } from './ContributionOverlapBanner';
import { DiversityFields } from './DiversityFields';
import { PostVoteShare } from './PostVoteShare';
import { ScoreImpactPreview } from './ScoreImpactPreview';
import type { ReviewQueueItem } from '@/lib/workspace/types';

interface ReviewActionZoneProps {
  item: ReviewQueueItem;
  drepId: string;
  onVote?: (txHash: string, index: number, vote: string) => void;
  onNextProposal?: () => void;
  /** Total proposals in queue — used for score impact preview */
  totalProposals?: number;
  /** Already voted count — used for score impact preview */
  votedCount?: number;
}

type FlowStep =
  | 'question'
  | 'select'
  | 'rationale'
  | 'diversity'
  | 'review'
  | 'submitting'
  | 'success';

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
    currentStep === 'success'
      ? STEPS.length
      : currentStep === 'question'
        ? -1
        : currentStep === 'diversity'
          ? STEPS.findIndex((s) => s.key === 'rationale')
          : STEPS.findIndex((s) => s.key === currentStep);

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
// Submission progress timeline
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

export function ReviewActionZone({
  item,
  drepId,
  onVote,
  onNextProposal,
  totalProposals = 0,
  votedCount = 0,
}: ReviewActionZoneProps) {
  const { connected, ownDRepId } = useWallet();
  const { segment, poolId, isViewingAs, drepId: overrideDrepId } = useSegment();
  const { phase, startVote, confirmVote, reset, isProcessing, canVote: hookCanVote } = useVote();

  // Determine voter role and credential from segment
  const voterRole: VoterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId =
    segment === 'spo' ? poolId : ownDRepId || (isViewingAs ? overrideDrepId : null) || drepId;
  const roleLabel = voterRole === 'spo' ? 'SPO' : 'DRep';
  const previewMode = isViewingAs && !connected;

  // Determine initial flow step
  const questionAlreadyDone = hasSubmittedQuestion(drepId, item.txHash, item.proposalIndex);

  const [flowStep, setFlowStep] = useState<FlowStep>(() => {
    if (item.existingVote) return 'select';
    return questionAlreadyDone ? 'select' : 'question';
  });
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [submitSubPhase, setSubmitSubPhase] = useState<SubmitSubPhase>('building');
  const [showContext, setShowContext] = useState(false);

  // Diversity fields
  const [steelmanText, setSteelmanText] = useState('');
  const [diversityConfidence, setDiversityConfidence] = useState(50);
  const [keyAssumptions, setKeyAssumptions] = useState('');

  // Detect success — transition flow step when vote succeeds
  useEffect(() => {
    if (phase.status === 'success' && flowStep === 'submitting') {
      setFlowStep('success');
      onVote?.(item.txHash, item.proposalIndex, selectedVote || 'Yes');

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('review_vote_cast', {
            proposal_tx_hash: item.txHash,
            proposal_index: item.proposalIndex,
            vote: selectedVote,
            voter_role: voterRole,
            had_rationale: rationaleText.trim().length > 0,
          });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.status, flowStep]);

  // Reset state when item changes
  useEffect(() => {
    setSelectedVote(null);
    setRationaleText('');
    setSteelmanText('');
    setDiversityConfidence(50);
    setKeyAssumptions('');
    setSubmitSubPhase('building');
    setShowContext(false);
    reset();

    const done = hasSubmittedQuestion(drepId, item.txHash, item.proposalIndex);
    setFlowStep(item.existingVote ? 'select' : done ? 'select' : 'question');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.txHash, item.proposalIndex]);

  // Wallet not connected — show connect CTA (skip in View As mode)
  if (!connected && !isViewingAs) {
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

  if (!voterId) return null;

  // Handlers
  const handleQuestionComplete = () => {
    setFlowStep('select');
  };

  const handleVoteSelect = (vote: VoteChoice) => {
    if (previewMode || isProcessing) return;
    setSelectedVote(vote);
    if (phase.status === 'error') reset();

    startVote(
      { txHash: item.txHash, txIndex: item.proposalIndex, title: item.title },
      voterRole,
      voterId,
    );
  };

  const handleContinueToRationale = () => {
    if (!selectedVote || phase.status !== 'confirming') return;
    setFlowStep('rationale');
  };

  const handleQuickVote = () => {
    if (!selectedVote || phase.status !== 'confirming') return;
    setRationaleText('');
    setFlowStep('review');
  };

  const handleContinueToDiversity = () => {
    setFlowStep('diversity');
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

  const handleBackToDiversity = () => {
    setFlowStep('diversity');
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
          proposalTitle: item.title,
          proposalAbstract: item.abstract || undefined,
          proposalType: item.proposalType || undefined,
          aiSummary: item.aiSummary || undefined,
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
            proposalTxHash: item.txHash,
            proposalIndex: item.proposalIndex,
            rationaleText: rationaleText.trim(),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          anchorUrl = data.anchorUrl;
          anchorHash = data.anchorHash;

          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('review_rationale_submitted', {
                proposal_tx_hash: item.txHash,
                proposal_index: item.proposalIndex,
                rationale_length: rationaleText.trim().length,
              });
            })
            .catch(() => {});
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
    setSteelmanText('');
    setDiversityConfidence(50);
    setKeyAssumptions('');
    setSubmitSubPhase('building');
    setShowContext(false);
    reset();
  };

  const hasRationale = rationaleText.trim().length > 0;
  const isConfirming = phase.status === 'confirming';
  const hasExistingVote = isConfirming && phase.preflight.hasExistingVote;
  const selectedOption = VOTE_OPTIONS.find((o) => o.value === selectedVote);

  const scoringHint =
    voterRole === 'spo'
      ? 'SPOs who explain votes score higher on Deliberation Quality (25% weight)'
      : 'DReps who explain votes score higher on Engagement (25% weight)';

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-foreground">
              {flowStep === 'success' ? 'Vote Submitted' : `Cast Your ${roleLabel} Vote`}
            </p>
            {flowStep !== 'select' && flowStep !== 'question' && flowStep !== 'success' && (
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
        {/* STEP 0: Question Gate                                              */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'question' && (
          <QuestionGate
            txHash={item.txHash}
            index={item.proposalIndex}
            voterId={drepId}
            onQuestionSubmitted={handleQuestionComplete}
            onSkip={handleQuestionComplete}
          />
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1: Select Vote                                                */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'select' && (
          <div className="space-y-3">
            {previewMode && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                Preview mode — voting disabled while viewing as another user
              </div>
            )}

            {item.existingVote && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                You previously voted <span className="font-semibold">{item.existingVote}</span>.
                Select below to change your vote.
              </div>
            )}

            {/* Score impact motivational badge */}
            {totalProposals > 0 && (
              <ScoreImpactPreview totalProposals={totalProposals} votedCount={votedCount} />
            )}

            {/* Vote buttons */}
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label={`Cast your ${roleLabel} vote`}
            >
              {VOTE_OPTIONS.map(({ value, label, icon: Icon, color, selectedColor, bgColor }) => {
                const isSelected = selectedVote === value;
                return (
                  <button
                    key={value}
                    onClick={() => handleVoteSelect(value)}
                    disabled={previewMode || isProcessing}
                    role="radio"
                    aria-checked={isSelected}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all',
                      isSelected
                        ? `${bgColor} ring-2 ring-offset-1 ring-offset-background ${selectedColor}`
                        : 'border-border hover:bg-muted/30',
                      (previewMode || isProcessing) && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <Icon
                      className={cn('h-5 w-5', isSelected ? color : 'text-muted-foreground')}
                      aria-hidden="true"
                    />
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

                <p className="text-[10px] text-muted-foreground text-center">{scoringHint}</p>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2: Write Rationale                                            */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'rationale' && selectedVote && (
          <div className="space-y-3">
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

            {(item.aiSummary || item.abstract) && (
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
                {item.aiSummary || item.abstract || 'No summary available.'}
              </div>
            )}

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
                placeholder="Explain your vote. This will be published as a CIP-100 document anchored to your on-chain vote."
                className="w-full min-h-[160px] p-3 text-sm border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            </div>

            <ContributionOverlapBanner
              proposalTxHash={item.txHash}
              proposalIndex={item.proposalIndex}
              text={rationaleText}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackToSelect} className="gap-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button onClick={handleContinueToDiversity} className="flex-1 gap-2">
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2.5: Diversity Fields                                         */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'diversity' && selectedVote && (
          <div className="space-y-3">
            {selectedOption && (
              <div className="flex items-center gap-2 text-sm">
                <selectedOption.icon className={cn('h-4 w-4', selectedOption.color)} />
                <span className="font-medium">Voting {selectedOption.label}</span>
              </div>
            )}

            <DiversityFields
              steelmanText={steelmanText}
              onSteelmanChange={setSteelmanText}
              confidence={diversityConfidence}
              onConfidenceChange={setDiversityConfidence}
              keyAssumptions={keyAssumptions}
              onAssumptionsChange={setKeyAssumptions}
              selectedVote={selectedVote}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackToRationale} className="gap-2">
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
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Transaction Summary
              </p>

              {selectedOption && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vote</span>
                  <div className="flex items-center gap-1.5">
                    <selectedOption.icon className={cn('h-4 w-4', selectedOption.color)} />
                    <span className="text-sm font-medium">{selectedOption.label}</span>
                  </div>
                </div>
              )}

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

              {isConfirming && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated fee</span>
                  <span className="text-sm font-medium tabular-nums">
                    {phase.preflight.estimatedFee}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">
                  {hasRationale
                    ? 'Your vote and CIP-100 rationale will be submitted in a single transaction.'
                    : 'Your vote will be submitted. You can add a rationale later.'}
                </p>
              </div>
            </div>

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

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={hasRationale ? handleBackToDiversity : handleBackToSelect}
                className="gap-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 gap-2"
                disabled={!hookCanVote || previewMode}
              >
                <Shield className="h-4 w-4" />
                Confirm &amp; Sign
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 4: Submitting (progress timeline)                             */}
        {/* ------------------------------------------------------------------ */}
        {(flowStep === 'submitting' || flowStep === 'success') && phase.status !== 'error' && (
          <SubmissionTimeline
            phase={phase}
            subPhase={effectiveSubPhase}
            hasRationale={hasRationale}
          />
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 5: Success — PostVoteShare + Next Proposal                    */}
        {/* ------------------------------------------------------------------ */}
        {flowStep === 'success' && phase.status === 'success' && (
          <PostVoteShare
            drepId={drepId}
            txHash={item.txHash}
            index={item.proposalIndex}
            vote={selectedVote || 'Yes'}
            proposalTitle={item.title || 'Governance Proposal'}
            rationale={hasRationale ? rationaleText.trim() : undefined}
            onNextProposal={onNextProposal}
          />
        )}
      </CardContent>
    </Card>
  );
}
