import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <span data-testid="icon-chevron" className={className} />
  ),
  Share2: ({ className }: { className?: string }) => (
    <span data-testid="icon-share" className={className} />
  ),
}));

vi.mock('@/lib/animations', () => ({
  staggerContainerSlow: { hidden: {}, visible: {} },
  fadeInUp: { hidden: {}, visible: {} },
  spring: { smooth: {} },
}));

vi.mock('@/components/governada/shared/ShareModal', () => ({
  ShareModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="share-modal">Share Modal</div> : null,
}));

import { GHIExplorer } from '@/components/governada/pulse/GHIExplorer';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockComponents = [
  { name: 'DRep Participation', value: 75, weight: 0.2, contribution: 0.15 },
  { name: 'Citizen Engagement', value: 60, weight: 0.15, contribution: 0.09 },
  { name: 'Deliberation Quality', value: 80, weight: 0.2, contribution: 0.16 },
  { name: 'Governance Effectiveness', value: 70, weight: 0.15, contribution: 0.105 },
  { name: 'Power Distribution', value: 65, weight: 0.15, contribution: 0.0975 },
  { name: 'System Stability', value: 85, weight: 0.15, contribution: 0.1275 },
];

const defaultProps = {
  components: mockComponents,
  componentHistory: [],
  calibration: {},
  componentTrends: {},
  band: 'good',
  score: 72,
};

describe('GHIExplorer', () => {
  it('shows "See what drives this score" button when collapsed', () => {
    render(<GHIExplorer {...defaultProps} />);
    const button = screen.getByText('See what drives this score');
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('sets aria-expanded=true after clicking the toggle button', () => {
    render(<GHIExplorer {...defaultProps} />);
    const button = screen.getByText('See what drives this score');
    fireEvent.click(button);
    // After expanding, button text changes to "Hide breakdown"
    const expandedButton = screen.getByText('Hide breakdown');
    expect(expandedButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders 6 component cards when expanded', () => {
    render(<GHIExplorer {...defaultProps} />);
    // Expand the explorer
    fireEvent.click(screen.getByText('See what drives this score'));

    // Each component should render with a meter role
    const meters = screen.getAllByRole('meter');
    expect(meters.length).toBe(6);

    // Verify component labels are present
    expect(screen.getByText('DRep Participation')).toBeDefined();
    expect(screen.getByText('Citizen Engagement')).toBeDefined();
    expect(screen.getByText('Deliberation Quality')).toBeDefined();
    expect(screen.getByText('Governance Effectiveness')).toBeDefined();
    expect(screen.getByText('Power Distribution')).toBeDefined();
    expect(screen.getByText('System Stability')).toBeDefined();
  });

  it('renders share button in expanded state', () => {
    render(<GHIExplorer {...defaultProps} />);
    fireEvent.click(screen.getByText('See what drives this score'));

    const shareButton = screen.getByText('Share GHI Report');
    expect(shareButton).toBeDefined();
  });

  it('does not show component cards when collapsed', () => {
    render(<GHIExplorer {...defaultProps} />);
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.queryByText('Share GHI Report')).toBeNull();
  });
});
