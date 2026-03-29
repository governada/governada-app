'use client';

import { useState, useCallback, useMemo } from 'react';
import type { DecisionTableItem, DecisionTablePhase } from '@/lib/workspace/types';

export type SortColumn =
  | 'title'
  | 'type'
  | 'phase'
  | 'urgency'
  | 'risk'
  | 'treasury'
  | 'signal'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface DecisionTableState {
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  phaseFilter: 'all' | DecisionTablePhase;
  urgencyOnly: boolean;
  searchTerm: string;
}

const RISK_ORDER: Record<string, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

function compareSortColumn(a: DecisionTableItem, b: DecisionTableItem, col: SortColumn): number {
  switch (col) {
    case 'title':
      return (a.title || '').localeCompare(b.title || '');
    case 'type':
      return (a.proposalType || '').localeCompare(b.proposalType || '');
    case 'phase': {
      const order = { feedback: 0, voting: 1, completed: 2 };
      return order[a.phase] - order[b.phase];
    }
    case 'urgency': {
      // Epochs remaining ascending (fewer = more urgent = first)
      // Fallback to daysInReview descending (more days = more stale = first)
      const aVal = a.epochsRemaining ?? (a.daysInReview != null ? 1000 - a.daysInReview : Infinity);
      const bVal = b.epochsRemaining ?? (b.daysInReview != null ? 1000 - b.daysInReview : Infinity);
      return aVal - bVal;
    }
    case 'risk': {
      const aR = a.constitutionalRisk ? (RISK_ORDER[a.constitutionalRisk] ?? 4) : 4;
      const bR = b.constitutionalRisk ? (RISK_ORDER[b.constitutionalRisk] ?? 4) : 4;
      return bR - aR; // Higher risk first by default
    }
    case 'treasury': {
      const aT = a.treasuryAmount ?? -1;
      const bT = b.treasuryAmount ?? -1;
      return bT - aT; // Larger amounts first
    }
    case 'signal': {
      const aS = a.communitySignal
        ? a.communitySignal.support / Math.max(a.communitySignal.total, 1)
        : -1;
      const bS = b.communitySignal
        ? b.communitySignal.support / Math.max(b.communitySignal.total, 1)
        : -1;
      return bS - aS;
    }
    case 'status': {
      const order = { unreviewed: 0, snoozed: 1, feedback_given: 2, voted: 3 };
      return order[a.status] - order[b.status];
    }
    default:
      return 0;
  }
}

export function useDecisionTableState() {
  const [sortColumn, setSortColumn] = useState<SortColumn>('urgency');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [phaseFilter, setPhaseFilter] = useState<'all' | DecisionTablePhase>('all');
  const [urgencyOnly, setUrgencyOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const onSort = useCallback(
    (col: SortColumn) => {
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
    (items: DecisionTableItem[]): DecisionTableItem[] => {
      let result = items;

      // Phase filter
      if (phaseFilter !== 'all') {
        result = result.filter((item) => item.phase === phaseFilter);
      }

      // Urgency filter
      if (urgencyOnly) {
        result = result.filter(
          (item) => item.isUrgent || (item.epochsRemaining != null && item.epochsRemaining <= 3),
        );
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
    [phaseFilter, urgencyOnly, searchTerm, sortColumn, sortDirection],
  );

  return useMemo(
    () => ({
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
    }),
    [sortColumn, sortDirection, phaseFilter, urgencyOnly, searchTerm, onSort, filterAndSort],
  );
}
