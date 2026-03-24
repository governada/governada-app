'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/utils/wallet';
import { subscribeToPush } from '@/lib/pushSubscription';
import { getStoredSession } from '@/lib/supabaseAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Shield,
  Bell,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  skipPushPrompt?: boolean;
}

type Step = 'connect' | 'sign' | 'push' | 'success';

const PREFERRED_WALLETS = ['eternl', 'lace', 'nami', 'typhon', 'vespr'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function sortWallets(wallets: string[]): string[] {
  return [...wallets].sort((a, b) => {
    const aIdx = PREFERRED_WALLETS.indexOf(a.toLowerCase());
    const bIdx = PREFERRED_WALLETS.indexOf(b.toLowerCase());
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function WalletConnectModal({
  open,
  onOpenChange,
  onSuccess,
  skipPushPrompt,
}: WalletConnectModalProps) {
  const {
    connected,
    connecting,
    address,
    error,
    availableWallets,
    connect,
    authenticate,
    clearError,
    disconnect,
  } = useWallet();

  const isMobile = useIsMobile();
  const [step, setStep] = useState<Step>('connect');
  const [authenticating, setAuthenticating] = useState(false);
  const [pushRequested, setPushRequested] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      clearError();
      posthog.capture('wallet_modal_opened', { available_wallets: availableWallets });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- availableWallets is read for analytics only; effect should fire on open/clearError changes
  }, [open, clearError]);

  const handleWalletSelect = async (walletName: string) => {
    posthog.capture('wallet_selected', { wallet_name: walletName });
    clearError();
    setSelectedWallet(walletName);
    try {
      await connect(walletName);
    } catch {
      // connect() sets error state internally via categorizeError;
      // this catch prevents unhandled promise rejections from surfacing as silent failures
    }
  };

  // Auto-authenticate once wallet connects — skip the manual sign step.
  // On mobile: stay on "connect" step visually (shows inline loading) to reduce perceived steps.
  // On desktop: advance to "sign" step for the full verification UI.
  useEffect(() => {
    if (connected && address && !error && step === 'connect') {
      if (!isMobile) setStep('sign');
      // Auto-trigger authentication so user doesn't land in connected-but-not-authenticated state
      (async () => {
        clearError();
        setAuthenticating(true);
        try {
          const success = await authenticate();
          if (success) {
            posthog.capture('wallet_authenticated', { wallet_name: selectedWallet });
            // On mobile, skip push prompt entirely to reduce steps
            setStep(skipPushPrompt || isMobile ? 'success' : 'push');
          }
        } catch {
          // authenticate() sets error state internally; no additional handling needed
        } finally {
          setAuthenticating(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fire only on connection state changes
  }, [connected, address, error, step]);

  const handleTryAgain = async () => {
    clearError();
    if (selectedWallet) {
      try {
        await connect(selectedWallet);
      } catch {
        // connect() sets error state internally
      }
    }
  };

  const handleTryDifferentWallet = () => {
    clearError();
    disconnect();
    setSelectedWallet(null);
    setStep('connect');
  };

  const handleSign = async () => {
    clearError();
    setAuthenticating(true);
    try {
      const success = await authenticate();
      if (success) {
        posthog.capture('wallet_authenticated', { wallet_name: selectedWallet });
        setStep(skipPushPrompt || isMobile ? 'success' : 'push');
      }
    } catch {
      // authenticate() sets error state internally
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePushPrompt = async (enable: boolean) => {
    if (enable && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = getStoredSession();
        if (token) {
          const ok = await subscribeToPush(token);
          if (ok) setPushRequested(true);
        }
      }
    }
    setStep('success');
  };

  const handleClose = () => {
    onOpenChange(false);
    if (step === 'success') {
      onSuccess?.();
    }
    // If user closes before authenticating, disconnect to prevent half-state
    // (connected to wallet extension but no session token)
    if (step === 'sign' || step === 'connect') {
      disconnect();
    }
    setTimeout(() => setStep('connect'), 300);
  };

  // On mobile, auto-close after success to reduce friction
  useEffect(() => {
    if (step === 'success' && isMobile) {
      const timer = setTimeout(handleClose, 1500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleClose is stable enough for this effect
  }, [step, isMobile]);

  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" aria-live="polite">
        {step === 'connect' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Connect Your Wallet
              </DialogTitle>
              <DialogDescription>
                Save your preferences permanently and unlock Governance Guardian status.
              </DialogDescription>
            </DialogHeader>

            {/* Mobile: show inline loading state during auto-authentication */}
            {isMobile && authenticating ? (
              <div className="py-8 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  Verifying ownership — check your wallet app...
                </p>
              </div>
            ) : (
              <>
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Read-only signature verification. We never request transactions or access to
                    your funds.
                  </span>
                </div>

                <div className="space-y-2 py-2">
                  {availableWallets.length > 0 ? (
                    sortWallets(availableWallets).map((walletName) => (
                      <Button
                        key={walletName}
                        variant="outline"
                        className="w-full justify-start gap-2 h-12"
                        onClick={() => handleWalletSelect(walletName)}
                        disabled={connecting}
                      >
                        {connecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wallet className="h-4 w-4" />
                        )}
                        <span className="capitalize">{walletName}</span>
                      </Button>
                    ))
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      <div className="text-muted-foreground">
                        <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-medium text-foreground">No Cardano wallets detected</p>
                        <p className="text-sm mt-1">
                          {isMobile
                            ? 'Open this page in your wallet app\u2019s built-in browser (Eternl, Lace, etc.) to connect.'
                            : 'You need a Cardano wallet extension to connect. We\u2019ll help you get set up.'}
                        </p>
                      </div>
                      <Button asChild className="w-full">
                        <Link href="/help" onClick={() => onOpenChange(false)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Learn how to get a wallet
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div className="space-y-3">
                <div
                  className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">{error.message}</p>
                      <p className="text-xs text-muted-foreground">{error.hint}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleTryAgain}
                    disabled={connecting}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleTryDifferentWallet}
                    disabled={connecting}
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Different Wallet
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'sign' && connected && address && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Verify Ownership
              </DialogTitle>
              <DialogDescription>Sign a message to prove you own this wallet.</DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Connected wallet</p>
                <p className="font-mono text-sm">{shortenAddress(address)}</p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">What to expect:</p>
                <ul className="text-blue-700 dark:text-blue-300 space-y-1 text-xs">
                  <li>&bull; Your wallet will show &quot;Sign in to Governada&quot;</li>
                  <li>&bull; This is free — no ADA will be sent</li>
                  <li>&bull; You can ignore the technical hex codes</li>
                </ul>
              </div>

              <Button className="w-full" onClick={handleSign} disabled={authenticating}>
                {authenticating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Waiting for signature...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Sign & Verify
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="space-y-3">
                <div
                  className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">{error.message}</p>
                      <p className="text-xs text-muted-foreground">{error.hint}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleSign}
                    disabled={authenticating}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleTryDifferentWallet}
                    disabled={authenticating}
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Different Wallet
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'push' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Stay Informed
              </DialogTitle>
              <DialogDescription>
                Get notified when your DReps vote on important proposals.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border text-sm">
                <p className="font-medium mb-1">Mock Alert Preview:</p>
                <p className="text-muted-foreground">
                  &quot;Your DRep voted against Treasury Conservative — see how this affects your
                  alignment&quot;
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handlePushPrompt(false)}
                >
                  Maybe Later
                </Button>
                <Button className="flex-1" onClick={() => handlePushPrompt(true)}>
                  <Bell className="h-4 w-4 mr-2" />
                  Enable Alerts
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-5 w-5" />
                You&apos;re a Governance Guardian!
              </DialogTitle>
            </DialogHeader>

            <div className="py-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
                <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>

              <div className="space-y-2">
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                  <Shield className="h-3 w-3" />
                  Governance Guardian
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Your preferences are now saved permanently.
                  {pushRequested && ' Alerts enabled.'}
                </p>
              </div>

              <Button onClick={handleClose} className="w-full">
                Continue to DReps
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
