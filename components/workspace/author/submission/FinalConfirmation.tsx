'use client';

/**
 * FinalConfirmation — Step 4 of the submission ceremony.
 *
 * Shows the deposit amount prominently and enforces a 15-second cooldown
 * before the "Sign & Submit" button becomes active. This forced pause
 * prevents impulse submissions of a 100,000 ADA commitment.
 *
 * When isProcessing is true, shows a processing overlay with phase-aware
 * status messages from the useGovernanceAction hook.
 */

import { useState, useEffect } from 'react';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GovernanceActionPhase } from '@/hooks/useGovernanceAction';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FinalConfirmationProps {
  depositAda: number;
  onSubmit: () => void;
  onBack: () => void;
  isProcessing: boolean;
  /** Current phase from useGovernanceAction — drives processing status text */
  phase?: GovernanceActionPhase;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOLDOWN_SECONDS = 15;

const PHASE_STATUS_MESSAGES: Record<string, string> = {
  publishing: 'Publishing metadata...',
  building: 'Building transaction...',
  signing: 'Waiting for wallet signature...',
  submitting: 'Submitting to network...',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinalConfirmation({
  depositAda,
  onSubmit,
  onBack,
  isProcessing,
  phase,
}: FinalConfirmationProps) {
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);
  const [cooldownDone, setCooldownDone] = useState(false);

  // Cooldown timer — starts when the component mounts (user arrives at this step)
  useEffect(() => {
    if (secondsLeft <= 0) {
      setCooldownDone(true);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Progress percentage for the cooldown bar (0% at start, 100% when done)
  const progressPercent = ((COOLDOWN_SECONDS - secondsLeft) / COOLDOWN_SECONDS) * 100;

  // Processing overlay
  if (isProcessing) {
    const statusMessage =
      phase?.status && phase.status in PHASE_STATUS_MESSAGES
        ? PHASE_STATUS_MESSAGES[phase.status]
        : 'Processing...';

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--compass-teal)]" />
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground mb-1">{statusMessage}</p>
            {phase?.status === 'signing' && (
              <p className="text-sm text-muted-foreground">
                Check your wallet extension for the signature request
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" disabled className="w-full opacity-50">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  // Format deposit with commas
  const formattedDeposit = depositAda.toLocaleString();

  return (
    <div className="space-y-6">
      {/* Deposit amount — large and prominent */}
      <div className="text-center py-6">
        <p className="text-4xl font-display font-bold text-foreground tracking-tight">
          {formattedDeposit} ADA
        </p>
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mt-2">
          Refundable Deposit
        </p>
      </div>

      {/* Warning */}
      <div className="rounded-lg border border-[var(--wayfinder-amber)]/30 bg-[var(--wayfinder-amber)]/5 px-4 py-3">
        <p className="text-sm text-foreground">
          This action is irreversible once confirmed. The deposit will be locked until the proposal
          is ratified or expires.
        </p>
      </div>

      {/* Cooldown timer bar */}
      <div className="space-y-2">
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: cooldownDone ? 'var(--compass-teal)' : 'var(--wayfinder-amber)',
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {cooldownDone ? 'Ready to submit' : `${secondsLeft}s remaining`}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={isProcessing}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!cooldownDone || isProcessing}
          className="flex-1 transition-colors"
          style={
            cooldownDone
              ? { backgroundColor: 'var(--compass-teal)', color: 'var(--primary-foreground)' }
              : undefined
          }
        >
          <Shield className="h-4 w-4 mr-2" />
          Sign &amp; Submit
        </Button>
      </div>
    </div>
  );
}
