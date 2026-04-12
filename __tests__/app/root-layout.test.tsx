import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectionMock = vi.fn();

vi.mock('next/server', () => ({
  connection: connectionMock,
}));

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'font-geist' }),
  Space_Grotesk: () => ({ variable: 'font-space-grotesk' }),
  Fraunces: () => ({ variable: 'font-fraunces' }),
}));

vi.mock('@/components/Providers', () => ({
  Providers: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/BrandedLoader', () => ({
  BrandedLoader: () => <div data-testid="branded-loader" />,
}));

vi.mock('@/components/NavDirectionProvider', () => ({
  NavDirectionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/providers/CommandProvider', () => ({
  CommandProvider: () => <div data-testid="command-provider" />,
}));

vi.mock('@/components/InstallPrompt', () => ({
  InstallPrompt: () => <div data-testid="install-prompt" />,
}));

vi.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: () => <div data-testid="offline-banner" />,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('@/components/governada/GovernadaShell', () => ({
  GovernadaShell: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/GovernanceFontProvider', () => ({
  GovernanceFontProvider: () => <div data-testid="governance-font-provider" />,
}));

vi.mock('@/components/providers/LocaleProvider', () => ({
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));

const { default: RootLayout, dynamic } = await import('@/app/layout');

describe('RootLayout', () => {
  beforeEach(() => {
    connectionMock.mockReset();
    connectionMock.mockResolvedValue(undefined);
  });

  it('declares the root shell as request-bound', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('binds the root app shell to the request connection', async () => {
    const tree = await RootLayout({
      children: <div data-testid="app-child">App content</div>,
    });

    expect(connectionMock).toHaveBeenCalledOnce();
    expect(tree.type).toBe('html');
    expect(tree.props.lang).toBe('en');
  });
});
