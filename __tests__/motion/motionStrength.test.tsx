import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOTION_STRENGTH_USER_OVERRIDE_KEY,
  MotionStrengthProvider,
  useMotionStrength,
  useMotionStrengthSetter,
} from '@/lib/motion/motionStrength';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockLocalStorage() {
  let store: Record<string, string> = {};
  const storage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

function StrengthValue() {
  const strength = useMotionStrength();
  return <div data-testid="strength">{strength}</div>;
}

function StrengthControls() {
  const strength = useMotionStrength();
  const { userOverride, setUserOverride } = useMotionStrengthSetter();

  return (
    <div>
      <div data-testid="strength">{strength}</div>
      <div data-testid="override">{userOverride}</div>
      <button type="button" onClick={() => setUserOverride('auto')}>
        auto
      </button>
      <button type="button" onClick={() => setUserOverride('full')}>
        full
      </button>
      <button type="button" onClick={() => setUserOverride('suspended')}>
        suspended
      </button>
    </div>
  );
}

describe('MotionStrengthProvider', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('defaults to 1.0 when no stored value and prefers-reduced-motion is no-preference', async () => {
    mockMatchMedia(false);

    render(
      <MotionStrengthProvider>
        <StrengthValue />
      </MotionStrengthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('1'));
  });

  it('defaults to 0.05 when no stored value and prefers-reduced-motion is reduce', async () => {
    mockMatchMedia(true);

    render(
      <MotionStrengthProvider>
        <StrengthValue />
      </MotionStrengthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0.05'));
  });

  it('persists full-motion override and updates consumers', async () => {
    mockMatchMedia(false);

    render(
      <MotionStrengthProvider>
        <StrengthControls />
      </MotionStrengthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'full' }));

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('1'));
    expect(screen.getByTestId('override').textContent).toBe('full');
    expect(localStorage.getItem(MOTION_STRENGTH_USER_OVERRIDE_KEY)).toBe('full');
  });

  it('auto override continues to respect prefers-reduced-motion', async () => {
    mockMatchMedia(true);

    render(
      <MotionStrengthProvider>
        <StrengthControls />
      </MotionStrengthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'auto' }));
    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0.05'));
    expect(localStorage.getItem(MOTION_STRENGTH_USER_OVERRIDE_KEY)).toBe('auto');
  });

  it('persists fully suspended motion and restores it after remount', async () => {
    mockMatchMedia(false);

    const { unmount } = render(
      <MotionStrengthProvider>
        <StrengthControls />
      </MotionStrengthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'suspended' }));

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0'));
    expect(localStorage.getItem(MOTION_STRENGTH_USER_OVERRIDE_KEY)).toBe('suspended');

    unmount();

    render(
      <MotionStrengthProvider>
        <StrengthValue />
      </MotionStrengthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0'));
  });

  it('migrates a legacy zero-strength value to suspended', async () => {
    mockMatchMedia(false);
    localStorage.setItem('governada_motion_strength', '0');

    render(
      <MotionStrengthProvider>
        <StrengthControls />
      </MotionStrengthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0'));
    expect(screen.getByTestId('override').textContent).toBe('suspended');
  });
});
