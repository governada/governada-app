'use client';

import { useDelegation } from '@/hooks/useDelegation';
import { Button } from '@/components/ui/button';
import {
  Vote,
  Wallet,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DelegationCeremony = dynamic(
  () => import('./DelegationCeremony').then((m) => m.DelegationCeremony),
  { ssr: false },
);

interface DelegateButtonProps {
  drepId: string;
  drepName: string;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

const PHASE_LABELS: Record<string, string> = {
  preflight: 'Checking...',
  building: 'Preparing...',
  signing: 'Sign in wallet...',
  submitting: 'Submitting...',
};

export function DelegateButton({ drepId, drepName, size = 'sm', className }: DelegateButtonProps) {
  const {
    phase,
    startDelegation,
    confirmDelegation,
    reset,
    isProcessing,
    delegatedDrepId,
    canDelegate,
  } = useDelegation();

  const [showCeremony, setShowCeremony] = useState(false);
  const [ceremonyScore, setCeremonyScore] = useState(0);
  const [ceremonyAlignments, setCeremonyAlignments] = useState<AlignmentScores | undefined>();

  const isAlreadyDelegated = !!delegatedDrepId && delegatedDrepId === drepId;

  const handleDelegate = () => {
    if (!canDelegate) {
      window.dispatchEvent(new Event('openWalletConnect'));
      return;
    }
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

  // Ceremony overlay
  if (showCeremony) {
    return (
      <DelegationCeremony
        drepId={drepId}
        drepName={drepName}
        score={ceremonyScore || 0}
        alignments={ceremonyAlignments}
        onContinue={() => setShowCeremony(false)}
      />
    );
  }

  // Already delegated
  if (isAlreadyDelegated && phase.status !== 'success') {
    return (
      <Button variant="outline" size={size} className={cn('gap-1.5', className)} disabled>
        <CheckCircle className="h-3.5 w-3.5 text-primary" />
        Delegating
      </Button>
    );
  }

  // Success
  if (phase.status === 'success') {
    return (
      <div className="flex flex-col gap-1.5">
        <Button variant="outline" size={size} className={cn('gap-1.5', className)} disabled>
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          {phase.confirmed ? 'Delegated!' : 'Submitted!'}
        </Button>
        <a
          href={`https://cardanoscan.io/transaction/${phase.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors justify-center"
        >
          View tx <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    );
  }

  // Error
  if (phase.status === 'error') {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-destructive text-center">{phase.hint}</p>
        <Button variant="outline" size={size} className={cn('gap-1.5', className)} onClick={reset}>
          Try Again
        </Button>
      </div>
    );
  }

  // Confirming -- show fee and confirm/cancel
  if (phase.status === 'confirming') {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-primary/20 bg-card">
        <p className="text-xs font-medium">Delegate to {drepName}</p>
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p>
            Fee: <span className="font-medium text-foreground">{phase.preflight.estimatedFee}</span>
          </p>
          {phase.preflight.needsDeposit && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400 cursor-help">
                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                    +2 ADA refundable deposit
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-64">
                  Cardano requires a one-time 2 ADA deposit to register your stake key on-chain.
                  This is fully refundable if you ever unregister. Your remaining ADA stays in your
                  wallet and is never locked.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <p className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            <Shield className="h-2.5 w-2.5 shrink-0" />
            Your ADA stays in your wallet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={reset}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={handleConfirm}>
            <Vote className="h-3 w-3" /> Confirm
          </Button>
        </div>
      </div>
    );
  }

  // Processing
  if (isProcessing) {
    return (
      <Button size={size} className={cn('gap-1.5', className)} disabled>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {PHASE_LABELS[phase.status] || 'Processing...'}
      </Button>
    );
  }

  // Default: delegate button
  return (
    <Button size={size} className={cn('gap-1.5', className)} onClick={handleDelegate}>
      {canDelegate ? (
        <>
          <Vote className="h-3.5 w-3.5" />
          {delegatedDrepId ? 'Switch DRep' : 'Delegate'}
        </>
      ) : (
        <>
          <Wallet className="h-3.5 w-3.5" />
          Connect & Delegate
        </>
      )}
    </Button>
  );
}
