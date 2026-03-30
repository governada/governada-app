/**
 * SenecaSearchPanel — Search UI for anonymous users in the Seneca panel.
 *
 * Includes:
 * - SearchInput: Semantic search input field
 * - SearchResultsContent: Results grid with Seneca narration
 */

import { useCallback, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { CompassSigil } from '@/components/governada/CompassSigil';
import type { SearchResult } from '@/hooks/useSenecaSearch';
import type { PanelRoute } from '@/hooks/useSenecaThread';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Search placeholders per route
// ---------------------------------------------------------------------------

const SEARCH_PLACEHOLDERS: Record<PanelRoute, string> = {
  hub: 'Search proposals, representatives, pools...',
  proposal: 'Search for similar proposals...',
  drep: 'Search for similar representatives...',
  'proposals-list': 'Search proposals by topic...',
  'representatives-list': 'Search representatives by priority...',
  health: 'Search governance topics...',
  treasury: 'Search treasury proposals...',
  workspace: 'Search governance entities...',
  default: 'Search proposals, representatives, pools...',
};

// ---------------------------------------------------------------------------
// SearchInput
// ---------------------------------------------------------------------------

export function SearchInput({
  onSearch,
  isSearching,
  panelRoute,
}: {
  onSearch: (query: string) => void;
  isSearching: boolean;
  panelRoute: PanelRoute;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (value.trim().length >= 2) {
        onSearch(value.trim());
      }
    },
    [value, onSearch],
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2.5">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={SEARCH_PLACEHOLDERS[panelRoute]}
          className={cn(
            'w-full pl-8 pr-3 py-2 rounded-xl text-sm',
            'bg-white/[0.04] border border-white/[0.08]',
            'text-foreground/90 placeholder:text-muted-foreground/40',
            'focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30',
            'transition-colors',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              inputRef.current?.blur();
            }
          }}
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Narration helper — Seneca contextualizes the search results
// ---------------------------------------------------------------------------

function getSearchNarration(results: SearchResult[], query: string): string {
  const proposalCount = results.filter((r) => r.entityType === 'proposal').length;
  const drepCount = results.filter((r) => r.entityType === 'drep_profile').length;

  if (proposalCount > 0 && drepCount > 0) {
    return `I found ${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} and ${drepCount} representative${drepCount !== 1 ? 's' : ''} related to "${query}." Here's what stands out:`;
  }
  if (proposalCount > 0) {
    return `Here are ${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} related to "${query}." Each one could shape Cardano's direction:`;
  }
  if (drepCount > 0) {
    return `I found ${drepCount} representative${drepCount !== 1 ? 's' : ''} whose priorities align with "${query}":`;
  }
  return `Here's what I found for "${query}":`;
}

// ---------------------------------------------------------------------------
// SearchResultsContent
// ---------------------------------------------------------------------------

export function SearchResultsContent({
  results,
  query,
  isSearching,
  error,
  onClear,
  accentColor,
}: {
  results: SearchResult[];
  query: string;
  isSearching: boolean;
  error: string | null;
  onClear: () => void;
  accentColor?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Search context header */}
      <div className="flex items-center gap-2">
        <CompassSigil
          state={isSearching ? 'searching' : 'idle'}
          size={14}
          accentColor={accentColor}
        />
        <p className="text-xs text-muted-foreground/70 flex-1">
          {isSearching ? (
            'Searching across governance...'
          ) : error ? (
            <span className="text-red-400/70">{error}</span>
          ) : results.length === 0 ? (
            <>No results found for &ldquo;{query}&rdquo;. Try different terms.</>
          ) : (
            <>
              Found {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}
              &rdquo;
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Seneca narration of results */}
      {results.length > 0 && !isSearching && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 items-start"
        >
          <p className="text-sm text-foreground/70 leading-relaxed">
            {getSearchNarration(results, query)}
          </p>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {isSearching && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2"
            >
              <div className="h-3 bg-white/[0.06] rounded w-3/4" />
              <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Result cards */}
      {!isSearching &&
        results.map((result, i) => (
          <motion.div
            key={`${result.entityType}-${result.entityId}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={result.href}
              className={cn(
                'block rounded-xl p-3 space-y-1',
                'bg-white/[0.03] border border-white/[0.06]',
                'hover:bg-white/[0.06] hover:border-white/[0.10]',
                'transition-colors group',
              )}
            >
              {/* Type badge + similarity */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    result.entityType === 'proposal'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-violet-500/10 text-violet-400',
                  )}
                >
                  {result.entityType === 'proposal' ? 'Proposal' : 'Representative'}
                </span>
                {result.status && (
                  <span className="text-[10px] text-muted-foreground/50">{result.status}</span>
                )}
                <span className="text-[10px] text-muted-foreground/30 ml-auto">
                  {Math.round(result.similarity * 100)}% match
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-foreground/85 group-hover:text-foreground/95 line-clamp-2 transition-colors">
                {result.title}
              </p>

              {/* Subtitle */}
              {result.subtitle && (
                <p className="text-xs text-muted-foreground/50 line-clamp-1">{result.subtitle}</p>
              )}

              {/* Arrow hint */}
              <div className="flex items-center gap-1 text-primary/50 group-hover:text-primary/70 transition-colors">
                <span className="text-[10px]">View details</span>
                <ArrowRight className="h-2.5 w-2.5" />
              </div>
            </Link>
          </motion.div>
        ))}
    </div>
  );
}
