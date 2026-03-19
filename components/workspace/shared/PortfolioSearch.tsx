'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Search, LayoutGrid, List } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PortfolioSearchProps {
  filter: string;
  onFilterChange: (filter: string) => void;
  viewMode: 'kanban' | 'list';
  onViewModeChange: (mode: 'kanban' | 'list') => void;
  placeholder?: string;
  showArchiveToggle?: boolean;
  showArchived?: boolean;
  onShowArchivedChange?: (show: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioSearch({
  filter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  placeholder = 'Search...',
  showArchiveToggle = false,
  showArchived = false,
  onShowArchivedChange,
}: PortfolioSearchProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search input */}
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center rounded-md border border-border overflow-hidden">
        <Button
          variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
          size="icon-xs"
          className="rounded-none h-8 w-8"
          onClick={() => onViewModeChange('kanban')}
          aria-label="Kanban view"
          aria-pressed={viewMode === 'kanban'}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="icon-xs"
          className="rounded-none h-8 w-8"
          onClick={() => onViewModeChange('list')}
          aria-label="List view"
          aria-pressed={viewMode === 'list'}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Archive toggle */}
      {showArchiveToggle && onShowArchivedChange && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Switch size="sm" checked={showArchived} onCheckedChange={onShowArchivedChange} />
          Archived
        </label>
      )}
    </div>
  );
}
