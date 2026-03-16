'use client';

import { useState, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RotateCcw,
  LayoutGrid,
  TableProperties,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GovernadaDRepCard } from '@/components/governada/cards/GovernadaDRepCard';
import { computeTier } from '@/lib/scoring/tiers';
import {
  TIER_SCORE_COLOR,
  TIER_BADGE_BG,
  TIER_LEFT_ACCENT,
  tierKey,
} from '@/components/governada/cards/tierStyles';
import { useBatchEndorsementCounts } from '@/hooks/useEngagement';
import { useDReps } from '@/hooks/queries';
import type { EnrichedDRep } from '@/lib/koios';
import { AnonymousNudge } from '@/components/governada/shared/AnonymousNudge';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { DepthGate } from '@/components/providers/DepthGate';
import { useWallet } from '@/utils/wallet-context';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';
import {
  loadMatchProfile,
  alignmentDistance,
  distanceToMatchScore,
  type StoredMatchProfile,
} from '@/lib/matchStore';
import {
  extractAlignments,
  getPersonalityLabel,
  getDominantDimension,
  getIdentityColor,
} from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';

const TIER_CHIPS: { value: string; label: string; tooltip?: string }[] = [
  { value: 'All', label: 'All' },
  {
    value: 'Emerging',
    label: 'Emerging',
    tooltip: 'Score 0-29. New DReps building their governance track record.',
  },
  {
    value: 'Bronze',
    label: 'Bronze',
    tooltip: 'Score 30-49. DReps with some voting history and engagement.',
  },
  {
    value: 'Silver',
    label: 'Silver',
    tooltip: 'Score 50-69. Consistent DReps with solid participation.',
  },
  {
    value: 'Gold',
    label: 'Gold',
    tooltip: 'Score 70-84. Active, transparent DReps with strong voting records.',
  },
  {
    value: 'Diamond',
    label: 'Diamond',
    tooltip: 'Score 85-94. Top-tier DReps with exceptional governance engagement.',
  },
  {
    value: 'Legendary',
    label: 'Legendary',
    tooltip: 'Score 95-100. Elite DReps leading Cardano governance.',
  },
];

const ALIGNMENT_OPTIONS = [
  { value: 'all', label: 'Any alignment' },
  {
    value: 'treasury_conservative',
    label: 'Fiscal conservative',
    tooltip: 'Favors careful spending of community treasury funds.',
  },
  {
    value: 'treasury_growth',
    label: 'Growth-oriented',
    tooltip: 'Supports bold treasury investment to grow the ecosystem.',
  },
  {
    value: 'decentralization',
    label: 'Decentralization',
    tooltip: 'Prioritizes distributing power across the community.',
  },
  {
    value: 'security',
    label: 'Security-focused',
    tooltip: 'Values protocol stability and security over rapid change.',
  },
  {
    value: 'innovation',
    label: 'Innovation-first',
    tooltip: 'Embraces new ideas and rapid protocol evolution.',
  },
  {
    value: 'transparency',
    label: 'Transparency',
    tooltip: 'Demands public explanations for all governance votes.',
  },
];

const ALIGNMENT_FIELD_MAP: Record<string, keyof EnrichedDRep> = {
  treasury_conservative: 'alignmentTreasuryConservative',
  treasury_growth: 'alignmentTreasuryGrowth',
  decentralization: 'alignmentDecentralization',
  security: 'alignmentSecurity',
  innovation: 'alignmentInnovation',
  transparency: 'alignmentTransparency',
};

type ViewMode = 'cards' | 'table';
const VIEW_MODE_KEY = 'governada_drep_view';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'cards';
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'table' || stored === 'cards') return stored;
  } catch {}
  return 'cards';
}

const CARD_PAGE_SIZE = 24;
const TABLE_PAGE_SIZE = 50;

interface FilterState {
  search: string;
  tier: string;
  activeOnly: boolean;
  alignment: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  tier: 'All',
  activeOnly: true,
  alignment: 'all',
};

type GovernadaDRepBrowseProps = Record<string, never>;

