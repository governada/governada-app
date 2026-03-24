'use client';

import { useDelegation } from '@/hooks/useDelegation';
import { Button } from '@/components/ui/button';
import {
  Vote,
  Wallet,
  CheckCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { DelegationRisksModal } from './InfoModal';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DelegationCeremony = dynamic(
  () => import('./DelegationCeremony').then((m) => m.DelegationCeremony),
  { ssr: false },
);

import { type AlignmentScores } from '@/lib/drepIdentity';

interface InlineDelegationCTAProps {
  drepId: string;
  drepName: string;
}

const PHASE_LABELS: Record<string, string> = {
  preflight: 'Checking eligibility...',
  building: 'Preparing transaction...',
  signing: 'Please sign in your wallet...',
  submitting: 'Submitting to the network...',
};

export function InlineDelegationCTA({ drepId, drepName }: InlineDelegationCTAProps) {
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
  const [ceremonyAlignments, setCeremonyAlignments] = useState<AlignmentScores | undefined>(
    undefined,
  );

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

  // Already delegated to this DRep
  if (isAlreadyDelegated && phase.status !== 'success') {
    return (
      <div className="flex flex-col gap-2 p-4 border border-primary/20 rounded-lg bg-primary/5 text-center">
        <CheckCircle className="h-5 w-5 text-primary mx-auto" />
        <p className="text-sm font-medium">You&apos;re delegating to this DRep</p>
        <p className="text-xs text-muted-foreground">
          Your ADA voting power is already with this DRep.
        </p>
      </div>
    );
  }

  // Success -- show delegation ceremony overlay or simple message
  if (phase.status === 'success') {
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

    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
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
      </div>
    );
  }

  // Error state
  if (phase.status === 'error') {
    return (
      <div className="flex flex-col gap-2 p-4 border border-destructive/20 rounded-lg bg-destructive/5 text-center">
        <p className="text-sm text-destructive">{phase.hint}</p>
        {phase.code !== 'user_rejected' && (
          <p className="text-xs text-muted-foreground">{phase.message}</p>
        )}
        <Button variant="outline" size="sm" onClick={reset}>
          Try Again
        </Button>
      </div>
    );
  }

  // Confirmation step -- user reviews before wallet popup
  if (phase.status === 'confirming') {
    const { preflight } = phase;
    return (
      <div className="flex flex-col gap-3 p-4 border border-primary/20 rounded-lg bg-card">
        <div className="space-y-2">
          <p className="text-sm font-medium">Delegate to {drepName}</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Your voting power will be assigned to this DRep. You can change anytime.</p>
            <p>
              Transaction fee:{' '}
              <span className="font-medium text-foreground">{preflight.estimatedFee}</span>
            </p>
            {preflight.needsDeposit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="flex items-start gap-1 text-amber-600 dark:text-amber-400 cursor-help">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      Includes a 2 ADA refundable deposit for stake registration.
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64">
                    Cardano requires a one-time 2 ADA deposit to register your stake key on-chain.
                    This is fully refundable if you ever unregister. Your remaining ADA stays in
                    your wallet and is never locked.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <p className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <Shield className="h-3 w-3 shrink-0" />
              Your ADA stays in your wallet at all times.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={reset}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 gap-1" onClick={handleConfirm}>
            <Vote className="h-3.5 w-3.5" />
            Confirm &amp; Sign
          </Button>
        </div>
      </div>
    );
  }

  // Default: delegate action button
  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
      <Button onClick={handleDelegate} disabled={isProcessing} className="gap-2 w-full" size="lg">
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {PHASE_LABELS[phase.status] || 'Processing...'}
          </>
        ) : canDelegate ? (
          <>
            <Vote className="h-4 w-4" />
            {delegatedDrepId ? 'Switch to this DRep' : 'Delegate to this DRep'}
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            Connect wallet to delegate
          </>
        )}
      </Button>
      {!canDelegate && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Delegation lets this DRep vote on your behalf. You keep full control of your ADA and can
            change or remove your delegation at any time.
          </p>
          <p className="text-center">
            <Link
              href="/help"
              className="text-xs text-primary/80 hover:text-primary hover:underline transition-colors"
            >
              Need help getting set up? &rarr;
            </Link>
          </p>
        </div>
      )}
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <Shield className="h-3 w-3 shrink-0" />
          Your ADA stays in your wallet.
        </span>
        <DelegationRisksModal />
      </div>
    </div>
  );
}
