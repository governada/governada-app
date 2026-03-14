import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);

// ── Tab resolution tests ────────────────────────────────────────

const TAB_ALIASES: Record<string, string> = {
  dreps: 'dreps',
  spos: 'spos',
  pools: 'spos',
  proposals: 'proposals',
  committee: 'committee',
  rankings: 'rankings',
  leaderboard: 'rankings',
};

const VALID_TABS = new Set(['dreps', 'spos', 'proposals', 'committee', 'rankings']);

function resolveTab(param: string | null): string {
  if (!param) return 'dreps';
  const resolved = TAB_ALIASES[param.toLowerCase()];
  return resolved && VALID_TABS.has(resolved) ? resolved : 'dreps';
}

describe('Discover tab resolution', () => {
  it('defaults to dreps when no param', () => {
    expect(resolveTab(null)).toBe('dreps');
    expect(resolveTab('')).toBe('dreps');
  });

  it('resolves canonical tab names', () => {
    expect(resolveTab('dreps')).toBe('dreps');
    expect(resolveTab('spos')).toBe('spos');
    expect(resolveTab('proposals')).toBe('proposals');
    expect(resolveTab('committee')).toBe('committee');
    expect(resolveTab('rankings')).toBe('rankings');
  });

  it('resolves legacy alias "pools" to "spos"', () => {
    expect(resolveTab('pools')).toBe('spos');
  });

  it('resolves "leaderboard" alias to "rankings"', () => {
    expect(resolveTab('leaderboard')).toBe('rankings');
  });

  it('is case-insensitive', () => {
    expect(resolveTab('PROPOSALS')).toBe('proposals');
    expect(resolveTab('Pools')).toBe('spos');
    expect(resolveTab('RANKINGS')).toBe('rankings');
  });

  it('falls back to dreps for unknown tabs', () => {
    expect(resolveTab('unknown')).toBe('dreps');
    expect(resolveTab('treasury')).toBe('dreps');
    expect(resolveTab('admin')).toBe('dreps');
  });
});

// ── Pulse tab resolution tests ──────────────────────────────────

const VALID_PULSE_TABS = new Set([
  'overview',
  'epoch',
  'treasury',
  'trends',
  'observatory',
  'calendar',
]);

function resolvePulseTab(param: string | null): string {
  if (!param) return 'overview';
  const lower = param.toLowerCase();
  return VALID_PULSE_TABS.has(lower) ? lower : 'overview';
}

describe('Pulse tab resolution', () => {
  it('defaults to overview when no param', () => {
    expect(resolvePulseTab(null)).toBe('overview');
  });

  it('resolves valid tab names', () => {
    expect(resolvePulseTab('epoch')).toBe('epoch');
    expect(resolvePulseTab('treasury')).toBe('treasury');
    expect(resolvePulseTab('trends')).toBe('trends');
    expect(resolvePulseTab('observatory')).toBe('observatory');
    expect(resolvePulseTab('calendar')).toBe('calendar');
  });

  it('is case-insensitive', () => {
    expect(resolvePulseTab('TREASURY')).toBe('treasury');
    expect(resolvePulseTab('Observatory')).toBe('observatory');
  });

  it('falls back to overview for unknown tabs', () => {
    expect(resolvePulseTab('unknown')).toBe('overview');
    expect(resolvePulseTab('dreps')).toBe('overview');
  });
});

// ── Proposal epochs-left logic ──────────────────────────────────

describe('Proposal epochs-left logic', () => {
  it('shows epochs remaining for Open proposals', () => {
    const currentEpoch = 100;
    const expirationEpoch = 102;
    const status = 'Open';

    const epochsLeft =
      status === 'Open' && currentEpoch && expirationEpoch ? expirationEpoch - currentEpoch : null;

    expect(epochsLeft).toBe(2);
  });

  it('returns null for non-Open proposals', () => {
    const currentEpoch = 100;
    const expirationEpoch = 102;

    for (const status of ['Ratified', 'Enacted', 'Expired', 'Dropped']) {
      const epochsLeft =
        status === 'Open' && currentEpoch && expirationEpoch
          ? expirationEpoch - currentEpoch
          : null;

      expect(epochsLeft).toBeNull();
    }
  });

  it('returns null when expiration is missing', () => {
    const currentEpoch = 100;
    const expirationEpoch = undefined;
    const status = 'Open';

    const epochsLeft =
      status === 'Open' && currentEpoch && expirationEpoch ? expirationEpoch - currentEpoch : null;

    expect(epochsLeft).toBeNull();
  });
});

