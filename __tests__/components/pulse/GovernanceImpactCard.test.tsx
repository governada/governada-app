import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('lucide-react', () => ({
  Shield: ({ className }: { className?: string }) => (
    <span data-testid="icon-shield" className={className} />
  ),
  Vote: ({ className }: { className?: string }) => (
    <span data-testid="icon-vote" className={className} />
  ),
  DollarSign: ({ className }: { className?: string }) => (
    <span data-testid="icon-dollar" className={className} />
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <span data-testid="icon-chevron-right" className={className} />
  ),
  UserCheck: ({ className }: { className?: string }) => (
    <span data-testid="icon-user-check" className={className} />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@/lib/scoring/tiers', () => ({
  computeTier: (score: number) => {
    if (score >= 90) return 'Diamond';
    if (score >= 75) return 'Gold';
    if (score >= 60) return 'Silver';
    return 'Bronze';
  },
}));

const mockUseWallet = vi.fn();
const mockUseSegment = vi.fn();
const mockUseDRepReportCard = vi.fn();
const mockUseAccountInfo = vi.fn();
const mockUseEpochSummary = vi.fn();

vi.mock('@/utils/wallet-context', () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock('@/components/providers/SegmentProvider', () => ({
  useSegment: () => mockUseSegment(),
}));

vi.mock('@/hooks/queries', () => ({
  useDRepReportCard: (...args: unknown[]) => mockUseDRepReportCard(...args),
  useAccountInfo: (...args: unknown[]) => mockUseAccountInfo(...args),
  useEpochSummary: (...args: unknown[]) => mockUseEpochSummary(...args),
}));

import { GovernanceImpactCard } from '@/components/governada/pulse/GovernanceImpactCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  totalAdaGovernedLovelace: 25_000_000_000_000,
  treasuryBalanceAda: 1_500_000_000,
};

describe('GovernanceImpactCard', () => {
  it('shows blurred preview with "Connect your wallet" text when no wallet connected', () => {
    mockUseWallet.mockReturnValue({
      connected: false,
      delegatedDrepId: null,
    });
    mockUseSegment.mockReturnValue({
      stakeAddress: null,
      delegatedDrep: null,
    });
    mockUseDRepReportCard.mockReturnValue({ data: undefined, isLoading: false });
    mockUseAccountInfo.mockReturnValue({ data: undefined, isLoading: false });
    mockUseEpochSummary.mockReturnValue({ data: undefined });

    const { container } = render(<GovernanceImpactCard {...defaultProps} />);

    // Should show the "Connect your wallet" message
    expect(container.textContent).toContain('Connect your wallet');
    expect(container.textContent).toContain('see how your DRep represents you');

    // The blurred preview has pointer-events-none and backdrop-blur
    const blurOverlay = container.querySelector('.backdrop-blur-sm');
    expect(blurOverlay).not.toBeNull();
  });

  it('shows "Find your DRep match" link when connected but not delegated', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      delegatedDrepId: null,
    });
    mockUseSegment.mockReturnValue({
      stakeAddress: 'stake1abc123',
      delegatedDrep: null,
    });
    mockUseDRepReportCard.mockReturnValue({ data: undefined, isLoading: false });
    mockUseAccountInfo.mockReturnValue({
      data: { totalBalanceAda: 5000 },
      isLoading: false,
    });
    mockUseEpochSummary.mockReturnValue({ data: undefined });

    const { container } = render(<GovernanceImpactCard {...defaultProps} />);

    expect(container.textContent).toContain('Your Governance Impact');
    const matchLink = screen.getByText('Find your DRep match');
    expect(matchLink).toBeDefined();
    expect(matchLink.closest('a')?.getAttribute('href')).toBe('/match');
    // Should mention their ADA balance
    expect(container.textContent).toContain('5,000 ADA');
    expect(container.textContent).toContain("aren't represented in governance");
  });

  it('shows voting power and DRep name when connected and delegated', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      delegatedDrepId: 'drep1abc123def456',
    });
    mockUseSegment.mockReturnValue({
      stakeAddress: 'stake1xyz789',
      delegatedDrep: 'drep1abc123def456',
    });
    mockUseDRepReportCard.mockReturnValue({
      data: {
        name: 'CardanoMax',
        score: 82,
        tier: 'Gold',
        participationRate: 95,
        drepId: 'drep1abc123def456',
        scoreHistory: [],
      },
      isLoading: false,
    });
    mockUseAccountInfo.mockReturnValue({
      data: { totalBalanceAda: 250_000 },
      isLoading: false,
    });
    mockUseEpochSummary.mockReturnValue({
      data: {
        drep_votes_cast: 8,
        proposals_voted_on: 10,
        drep_score_at_epoch: 82,
        drep_tier_at_epoch: 'Gold',
      },
    });

    const { container } = render(<GovernanceImpactCard {...defaultProps} />);

    // DRep name visible
    expect(container.textContent).toContain('CardanoMax');
    // Voting power section header
    expect(container.textContent).toContain('Your Voting Power');
    // ADA amount formatted (250K)
    expect(container.textContent).toContain('250K');
    // Tier badge
    expect(container.textContent).toContain('Gold');
    // Participation rate
    expect(container.textContent).toContain('95% participation');
    // Epoch activity
    expect(container.textContent).toContain('8');
    expect(container.textContent).toContain('10');
  });

  it('shows loading skeletons while data is being fetched', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      delegatedDrepId: 'drep1abc',
    });
    mockUseSegment.mockReturnValue({
      stakeAddress: 'stake1xyz',
      delegatedDrep: 'drep1abc',
    });
    mockUseDRepReportCard.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockUseAccountInfo.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockUseEpochSummary.mockReturnValue({ data: undefined });

    render(<GovernanceImpactCard {...defaultProps} />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
