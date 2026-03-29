'use client';

import { useState, useCallback, useMemo } from 'react';
import type { AuthorDecisionTableItem, AuthorTablePhase } from '@/lib/workspace/types';

export type AuthorSortColumn =
  | 'title'
  | 'type'
  | 'phase'
  | 'quality'
  | 'risk'
  | 'feedback'
  | 'updated'
  | 'action';

export type SortDirection = 'asc' | 'desc';

const RISK_ORDER: Record<string, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

function compareSortColumn(
  a: AuthorDecisionTableItem,
  b: AuthorDecisionTableItem,
  col: AuthorSortColumn,
): number {
  switch (col) {
    case 'title':
      return (a.title || '').localeCompare(b.title || '');
    case 'type':
      return (a.proposalType || '').localeCompare(b.proposalType || '');
    case 'phase': {
      const order: Record<AuthorTablePhase, number> = {
        draft: 0,
        in_review: 1,
        on_chain: 2,
        archived: 3,
      };
      return order[a.phase] - order[b.phase];
    }
    case 'quality':
      return b.fieldCompleteness - a.fieldCompleteness;
    case 'risk': {
      const aR = a.constitutionalRisk ? (RISK_ORDER[a.constitutionalRisk] ?? 4) : 4;
      const bR = b.constitutionalRisk ? (RISK_ORDER[b.constitutionalRisk] ?? 4) : 4;
      return bR - aR;
    }
    case 'feedback':
      return (b.feedbackCount ?? -1) - (a.feedbackCount ?? -1);
    case 'updated':
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    case 'action':
      return (a.nextAction || '').localeCompare(b.nextAction || '');
    default:
      return 0;
  }
}

export function useAuthorTableState() {
  const [sortColumn, setSortColumn] = useState<AuthorSortColumn>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [phaseFilter, setPhaseFilter] = useState<'all' | AuthorTablePhase>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const onSort = useCallback(
    (col: AuthorSortColumn) => {
      if (col === sortColumn) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(col);
        setSortDirection('asc');
      }
    },
    [sortColumn],
  );

  const filterAndSort = useCallback(
    (items: AuthorDecisionTableItem[]): AuthorDecisionTableItem[] => {
      let result = items;

      // Phase filter
      if (phaseFilter !== 'all') {
        result = result.filter((item) => item.phase === phaseFilter);
      }

      // Search filter
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        result = result.filter((item) => item.title.toLowerCase().includes(term));
      }

      // Sort
      const dir = sortDirection === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => dir * compareSortColumn(a, b, sortColumn));

      return result;
    },
    [phaseFilter, searchTerm, sortColumn, sortDirection],
  );

  return useMemo(
    () => ({
      sortColumn,
      sortDirection,
      phaseFilter,
      searchTerm,
      onSort,
      setPhaseFilter,
      setSearchTerm,
      filterAndSort,
    }),
    [sortColumn, sortDirection, phaseFilter, searchTerm, onSort, filterAndSort],
  );
}
