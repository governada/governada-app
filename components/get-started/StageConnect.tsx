'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Shield,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Check,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { trackOnboarding, ONBOARDING_EVENTS } from '@/lib/funnel';
import { useWallet } from '@/utils/wallet';
import type { GovernancePassport } from '@/lib/passport';

interface StageConnectProps {
  passport: GovernancePassport;
  onComplete: () => void;
  onGoBack: () => void;
}

export function StageConnect({ passport, onComplete, onGoBack }: StageConnectProps) {
  const {
    connected,
    connecting,
    address,
    error,
    availableWallets,
    connect,
    authenticate,
    isAuthenticated,
    clearError,
  } = useWallet();

  const [authenticating, setAuthenticating] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);

  const isActiveStage = passport.stage === 3;

  // If already connected and authenticated (e.g., returning user), auto-advance
  useEffect(() => {
    if (!isActiveStage) return;
    if (connected && isAuthenticated && !authComplete) {
      setAuthComplete(true);
      trackOnboarding(ONBOARDING_EVENTS.CONNECTED, { source: 'returning_user' });
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, isAuthenticated, isActiveStage]);

  // Auto-authenticate after wallet connects
  useEffect(() => {
    if (!isActiveStage) return;
    if (connected && address && !isAuthenticated && !authenticating && !authComplete && !error) {
      (async () => {
        setAuthenticating(true);
        clearError();
        const success = await authenticate();
        setAuthenticating(false);
        if (success) {
          setAuthComplete(true);
          trackOnboarding(ONBOARDING_EVENTS.CONNECTED, { source: 'fresh_connect' });
          onComplete();
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, address, isAuthenticated, error, isActiveStage]);

  // Already completed — show summary
  if (!isActiveStage) {
    if (passport.connectedAt) {
      return (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.div variants={fadeInUp} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Wallet Connected</h2>
              <p className="text-xs text-muted-foreground">Your wallet is linked to Governada.</p>
            </div>
          </motion.div>
        </motion.div>
      );
    }
    return null;
  }

  const handleConnect = async (walletName: string) => {
    clearError();
    await connect(walletName);
  };

  // No wallets detected
  if (availableWallets.length === 0) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center"
      >
        <motion.div variants={fadeInUp} className="space-y-3 max-w-md">
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
              <AlertCircle className="h-8 w-8 text-amber-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold">No Wallet Detected</h2>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find a Cardano wallet extension in your browser. Make sure you&apos;ve
            installed and enabled it, then refresh the page.
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoBack}
            className="gap-1 text-muted-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to wallet setup
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Show available wallets
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
            <Link2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Link your wallet</h1>
        <p className="text-muted-foreground">
          Connect your wallet so Governada can read your delegation status and voting power.
        </p>
      </motion.div>

      {/* Trust messaging */}
      <motion.div
        variants={fadeInUp}
        className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-950/20 px-4 py-3 max-w-md"
      >
        <Shield className="h-4 w-4 mt-0.5 shrink-0 text-blue-400" />
        <p className="text-xs text-blue-300">
          Read-only connection. We never request transactions or access to your funds.
        </p>
      </motion.div>

      {/* Wallet list */}
      <motion.div variants={fadeInUp} className="w-full max-w-md space-y-2">
        {availableWallets.map((walletName) => (
          <Button
            key={walletName}
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-left"
            onClick={() => handleConnect(walletName)}
            disabled={connecting || authenticating}
          >
            {connecting || authenticating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Wallet className="h-5 w-5" />
            )}
            <div className="flex-1">
              <span className="capitalize font-medium">{walletName}</span>
              {connecting && (
                <span className="block text-xs text-muted-foreground">Connecting...</span>
              )}
              {authenticating && (
                <span className="block text-xs text-muted-foreground">Verifying ownership...</span>
              )}
            </div>
          </Button>
        ))}
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-destructive">{error.message}</p>
                  <p className="text-xs text-muted-foreground">{error.hint}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
