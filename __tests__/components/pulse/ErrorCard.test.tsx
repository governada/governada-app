import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorCard } from '@/components/ui/ErrorCard';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  AlertCircle: ({ className }: { className?: string }) => (
    <span data-testid="icon-alert" className={className} />
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <span data-testid="icon-refresh" className={className} />
  ),
}));

afterEach(cleanup);

describe('ErrorCard', () => {
  it('renders default message when no message prop provided', () => {
    render(<ErrorCard />);
    expect(screen.getByText('Failed to load data. Please try again.')).toBeDefined();
  });

  it('renders custom message when provided', () => {
    render(<ErrorCard message="Governance Health temporarily unavailable." />);
    expect(screen.getByText('Governance Health temporarily unavailable.')).toBeDefined();
  });

  it('calls onRetry callback when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorCard onRetry={onRetry} />);
    const retryButton = screen.getByText('Try again');
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorCard />);
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('has aria-live="assertive" and role="alert" on the container', () => {
    render(<ErrorCard />);
    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeDefined();
    expect(alertEl.getAttribute('aria-live')).toBe('assertive');
  });
});
