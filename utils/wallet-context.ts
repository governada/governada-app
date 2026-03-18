'use client';

/**
 * Wallet context definition and consumer hook.
 *
 * Separated from wallet.tsx so that components needing only the consumer
 * (useWallet) don't pull in @meshsdk/core and its native dependencies.
 * The heavy WalletProvider stays in wallet.tsx.
 */

import { createContext, useContext } from 'react';
import type { BrowserWallet } from '@meshsdk/core';

export type WalletErrorType =
  | 'no_addresses'
  | 'extension_error'
  | 'user_rejected'
  | 'network'
  | 'unknown';

export interface WalletError {
  type: WalletErrorType;
  message: string;
  hint: string;
}

export interface WalletContextType {
  wallet: BrowserWallet | null;
  walletName: string | null;
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  address: string | null;
  userId: string | null;
  sessionAddress: string | null;
  isAuthenticated: boolean;
  delegatedDrepId: string | null;
  ownDRepId: string | null;
  balanceAda: number | null;
  error: WalletError | null;
  availableWallets: string[];
  connectMethod: 'extension' | 'peer' | null;
  connect: (walletName: string) => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<{ signature: string; key: string } | null>;
  authenticate: () => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  refreshDelegation: () => void;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
