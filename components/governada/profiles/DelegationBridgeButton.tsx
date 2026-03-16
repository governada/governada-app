'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Vote, Loader2, CheckCircle, ExternalLink, AlertTriangle, Shield } from 'lucide-react';
import { useDelegation, type DelegationPhase } from '@/hooks/useDelegation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { type AlignmentScores } from '@/lib/drepIdentity';

const DelegationCeremony = dynamic(
  () => import('@/components/DelegationCeremony').then((m) => m.DelegationCeremony),
  { ssr: false },
);

interface DelegationBridgeButtonProps {
  drepId: string;
  drepName: string;
}

const PHASE_LABELS: Record<string, string> = {
  preflight: 'Checking eligibility...',
  building: 'Preparing transaction...',
  signing: 'Please sign in your wallet...',
  submitting: 'Submitting to the network...',
};

/**
 * Compact delegation button that opens a Sheet for the full delegation flow.
 * Replaces InlineDelegationCTA in the discovery/action split layout.
 */
export function DelegationBridgeButton({ drepId, drepName }: DelegationBridgeButtonProps) {
  const {
    phase,
    startDelegation,
    confirmDelegation,
    reset,
    isProcessing,
    delegatedDrepId,
    canDelegate,
  } = useDelegation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);
  const [ceremonyScore, setCeremonyScore] = useState(0);
  const [ceremonyAlignments, setCeremonyAlignments] = useState<AlignmentScores | undefined>(
    undefined,
  );

  const isAlreadyDelegated = !!delegatedDrepId && delegatedDrepId === drepId;

  const handleClick = () => {
    if (!canDelegate) {
      window.dispatchEvent(new Event('openWalletConnect'));
      return;
    }
    if (isAlreadyDelegated) return;
    setSheetOpen(true);
    startDelegation(drepId);
  };

  const handleConfirm = async () => {
    const result = await confirmDelegation(drepId);
    if (result) {
      fetch(`/api/dreps/${encodeURIComponent(drepId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.drepScore) setCeremonyScore(data.drepScore);
          if (data?.alignmentTreasuryConservative != null) {
            setCeremonyAlignments({
              treasuryConservative: data.alignmentTreasuryConservative ?? 50,
              treasuryGrowth: data.alignmentTreasuryGrowth ?? 50,
              decentralization: data.alignmentDecentralization ?? 50,
              security: data.alignmentSecurity ?? 50,
              innovation: data.alignmentInnovation ?? 50,
              transparency: data.alignmentTransparency ?? 50,
            });
          }
        })
        .catch(() => {});
      setShowCeremony(true);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setSheetOpen(false);
      if (phase.status !== 'success') reset();
    }
  };

  const handleCeremonyDone = () => {
    setShowCeremony(false);
    setSheetOpen(false);
  };

  // Already delegated — show static badge
  if (isAlreadyDelegated && phase.status !== 'success') {
    return (
      <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" disabled>
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        Delegating
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant={delegatedDrepId ? 'outline' : 'default'}
        className="gap-1.5"
        onClick={handleClick}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Vote className="h-3.5 w-3.5" />
        )}
        {delegatedDrepId ? 'Switch DRep' : 'Delegate'}
      </Button>

      <Sheet open={sheetOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Delegate to {drepName}</SheetTitle>
            <SheetDescription>
              Your voting power will be assigned to this representative.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 pt-2">
            <SheetBody
              phase={phase}
              drepId={drepId}
              drepName={drepName}
              onConfirm={handleConfirm}
              onReset={reset}
              isProcessing={isProcessing}
              showCeremony={showCeremony}
              ceremonyScore={ceremonyScore}
              ceremonyAlignments={ceremonyAlignments}
              onCeremonyDone={handleCeremonyDone}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Inner content of the delegation Sheet, branching on phase. */
function SheetBody({
  phase,
  drepId,
  drepName,
  onConfirm,
  onReset,
  isProcessing,
  showCeremony,
  ceremonyScore,
  ceremonyAlignments,
  onCeremonyDone,
}: {
  phase: DelegationPhase;
  drepId: string;
  drepName: string;
  onConfirm: () => void;
  onReset: () => void;
  isProcessing: boolean;
  showCeremony: boolean;
  ceremonyScore: number;
  ceremonyAlignments?: AlignmentScores;
  onCeremonyDone: () => void;
}) {
  // Success with ceremony
  if (phase.status === 'success' && showCeremony) {
    return (
      <DelegationCeremony
        drepId={drepId}
        drepName={drepName}
        score={ceremonyScore || 0}
        alignments={ceremonyAlignments}
        onContinue={onCeremonyDone}
      />
    );
  }

  // Success without ceremony
  if (phase.status === 'success') {
    return (
      <div className="space-y-3 text-center py-6">
        <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {phase.confirmed ? 'Delegation confirmed on-chain!' : 'Delegation submitted!'}
        </p>
        <p className="text-xs text-muted-foreground">
          {phase.confirmed
            ? 'Your voting power will be active with this DRep next epoch.'
            : 'Waiting for on-chain confirmation...'}
        </p>
        <a
          href={`https://cardanoscan.io/transaction/${phase.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View transaction <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  // Error
  if (phase.status === 'error') {
    return (
      <div className="space-y-3 text-center py-6">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{phase.hint}</p>
        {phase.code !== 'user_rejected' && (
          <p className="text-xs text-muted-foreground">{phase.message}</p>
        )}
        <Button variant="outline" size="sm" onClick={onReset}>
          Try Again
        </Button>
      </div>
    );
  }

  // Confirming
  if (phase.status === 'confirming') {
    const { preflight } = phase;
    return (
      <div className="space-y-4 py-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Your voting power will be assigned to this DRep. You can change anytime.</p>
          <p>
            Transaction fee:{' '}
            <span className="font-medium text-foreground">{preflight.estimatedFee}</span>
          </p>
          {preflight.needsDeposit && (
            <p className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              Includes a 2 ADA refundable deposit for stake registration.
            </p>
          )}
          <p className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            <Shield className="h-3 w-3 shrink-0" />
            Your ADA stays in your wallet at all times.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onReset}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 gap-1" onClick={onConfirm}>
            <Vote className="h-3.5 w-3.5" />
            Confirm &amp; Sign
          </Button>
        </div>
      </div>
    );
  }

  // Processing (preflight/building/signing/submitting)
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {PHASE_LABELS[phase.status] || 'Processing...'}
        </p>
      </div>
    );
  }

  // Idle fallback (brief flash while preflight starts)
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Starting...</p>
    </div>
  );
}
