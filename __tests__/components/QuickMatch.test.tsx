import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickMatch } from '@/components/QuickMatch';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    button: ({ children, onClick, ...props }: Record<string, unknown>) => (
      <button onClick={onClick as () => void} {...props}>
        {children as React.ReactNode}
      </button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/GovernanceRadar', () => ({
  GovernanceRadar: () => <div data-testid="governance-radar" />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} {...props}>
      {children as React.ReactNode}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: vi.fn() },
}));

describe('QuickMatch', () => {
  it('renders initial quiz state', () => {
    const { container } = render(<QuickMatch />);
    expect(container).toBeDefined();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders without crashing', () => {
    expect(() => render(<QuickMatch />)).not.toThrow();
  });
});
