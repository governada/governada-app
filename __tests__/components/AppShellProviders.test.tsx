import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShellProviders } from '@/components/governada/AppShellProviders';
import { useMode } from '@/components/providers/ModeProvider';
import { useShortcuts } from '@/components/governada/ShortcutProvider';

vi.mock('next/navigation', () => ({
  usePathname: () => '/workspace',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/FeatureGate', () => ({
  useFeatureFlag: (flag: string) => (flag === 'keyboard_shortcuts' ? true : false),
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/components/governada/ShortcutOverlay', () => ({
  ShortcutOverlay: () => <div data-testid="shortcut-overlay" />,
}));

function ProviderProbe() {
  const { mode, isAutoSelected } = useMode();
  const { enabled } = useShortcuts();

  return (
    <div
      data-testid="provider-probe"
      data-mode={mode}
      data-auto={String(isAutoSelected)}
      data-shortcuts={String(enabled)}
    />
  );
}

describe('AppShellProviders', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('attaches workflow providers only for app-shell layouts', () => {
    render(
      <AppShellProviders>
        <ProviderProbe />
      </AppShellProviders>,
    );

    const probe = screen.getByTestId('provider-probe');
    expect(probe.getAttribute('data-mode')).toBe('work');
    expect(probe.getAttribute('data-auto')).toBe('true');
    expect(probe.getAttribute('data-shortcuts')).toBe('true');
    expect(screen.getByTestId('shortcut-overlay')).toBeTruthy();
  });
});
