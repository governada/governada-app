'use client';

import { useEffect, useCallback } from 'react';
import { Loader2, QrCode, RefreshCw, Smartphone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePeerConnect } from '@/hooks/usePeerConnect';

interface PeerConnectPanelProps {
  onConnected: (walletName: string) => void;
  onCancel: () => void;
  isMobile: boolean;
}

const MOBILE_WALLETS = [
  { name: 'eternl', label: 'Eternl' },
  { name: 'vespr', label: 'Vespr' },
  { name: 'typhon', label: 'Typhon' },
] as const;

export function PeerConnectPanel({ onConnected, onCancel, isMobile }: PeerConnectPanelProps) {
  const { status, connectedWalletName, error, qrContainerRef, init, reset, getDeepLinkUri } =
    usePeerConnect();

  // Initialize on mount
  useEffect(() => {
    init();
  }, [init]);

  // Notify parent when connected
  useEffect(() => {
    if (status === 'connected' && connectedWalletName) {
      onConnected(connectedWalletName);
    }
  }, [status, connectedWalletName, onConnected]);

  const handleRetry = useCallback(() => {
    reset();
    // Small delay to allow cleanup before reinitializing
    setTimeout(() => init(), 100);
  }, [reset, init]);

  const handleDeepLink = useCallback(
    (walletName: string) => {
      const uri = getDeepLinkUri();
      if (uri) {
        import('@/lib/posthog')
          .then(({ posthog }) => {
            posthog.capture('peer_connect_initiated', {
              method: 'deeplink',
              device: 'mobile',
              wallet: walletName,
            });
          })
          .catch(() => {});

        window.location.href = uri;
      }
    },
    [getDeepLinkUri],
  );

  // Track QR view
  useEffect(() => {
    if (status === 'waiting' && !isMobile) {
      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('peer_connect_initiated', {
            method: 'qr',
            device: 'desktop',
          });
        })
        .catch(() => {});
    }
  }, [status, isMobile]);

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <Smartphone className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">Connect your wallet app</p>
          <p className="text-xs text-muted-foreground">
            Tap a wallet to open it and establish a secure connection
          </p>
        </div>

        {(status === 'initializing' || status === 'idle') && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Preparing connection...</span>
          </div>
        )}

        {(status === 'waiting' || status === 'connected') && (
          <div className="space-y-2">
            {MOBILE_WALLETS.map(({ name, label }) => (
              <Button
                key={name}
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => handleDeepLink(name)}
              >
                <Wallet className="h-5 w-5" />
                <span>Connect with {label}</span>
              </Button>
            ))}
          </div>
        )}

        {status === 'waiting' && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">
              Waiting for wallet connection...
            </span>
          </div>
        )}

        {(status === 'error' || status === 'timeout') && (
          <div className="text-center space-y-3">
            <p className="text-sm text-destructive">
              {status === 'timeout' ? 'Connection timed out' : error || 'Connection failed'}
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Try again
            </Button>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Or open <span className="font-medium text-foreground">governada.io</span> in your wallet
            app&apos;s built-in browser
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }

  // Desktop: QR code mode
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <QrCode className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Scan with your wallet app</p>
        <p className="text-xs text-muted-foreground">
          Open your Cardano wallet on your phone and scan this QR code
        </p>
      </div>

      {/* QR Code container */}
      <div className="flex items-center justify-center min-h-[200px]">
        {status === 'initializing' && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Generating QR code...</span>
          </div>
        )}
        <div
          ref={qrContainerRef}
          className={`[&_svg]:w-48 [&_svg]:h-48 [&_svg]:mx-auto ${
            status === 'initializing' ? 'hidden' : ''
          }`}
        />
      </div>

      {status === 'waiting' && (
        <div className="flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">
            Waiting for wallet connection...
          </span>
        </div>
      )}

      {status === 'connected' && (
        <div className="text-center">
          <p className="text-sm text-green-400 font-medium">Wallet connected!</p>
        </div>
      )}

      {(status === 'error' || status === 'timeout') && (
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">
            {status === 'timeout'
              ? 'Connection timed out. Make sure your wallet app supports CIP-45.'
              : error || 'Failed to establish connection'}
          </p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Generate new QR code
          </Button>
        </div>
      )}

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Works with Eternl, Vespr, and other CIP-45 compatible wallets
        </p>
      </div>

      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onCancel}>
        Use a browser extension instead
      </Button>
    </div>
  );
}
