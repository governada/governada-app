'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface DAppPeerConnectInstance {
  shutdownServer: () => void;
  generateQRCode: (canvas: HTMLElement) => void;
  getConnectedWallet: () => string | null;
  getAddress: () => string;
  getSeed: () => string;
}

interface WalletInfo {
  address?: string;
  name: string;
  version: string;
  icon: string;
  requestAutoconnect?: boolean;
}

type PeerConnectStatus = 'idle' | 'initializing' | 'waiting' | 'connected' | 'error' | 'timeout';

interface UsePeerConnectReturn {
  status: PeerConnectStatus;
  address: string | null;
  connectedWalletName: string | null;
  error: string | null;
  qrContainerRef: React.RefObject<HTMLDivElement | null>;
  init: () => Promise<void>;
  reset: () => void;
  destroy: () => void;
  getDeepLinkUri: () => string | null;
}

const ANNOUNCE_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.btorrent.xyz',
];

const CONNECTION_TIMEOUT_MS = 60_000;
const SEED_KEY = 'governada_peer_connect_seed';

export function usePeerConnect(): UsePeerConnectReturn {
  const [status, setStatus] = useState<PeerConnectStatus>('idle');
  const [address, setAddress] = useState<string | null>(null);
  const [connectedWalletName, setConnectedWalletName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<DAppPeerConnectInstance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (instanceRef.current) {
      try {
        instanceRef.current.shutdownServer();
      } catch {
        // ignore shutdown errors
      }
      instanceRef.current = null;
    }
  }, []);

  const init = useCallback(async () => {
    cleanup();
    setStatus('initializing');
    setError(null);
    setConnectedWalletName(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const peerConnectModule: any = await import('@fabianbormann/cardano-peer-connect');
      const DAppPeerConnect = peerConnectModule.DAppPeerConnect as new (
        params: Record<string, unknown>,
      ) => DAppPeerConnectInstance;

      // Reuse seed for consistent identity across sessions
      const seed = localStorage.getItem(SEED_KEY) ?? undefined;

      const dAppConnect = new DAppPeerConnect({
        dAppInfo: {
          name: 'Governada',
          url: 'https://governada.io',
        },
        seed,
        announce: ANNOUNCE_TRACKERS,
        verifyConnection: (
          _walletInfo: WalletInfo,
          callback: (granted: boolean, allowAutoConnect: boolean) => void,
        ) => {
          callback(true, true);
        },
        onApiInject: (name: string, _address: string) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setConnectedWalletName(name);
          setStatus('connected');

          // Track connection time for analytics
          const connectionTimeMs = Date.now() - initTimeRef.current;
          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('peer_connect_connected', {
                wallet_name: name,
                connection_time_ms: connectionTimeMs,
              });
            })
            .catch(() => {});
        },
        onApiEject: (name: string, _address: string) => {
          setConnectedWalletName(null);
          setStatus('idle');

          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('peer_connect_disconnected', {
                wallet_name: name,
              });
            })
            .catch(() => {});
        },
        onDisconnect: () => {
          setConnectedWalletName(null);
          setStatus('idle');
        },
      });

      instanceRef.current = dAppConnect;

      // Store seed for future sessions
      const generatedSeed = dAppConnect.getSeed();
      if (generatedSeed) {
        localStorage.setItem(SEED_KEY, generatedSeed);
      }

      const addr = dAppConnect.getAddress();
      setAddress(addr);

      // Render QR code
      if (qrContainerRef.current) {
        qrContainerRef.current.innerHTML = '';
        dAppConnect.generateQRCode(qrContainerRef.current);
      }

      initTimeRef.current = Date.now();
      setStatus('waiting');

      // Connection timeout
      timeoutRef.current = setTimeout(() => {
        setStatus('timeout');
        import('@/lib/posthog')
          .then(({ posthog }) => {
            posthog.capture('peer_connect_failed', { reason: 'timeout' });
          })
          .catch(() => {});
      }, CONNECTION_TIMEOUT_MS);
    } catch (err) {
      console.error('Peer connect initialization error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to initialize connection');

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('peer_connect_failed', {
            reason: 'init_error',
            error: err instanceof Error ? err.message : String(err),
          });
        })
        .catch(() => {});
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setStatus('idle');
    setAddress(null);
    setConnectedWalletName(null);
    setError(null);
    if (qrContainerRef.current) {
      qrContainerRef.current.innerHTML = '';
    }
  }, [cleanup]);

  const destroy = useCallback(() => {
    reset();
  }, [reset]);

  const getDeepLinkUri = useCallback((): string | null => {
    if (!address) return null;
    return `web+cardano://connect/v1?identifier=${encodeURIComponent(address)}`;
  }, [address]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    address,
    connectedWalletName,
    error,
    qrContainerRef,
    init,
    reset,
    destroy,
    getDeepLinkUri,
  };
}
