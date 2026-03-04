'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DRepTable } from '@/components/DRepTable';
import { DRepCardGrid } from '@/components/DRepCardGrid';
import { DRepQuickView, type DRepMatchDetail } from '@/components/DRepQuickView';
const SmartSearch = dynamic(() => import('@/components/SmartSearch').then(m => m.SmartSearch), { ssr: false, loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> });
import { FilterPanel } from '@/components/FilterPanel';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EnrichedDRep } from '@/lib/koios';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, LayoutGrid, TableProperties } from 'lucide-react';
import { SizeTier } from '@/utils/scoring';
import { GitCompareArrows, X } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { cn } from '@/lib/utils';

export type SortKey = 'drepScore' | 'votingPower' | 'sizeTier' | 'match';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

type ViewMode = 'table' | 'cards';

const PAGE_SIZE = 10;
const CARD_PAGE_SIZE = 21;
const VIEW_MODE_KEY = 'drepscore_view_mode';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'cards';
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'table' || stored === 'cards') return stored;
  } catch {
    /* noop */
  }
  return window.innerWidth >= 768 ? 'table' : 'cards';
}

interface DRepTableClientProps {
  initialDReps?: EnrichedDRep[];
  initialAllDReps?: EnrichedDRep[];
  initialTotalAvailable?: number;
  watchlist?: string[];
  onWatchlistToggle?: (drepId: string) => void;
  isConnected?: boolean;
  matchData?: Record<string, number>;
  matchConfidence?: Record<string, number>;
}

