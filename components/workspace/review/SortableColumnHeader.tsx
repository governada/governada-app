'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { SortColumn, SortDirection } from '@/hooks/useDecisionTableState';

interface SortableColumnHeaderProps {
  column: SortColumn;
  label: string;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  className?: string;
}

export function SortableColumnHeader({
  column,
  label,
  activeColumn,
  direction,
  onSort,
  className,
}: SortableColumnHeaderProps) {
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
