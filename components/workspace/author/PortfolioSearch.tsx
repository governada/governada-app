'use client';

import { useWorkspaceStore } from '@/lib/workspace/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Search, LayoutGrid, List } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PortfolioSearchProps {
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioSearch({ showArchived, onShowArchivedChange }: PortfolioSearchProps) {
  const authorFilter = useWorkspaceStore((s) => s.authorFilter);
  const setAuthorFilter = useWorkspaceStore((s) => s.setAuthorFilter);
  const authorViewMode = useWorkspaceStore((s) => s.authorViewMode);
  const setAuthorViewMode = useWorkspaceStore((s) => s.setAuthorViewMode);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search input */}
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search drafts..."
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center rounded-md border border-border overflow-hidden">
        <Button
          variant={authorViewMode === 'kanban' ? 'secondary' : 'ghost'}
          size="icon-xs"
          className="rounded-none h-8 w-8"
          onClick={() => setAuthorViewMode('kanban')}
          aria-label="Kanban view"
          aria-pressed={authorViewMode === 'kanban'}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={authorViewMode === 'list' ? 'secondary' : 'ghost'}
          size="icon-xs"
          className="rounded-none h-8 w-8"
          onClick={() => setAuthorViewMode('list')}
          aria-label="List view"
          aria-pressed={authorViewMode === 'list'}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Archive toggle */}
      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
        <Switch size="sm" checked={showArchived} onCheckedChange={onShowArchivedChange} />
        Archived
      </label>
    </div>
  );
}