export function DRepTableClient({
  initialDReps,
  initialAllDReps,
  initialTotalAvailable,
  watchlist = [],
  onWatchlistToggle,
  isConnected = false,
  matchData = {},
  matchConfidence = {},
}: DRepTableClientProps) {
  const router = useRouter();
  const { delegatedDrepId } = useWallet();
  const quickViewEnabled = true;

  // Quick view state
  const [quickViewDrep, setQuickViewDrep] = useState<EnrichedDRep | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickViewMatchDetail, setQuickViewMatchDetail] = useState<DRepMatchDetail | null>(null);

  useEffect(() => {
    if (!quickViewOpen || !quickViewDrep || matchData[quickViewDrep.drepId] == null) {
      setQuickViewMatchDetail(null);
      return;
    }
    let cancelled = false;
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('drepscore_session_token') : null;
    if (!token) return;

    fetch(`/api/governance/matches/detail?drepId=${encodeURIComponent(quickViewDrep.drepId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setQuickViewMatchDetail({
            matchScore: data.matchScore,
            agreed: data.agreed,
            total: data.total,
            comparisons: data.comparisons,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [quickViewOpen, quickViewDrep, matchData]);

  const hasServerData = !!initialDReps;
  const [loading, setLoading] = useState(!hasServerData);
  const [error, setError] = useState<string | null>(null);
  const [wellDocDReps, setWellDocDReps] = useState<EnrichedDRep[]>(initialDReps ?? []);
  const [allDReps, setAllDReps] = useState<EnrichedDRep[]>(initialAllDReps ?? []);
  const [totalAvailable, setTotalAvailable] = useState(initialTotalAvailable ?? 0);

  const hasMatch = Object.keys(matchData).length > 0;

  // Client-side fetch only when no server data provided
  useEffect(() => {
    if (hasServerData) return;
    fetch('/api/dreps')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch DReps');
        return res.json();
      })
      .then((data) => {
        setWellDocDReps(data.dreps || []);
        setAllDReps(data.allDReps || []);
        setTotalAvailable(data.totalAvailable || 0);
        setLoading(false);
        if (data.error) setError('Data may be stale - try refreshing');
      })
      .catch((err) => {
        console.error('Error fetching DReps:', err);
        setError('Failed to load DReps. Please try refreshing the page.');
        setLoading(false);
      });
  }, [hasServerData]);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filterWellDocumented, setFilterWellDocumented] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilters, setSizeFilters] = useState<Set<SizeTier>>(
    new Set(['Small', 'Medium', 'Large', 'Whale']),
  );
  const [showMyDrepOnly, setShowMyDrepOnly] = useState(false);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'drepScore',
    direction: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleCardCount, setVisibleCardCount] = useState(CARD_PAGE_SIZE);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Restore view mode from localStorage after mount
  useEffect(() => {
    setViewMode(getInitialViewMode());
  }, []);

  // Reset visible card count when filters change
  useEffect(() => {
    setVisibleCardCount(CARD_PAGE_SIZE);
  }, [filterWellDocumented, sizeFilters, searchQuery, showMyDrepOnly, showWatchlistOnly]);

  // IntersectionObserver for infinite scroll in card mode
  useEffect(() => {
    if (viewMode !== 'cards') return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCardCount((prev) => prev + CARD_PAGE_SIZE);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setCurrentPage(1);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* noop */
    }
    import('@/lib/posthog')
      .then(({ posthog }) => {
        posthog.capture('drep_view_mode_changed', { mode });
      })
      .catch(() => {});
  };

  const handleCompareToggle = useCallback((drepId: string) => {
    setCompareSelection((prev) => {
      const next = new Set(prev);
      if (next.has(drepId)) {
        next.delete(drepId);
      } else if (next.size < 3) {
        next.add(drepId);
      } else {
        const first = next.values().next().value!;
        next.delete(first);
        next.add(drepId);
      }
      return next;
    });
  }, []);

  // Filter Logic
  const filteredDReps = useMemo(() => {
    let result = filterWellDocumented ? wellDocDReps : allDReps;

    result = result.filter((drep) => sizeFilters.has(drep.sizeTier));

    if (showMyDrepOnly && delegatedDrepId) {
      result = result.filter((d) => d.drepId === delegatedDrepId);
    }

    if (showWatchlistOnly && watchlist.length > 0) {
      const wSet = new Set(watchlist);
      result = result.filter((d) => wSet.has(d.drepId));
    }

    if (!searchQuery.trim()) return result;

    const query = searchQuery.toLowerCase();
    return result.filter((drep) => {
      const name = drep.name?.toLowerCase() || '';
      const ticker = drep.ticker?.toLowerCase() || '';
      const id = drep.drepId.toLowerCase();
      const handle = drep.handle?.toLowerCase() || '';

      return (
        name.includes(query) ||
        ticker.includes(query) ||
        id.includes(query) ||
        handle.includes(query)
      );
    });
  }, [
    filterWellDocumented,
    sizeFilters,
    searchQuery,
    allDReps,
    wellDocDReps,
    showMyDrepOnly,
    showWatchlistOnly,
    delegatedDrepId,
    watchlist,
  ]);

  const sizeTierOrder: Record<string, number> = { Small: 1, Medium: 2, Large: 3, Whale: 4 };

  // Sorting Logic
  const sortedDReps = useMemo(() => {
    return [...filteredDReps].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      if (sortConfig.key === 'match') {
        aValue = matchData[a.drepId] ?? 0;
        bValue = matchData[b.drepId] ?? 0;
      } else if (sortConfig.key === 'sizeTier') {
        aValue = sizeTierOrder[a.sizeTier] ?? 0;
        bValue = sizeTierOrder[b.sizeTier] ?? 0;
      } else if (sortConfig.key === 'drepScore') {
        aValue = a.drepScore ?? 0;
        bValue = b.drepScore ?? 0;
      } else {
        aValue = a[sortConfig.key] ?? 0;
        bValue = b[sortConfig.key] ?? 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDReps, sortConfig, matchData, sizeTierOrder]);

  // Pagination Logic
  const pageSize = viewMode === 'cards' ? CARD_PAGE_SIZE : PAGE_SIZE;
  const totalPages = Math.ceil(sortedDReps.length / pageSize);
  const paginatedDReps = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedDReps.slice(startIndex, startIndex + pageSize);
  }, [sortedDReps, currentPage, pageSize]);

  // Handlers
  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
    setCurrentPage(1);
  };

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleSearchSelectDRep = useCallback(
    (drepId: string) => {
      router.push(`/drep/${encodeURIComponent(drepId)}`);
    },
    [router],
  );

  const handleReset = () => {
    setSearchQuery('');
    setSortConfig({ key: 'drepScore', direction: 'desc' });
    setFilterWellDocumented(true);
    setSizeFilters(new Set(['Small', 'Medium', 'Large', 'Whale']));
    setShowMyDrepOnly(false);
    setShowWatchlistOnly(false);
    setCurrentPage(1);
  };

  const preserveScroll = useCallback((fn: () => void) => {
    const y = window.scrollY;
    fn();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' })),
    );
  }, []);

  const toggleSizeFilter = (size: SizeTier) => {
    setSizeFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(size)) {
        newSet.delete(size);
      } else {
        newSet.add(size);
      }
      return newSet;
    });
    setCurrentPage(1);
  };

  if (loading) {
    return <TableSkeleton />;
  }

  if (error) {
    return (
      <ErrorBanner
        message={error}
        retryable={true}
        onRetry={() => {
          setError(null);
          setLoading(true);
          fetch('/api/dreps')
            .then((res) => {
              if (!res.ok) throw new Error('Failed to fetch DReps');
              return res.json();
            })
            .then((data) => {
              setWellDocDReps(data.dreps || []);
              setAllDReps(data.allDReps || []);
              setTotalAvailable(data.totalAvailable || 0);
              setLoading(false);
              if (data.error) setError('Data may be stale - try refreshing');
            })
            .catch((err) => {
              console.error('Error fetching DReps:', err);
              setError('Failed to load DReps. Please try refreshing the page.');
              setLoading(false);
            });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-4 rounded-lg border bg-card/50 backdrop-blur-sm space-y-4">
        {/* Search and filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <SmartSearch
              dreps={filterWellDocumented ? wellDocDReps : allDReps}
              value={searchQuery}
              onChange={handleSearchChange}
              onSelectDRep={handleSearchSelectDRep}
              className="w-full md:w-96"
            />

            <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
              <button
                onClick={() => handleViewModeChange('cards')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'cards'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleViewModeChange('table')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Table view"
              >
                <TableProperties className="h-4 w-4" />
              </button>
            </div>
          </div>

          <FilterPanel
            filterWellDocumented={filterWellDocumented}
            onFilterWellDocumentedChange={(checked) => {
              setFilterWellDocumented(checked);
              setCurrentPage(1);
            }}
            sizeFilters={sizeFilters}
            onToggleSizeFilter={toggleSizeFilter}
            showMyDrepOnly={showMyDrepOnly}
            onToggleMyDrep={() =>
              preserveScroll(() => {
                setShowMyDrepOnly(!showMyDrepOnly);
                setCurrentPage(1);
              })
            }
            hasMyDrep={!!delegatedDrepId}
            showWatchlistOnly={showWatchlistOnly}
            onToggleWatchlist={() =>
              preserveScroll(() => {
                setShowWatchlistOnly(!showWatchlistOnly);
                setCurrentPage(1);
              })
            }
            watchlistCount={watchlist.length}
            onReset={handleReset}
            hasMatch={hasMatch}
            sortKey={sortConfig.key}
            onSortByMatch={() => handleSort('match')}
          />
        </div>
      </div>

      {/* Results Info */}
      <div className="text-sm text-muted-foreground px-1">
        Showing {sortedDReps.length} DReps
        {totalAvailable > 0 && ` (${totalAvailable} registered)`}
      </div>

      {/* Content */}
      {sortedDReps.length === 0 ? (
        <EmptyState
          title="No DReps found"
          message={
            searchQuery
              ? `No results matching "${searchQuery}"`
              : 'No DReps match. Try adjusting your filters — there are hundreds of active representatives to explore.'
          }
          icon="search"
          action={
            filterWellDocumented && !searchQuery
              ? {
                  label: 'Show all DReps',
                  onClick: () => setFilterWellDocumented(false),
                }
              : {
                  label: 'Clear Filters',
                  onClick: handleReset,
                }
          }
        />
      ) : viewMode === 'cards' ? (
        <>
          <DRepCardGrid
            dreps={sortedDReps.slice(0, visibleCardCount)}
            matchData={matchData}
            matchConfidence={matchConfidence}
            watchlist={watchlist}
            onWatchlistToggle={onWatchlistToggle}
            delegatedDrepId={delegatedDrepId}
            onCardClick={(drep) => {
              if (quickViewEnabled) {
                setQuickViewDrep(drep);
                setQuickViewOpen(true);
                import('@/lib/posthog')
                  .then(({ posthog }) => {
                    posthog.capture('drep_quick_view_opened', {
                      drep_id: drep.drepId,
                      drep_score: drep.drepScore,
                      has_match: !!matchData[drep.drepId],
                      view_mode: viewMode,
                    });
                  })
                  .catch(() => {});
              } else {
                router.push(`/drep/${encodeURIComponent(drep.drepId)}`);
              }
            }}
          />
          {visibleCardCount < sortedDReps.length && (
            <div ref={loadMoreRef} className="flex justify-center py-6">
              <Button
                variant="outline"
                onClick={() => setVisibleCardCount((prev) => prev + CARD_PAGE_SIZE)}
              >
                Load More ({sortedDReps.length - visibleCardCount} remaining)
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <DRepTable
            dreps={paginatedDReps}
            sortConfig={sortConfig}
            onSort={handleSort}
            watchlist={watchlist}
            onWatchlistToggle={onWatchlistToggle}
            isConnected={isConnected}
            delegatedDrepId={delegatedDrepId}
            compareSelection={compareSelection}
            onCompareToggle={handleCompareToggle}
            matchData={matchData}
          />

          {/* Pagination Controls (table mode only) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Quick View Sheet */}
      <DRepQuickView
        drep={quickViewDrep}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        matchDetail={
          quickViewMatchDetail ??
          (quickViewDrep && matchData[quickViewDrep.drepId] != null
            ? {
                matchScore: matchData[quickViewDrep.drepId],
                agreed: 0,
                total: 0,
                comparisons: [],
              }
            : undefined)
        }
        isWatchlisted={quickViewDrep ? watchlist.includes(quickViewDrep.drepId) : false}
        onWatchlistToggle={onWatchlistToggle}
        isDelegated={quickViewDrep?.drepId === delegatedDrepId}
      />

      {/* Floating Compare Bar */}
      {compareSelection.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-3 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-lg">
            <GitCompareArrows className="h-4 w-4" />
            <span className="text-sm font-medium">{compareSelection.size} DReps selected</span>
            <a href={`/compare?dreps=${[...compareSelection].join(',')}`}>
              <Button size="sm" variant="secondary" className="h-7 text-xs font-semibold">
                Compare Now
              </Button>
            </a>
            <button
              onClick={() => setCompareSelection(new Set())}
              className="text-primary-foreground/70 hover:text-primary-foreground ml-1"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