/* ── Compact single-line row for inactive DReps ──────────────────── */
function InactiveDRepRow({ drep, animationDelay }: { drep: EnrichedDRep; animationDelay: number }) {
  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const displayName =
    drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 16)}\u2026`;

  return (
    <Link
      href={`/drep/${drep.drepId}`}
      className="group flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/40 bg-card/30 hover:bg-muted/40 hover:border-border/70 hover:shadow-sm transition-all duration-200 animate-in fade-in fill-mode-backwards"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <span
        className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
          TIER_BADGE_BG[tier],
          TIER_SCORE_COLOR[tier],
        )}
      >
        {score}
      </span>
      <span className="flex-1 text-sm text-muted-foreground/80 group-hover:text-foreground/90 truncate min-w-0 transition-colors duration-200">
        {displayName}
      </span>
      <span className="text-[10px] text-muted-foreground/50">Inactive</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    </Link>
  );
}

/* ── Enhanced table row ──────────────────────────────────────────── */
function DRepTableRow({ drep, rank }: { drep: EnrichedDRep; rank: number }) {
  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const displayName =
    drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 16)}\u2026`;
  const momentum = drep.scoreMomentum ?? null;

  const alignments = extractAlignments(drep);
  const hasAlignment = drep.alignmentDecentralization !== null;
  const personalityLabel = hasAlignment ? getPersonalityLabel(alignments) : null;
  const dominantDim = hasAlignment ? getDominantDimension(alignments) : null;
  const identityColor = dominantDim ? getIdentityColor(dominantDim) : null;

  const participation =
    drep.effectiveParticipation != null ? Math.round(drep.effectiveParticipation) : null;
  const rationaleRate = Math.round(drep.rationaleRate ?? 0);

  return (
    <Link
      href={`/drep/${drep.drepId}`}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-all duration-200',
        TIER_LEFT_ACCENT[tier],
      )}
    >
      {/* Rank */}
      <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums w-6 text-right shrink-0">
        #{rank}
      </span>

      {/* Score pill */}
      <div className="shrink-0 flex flex-col items-center w-10">
        <span className={cn('text-lg font-bold tabular-nums leading-none', TIER_SCORE_COLOR[tier])}>
          {score}
        </span>
        <span
          className={cn(
            'text-[8px] font-semibold uppercase tracking-wider mt-0.5',
            TIER_SCORE_COLOR[tier],
          )}
        >
          {tier === 'Emerging' ? 'NEW' : tier.slice(0, 3).toUpperCase()}
        </span>
      </div>

      {/* Name + identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground truncate">{displayName}</span>
          {personalityLabel && identityColor && (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0"
              style={{
                borderColor: `${identityColor.hex}40`,
                backgroundColor: `${identityColor.hex}10`,
                color: identityColor.hex,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: identityColor.hex }}
              />
              {personalityLabel}
            </span>
          )}
        </div>
        {/* Subtle stat line */}
        <div className="flex items-center gap-2 mt-0.5">
          {participation !== null && (
            <span className="text-[10px] text-muted-foreground">
              {participation}% participation
            </span>
          )}
          {rationaleRate > 0 && (
            <span className="text-[10px] text-muted-foreground">· {rationaleRate}% rationale</span>
          )}
          {drep.delegatorCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              · {drep.delegatorCount.toLocaleString()} delegators
            </span>
          )}
        </div>
      </div>

      {/* Momentum */}
      <span className="shrink-0">
        {momentum !== null && momentum > 0.5 ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
        ) : momentum !== null && momentum < -0.5 ? (
          <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
        ) : (
          <Minus className="h-3 w-3 text-muted-foreground/40" />
        )}
      </span>

      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}

