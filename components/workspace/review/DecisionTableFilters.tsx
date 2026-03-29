'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { DecisionTablePhase } from '@/lib/workspace/types';

interface PhaseCounts {
  all: number;
  feedback: number;
  voting: number;
  completed: number;
}

interface DecisionTableFiltersProps {
  phaseFilter: 'all' | DecisionTablePhase;
  onPhaseChange: (phase: 'all' | DecisionTablePhase) => void;
  urgencyOnly: boolean;
  onUrgencyChange: (value: boolean) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  counts: PhaseCounts;
}

const PHASE_TABS: Array<{ value: 'all' | DecisionTablePhase; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'voting', label: 'Voting' },
  { value: 'completed', label: 'Done' },
];

export function DecisionTableFilters({
  phaseFilter,
  onPhaseChange,
  urgencyOnly,
  onUrgencyChange,
  searchTerm,
  onSearchChange,
  counts,
}: DecisionTableFiltersProps) {
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

      {/* Right side: urgency toggle + search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="urgency-filter"
            checked={urgencyOnly}
            onCheckedChange={onUrgencyChange}
            className="scale-75"
          />
          <Label htmlFor="urgency-filter" className="text-xs text-muted-foreground cursor-pointer">
            Urgent only
          </Label>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="h-8 w-40 pl-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
