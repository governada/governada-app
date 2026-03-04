'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchableDRep {
  drepId: string;
  name: string | null;
  ticker: string | null;
  drepScore: number;
}

interface ConstellationSearchProps {
  onSelect: (drepId: string) => void;
  className?: string;
}

export function ConstellationSearch({ onSelect, className }: ConstellationSearchProps) {
  const [query, setQuery] = useState('');
  const [dreps, setDreps] = useState<SearchableDRep[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dreps?limit=500&fields=drepId,name,ticker,drepScore')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDreps(data?.dreps || data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return dreps
      .filter((d) => {
        const name = (d.name || '').toLowerCase();
        const ticker = (d.ticker || '').toLowerCase();
        const id = d.drepId.toLowerCase();
        return name.includes(q) || ticker.includes(q) || id.includes(q);
      })
      .slice(0, 6);
  }, [query, dreps]);

  const handleSelect = useCallback(
    (drepId: string) => {
      onSelect(drepId);
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        handleSelect(results[activeIndex].drepId);
      } else if (e.key === 'Escape') {
        setQuery('');
        setOpen(false);
        inputRef.current?.blur();
      }
    },
    [results, activeIndex, handleSelect],
  );

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative w-full max-w-sm', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search DReps, Pools..."
          className="w-full pl-9 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 backdrop-blur-md focus:outline-none focus:border-white/20 focus:bg-white/8 transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/40 hover:text-white/60"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full rounded-lg bg-[#12132a]/95 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
          {results.map((d, i) => (
            <button
              key={d.drepId}
              onClick={() => handleSelect(d.drepId)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                i === activeIndex ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5',
              )}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {d.name || d.drepId.slice(0, 20) + '...'}
                </div>
                {d.ticker && <div className="text-xs text-white/40 truncate">{d.ticker}</div>}
              </div>
              {d.drepScore > 0 && (
                <span className="ml-2 shrink-0 text-xs font-mono text-white/50">
                  {Math.round(d.drepScore)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