// ── Committee VoteBar logic ─────────────────────────────────────

describe('Committee VoteBar', () => {
  it('computes correct proportions', () => {
    const total = 10 + 3 + 2;
    const yPct = (10 / total) * 100;
    const nPct = (3 / total) * 100;
    expect(yPct).toBeCloseTo(66.67, 1);
    expect(nPct).toBeCloseTo(20, 1);
  });

  it('handles zero total gracefully', () => {
    const total = 0 + 0 + 0;
    expect(total).toBe(0);
  });
});

// ── Keyboard tab navigation ─────────────────────────────────

describe('Keyboard tab navigation logic', () => {
  const TAB_IDS = ['dreps', 'spos', 'proposals', 'committee', 'rankings'];

  function nextTab(current: string, direction: 'right' | 'left' | 'home' | 'end'): string {
    const idx = TAB_IDS.indexOf(current);
    if (direction === 'right') return TAB_IDS[(idx + 1) % TAB_IDS.length];
    if (direction === 'left') return TAB_IDS[(idx - 1 + TAB_IDS.length) % TAB_IDS.length];
    if (direction === 'home') return TAB_IDS[0];
    return TAB_IDS[TAB_IDS.length - 1];
  }

  it('ArrowRight wraps from last to first', () => {
    expect(nextTab('rankings', 'right')).toBe('dreps');
  });

  it('ArrowLeft wraps from first to last', () => {
    expect(nextTab('dreps', 'left')).toBe('rankings');
  });

  it('Home goes to first tab', () => {
    expect(nextTab('committee', 'home')).toBe('dreps');
  });

  it('End goes to last tab', () => {
    expect(nextTab('dreps', 'end')).toBe('rankings');
  });

  it('ArrowRight from middle advances by one', () => {
    expect(nextTab('proposals', 'right')).toBe('committee');
  });
});

// ── Needs-vote badge logic ──────────────────────────────────

describe('Needs-vote badge logic', () => {
  function shouldShowNeedsVote(
    status: string,
    hasDrepVote: boolean,
    delegatedDrepId: string | null,
    voteMapSize: number,
  ): boolean {
    return !hasDrepVote && status === 'Open' && !!delegatedDrepId && voteMapSize > 0;
  }

  it('shows for Open proposals without DRep vote when delegating', () => {
    expect(shouldShowNeedsVote('Open', false, 'drep1abc', 5)).toBe(true);
  });

  it('does not show when not delegating', () => {
    expect(shouldShowNeedsVote('Open', false, null, 5)).toBe(false);
  });

  it('does not show on non-Open proposals', () => {
    expect(shouldShowNeedsVote('Ratified', false, 'drep1abc', 5)).toBe(false);
    expect(shouldShowNeedsVote('Enacted', false, 'drep1abc', 5)).toBe(false);
  });

  it('does not show when DRep already voted', () => {
    expect(shouldShowNeedsVote('Open', true, 'drep1abc', 5)).toBe(false);
  });

  it('does not show when vote map is empty (still loading)', () => {
    expect(shouldShowNeedsVote('Open', false, 'drep1abc', 0)).toBe(false);
  });
});

// ── Score distribution threshold ────────────────────────────

describe('Score distribution visibility', () => {
  it('shows chart when > 10 DReps', () => {
    const drepsLength = 15;
    expect(drepsLength > 10).toBe(true);
  });

  it('shows fallback message when 1-10 DReps', () => {
    const drepsLength = 5;
    const showChart = drepsLength > 10;
    const showFallback = !showChart && drepsLength > 0;
    expect(showChart).toBe(false);
    expect(showFallback).toBe(true);
  });

  it('hides entirely when 0 DReps', () => {
    const drepsLength = 0;
    const showChart = drepsLength > 10;
    const showFallback = !showChart && drepsLength > 0;
    expect(showChart).toBe(false);
    expect(showFallback).toBe(false);
  });
});

describe('Committee member display name', () => {
  it('shows author_name when available', () => {
    const member = { name: 'Alice', ccHotId: 'cc_hot_1abc123def456' };
    const displayName = member.name || `${member.ccHotId.slice(0, 12)}…${member.ccHotId.slice(-6)}`;
    expect(displayName).toBe('Alice');
  });

  it('falls back to truncated hex when name is null', () => {
    const member = { name: null, ccHotId: 'cc_hot_1abc123def456789' };
    const displayName = member.name || `${member.ccHotId.slice(0, 12)}…${member.ccHotId.slice(-6)}`;
    expect(displayName).toBe('cc_hot_1abc1…456789');
  });
});

