'use client';

/**
 * Multi-step governance action submission flow.
 * Steps: Review -> Deposit Warning -> Confirmation -> Signing -> Success/Published
 *
 * Wrapped in <FeatureGate flag="governance_action_submission">.
 * Uses the useGovernanceAction hook for phase management.
 *
 * SAFETY: This flow handles 100,000 ADA deposits. Every step includes
 * explicit warnings, balance checks, and a manual confirmation gate.
 */

import { useState, useCallback } from 'react';
import { Shield, AlertTriangle, Check, Loader2, ExternalLink, Copy, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FeatureGate } from '@/components/FeatureGate';
import { useGovernanceAction, type GovernanceActionPhase } from '@/hooks/useGovernanceAction';
import type { ProposalDraft, GovernanceActionTarget } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SubmissionFlowProps {
  draft: ProposalDraft;
  onClose: () => void;
  onSubmitted?: (txHash: string, anchorUrl: string, anchorHash: string) => void;
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i < current
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                : i === current
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                  : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {i < current ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-px w-8 ${i < current ? 'bg-emerald-500/40' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewStep({ draft, onNext }: { draft: ProposalDraft; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Title</p>
          <p className="text-foreground">{draft.title || 'Untitled'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Type</p>
          <Badge variant="outline">{draft.proposalType}</Badge>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Abstract</p>
          <p className="text-sm text-foreground line-clamp-3">
            {draft.abstract || 'No abstract provided'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Motivation</p>
          <p className="text-sm text-foreground line-clamp-3">
            {draft.motivation || 'No motivation provided'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Rationale</p>
          <p className="text-sm text-foreground line-clamp-3">
            {draft.rationale || 'No rationale provided'}
          </p>
        </div>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
          This will generate a CIP-108 metadata document hosted at a permanent URL, then construct a
          governance action transaction for on-chain submission.
        </AlertDescription>
      </Alert>

      <Button onClick={onNext} className="w-full">
        Continue to Deposit Information
      </Button>
    </div>
  );
}

function DepositWarningStep({
  phase,
  onNext,
  onBack,
}: {
  phase: GovernanceActionPhase;
  onNext: () => void;
  onBack: () => void;
}) {
  const preflight = phase.status === 'confirming' ? phase.preflight : null;

  return (
    <div className="space-y-4">
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-2">Refundable Deposit Required</p>
          <p className="text-sm">
            Submitting a governance action requires locking{' '}
            <span className="font-bold text-amber-900 dark:text-amber-200">100,000 ADA</span> as a
            refundable deposit. The deposit is returned when the proposal expires (~6 epochs / ~30
            days) or is ratified.
          </p>
        </AlertDescription>
      </Alert>

      {preflight && (
        <div className="bg-muted/50 rounded-lg border border-border p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Deposit</span>
            <span className="text-sm font-mono text-amber-700 dark:text-amber-300">
              {preflight.estimatedDeposit}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Estimated Fee</span>
            <span className="text-sm font-mono text-foreground">{preflight.estimatedFee}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="text-sm text-muted-foreground">Your Balance</span>
            <span className="text-sm font-mono text-foreground">{preflight.currentBalance}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Balance After</span>
            <span
              className={`text-sm font-mono ${preflight.canAfford ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'}`}
            >
              {preflight.canAfford ? preflight.balanceAfter : 'Insufficient funds'}
            </span>
          </div>
        </div>
      )}

      {preflight && !preflight.canAfford && (
        <Alert className="border-rose-500/30 bg-rose-500/5">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <AlertDescription className="text-rose-700 dark:text-rose-300 text-sm">
            Your wallet does not have sufficient funds for the 100,000 ADA deposit plus transaction
            fees. You need at least 100,000.2 ADA to proceed.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} disabled={!preflight?.canAfford} className="flex-1">
          I Understand, Continue
        </Button>
      </div>
    </div>
  );
}

function ConfirmationStep({
  onConfirm,
  onBack,
  isProcessing,
}: {
  onConfirm: () => void;
  onBack: () => void;
  isProcessing: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === 'SUBMIT';

  return (
    <div className="space-y-4">
      <Alert className="border-rose-500/30 bg-rose-500/5">
        <Shield className="h-4 w-4 text-rose-400" />
        <AlertDescription className="text-rose-700 dark:text-rose-300">
          <p className="font-semibold mb-2">Final Confirmation</p>
          <p className="text-sm">
            You are about to submit a governance action on-chain. This will lock{' '}
            <span className="font-bold">100,000 ADA</span> from your wallet as a refundable deposit.
            This action cannot be undone once the transaction is signed.
          </p>
        </AlertDescription>
      </Alert>

      <div>
        <label htmlFor="confirm-submit" className="text-sm text-muted-foreground mb-2 block">
          Type <span className="font-mono font-bold text-foreground">SUBMIT</span> to confirm
        </label>
        <Input
          id="confirm-submit"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type SUBMIT"
          className="font-mono"
          disabled={isProcessing}
          autoComplete="off"
        />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={isProcessing}>
          Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!isConfirmed || isProcessing}
          className="flex-1 bg-rose-600 hover:bg-rose-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Submit On-Chain
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ProcessingStep({ phase }: { phase: GovernanceActionPhase }) {
  const statusMessages: Record<string, string> = {
    publishing: 'Publishing CIP-108 metadata...',
    building: 'Building governance action transaction...',
    signing: 'Waiting for wallet signature...',
    submitting: 'Submitting transaction to the network...',
  };

  const message = statusMessages[phase.status] || 'Processing...';

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      <p className="text-foreground">{message}</p>
      {phase.status === 'signing' && (
        <p className="text-sm text-muted-foreground">
          Check your wallet extension for the signature request
        </p>
      )}
    </div>
  );
}

function PublishedStep({
  anchorUrl,
  anchorHash,
  onClose,
}: {
  anchorUrl: string;
  anchorHash: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(anchorUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [anchorUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3">
          <Check className="h-6 w-6 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Metadata Published</h3>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Your CIP-108 metadata document is live and ready for on-chain submission.
        </p>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
          On-chain transaction submission requires MeshJS governance action support which is still
          in development. You can submit using cardano-cli with the anchor URL below.
        </AlertDescription>
      </Alert>

      <div className="bg-muted/50 rounded-lg border border-border p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Anchor URL</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-foreground break-all flex-1">{anchorUrl}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyUrl}
              className="shrink-0"
              aria-label="Copy anchor URL"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Anchor Hash (Blake2b-256)</p>
          <code className="text-xs text-foreground break-all">{anchorHash}</code>
        </div>
      </div>

      <Button onClick={onClose} className="w-full">
        Done
      </Button>
    </div>
  );
}

function SuccessStep({
  txHash,
  anchorUrl,
  confirmed,
  onClose,
}: {
  txHash: string;
  anchorUrl: string;
  confirmed: boolean;
  onClose: () => void;
}) {
  const cardanoscanUrl = `https://cardanoscan.io/transaction/${txHash}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
          <Check className="h-6 w-6 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Governance Action Submitted</h3>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Your proposal is now live on-chain for approximately 6 epochs (~30 days).
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg border border-border p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-foreground break-all flex-1">{txHash}</code>
            <a
              href={cardanoscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="View on CardanoScan"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Anchor URL</p>
          <code className="text-xs text-foreground break-all">{anchorUrl}</code>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <Badge variant={confirmed ? 'default' : 'outline'}>
            {confirmed ? 'Confirmed on-chain' : 'Awaiting confirmation...'}
          </Badge>
        </div>
      </div>

      <Button onClick={onClose} className="w-full">
        Done
      </Button>
    </div>
  );
}

function ErrorStep({
  code,
  message,
  hint,
  onRetry,
  onClose,
}: {
  code: string;
  message: string;
  hint: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert className="border-rose-500/30 bg-rose-500/5">
        <AlertTriangle className="h-4 w-4 text-rose-400" />
        <AlertDescription className="text-rose-700 dark:text-rose-300">
          <p className="font-semibold mb-1">{message}</p>
          <p className="text-sm">{hint}</p>
          {code !== 'unknown' && (
            <p className="text-xs text-rose-600/60 dark:text-rose-400/60 mt-2">
              Error code: {code}
            </p>
          )}
        </AlertDescription>
      </Alert>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={onRetry} className="flex-1">
          Try Again
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function SubmissionFlowInner({ draft, onClose, onSubmitted }: SubmissionFlowProps) {
  const [step, setStep] = useState(0);
  const { phase, startSubmission, confirmSubmission, reset, isProcessing } = useGovernanceAction();

  // Step 0 -> 1: Run preflight when moving from Review to Deposit Warning
  const handleReviewNext = useCallback(async () => {
    const target: GovernanceActionTarget = {
      type: draft.proposalType as GovernanceActionTarget['type'],
      anchorUrl: '', // Will be set during publishing
      anchorHash: '',
    };
    await startSubmission(target);
    setStep(1);
  }, [draft, startSubmission]);

  // Step 1 -> 2: Move to confirmation
  const handleDepositNext = useCallback(() => {
    setStep(2);
  }, []);

  // Step 2: Confirm and publish + submit
  const handleConfirm = useCallback(async () => {
    setStep(3); // Processing step

    const publishFn = async (): Promise<{ anchorUrl: string; anchorHash: string }> => {
      const res = await fetch(`/api/workspace/drafts/${draft.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to publish metadata' }));
        throw new Error(data.error || 'Failed to publish CIP-108 metadata');
      }
      const data = await res.json();
      return { anchorUrl: data.anchorUrl, anchorHash: data.anchorHash };
    };

    const result = await confirmSubmission(publishFn);
    if (result) {
      onSubmitted?.(result.txHash, result.anchorUrl, result.anchorHash);
    }
  }, [draft.id, confirmSubmission, onSubmitted]);

  const handleBack = useCallback(
    (toStep: number) => {
      if (toStep === 0) {
        reset();
      }
      setStep(toStep);
    },
    [reset],
  );

  const handleRetry = useCallback(() => {
    reset();
    setStep(0);
  }, [reset]);

  // Determine what to render based on step and phase
  const renderContent = () => {
    // Error state (from any step)
    if (phase.status === 'error') {
      return (
        <ErrorStep
          code={phase.code}
          message={phase.message}
          hint={phase.hint}
          onRetry={handleRetry}
          onClose={onClose}
        />
      );
    }

    // Published state (metadata live, tx not yet supported)
    if (phase.status === 'published') {
      return (
        <PublishedStep
          anchorUrl={phase.anchorUrl}
          anchorHash={phase.anchorHash}
          onClose={onClose}
        />
      );
    }

    // Success state (tx submitted)
    if (phase.status === 'success') {
      return (
        <SuccessStep
          txHash={phase.txHash}
          anchorUrl={phase.anchorUrl}
          confirmed={phase.confirmed}
          onClose={onClose}
        />
      );
    }

    // Processing states
    if (
      phase.status === 'publishing' ||
      phase.status === 'building' ||
      phase.status === 'signing' ||
      phase.status === 'submitting'
    ) {
      return <ProcessingStep phase={phase} />;
    }

    // Step-based rendering
    switch (step) {
      case 0:
        return <ReviewStep draft={draft} onNext={handleReviewNext} />;
      case 1:
        return (
          <DepositWarningStep
            phase={phase}
            onNext={handleDepositNext}
            onBack={() => handleBack(0)}
          />
        );
      case 2:
        return (
          <ConfirmationStep
            onConfirm={handleConfirm}
            onBack={() => handleBack(1)}
            isProcessing={isProcessing}
          />
        );
      default:
        return <ProcessingStep phase={phase} />;
    }
  };

  // Step titles
  const stepTitles = ['Review Proposal', 'Deposit Information', 'Final Confirmation'];
  const currentStepIndex =
    phase.status === 'error' || phase.status === 'published' || phase.status === 'success'
      ? step
      : step;

  return (
    <Card className="border-border bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-amber-400" />
          Submit Governance Action
        </CardTitle>
        {step < 3 &&
          phase.status !== 'error' &&
          phase.status !== 'published' &&
          phase.status !== 'success' && (
            <>
              <StepIndicator current={currentStepIndex} total={3} />
              <p className="text-sm text-muted-foreground">{stepTitles[currentStepIndex]}</p>
            </>
          )}
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}

/**
 * Governance action submission flow, wrapped in a feature gate.
 * Only renders when the `governance_action_submission` flag is enabled.
 */
export function SubmissionFlow(props: SubmissionFlowProps) {
  return (
    <FeatureGate flag="governance_action_submission">
      <SubmissionFlowInner {...props} />
    </FeatureGate>
  );
}
