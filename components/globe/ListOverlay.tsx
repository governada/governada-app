'use client';

/**
 * ListOverlay — Translucent scrollable entity list that overlays the globe.
 *
 * Left side on desktop (380px), full-width bottom sheet on mobile.
 * Hover highlights globe node. Click flies to node + opens detail panel.
 * Filter chips dim non-matching globe nodes.
 */

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useDReps, useProposals, useCommitteeMembers } from '@/hooks/queries';
import type { EnrichedDRep } from '@/lib/koios';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';
import type { GovernadaSPOData } from '@/components/governada/cards/GovernadaSPOCard';
import type { CommitteeMemberQuickView } from '@/hooks/queries';
import type { GlobeFilter } from '@/lib/globe/urlState';
import { FilterBar, type SortMode } from './FilterBar';
import { ListItem, type ListEntity } from './ListItem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  filter: GlobeFilter | null;
  onFilterChange: (filter: GlobeFilter | null) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  highlightedNodeId: string | null;
  onNodeHover: (nodeId: string | null) => void;
}

const EMPTY_DREPS: EnrichedDRep[] = [];
const EMPTY_PROPOSALS: BrowseProposal[] = [];
const EMPTY_CC_MEMBERS: CommitteeMemberQuickView[] = [];
const EMPTY_POOLS: GovernadaSPOData[] = [];

// ---------------------------------------------------------------------------
// Fetcher for pools (no dedicated hook in queries.ts)
// ---------------------------------------------------------------------------

