'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Vote,
  Shield,
  ArrowRight,
  Sparkles,
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { trackOnboarding, ONBOARDING_EVENTS } from '@/lib/funnel';
import { useDelegation } from '@/hooks/useDelegation';
import { useWallet } from '@/utils/wallet';
import type { GovernancePassport } from '@/lib/passport';
import dynamic from 'next/dynamic';

const GovernanceRadar = dynamic(
  () => import('@/components/GovernanceRadar').then((m) => ({ default: m.GovernanceRadar })),
  { ssr: false },
);

interface StageDelegateProps {
  passport: GovernancePassport;
  onComplete: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  preflight: 'Checking eligibility...',
  building: 'Preparing transaction...',
  signing: 'Please sign in your wallet...',
  submitting: 'Submitting to the network...',
};

export function StageDelegate({ passport, onComplete }: StageDelegateProps) {
  const { phase, startDelegation, confirmDelegation, reset, isProcessing } = useDelegation();
  const { connected, wallet, delegatedDrepId } = useWallet();

  const drepId = passport.matchedDrepId;
  const drepName = passport.matchedDrepName ?? 'Your Matched DRep';
  const isActiveStage = passport.stage === 4;
  const isAlreadyDelegated = !!delegatedDrepId && delegatedDrepId === drepId;

  // Check if user already delegated to the matched DRep — auto-advance
  useEffect(() => {
    if (isAlreadyDelegated && isActiveStage) {
      trackOnboarding(ONBOARDING_EVENTS.DELEGATED, {
        drep_id: drepId,
        source: 'already_delegated',
      });
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlreadyDelegated, isActiveStage]);

  // Already completed
  if (passport.stage === 'complete') {
    return <WelcomeCitizen passport={passport} />;
  }

  // No matched DRep — show a link to discover
  if (!drepId) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center"
      >
        <motion.div variants={fadeInUp} className="space-y-3 max-w-md">
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Vote className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Find Your Representative</h2>
          <p className="text-sm text-muted-foreground">
            Browse DReps on our discover page to find someone who shares your values, then delegate
            from their profile.
          </p>
        </motion.div>
        <motion.div variants={fadeInUp}>
          <Button asChild className="gap-2">
            <Link href="/discover">
              Browse DReps
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  const handleDelegate = () => {
    if (!connected || !wallet) return;
    startDelegation(drepId);
  };

  const handleConfirm = async () => {
    const result = await confirmDelegation(drepId);
    if (result) {
      trackOnboarding(ONBOARDING_EVENTS.DELEGATED, {
        drep_id: drepId,
        source: 'onboarding_flow',
      });
      onComplete();
    }
  };

  // Success state
  if (phase.status === 'success') {
    return <WelcomeCitizen passport={passport} txHash={phase.txHash} />;
  }

  // Error state
  if (phase.status === 'error') {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center"
      >
        <motion.div variants={fadeInUp} className="space-y-3 max-w-md">
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-destructive">Delegation Failed</h2>
          <p className="text-sm text-muted-foreground">{phase.hint}</p>
        </motion.div>
        <motion.div variants={fadeInUp}>
          <Button onClick={reset} variant="outline" className="gap-2">
            Try Again
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Confirming state — show fee and confirm
  if (phase.status === 'confirming') {
    const { preflight } = phase;
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="flex flex-col items-center justify-center min-h-[60vh] space-y-6"
      >
        <motion.div variants={fadeInUp} className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-bold">Confirm Delegation</h2>
          <p className="text-sm text-muted-foreground">
            Delegate your voting power to <strong>{drepName}</strong>
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="w-full max-w-md">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-xs text-muted-foreground space-y-1.5">
                <p>
                  Transaction fee:{' '}
                  <span className="font-medium text-foreground">{preflight.estimatedFee}</span>
                </p>
                {preflight.needsDeposit && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="flex items-start gap-1 text-amber-600 dark:text-amber-400 cursor-help">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          +2 ADA refundable deposit for stake registration
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-64">
                        Cardano requires a one-time 2 ADA deposit to register your stake key
                        on-chain. This is fully refundable if you ever unregister.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <p className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <Shield className="h-3 w-3 shrink-0" />
                  Your ADA stays in your wallet at all times.
                </p>
                <p>You can change or remove your delegation anytime.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={reset}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 gap-1" onClick={handleConfirm}>
                  <Vote className="h-3.5 w-3.5" />
                  Confirm &amp; Sign
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  // Default: show matched DRep + delegate CTA
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
    >
      <motion.div variants={fadeInUp} className="text-center space-y-2 max-w-md">
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Vote className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Make your voice count</h1>
        <p className="text-muted-foreground">
          By delegating, <strong>{drepName}</strong> votes on your behalf. Your ADA never leaves
          your wallet. You can change anytime.
        </p>
      </motion.div>

      {/* Matched DRep card */}
      <motion.div variants={fadeInUp} className="w-full max-w-md">
        <Card className="border-primary/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              {passport.alignment && (
                <GovernanceRadar alignments={passport.alignment} size="mini" animate={false} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{drepName}</p>
                {passport.matchScore != null && (
                  <Badge variant="secondary" className="mt-1">
                    {passport.matchScore}% match
                  </Badge>
                )}
              </div>
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleDelegate}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {PHASE_LABELS[phase.status] || 'Processing...'}
                </>
              ) : (
                <>
                  <Vote className="h-4 w-4" />
                  Delegate to {drepName}
                </>
              )}
            </Button>

            <p className="flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Shield className="h-3 w-3" />
              Your ADA stays in your wallet.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* View profile link */}
      <motion.div variants={fadeInUp}>
        <Link
          href={`/drep/${encodeURIComponent(drepId)}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          View full profile
          <ExternalLink className="h-3 w-3" />
        </Link>
      </motion.div>
    </motion.div>
  );
}

/* ── Welcome Citizen — Post-delegation celebration ──────────────── */

function WelcomeCitizen({ passport, txHash }: { passport: GovernancePassport; txHash?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center"
    >
      <motion.div variants={fadeInUp} className="space-y-3 max-w-md">
        <div className="flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Sparkles className="h-10 w-10 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, Citizen</h1>
        <p className="text-muted-foreground">
          Your governance voice is now active.{' '}
          {passport.matchedDrepName && (
            <>
              <strong>{passport.matchedDrepName}</strong> votes on your behalf.
            </>
          )}
        </p>
      </motion.div>

      {passport.alignment && (
        <motion.div variants={fadeInUp}>
          <GovernanceRadar alignments={passport.alignment} size="medium" animate />
        </motion.div>
      )}

      <motion.div variants={fadeInUp}>
        <Card className="border-emerald-500/20 bg-emerald-950/5 max-w-md">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">
                Governance Passport Activated
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your DRep votes on your behalf. Check your briefing every epoch (~5 days) to stay
              informed about governance decisions.
            </p>
            {txHash && (
              <a
                href={`https://cardanoscan.io/transaction/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View transaction <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Button asChild size="lg" className="gap-2">
          <Link href="/">
            Go to my Hub
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}
