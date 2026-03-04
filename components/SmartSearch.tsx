'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { Input } from '@/components/ui/input';
import { Search, X, Clock } from 'lucide-react';
import { EnrichedDRep } from '@/lib/koios';
import { getDRepDisplayName } from '@/utils/display';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';

const RECENT_KEY = 'drepscore_recent_searches';
const MAX_RECENT = 5;
const MAX_SUGGESTIONS = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  const existing = getRecentSearches().filter((s) => s !== query);
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...existing].slice(0, MAX_RECENT)));
}

interface SmartSearchProps {
  dreps: EnrichedDRep[];
  value: string;
  onChange: (query: string) => void;
  onSelectDRep?: (drepId: string) => void;
  className?: string;
}

export function SmartSearch({ dreps, value, onChange, onSelectDRep, className }: SmartSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(dreps, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'ticker', weight: 2 },
        { name: 'handle', weight: 2 },
        { name: 'drepId', weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
  }, [dreps]);

  const suggestions = useMemo(() => {
    if (!value.trim() || value.length < 2) return [];
    return fuse.search(value).slice(0, MAX_SUGGESTIONS);
  }, [fuse, value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleSelect = useCallback(
    (query: string) => {
      onChange(query);
      saveRecentSearch(query);
      setRecentSearches(getRecentSearches());
      setIsFocused(false);
    },
    [onChange],
  );

  const handleSelectDRep = useCallback(
    (drepId: string, name: string) => {
      saveRecentSearch(name);
      setRecentSearches(getRecentSearches());
      setIsFocused(false);
      posthog?.capture('smart_search_result_clicked', { drep_id: drepId, query: value });
      onSelectDRep?.(drepId);
    },
    [onSelectDRep],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && value.trim()) {
        saveRecentSearch(value.trim());
        setRecentSearches(getRecentSearches());
        setIsFocused(false);
        posthog?.capture('smart_search_query', {
          query: value.trim(),
          result_count: suggestions.length,
        });
      }
      if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    },
    [value],
  );

  const showDropdown =
    isFocused && (suggestions.length > 0 || (recentSearches.length > 0 && !value.trim()));

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        placeholder="Search by Name, Ticker, ID, or Handle..."
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        className="pl-9 pr-8 bg-background/50 border-primary/20 focus:border-primary/50 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Fuzzy search suggestions */}
          {suggestions.length > 0 && (
            <div className="py-1">
              {suggestions.map(({ item }) => (
                <button
                  key={item.drepId}
                  onClick={() => handleSelectDRep(item.drepId, getDRepDisplayName(item))}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{getDRepDisplayName(item)}</span>
                  {item.handle && (
                    <span className="text-xs text-muted-foreground font-mono">{item.handle}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Recent searches (when input is empty) */}
          {!value.trim() && recentSearches.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Recent
              </div>
              {recentSearches.map((search) => (
                <button
                  key={search}
                  onClick={() => handleSelect(search)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{search}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
