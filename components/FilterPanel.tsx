'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SlidersHorizontal, Info, RotateCcw, Heart, UserCheck } from 'lucide-react';

import { SizeTier } from '@/utils/scoring';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filterWellDocumented: boolean;
  onFilterWellDocumentedChange: (checked: boolean) => void;
  sizeFilters: Set<SizeTier>;
  onToggleSizeFilter: (size: SizeTier) => void;
  showMyDrepOnly: boolean;
  onToggleMyDrep: () => void;
  hasMyDrep: boolean;
  showWatchlistOnly: boolean;
  onToggleWatchlist: () => void;
  watchlistCount: number;
  onReset: () => void;
  hasMatch: boolean;
  sortKey: string;
  onSortByMatch: () => void;
}

export function FilterPanel({
  filterWellDocumented,
  onFilterWellDocumentedChange,
  sizeFilters,
  onToggleSizeFilter,
  showMyDrepOnly,
  onToggleMyDrep,
  hasMyDrep,
  showWatchlistOnly,
  onToggleWatchlist,
  watchlistCount,
  onReset,
  hasMatch,
  sortKey,
  onSortByMatch,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const showBestMatch = hasMatch;

  const activeCount =
    (sizeFilters.size < 4 ? 1 : 0) +
    (!filterWellDocumented ? 1 : 0) +
    (showMyDrepOnly ? 1 : 0) +
    (showWatchlistOnly ? 1 : 0);

  return (
    <div className="space-y-2">
      {/* Always visible: quick filter buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {showBestMatch && (
          <Button
            variant={sortKey === 'match' ? 'default' : 'outline'}
            size="sm"
            onClick={onSortByMatch}
            className="gap-1.5 text-xs"
          >
            Best Match
          </Button>
        )}

        {hasMyDrep && (
          <Button
            variant={showMyDrepOnly ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleMyDrep}
            className="gap-1.5 text-xs"
          >
            <UserCheck className="h-3.5 w-3.5" />
            My DRep
          </Button>
        )}

        {watchlistCount > 0 && (
          <Button
            variant={showWatchlistOnly ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleWatchlist}
            className="gap-1.5 text-xs"
          >
            <Heart className="h-3.5 w-3.5" />
            Watchlist ({watchlistCount})
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="gap-1.5 text-xs ml-auto"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Expandable filter section */}
      {expanded && (
        <div className="flex items-center gap-4 p-3 rounded-lg border bg-card/50 flex-wrap animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center gap-2">
            <Switch
              id="filter-well-documented-panel"
              checked={filterWellDocumented}
              onCheckedChange={onFilterWellDocumentedChange}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label
                    htmlFor="filter-well-documented-panel"
                    className="cursor-pointer text-sm font-medium flex items-center gap-1.5"
                  >
                    Well-Documented
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Only shows DReps with metadata (name/description).</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Size
                {sizeFilters.size < 4 && (
                  <Badge
                    variant="default"
                    className="h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full"
                  >
                    {sizeFilters.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter by Size</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['Small', 'Medium', 'Large', 'Whale'] as SizeTier[]).map((size) => (
                <DropdownMenuCheckboxItem
                  key={size}
                  checked={sizeFilters.has(size)}
                  onCheckedChange={() => onToggleSizeFilter(size)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {size}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground hover:text-primary text-xs gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
