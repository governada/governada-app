'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { AuthorTablePhase } from '@/lib/workspace/types';

interface PhaseCounts {
  all: number;
  draft: number;
  in_review: number;
  on_chain: number;
  [key: string]: number;
}

interface AuthorTableFiltersProps {
  phaseFilter: 'all' | AuthorTablePhase;
  onPhaseChange: (phase: 'all' | AuthorTablePhase) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  counts: PhaseCounts;
}

const PHASE_TABS: Array<{ value: 'all' | AuthorTablePhase; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'in_review', label: 'In Review' },
  { value: 'on_chain', label: 'On-Chain' },
];

export function AuthorTableFilters({
  phaseFilter,
  onPhaseChange,
  searchTerm,
  onSearchChange,
  counts,
}: AuthorTableFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Phase tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
        {PHASE_TABS.map((tab) => {
          const count = counts[tab.value];
          const isActive = phaseFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onPhaseChange(tab.value)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span
                className={`tabular-nums ${
                  isActive ? 'text-foreground/70' : 'text-muted-foreground/60'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search drafts..."
          className="h-8 w-40 pl-8 text-xs"
        />
      </div>
    </div>
  );
}