/* ── Hands-Off: single focused DRep card ──────────────────────────────────── */
function YourDRepSummary({ dreps }: { dreps: EnrichedDRep[] }) {
  const { delegatedDrepId } = useWallet();
  const yourDrep = delegatedDrepId ? dreps.find((d) => d.drepId === delegatedDrepId) : null;
  const displayName = yourDrep
    ? yourDrep.name || yourDrep.ticker || yourDrep.handle || `${yourDrep.drepId.slice(0, 16)}\u2026`
    : null;

  return (
    <div className="space-y-3" data-discovery="gov-representatives">
      <h1 className="text-xl font-bold tracking-tight">Your Representative</h1>
      {yourDrep ? (
        <Link
          href={`/drep/${yourDrep.drepId}`}
          className="group flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/70 backdrop-blur-md hover:bg-muted/40 hover:border-border/70 transition-all"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold truncate">{displayName}</span>
              {yourDrep.isActive ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-rose-400">
                  <XCircle className="h-3.5 w-3.5" /> Inactive
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Score: {yourDrep.drepScore ?? 0} &middot;{' '}
              {yourDrep.delegatorCount?.toLocaleString() ?? 0} delegators
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        </Link>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            {delegatedDrepId
              ? 'Your representative is not yet registered on-chain.'
              : "You haven't delegated to a representative yet."}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/match">Find a representative &rarr;</Link>
          </Button>
        </div>
      )}
      {/* Score health nudge for hands-off users */}
      {yourDrep && yourDrep.drepScore != null && yourDrep.drepScore < 40 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
          <p className="text-xs text-amber-400/90">
            Your representative&apos;s governance score is {yourDrep.drepScore}/100 — below average.
            A low score means less participation, fewer explanations, or inconsistent voting.
          </p>
          <Button variant="outline" size="sm" asChild className="h-7 text-xs">
            <Link href="/match">Explore alternatives &rarr;</Link>
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground/60">
        {dreps.length > 0 ? `${dreps.length} DReps registered` : ''}
      </p>
    </div>
  );
}

type SortMode = 'score' | 'match';

export function GovernadaDRepBrowse(_props: GovernadaDRepBrowseProps) {
  const { data: rawData, isLoading } = useDReps();
  const drepsData = rawData as { allDReps?: EnrichedDRep[] } | undefined;
  const dreps: EnrichedDRep[] = useMemo(() => drepsData?.allDReps ?? [], [drepsData]);
  const { isAtLeast } = useGovernanceDepth();

  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const sortParam = searchParams.get('sort');
  const [matchProfile] = useState<StoredMatchProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    return loadMatchProfile();
  });
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'score';
    // Default to match sort when user has alignment data (WS-7)
    if (sortParam === 'score') return 'score';
    return loadMatchProfile() ? 'match' : 'score';
  });

  const deferredSearch = useDeferredValue(filters.search);
  const pageSize = viewMode === 'table' ? TABLE_PAGE_SIZE : CARD_PAGE_SIZE;

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(0);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {}
  };

  const isDefaultFilters =
    filters.search === '' &&
    filters.tier === 'All' &&
    filters.activeOnly &&
    filters.alignment === 'all';

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = dreps;

    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(
        (d) =>
          d.name?.toLowerCase().includes(q) ||
          d.ticker?.toLowerCase().includes(q) ||
          d.handle?.toLowerCase().includes(q) ||
          d.drepId.toLowerCase().includes(q),
      );
    }

    if (filters.tier !== 'All') {
      result = result.filter((d) => computeTier(d.drepScore ?? 0) === filters.tier);
    }

    if (filters.activeOnly) {
      result = result.filter((d) => d.isActive);
    }

    if (filters.alignment !== 'all') {
      const field = ALIGNMENT_FIELD_MAP[filters.alignment];
      if (field) {
        result = result.filter((d) => {
          const vals = ALIGNMENT_FIELD_MAP;
          const all = Object.values(vals).map(
            (f) => (d as unknown as Record<string, number | null>)[f],
          );
          const dominant = all.reduce<[string, number]>(
            (best, v, i) => {
              const dim = Object.keys(vals)[i];
              return v !== null && v > best[1] ? [dim, v] : best;
            },
            ['', -1],
          );
          return dominant[0] === filters.alignment;
        });
      }
    }

    // Sort by blended alignment+score when match mode active (WS-7)
    if (sortMode === 'match' && matchProfile) {
      const userAlign = matchProfile.userAlignments;
      result = [...result].sort((a, b) => {
        const aAlign: AlignmentScores = {
          treasuryConservative: a.alignmentTreasuryConservative,
          treasuryGrowth: a.alignmentTreasuryGrowth,
          decentralization: a.alignmentDecentralization,
          security: a.alignmentSecurity,
          innovation: a.alignmentInnovation,
          transparency: a.alignmentTransparency,
        };
        const bAlign: AlignmentScores = {
          treasuryConservative: b.alignmentTreasuryConservative,
          treasuryGrowth: b.alignmentTreasuryGrowth,
          decentralization: b.alignmentDecentralization,
          security: b.alignmentSecurity,
          innovation: b.alignmentInnovation,
          transparency: b.alignmentTransparency,
        };
        // Blended score: alignment × 0.7 + normalizedScore × 0.3
        const aMatchPct = distanceToMatchScore(alignmentDistance(userAlign, aAlign));
        const bMatchPct = distanceToMatchScore(alignmentDistance(userAlign, bAlign));
        const aBlended = (aMatchPct / 100) * 0.7 + ((a.drepScore ?? 0) / 100) * 0.3;
        const bBlended = (bMatchPct / 100) * 0.7 + ((b.drepScore ?? 0) / 100) * 0.3;
        return bBlended - aBlended;
      });
    }

    return result;
  }, [dreps, deferredSearch, filters, sortMode, matchProfile]);

  // Separate active/inactive for card view compact treatment
  const { activeItems, inactiveItems } = useMemo(() => {
    if (filters.activeOnly) return { activeItems: filtered, inactiveItems: [] };
    return {
      activeItems: filtered.filter((d) => d.isActive),
      inactiveItems: filtered.filter((d) => !d.isActive),
    };
  }, [filtered, filters.activeOnly]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Pagination operates on active items in card view, all items in table
  const paginationItems = viewMode === 'cards' ? activeItems : filtered;
  const totalPages = Math.ceil(paginationItems.length / pageSize);
  const pageItems = paginationItems.slice(page * pageSize, (page + 1) * pageSize);

  // Fetch endorsement counts for visible DReps
  const pageEntityIds = useMemo(() => pageItems.map((d) => d.drepId), [pageItems]);
  const { data: endorsementData } = useBatchEndorsementCounts('drep', pageEntityIds);
  const endorsementCounts = endorsementData?.counts ?? {};

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  // ── Hands-Off: focused single-DRep card ────────────────────────────────
  if (!isAtLeast('informed')) {
    return <YourDRepSummary dreps={dreps} />;
  }

  // ── Informed: top DReps by activity + your DRep highlighted ─────────────
  const isInformedOnly = !isAtLeast('engaged');

  return (
    <div ref={contentRef} className="space-y-3" data-discovery="gov-representatives">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            {isInformedOnly ? 'Top Representatives' : 'Find Your Representative'}
          </h1>
          <span className="text-xs text-muted-foreground shrink-0">
            {dreps.length > 0 ? `${dreps.length} DReps registered` : ''}
          </span>
        </div>
        {!isInformedOnly && (
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Every DRep has a unique governance philosophy. Find someone who represents your values.
          </p>
        )}
      </div>

      <AnonymousNudge variant="representatives" />

      {/* ── Sticky filter bar — Engaged+ ─────────────────────────── */}
      <DepthGate minDepth="engaged">
        <div className="sticky top-14 lg:top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-card/60 backdrop-blur-xl border-b border-border/30">
          <DiscoverFilterBar
            search={filters.search}
            onSearchChange={(v) => setFilter('search', v)}
            searchPlaceholder="Search by name, ticker, or ID\u2026"
            chipGroups={[
              {
                label: 'Tier',
                value: filters.tier,
                options: TIER_CHIPS,
                onChange: (v) => setFilter('tier', v),
              },
              {
                label: 'Alignment',
                value: filters.alignment,
                options: ALIGNMENT_OPTIONS,
                onChange: (v) => setFilter('alignment', v),
              },
            ]}
            toggles={[
              {
                label: 'Active DReps only',
                checked: filters.activeOnly,
                onChange: (v) => setFilter('activeOnly', v),
              },
            ]}
            resultCount={filtered.length}
            totalCount={dreps.length}
            entityLabel="DReps"
            isFiltered={!isDefaultFilters}
            onReset={resetFilters}
            pageInfo={totalPages > 1 ? `Page ${page + 1} / ${totalPages}` : undefined}
          />

          {/* Consolidated toolbar: match sort + view toggle */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
            <div className="flex items-center gap-2">
              {matchProfile && (
                <>
                  <button
                    onClick={() => setSortMode(sortMode === 'match' ? 'score' : 'match')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                      sortMode === 'match'
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    {sortMode === 'match' ? 'Best Match' : 'Governance Score'}
                  </button>
                  {sortMode === 'match' && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      Based on your{' '}
                      <Link href="/match" className="text-primary hover:underline">
                        profile
                      </Link>
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-0.5">
              <button
                onClick={() => toggleViewMode('cards')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'cards'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => toggleViewMode('table')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'table'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Table view"
              >
                <TableProperties className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </DepthGate>

      {/* ── Content ──────────────────────────────────────────────── */}
      {isInformedOnly ? (
        /* Informed: top DReps by score, compact card grid, no filters */
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
            Scores reflect participation, rationale quality, reliability, and profile completeness.
            Higher is better — Gold (70+) and Diamond (85+) DReps are the most engaged voices in
            governance.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeItems.slice(0, 12).map((drep, i) => (
              <div
                key={drep.drepId}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
              >
                <GovernadaDRepCard
                  drep={drep}
                  rank={i + 1}
                  endorsementCount={endorsementCounts[drep.drepId]}
                />
              </div>
            ))}
          </div>
        </div>
      ) : pageItems.length === 0 && inactiveItems.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          {filters.alignment !== 'all' ? (
            <>
              <p className="text-muted-foreground text-sm">
                No DReps have{' '}
                {ALIGNMENT_OPTIONS.find((a) => a.value === filters.alignment)?.label?.toLowerCase()}{' '}
                as their strongest alignment.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Try a different alignment or clear filters to browse all DReps.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No DReps match your filters.</p>
          )}
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Clear filters
          </Button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-6">
          {/* Active DRep cards */}
          {pageItems.length > 0 && (
            <div key={page} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageItems.map((drep, i) => {
                let ms: number | null = null;
                if (sortMode === 'match' && matchProfile) {
                  const dAlign: AlignmentScores = {
                    treasuryConservative: drep.alignmentTreasuryConservative,
                    treasuryGrowth: drep.alignmentTreasuryGrowth,
                    decentralization: drep.alignmentDecentralization,
                    security: drep.alignmentSecurity,
                    innovation: drep.alignmentInnovation,
                    transparency: drep.alignmentTransparency,
                  };
                  ms = distanceToMatchScore(alignmentDistance(matchProfile.userAlignments, dAlign));
                }
                return (
                  <div
                    key={drep.drepId}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                    style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
                  >
                    <GovernadaDRepCard
                      drep={drep}
                      rank={sortMode === 'match' ? undefined : page * pageSize + i + 1}
                      matchScore={ms}
                      endorsementCount={endorsementCounts[drep.drepId]}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Compact inactive DReps — only shown when activeOnly is off and on first page */}
          {!filters.activeOnly && inactiveItems.length > 0 && page === 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Inactive Representatives ({inactiveItems.length})
              </p>
              <div className="space-y-1">
                {inactiveItems.slice(0, 20).map((drep, i) => (
                  <InactiveDRepRow
                    key={drep.drepId}
                    drep={drep}
                    animationDelay={Math.min(i, 14) * 30}
                  />
                ))}
                {inactiveItems.length > 20 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-2">
                    + {inactiveItems.length - 20} more inactive DReps
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 divide-y divide-border/50 overflow-hidden bg-card/40 backdrop-blur-md">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="w-6 text-right shrink-0">#</span>
            <span className="w-10 text-center shrink-0">Score</span>
            <span className="flex-1">Representative</span>
            <span className="w-5 shrink-0" />
            <span className="w-3.5 shrink-0" />
          </div>
          {pageItems.map((drep, i) => (
            <DRepTableRow key={drep.drepId} drep={drep} rank={page * pageSize + i + 1} />
          ))}
        </div>
      )}

      {/* Deep: analytics context placeholder */}
      <DepthGate minDepth="deep">
        {/* TODO: Phase 6+ — DRep analytics, voting pattern analysis, delegation flow visualization */}
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 p-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            DRep analytics and delegation flow visualization coming soon
          </p>
        </div>
      </DepthGate>

      {!isInformedOnly && (
        <DiscoverPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
