import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  GovernanceRadar: () => <div data-testid="governance-radar" />,
}));

vi.mock('@/components/HexScore', () => ({
  HexScore: ({ score }: { score: number }) => <div data-testid="hex-score">{score}</div>,
}));

vi.mock('@/components/AccentProvider', () => ({
  AccentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('DRepProfileHero', () => {
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
    expect(screen.getByTestId('hex-score').textContent).toBe('85');
  });

  it('renders with match score', () => {
    const { container } = render(<DRepProfileHero {...defaultProps} matchScore={92} />);
    expect(container.textContent).toContain('TestDRep');
  });

  it('renders inactive DRep', () => {
    const { container } = render(<DRepProfileHero {...defaultProps} isActive={false} />);
    expect(container).toBeDefined();
  });
});
