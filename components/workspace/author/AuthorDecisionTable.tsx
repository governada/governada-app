'use client';

import { useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHeader, TableBody, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import { useFocusableList } from '@/hooks/useFocusableList';
import { useFocusStore } from '@/lib/workspace/focus';
import { commandRegistry } from '@/lib/workspace/commands';
import { useAuthorTableState } from '@/hooks/useAuthorTableState';
import type { AuthorSortColumn } from '@/hooks/useAuthorTableState';
import { AuthorTableFilters } from './AuthorTableFilters';
import { AuthorDecisionTableRow } from './AuthorDecisionTableRow';
import { posthog } from '@/lib/posthog';
import type { AuthorDecisionTableItem } from '@/lib/workspace/types';

// Reuse SortableColumnHeader but with AuthorSortColumn
import { TableHead } from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

function AuthorSortHeader({
  column,
  label,
  activeColumn,
  direction,
  onSort,
  className,
}: {
  column: AuthorSortColumn;
  label: string;
  activeColumn: AuthorSortColumn;
  direction: 'asc' | 'desc';
  onSort: (col: AuthorSortColumn) => void;
  className?: string;
}) {
  const isActive = column === activeColumn;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded"
      >
        <span className="text-xs">{label}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

interface AuthorDecisionTableProps {
  items: AuthorDecisionTableItem[];
  isLoading: boolean;
}

const COLUMNS: Array<{ key: AuthorSortColumn; label: string; className?: string }> = [
  { key: 'title', label: 'Draft', className: 'min-w-[180px]' },
  { key: 'type', label: 'Type' },
  { key: 'phase', label: 'Phase', className: 'hidden md:table-cell' },
  { key: 'quality', label: 'Quality' },
  { key: 'risk', label: 'Const. Risk', className: 'hidden lg:table-cell' },
  { key: 'feedback', label: 'Feedback', className: 'hidden lg:table-cell' },
  { key: 'updated', label: 'Updated', className: 'hidden md:table-cell' },
  { key: 'action', label: 'Next Action' },
];

export function AuthorDecisionTable({ items, isLoading }: AuthorDecisionTableProps) {
  const router = useRouter();
  const {
    sortColumn,
    sortDirection,
    phaseFilter,
    searchTerm,
    onSort,
    setPhaseFilter,
    setSearchTerm,
    filterAndSort,
  } = useAuthorTableState();

  const filteredItems = useMemo(() => filterAndSort(items), [filterAndSort, items]);

  // Phase counts (pre-filter for tab badges)
  const counts = useMemo(
    () => ({
      all: items.length,
      draft: items.filter((i) => i.phase === 'draft').length,
      in_review: items.filter((i) => i.phase === 'in_review').length,
      on_chain: items.filter((i) => i.phase === 'on_chain').length,
    }),
    [items],
  );

  // Keyboard navigation
  const { activeIndex, getListProps, getItemProps } = useFocusableList(
    'author-table-list',
    filteredItems.length,
  );

  // Scroll focused row into view
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.querySelector('[data-focus-active="true"]');
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  // Enter to navigate
  const filteredRef = useRef(filteredItems);
  useEffect(() => {
    filteredRef.current = filteredItems;
  }, [filteredItems]);

  const openFocused = useCallback(() => {
    const { activeIndex: idx, activeListId } = useFocusStore.getState();
    if (activeListId !== 'author-table-list') return;
    const item = filteredRef.current[idx];
    if (item) router.push(item.href);
  }, [router]);

  useEffect(() => {
    const unregisters: Array<() => void> = [];

    unregisters.push(
      commandRegistry.register({
        id: 'author-table.open',
        label: 'Open Draft',
        shortcut: 'enter',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'author-table-list',
        execute: openFocused,
      }),
    );

    unregisters.push(
      commandRegistry.register({
        id: 'author-table.down',
        label: 'Next Row',
        shortcut: 'j',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'author-table-list',
        execute: () => useFocusStore.getState().moveDown(),
      }),
    );

    unregisters.push(
      commandRegistry.register({
        id: 'author-table.up',
        label: 'Previous Row',
        shortcut: 'k',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'author-table-list',
        execute: () => useFocusStore.getState().moveUp(),
      }),
    );

    return () => {
      for (const fn of unregisters) fn();
    };
  }, [openFocused]);

  // PostHog tracking
  useEffect(() => {
    posthog.capture('author_table_viewed', { itemCount: items.length });
  }, [items.length]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const listProps = getListProps();

  return (
    <div className="space-y-4">
      <AuthorTableFilters
        phaseFilter={phaseFilter}
        onPhaseChange={setPhaseFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        counts={counts}
      />

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {searchTerm.trim()
              ? `No results for "${searchTerm.trim()}"`
              : 'No drafts match the current filters'}
          </p>
          {(searchTerm.trim() || phaseFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPhaseFilter('all');
              }}
              className="text-xs text-[var(--compass-teal)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className="border border-border/50 rounded-lg overflow-hidden bg-background/40 backdrop-blur-sm"
          {...listProps}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <AuthorSortHeader
                    key={col.key}
                    column={col.key}
                    label={col.label}
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={onSort}
                    className={col.className}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item, i) => (
                <AuthorDecisionTableRow
                  key={item.id}
                  item={item}
                  isFocused={i === activeIndex}
                  itemProps={getItemProps(i)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
