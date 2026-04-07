import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListOverlay } from '@/components/globe/ListOverlay';

const useDReps = vi.fn<(limit?: number, enabled?: boolean) => { data: undefined }>(() => ({
  data: undefined,
}));
const useProposals = vi.fn<(limit?: number, enabled?: boolean) => { data: undefined }>(() => ({
  data: undefined,
}));
const useCommitteeMembers = vi.fn<(enabled?: boolean) => { data: undefined }>(() => ({
  data: undefined,
}));
const useQuery = vi.fn<(options: unknown) => { data: unknown[] }>(() => ({ data: [] }));
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => useQuery(options),
}));

vi.mock('@/hooks/queries', () => ({
  useDReps: (limit?: number, enabled?: boolean) => useDReps(limit, enabled),
  useProposals: (limit?: number, enabled?: boolean) => useProposals(limit, enabled),
  useCommitteeMembers: (enabled?: boolean) => useCommitteeMembers(enabled),
}));

vi.mock('@/components/globe/FilterBar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('@/components/globe/ListItem', () => ({
  ListItem: () => <div data-testid="list-item" />,
}));

function renderOverlay(isOpen: boolean) {
  render(
    <ListOverlay
      isOpen={isOpen}
      onClose={vi.fn()}
      filter={null}
      onFilterChange={vi.fn()}
      sort="score"
      onSortChange={vi.fn()}
      highlightedNodeId={null}
      onNodeHover={vi.fn()}
    />,
  );
}

describe('ListOverlay query gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables entity queries while the overlay is closed', () => {
    renderOverlay(false);

    expect(useDReps).toHaveBeenCalledWith(undefined, false);
    expect(useProposals).toHaveBeenCalledWith(200, false);
    expect(useCommitteeMembers).toHaveBeenCalledWith(false);
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['governada-pools'],
        enabled: false,
      }),
    );
  });

  it('enables entity queries when the overlay opens', () => {
    renderOverlay(true);

    expect(useDReps).toHaveBeenCalledWith(undefined, true);
    expect(useProposals).toHaveBeenCalledWith(200, true);
    expect(useCommitteeMembers).toHaveBeenCalledWith(true);
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['governada-pools'],
        enabled: true,
      }),
    );
  });
});
