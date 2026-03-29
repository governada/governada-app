'use client';

import { useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHeader, TableBody, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import { useFocusableList } from '@/hooks/useFocusableList';
import { useFocusStore } from '@/lib/workspace/focus';
import { commandRegistry } from '@/lib/workspace/commands';
import { useDecisionTableState } from '@/hooks/useDecisionTableState';
import { DecisionTableFilters } from './DecisionTableFilters';
import { DecisionTableRow } from './DecisionTableRow';
import { SortableColumnHeader } from './SortableColumnHeader';
import { posthog } from '@/lib/posthog';
import type { DecisionTableItem } from '@/lib/workspace/types';
import type { SortColumn } from '@/hooks/useDecisionTableState';

interface DecisionTableProps {
  items: DecisionTableItem[];
  isLoading: boolean;
}

const COLUMNS: Array<{ key: SortColumn; label: string; className?: string }> = [
  { key: 'title', label: 'Proposal', className: 'min-w-[180px]' },
  { key: 'type', label: 'Type' },
  { key: 'phase', label: 'Phase', className: 'hidden md:table-cell' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'risk', label: 'Const. Risk', className: 'hidden lg:table-cell' },
  { key: 'treasury', label: 'Treasury', className: 'hidden md:table-cell' },
  { key: 'signal', label: 'Community', className: 'hidden lg:table-cell' },
  { key: 'status', label: 'Status' },
];

export function DecisionTable({ items, isLoading }: DecisionTableProps) {
  const router = useRouter();
  const {
    sortColumn,
    sortDirection,
    phaseFilter,
    urgencyOnly,
    searchTerm,
    onSort,
    setPhaseFilter,
    setUrgencyOnly,
    setSearchTerm,
    filterAndSort,
  } = useDecisionTableState();

  const filteredItems = useMemo(() => filterAndSort(items), [filterAndSort, items]);

  // Phase counts (pre-filter for tab badges)
  const counts = useMemo(
    () => ({
      all: items.length,
      feedback: items.filter((i) => i.phase === 'feedback').length,
      voting: items.filter((i) => i.phase === 'voting').length,
      completed: items.filter((i) => i.phase === 'completed').length,
    }),
    [items],
  );

  // Keyboard navigation
  const { activeIndex, getListProps, getItemProps } = useFocusableList(
    'decision-table-list',
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
    if (activeListId !== 'decision-table-list') return;
    const item = filteredRef.current[idx];
    if (item) router.push(item.href);
  }, [router]);

  useEffect(() => {
    const unregisters: Array<() => void> = [];

    unregisters.push(
      commandRegistry.register({
        id: 'decision-table.open',
        label: 'Open Proposal',
        shortcut: 'enter',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'decision-table-list',
        execute: openFocused,
      }),
    );

    unregisters.push(
      commandRegistry.register({
        id: 'decision-table.down',
        label: 'Next Row',
        shortcut: 'j',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'decision-table-list',
        execute: () => useFocusStore.getState().moveDown(),
      }),
    );

    unregisters.push(
      commandRegistry.register({
        id: 'decision-table.up',
        label: 'Previous Row',
        shortcut: 'k',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'decision-table-list',
        execute: () => useFocusStore.getState().moveUp(),
      }),
    );

    return () => {
      for (const fn of unregisters) fn();
    };
  }, [openFocused]);

  // PostHog tracking
  useEffect(() => {
    posthog.capture('review_table_viewed', { itemCount: items.length });
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
      <DecisionTableFilters
        phaseFilter={phaseFilter}
        onPhaseChange={setPhaseFilter}
        urgencyOnly={urgencyOnly}
        onUrgencyChange={setUrgencyOnly}
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
              : 'No proposals match the current filters'}
          </p>
          {(searchTerm.trim() || phaseFilter !== 'all' || urgencyOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPhaseFilter('all');
                setUrgencyOnly(false);
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
                  <SortableColumnHeader
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
                <DecisionTableRow
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
