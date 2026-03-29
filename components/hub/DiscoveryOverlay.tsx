'use client';

/**
 * DiscoveryOverlay — Lightweight entity card list when a filter is active.
 *
 * Desktop: Left side panel (350px). Mobile: Bottom sheet.
 * Replaces the heavy ListOverlay from the old /g route.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpDown } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDReps, useProposals, useCommitteeMembers } from '@/hooks/queries';
import { useQuery } from '@tanstack/react-query';
import { computeTier } from '@/lib/scoring/tiers';
import { cn } from '@/lib/utils';
import { encodeEntityParam } from '@/lib/homepage/parseEntityParam';
import type { EnrichedDRep } from '@/lib/koios';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';
import type { GovernadaSPOData } from '@/components/governada/cards/GovernadaSPOCard';
import type { CommitteeMemberQuickView } from '@/hooks/queries';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/governada/cards/tierStyles';

type SortMode = 'score' | 'activity' | 'recent';

interface DiscoveryOverlayProps {
  filter: string | null;
  sort?: string;
  onEntitySelect: (entityParam: string) => void;
  onClose: () => void;
}

const FILTER_LABELS: Record<string, string> = {
  proposals: 'Proposals',
  dreps: 'DReps',
  spos: 'Stake Pools',
  cc: 'Committee',
  treasury: 'Treasury',
};

// ─── DRep card ─────────────────────────────────────────────

function DRepCard({ drep, onClick }: { drep: EnrichedDRep; onClick: () => void }) {
  const tier = computeTier(drep.drepScore ?? 0);
  const tk = tierKey(tier);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
            TIER_BADGE_BG[tk],
          )}
        >
          {drep.drepScore ?? '—'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {drep.name || drep.handle || drep.drepId?.slice(0, 16)}
          </p>
          <p className="text-xs text-muted-foreground">
            {drep.delegatorCount ?? 0} delegators · {drep.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
        <span className={cn('text-xs font-medium', TIER_SCORE_COLOR[tk])}>{tier}</span>
      </div>
    </button>
  );
}

// ─── Proposal card ────────────────────────────────────────

function ProposalCard({ proposal, onClick }: { proposal: BrowseProposal; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
    >
      <p className="text-sm font-medium line-clamp-2">
        {proposal.title || `Proposal ${proposal.txHash?.slice(0, 12)}`}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-muted-foreground">{proposal.type ?? 'Proposal'}</span>
        {proposal.status && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/5">{proposal.status}</span>
        )}
      </div>
    </button>
  );
}

// ─── Pool card ─────────────────────────────────────────────

function PoolCard({ pool, onClick }: { pool: GovernadaSPOData; onClick: () => void }) {
  const tier = computeTier(pool.governanceScore ?? 0);
  const tk = tierKey(tier);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
            TIER_BADGE_BG[tk],
          )}
        >
          {pool.governanceScore ?? '—'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {pool.ticker ? `[${pool.ticker}] ` : ''}
            {pool.poolName || pool.poolId?.slice(0, 16)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pool.voteCount ?? 0} votes · {pool.delegatorCount ?? 0} delegators
          </p>
        </div>
        <span className={cn('text-xs font-medium', TIER_SCORE_COLOR[tk])}>{tier}</span>
      </div>
    </button>
  );
}

// ─── CC card ───────────────────────────────────────────────

function CCCard({ member, onClick }: { member: CommitteeMemberQuickView; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-sm font-bold">
          {member.fidelityGrade || '—'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {member.name || member.ccHotId?.slice(0, 16)}
          </p>
          <p className="text-xs text-muted-foreground">
            {member.voteCount ?? 0} votes · {Math.round(member.approvalRate ?? 0)}% approval
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────

function usePools() {
  return useQuery<GovernadaSPOData[]>({
    queryKey: ['governada-pools'],
    queryFn: async () => {
      const res = await fetch('/api/governance/pools');
      if (!res.ok) return [];
      const data = await res.json();
      return data.pools ?? [];
    },
    staleTime: 120_000,
  });
}

function DiscoveryContent({
  filter,
  sortMode,
  onEntitySelect,
}: {
  filter: string;
  sortMode: SortMode;
  onEntitySelect: (param: string) => void;
}) {
  const { data: drepsRaw } = useDReps();
  const drepsData = drepsRaw as { allDReps?: EnrichedDRep[] } | undefined;
  const { data: proposalsRaw } = useProposals(200);
  const proposalsData = proposalsRaw as { proposals?: BrowseProposal[] } | undefined;
  const { data: poolsData } = usePools();
  const { data: ccRaw } = useCommitteeMembers();
  const ccData = ccRaw as { members?: CommitteeMemberQuickView[] } | undefined;

  const content = useMemo(() => {
    switch (filter) {
      case 'dreps': {
        const dreps = drepsData?.allDReps ?? [];
        const sorted =
          sortMode === 'score'
            ? [...dreps].sort((a, b) => (b.drepScore ?? 0) - (a.drepScore ?? 0))
            : [...dreps].sort((a, b) => (b.delegatorCount ?? 0) - (a.delegatorCount ?? 0));
        return sorted
          .slice(0, 50)
          .map((d) => (
            <DRepCard
              key={d.drepId}
              drep={d}
              onClick={() => onEntitySelect(encodeEntityParam('drep', d.drepId))}
            />
          ));
      }
      case 'proposals':
      case 'treasury': {
        const proposals = proposalsData?.proposals ?? [];
        return proposals
          .slice(0, 50)
          .map((p) => (
            <ProposalCard
              key={`${p.txHash}_${p.index}`}
              proposal={p}
              onClick={() =>
                onEntitySelect(encodeEntityParam('proposal', p.txHash, String(p.index)))
              }
            />
          ));
      }
      case 'spos': {
        const pools = poolsData ?? [];
        const sorted =
          sortMode === 'score'
            ? [...pools].sort((a, b) => (b.governanceScore ?? 0) - (a.governanceScore ?? 0))
            : [...pools].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
        return sorted
          .slice(0, 50)
          .map((p) => (
            <PoolCard
              key={p.poolId}
              pool={p}
              onClick={() => onEntitySelect(encodeEntityParam('pool', p.poolId))}
            />
          ));
      }
      case 'cc': {
        const members = ccData?.members ?? [];
        return members.map((m) => (
          <CCCard
            key={m.ccHotId}
            member={m}
            onClick={() => onEntitySelect(encodeEntityParam('cc', m.ccHotId))}
          />
        ));
      }
      default:
        return null;
    }
  }, [filter, sortMode, drepsData, proposalsData, poolsData, ccData, onEntitySelect]);

  if (!content) return <p className="text-sm text-muted-foreground p-4">No results</p>;

  return <div className="space-y-2">{content}</div>;
}

export function DiscoveryOverlay({ filter, onEntitySelect, onClose }: DiscoveryOverlayProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const isOpen = filter !== null;

  if (!isOpen) return null;

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <h2 className="text-sm font-medium">{FILTER_LABELS[filter] ?? filter}</h2>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSortMode((m) => (m === 'score' ? 'activity' : 'score'))}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortMode === 'score' ? 'Score' : 'Activity'}
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground"
          aria-label="Close discovery"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Mobile: bottom sheet
  if (!isDesktop) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[70vh] rounded-t-2xl bg-background/95 backdrop-blur-xl border-t border-white/10 px-0"
          showCloseButton={false}
        >
          <div className="flex justify-center py-2">
            <div className="w-8 h-1 rounded-full bg-white/20" />
          </div>
          {header}
          <div className="overflow-y-auto px-4 py-3 max-h-[calc(70vh-5rem)]">
            <DiscoveryContent filter={filter} sortMode={sortMode} onEntitySelect={onEntitySelect} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: left side panel
  return (
    <AnimatePresence>
      <motion.div
        key="discovery-overlay-desktop"
        initial={{ x: -370, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -370, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed top-14 left-16 bottom-20 z-40',
          'w-[350px]',
          'backdrop-blur-2xl bg-black/75 border border-white/[0.08]',
          'rounded-2xl shadow-2xl shadow-black/40',
          'flex flex-col overflow-hidden',
        )}
      >
        {header}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <DiscoveryContent filter={filter} sortMode={sortMode} onEntitySelect={onEntitySelect} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
