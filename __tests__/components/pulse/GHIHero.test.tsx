import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    circle: (props: Record<string, unknown>) => <circle {...(props as object)} />,
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  TrendingUp: ({ className }: { className?: string }) => (
    <span data-testid="icon-trending-up" className={className} />
  ),
  TrendingDown: ({ className }: { className?: string }) => (
    <span data-testid="icon-trending-down" className={className} />
  ),
  Minus: ({ className }: { className?: string }) => (
    <span data-testid="icon-minus" className={className} />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@/components/ui/ErrorCard', () => ({
  ErrorCard: ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
    <div data-testid="error-card" role="alert">
      <p>{message}</p>
      {onRetry && <button onClick={onRetry}>Try again</button>}
    </div>
  ),
}));

vi.mock('@/lib/animations', () => ({
  spring: { smooth: {} },
}));

const mockUseGovernanceHealthIndex = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useGovernanceHealthIndex: (...args: unknown[]) => mockUseGovernanceHealthIndex(...args),
}));

import { GHIHero } from '@/components/civica/pulse/GHIHero';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GHIHero', () => {
  it('shows skeleton loading state when data is loading', () => {
    mockUseGovernanceHealthIndex.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    render(<GHIHero />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows ErrorCard with unavailable message on error', () => {
    mockUseGovernanceHealthIndex.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    render(<GHIHero />);
    const errorCard = screen.getByTestId('error-card');
    expect(errorCard).toBeDefined();
    expect(errorCard.textContent).toContain('Governance Health temporarily unavailable.');
  });

  it('renders score, band label, and trend for valid GHI data', () => {
    mockUseGovernanceHealthIndex.mockReturnValue({
      data: {
        current: { score: 72, band: 'good' },
        trend: { direction: 'up', delta: 3.5, streakEpochs: 2 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = render(<GHIHero />);

    // Score
    expect(container.textContent).toContain('72');
    // Band label
    expect(container.textContent).toContain('Good');
    // Trend delta
    expect(container.textContent).toContain('+3.5');
    // Streak label
    expect(container.textContent).toContain('2-epoch climb');
    // Aria label on meter
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('72');
    expect(meter.getAttribute('aria-label')).toBe('Governance Health Index: 72 out of 100');
  });

  it('adds ring glow class when band is "strong"', () => {
    mockUseGovernanceHealthIndex.mockReturnValue({
      data: {
        current: { score: 88, band: 'strong' },
        trend: { direction: 'flat', delta: 0, streakEpochs: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = render(<GHIHero />);
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain('ring-1');
    expect(outerDiv.className).toContain('ring-emerald-500/20');
    // Band label
    expect(container.textContent).toContain('Strong');
  });

  it('does not add ring glow class for non-strong bands', () => {
    mockUseGovernanceHealthIndex.mockReturnValue({
      data: {
        current: { score: 55, band: 'fair' },
        trend: { direction: 'down', delta: -2, streakEpochs: 3 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = render(<GHIHero />);
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).not.toContain('ring-1');
    expect(container.textContent).toContain('Fair');
  });
});