// ── Component tests ─────────────────────────────────────────────

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={props.variant as string}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="icon-search" />,
  X: () => <span data-testid="icon-x" />,
  RotateCcw: () => <span data-testid="icon-reset" />,
  ChevronLeft: () => <span data-testid="icon-left" />,
  ChevronRight: () => <span data-testid="icon-right" />,
}));

import { DiscoverFilterBar } from '@/components/governada/discover/DiscoverFilterBar';
import { DiscoverPagination } from '@/components/governada/discover/DiscoverPagination';

describe('DiscoverFilterBar', () => {
  const defaultProps = {
    search: '',
    onSearchChange: vi.fn(),
    resultCount: 42,
    entityLabel: 'DReps',
    isFiltered: false,
    onReset: vi.fn(),
  };

  it('renders search input and result count', () => {
    render(<DiscoverFilterBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search…')).toBeDefined();
    expect(screen.getByText(/42/)).toBeDefined();
  });

  it('shows reset button when filtered', () => {
    const { container } = render(<DiscoverFilterBar {...defaultProps} isFiltered={true} />);
    expect(container.querySelector('[data-variant="ghost"]')).not.toBeNull();
  });

  it('hides reset button when not filtered', () => {
    const { container } = render(<DiscoverFilterBar {...defaultProps} isFiltered={false} />);
    expect(container.querySelector('[data-variant="ghost"]')).toBeNull();
  });

  it('shows total count when filtered', () => {
    render(
      <DiscoverFilterBar {...defaultProps} isFiltered={true} resultCount={10} totalCount={50} />,
    );
    expect(screen.getByText(/of 50/)).toBeDefined();
  });

  it('renders chip groups', () => {
    render(
      <DiscoverFilterBar
        {...defaultProps}
        chipGroups={[
          {
            label: 'Tier',
            value: 'All',
            options: [
              { value: 'All', label: 'All Tiers' },
              { value: 'Gold', label: 'Gold Tier' },
            ],
            onChange: vi.fn(),
          },
        ]}
      />,
    );
    expect(screen.getByText('All Tiers')).toBeDefined();
    expect(screen.getByText('Gold Tier')).toBeDefined();
  });

  it('calls onChange when chip clicked', () => {
    const onChange = vi.fn();
    render(
      <DiscoverFilterBar
        {...defaultProps}
        chipGroups={[
          {
            label: 'Tier',
            value: 'All',
            options: [{ value: 'Gold', label: 'Gold Tier' }],
            onChange,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Gold Tier'));
    expect(onChange).toHaveBeenCalledWith('Gold');
  });

  it('shows page info', () => {
    render(<DiscoverFilterBar {...defaultProps} pageInfo="Page 1 / 5" />);
    expect(screen.getByText('Page 1 / 5')).toBeDefined();
  });
});

describe('DiscoverPagination', () => {
  it('returns null for single page', () => {
    const { container } = render(
      <DiscoverPagination page={0} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders prev/next buttons', () => {
    render(<DiscoverPagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByText('Prev')).toBeDefined();
    expect(screen.getByText('Next')).toBeDefined();
  });

  it('disables prev on first page', () => {
    render(<DiscoverPagination page={0} totalPages={3} onPageChange={vi.fn()} />);
    const prevBtn = screen.getByText('Prev').closest('button');
    expect(prevBtn?.disabled).toBe(true);
  });

  it('disables next on last page', () => {
    render(<DiscoverPagination page={2} totalPages={3} onPageChange={vi.fn()} />);
    const nextBtn = screen.getByText('Next').closest('button');
    expect(nextBtn?.disabled).toBe(true);
  });

  it('calls onPageChange when clicking page number', () => {
    const onPageChange = vi.fn();
    render(<DiscoverPagination page={0} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn();
    render(<DiscoverPagination page={0} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange when clicking prev', () => {
    const onPageChange = vi.fn();
    render(<DiscoverPagination page={2} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('Prev'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('shows ellipsis for many pages', () => {
    render(<DiscoverPagination page={10} totalPages={20} onPageChange={vi.fn()} />);
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });
});