function usePools(enabled = true) {
  return useQuery<GovernadaSPOData[]>({
    queryKey: ['governada-pools'],
    queryFn: () =>
      fetch('/api/governance/pools')
        .then((r) => (r.ok ? r.json() : { pools: [] }))
        .then((d) => d.pools ?? []),
    enabled,
    staleTime: 120_000,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ListOverlay({
  isOpen,
  onClose,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  highlightedNodeId,
  onNodeHover,
}: ListOverlayProps) {
  const router = useRouter();

  // Fetch all entity types (hooks return untyped data — cast here)
  const { data: rawDreps } = useDReps(undefined, isOpen);
  const { data: rawProposals } = useProposals(200, isOpen);
  const { data: rawCC } = useCommitteeMembers(isOpen);
  const { data: rawPools } = usePools(isOpen);

  const drepData = rawDreps as { allDReps?: EnrichedDRep[] } | undefined;
  const proposalData = rawProposals as
    | { proposals?: BrowseProposal[]; currentEpoch?: number }
    | undefined;
  const ccData = rawCC as { members?: CommitteeMemberQuickView[] } | undefined;

  const dreps: EnrichedDRep[] = drepData?.allDReps ?? EMPTY_DREPS;
  const proposals: BrowseProposal[] = proposalData?.proposals ?? EMPTY_PROPOSALS;
  const currentEpoch: number | null = proposalData?.currentEpoch ?? null;
  const ccMembers: CommitteeMemberQuickView[] = ccData?.members ?? EMPTY_CC_MEMBERS;
  const spoList: GovernadaSPOData[] = rawPools ?? EMPTY_POOLS;

  // Counts for filter chips
  const counts = useMemo(
    () => ({
      dreps: dreps.length,
      proposals: proposals.length,
      spos: spoList.length,
      cc: ccMembers.length,
    }),
    [dreps.length, proposals.length, spoList.length, ccMembers.length],
  );

  // Build unified entity list based on filter
  const entities: ListEntity[] = useMemo(() => {
    const result: ListEntity[] = [];

    if (!filter || filter === 'dreps') {
      for (const drep of dreps) {
        result.push({ type: 'drep', data: drep });
      }
    }
    if (!filter || filter === 'proposals') {
      for (const proposal of proposals) {
        result.push({ type: 'proposal', data: proposal, currentEpoch });
      }
    }
    if (!filter || filter === 'spos') {
      for (const pool of spoList) {
        result.push({ type: 'pool', data: pool });
      }
    }
    if (!filter || filter === 'cc') {
      for (const member of ccMembers) {
        result.push({ type: 'cc', data: member });
      }
    }

    // Sort
    return sortEntities(result, sort);
  }, [filter, dreps, proposals, spoList, ccMembers, currentEpoch, sort]);

  const handleClick = useCallback(
    (route: string) => {
      router.push(route);
    },
    [router],
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[25] bg-black/30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop: left panel */}
      <div
        role="region"
        aria-label="Entity list"
        className={cn(
          'fixed z-[25] overflow-hidden',
          'bg-black/75 backdrop-blur-2xl',
          'border border-white/[0.08]',
          'shadow-2xl shadow-black/40',
          // Desktop
          'hidden md:flex md:flex-col',
          'top-16 left-4 bottom-4',
          'w-[380px] rounded-2xl',
          'animate-panel-slide-left',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2 pb-0 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
            {filter ? FILTER_LABELS[filter] : 'All entities'}
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
            )}
            aria-label="Close list"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filter bar */}
        <FilterBar
          activeFilter={filter}
          onFilterChange={onFilterChange}
          sort={sort}
          onSortChange={onSortChange}
          counts={counts}
        />

        {/* Divider */}
        <div className="h-px bg-white/[0.06] mx-3" />

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 scroll-smooth">
          {entities.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No entities found
            </div>
          ) : (
            <div className="space-y-0.5">
              {entities.map((entity, i) => (
                <ListItem
                  key={getEntityKey(entity, i)}
                  entity={entity}
                  onHover={onNodeHover}
                  onClick={handleClick}
                  isHighlighted={highlightedNodeId === getEntityNodeId(entity)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60 tabular-nums border-t border-white/[0.04] shrink-0">
          {entities.length.toLocaleString()} entities
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        role="region"
        aria-label="Entity list"
        className={cn(
          'fixed z-[25] overflow-hidden md:hidden',
          'bg-black/80 backdrop-blur-2xl',
          'border-t border-white/[0.08]',
          'shadow-2xl shadow-black/40',
          'inset-x-0 bottom-0',
          'max-h-[70vh] rounded-t-2xl',
          'flex flex-col',
          'animate-panel-slide-up',
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-3 pb-0 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
            {filter ? FILTER_LABELS[filter] : 'All entities'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
            aria-label="Close list"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <FilterBar
          activeFilter={filter}
          onFilterChange={onFilterChange}
          sort={sort}
          onSortChange={onSortChange}
          counts={counts}
        />

        <div className="h-px bg-white/[0.06] mx-3" />

        <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
          {entities.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No entities found
            </div>
          ) : (
            <div className="space-y-0.5">
              {entities.map((entity, i) => (
                <ListItem
                  key={getEntityKey(entity, i)}
                  entity={entity}
                  onHover={onNodeHover}
                  onClick={handleClick}
                  isHighlighted={highlightedNodeId === getEntityNodeId(entity)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FILTER_LABELS: Record<GlobeFilter, string> = {
  dreps: 'Representatives',
  proposals: 'Proposals',
  spos: 'Stake Pools',
  cc: 'Committee',
};

function getEntityKey(entity: ListEntity, index: number): string {
  switch (entity.type) {
    case 'drep':
      return `d_${entity.data.drepId}`;
    case 'proposal':
      return `p_${entity.data.txHash}_${entity.data.index}`;
    case 'pool':
      return `s_${entity.data.poolId}`;
    case 'cc':
      return `c_${entity.data.ccHotId}`;
    default:
      return `e_${index}`;
  }
}

function getEntityNodeId(entity: ListEntity): string {
  switch (entity.type) {
    case 'drep':
      return `drep_${entity.data.drepId}`;
    case 'proposal':
      return `proposal_${entity.data.txHash}_${entity.data.index}`;
    case 'pool':
      return `spo_${entity.data.poolId}`;
    case 'cc':
      return `cc_${entity.data.ccHotId}`;
  }
}

function getEntityScore(entity: ListEntity): number {
  switch (entity.type) {
    case 'drep':
      return entity.data.drepScore ?? 0;
    case 'proposal':
      return 0; // Proposals don't have scores — will sort by status/time
    case 'pool':
      return entity.data.governanceScore ?? 0;
    case 'cc':
      return entity.data.fidelityScore ?? 0;
  }
}

function getEntityVoteCount(entity: ListEntity): number {
  switch (entity.type) {
    case 'drep':
      return entity.data.totalVotes ?? 0;
    case 'proposal': {
      const tri = entity.data.triBody;
      if (!tri?.drep) return 0;
      return tri.drep.yes + tri.drep.no + tri.drep.abstain;
    }
    case 'pool':
      return entity.data.voteCount;
    case 'cc':
      return entity.data.voteCount;
  }
}

function sortEntities(entities: ListEntity[], sort: SortMode): ListEntity[] {
  const sorted = [...entities];
  switch (sort) {
    case 'score':
      sorted.sort((a, b) => getEntityScore(b) - getEntityScore(a));
      break;
    case 'activity':
      sorted.sort((a, b) => getEntityVoteCount(b) - getEntityVoteCount(a));
      break;
    case 'recent':
      // For recent, proposals first (open status), then by activity
      sorted.sort((a, b) => {
        const aIsProposal = a.type === 'proposal' ? 1 : 0;
        const bIsProposal = b.type === 'proposal' ? 1 : 0;
        if (aIsProposal !== bIsProposal) return bIsProposal - aIsProposal;
        return getEntityVoteCount(b) - getEntityVoteCount(a);
      });
      break;
  }
  return sorted;
}
