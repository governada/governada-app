'use client';

import { useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ShieldCheck, FileText, Scale, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CivicaDRepBrowse } from './CivicaDRepBrowse';
import { CivicaSPOBrowse } from './CivicaSPOBrowse';
import { CivicaLeaderboard } from './CivicaLeaderboard';
import { CommitteeDiscovery } from '@/components/CommitteeDiscovery';
import { ProposalsBrowse } from './ProposalsBrowse';
import { DiscoverHero } from './DiscoverHero';
import { FirstVisitBanner } from '@/components/ui/FirstVisitBanner';
import type { EnrichedDRep } from '@/lib/koios';

type TabId = 'dreps' | 'spos' | 'proposals' | 'committee' | 'rankings';

const TAB_IDS: TabId[] = ['dreps', 'spos', 'proposals', 'committee', 'rankings'];

/** Map legacy/alias param values to canonical tab IDs */
const TAB_ALIASES: Record<string, TabId> = {
  dreps: 'dreps',
  spos: 'spos',
  pools: 'spos',
  proposals: 'proposals',
  committee: 'committee',
  rankings: 'rankings',
  leaderboard: 'rankings',
};

const VALID_TABS = new Set<TabId>(TAB_IDS);

function resolveTab(param: string | null): TabId {
  if (!param) return 'dreps';
  const resolved = TAB_ALIASES[param.toLowerCase()];
  return resolved && VALID_TABS.has(resolved) ? resolved : 'dreps';
}

interface Tab {
  id: TabId;
  label: string;
  icon: React.FC<{ className?: string }>;
  count?: number;
}

interface CivicaDiscoverProps {
  dreps: EnrichedDRep[];
  totalAvailable: number;
  proposalCount: number;
  ccMemberCount?: number;
  spoCount?: number;
}

export function CivicaDiscover({
  dreps,
  totalAvailable,
  proposalCount,
  ccMemberCount,
  spoCount,
}: CivicaDiscoverProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Derive active tab directly from URL — searchParams is the source of truth
  const activeTab = resolveTab(searchParams.get('tab'));

  const setActiveTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'dreps') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const qs = params.toString();
      // Use history API directly to avoid a full server re-render of the force-dynamic page
      window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`);
    },
    [searchParams, pathname],
  );

  // Keyboard navigation for tabs (WAI-ARIA roving tabindex pattern)
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = TAB_IDS.indexOf(activeTab);
      let newIndex: number | null = null;

      if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % TAB_IDS.length;
      else if (e.key === 'ArrowLeft')
        newIndex = (currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length;
      else if (e.key === 'Home') newIndex = 0;
      else if (e.key === 'End') newIndex = TAB_IDS.length - 1;

      if (newIndex !== null) {
        e.preventDefault();
        setActiveTab(TAB_IDS[newIndex]);
        const btn = document.getElementById(`tab-${TAB_IDS[newIndex]}`);
        btn?.focus();
      }
    },
    [activeTab, setActiveTab],
  );

  const tabs: Tab[] = [
    { id: 'dreps', label: 'DReps', icon: Users, count: totalAvailable },
    { id: 'spos', label: 'SPOs', icon: ShieldCheck, count: spoCount },
    { id: 'proposals', label: 'Proposals', icon: FileText, count: proposalCount },
    { id: 'committee', label: 'Committee', icon: Scale, count: ccMemberCount },
    { id: 'rankings', label: 'Rankings', icon: Trophy },
  ];

  return (
    <div className="space-y-0">
      <div className="mb-4">
        <DiscoverHero
          totalDreps={totalAvailable}
          proposalCount={proposalCount}
          ccMemberCount={ccMemberCount}
          spoCount={spoCount}
        />
      </div>
      <FirstVisitBanner
        pageKey="discover"
        message="Browse and compare governance participants. Scores reflect actual voting behavior, not popularity."
      />
      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div className="border-b border-border sticky top-14 z-30 bg-background/90 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div
          className="flex gap-0 overflow-x-auto scrollbar-none max-w-4xl"
          role="tablist"
          aria-label="Discover governance entities"
        >
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              onKeyDown={handleTabKeyDown}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`tabpanel-${id}`}
              id={`tab-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              aria-label={count != null && count > 0 ? `${label} (${count})` : label}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap',
                'transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                activeTab === id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {label}
              {count != null && count > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full',
                    activeTab === id
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count > 999 ? `${Math.round(count / 1000)}k` : count}
                </span>
              )}
              {activeTab === id && (
                <motion.span
                  layoutId="discover-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="pt-1"
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'dreps' && (
            <CivicaDRepBrowse dreps={dreps} totalAvailable={totalAvailable} />
          )}
          {activeTab === 'spos' && <CivicaSPOBrowse />}
          {activeTab === 'proposals' && <ProposalsBrowse />}
          {activeTab === 'committee' && (
            <div className="pt-4">
              <CommitteeDiscovery />
            </div>
          )}
          {activeTab === 'rankings' && <CivicaLeaderboard />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
