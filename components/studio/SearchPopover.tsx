'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  /** Content per section for "This Proposal" search */
  proposalContent?: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  /** Queue items for "Queue" search */
  queueItems?: Array<{ txHash: string; title: string; abstract: string | null }>;
  onSelectQueueItem?: (txHash: string) => void;
}

type SearchScope = 'proposal' | 'queue';

const SECTION_LABELS: Record<string, string> = {
  title: 'Title',
  abstract: 'Abstract',
  motivation: 'Motivation',
  rationale: 'Rationale',
};

/** Extract a snippet around a match with context. */
function getSnippet(text: string, query: string, contextChars = 60): string {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return '';

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  let snippet = '';
  if (start > 0) snippet += '...';
  snippet += text.slice(start, end);
  if (end < text.length) snippet += '...';
  return snippet;
}

export function SearchPopover({
  isOpen,
  onClose,
  proposalContent,
  queueItems,
  onSelectQueueItem,
}: SearchPopoverProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('proposal');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  // Proposal section matches
  const proposalResults = useMemo(() => {
    if (!query.trim() || !proposalContent) return [];
    const q = query.toLowerCase();
    return (['title', 'abstract', 'motivation', 'rationale'] as const)
      .filter((field) => proposalContent[field]?.toLowerCase().includes(q))
      .map((field) => ({
        field,
        label: SECTION_LABELS[field],
        snippet: getSnippet(proposalContent[field], query),
      }));
  }, [query, proposalContent]);

  // Queue item matches
  const queueResults = useMemo(() => {
    if (!query.trim() || !queueItems) return [];
    const q = query.toLowerCase();
    return queueItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.abstract && item.abstract.toLowerCase().includes(q)),
    );
  }, [query, queueItems]);

  const handleSelectQueueItem = useCallback(
    (txHash: string) => {
      onSelectQueueItem?.(txHash);
      onClose();
    },
    [onSelectQueueItem, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full right-0 mt-1 w-80 max-h-96 rounded-lg border border-border bg-background shadow-lg z-50 flex flex-col overflow-hidden"
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
        <button
          onClick={onClose}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Scope tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
        <button
          onClick={() => setScope('proposal')}
          className={cn(
            'px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer',
            scope === 'proposal'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          This Proposal
        </button>
        {queueItems && queueItems.length > 0 && (
          <button
            onClick={() => setScope('queue')}
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer',
              scope === 'queue'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Queue
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!query.trim() ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60">
            Type to search...
          </div>
        ) : scope === 'proposal' ? (
          proposalResults.length > 0 ? (
            <div className="p-1.5 space-y-1">
              {proposalResults.map((result) => (
                <div
                  key={result.field}
                  className="rounded-md px-2.5 py-2 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {result.label}
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    {result.snippet}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60">
              No matches in this proposal
            </div>
          )
        ) : queueResults.length > 0 ? (
          <div className="p-1.5 space-y-0.5">
            {queueResults.map((item) => (
              <button
                key={item.txHash}
                onClick={() => handleSelectQueueItem(item.txHash)}
                className="w-full text-left rounded-md px-2.5 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                {item.abstract && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {item.abstract}
                  </p>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60">
            No matching proposals in queue
          </div>
        )}
      </div>
    </div>
  );
}
