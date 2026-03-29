import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock wallet-context FIRST (before any imports that depend on it)
vi.mock('@/utils/wallet-context', () => ({
  useWallet: () => ({
    address: null,
    stakeAddress: null,
    connected: false,
    connecting: false,
  }),
  WalletContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

vi.mock('@/utils/wallet', () => ({
  useWallet: () => ({
    availableWallets: ['eternl', 'lace'],
    connect: vi.fn(),
    authenticate: vi.fn(),
    clearError: vi.fn(),
    connected: false,
    connecting: false,
    isAuthenticated: false,
    error: null,
    address: null,
    stakeAddress: null,
  }),
  WalletError: class extends Error {},
}));

vi.mock('@/lib/pushSubscription', () => ({
  subscribeToPush: vi.fn(),
}));

vi.mock('@/lib/supabaseAuth', () => ({
  getStoredSession: vi.fn(() => null),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: vi.fn() },
}));

vi.mock('@/hooks/usePeerConnect', () => ({
  usePeerConnect: () => ({
    qrCode: null,
    status: 'idle',
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: Record<string, unknown>) => (
    <button {...props}>{children as React.ReactNode}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// Import AFTER all mocks
const { WalletConnectModal } = await import('@/components/WalletConnectModal');

describe('WalletConnectModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<WalletConnectModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('dialog')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(<WalletConnectModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });
});
