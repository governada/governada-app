import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DRepProfileHero } from '@/components/DRepProfileHero';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    span: ({ children, ...props }: Record<string, unknown>) => (
      <span {...props}>{children as React.ReactNode}</span>
    ),
  },
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => 0,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/GovernanceRadar', () => ({
  GovernanceRadar: ({ centerScore }: { centerScore?: number }) => (
    <div data-testid="governance-radar">{centerScore}</div>
  ),
}));

vi.mock('@/components/AccentProvider', () => ({
  AccentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/matching/MatchContextBadge', () => ({
  MatchContextBadge: () => null,
}));

let currentSegment = 'drep';
vi.mock('@/components/providers/SegmentProvider', () => ({
  useSegment: () => ({ segment: currentSegment, isLoading: false }),
}));

describe('DRepProfileHero', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    currentSegment = 'drep';
  });

  const defaultProps = {
    name: 'TestDRep',
    score: 85,
    rank: 12,
    delegatorCount: 150,
    votingPowerFormatted: '1.2M ADA',
    alignments: {
      treasuryConservative: 80,
      treasuryGrowth: 40,
      decentralization: 70,
      security: 60,
      innovation: 55,
      transparency: 75,
    },
    traitTags: ['Fiscal Hawk', 'Active Voter'],
    isActive: true,
  };

  it('renders with valid props', () => {
    const { container } = render(<DRepProfileHero {...defaultProps} />);
    expect(container.textContent).toContain('TestDRep');
    const radar = screen.getByTestId('governance-radar');
    expect(radar.textContent).toBe('85');
  });

  it('renders with match score', () => {
    const { container } = render(<DRepProfileHero {...defaultProps} matchScore={92} />);
    expect(container.textContent).toContain('TestDRep');
  });

  it('renders inactive DRep', () => {
    const { container } = render(<DRepProfileHero {...defaultProps} isActive={false} />);
    expect(container).toBeDefined();
  });

  it('shows score number instead of radar for citizens', () => {
    currentSegment = 'citizen';
    const { container } = render(<DRepProfileHero {...defaultProps} />);
    expect(container.textContent).toContain('TestDRep');
    expect(screen.queryAllByTestId('governance-radar')).toHaveLength(0);
    expect(container.textContent).toContain('/ 100');
  });
});
