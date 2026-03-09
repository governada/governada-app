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

import { DiscoverFilterBar } from '@/components/civica/discover/DiscoverFilterBar';
import { DiscoverPagination } from '@/components/civica/discover/DiscoverPagination';

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
