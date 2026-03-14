'use client';

import { Search, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChipOption {
  value: string;
  label: string;
  tooltip?: string;
}

interface ChipGroup {
  label: string;
  value: string;
  options: ChipOption[];
  onChange: (value: string) => void;
}

interface DiscoverFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chipGroups?: ChipGroup[];
  toggles?: { label: string; checked: boolean; onChange: (checked: boolean) => void }[];
  resultCount: number;
  totalCount?: number;
  entityLabel: string;
  isFiltered: boolean;
  onReset: () => void;
  /** Page info shown in the header row */
  pageInfo?: string;
}

function ChipButton({
  opt,
  isActive,
  onClick,
}: {
  opt: ChipOption;
  isActive: boolean;
  onClick: () => void;
}) {
  const btn = (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {opt.label}
    </button>
  );

  if (!opt.tooltip) return btn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-56">
        {opt.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function DiscoverFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search\u2026',
  chipGroups,
  toggles,
  resultCount,
  totalCount,
  entityLabel,
  isFiltered,
  onReset,
  pageInfo,
}: DiscoverFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Search row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isFiltered && (
          <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Chip groups */}
      {chipGroups?.map((group) => (
        <TooltipProvider key={group.label}>
          <div className="flex flex-wrap items-center gap-2">
            {group.options.map((opt) => (
              <ChipButton
                key={opt.value}
                opt={opt}
                isActive={group.value === opt.value}
                onClick={() => group.onChange(opt.value)}
              />
            ))}
            {/* Inline toggles after chip group */}
            {toggles?.map((t) => (
              <label
                key={t.label}
                className="ml-2 flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none"
              >
                <input
                  type="checkbox"
                  checked={t.checked}
                  onChange={(e) => t.onChange(e.target.checked)}
                  className="h-3 w-3 rounded accent-primary"
                />
                {t.label}
              </label>
            ))}
          </div>
        </TooltipProvider>
      ))}

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <strong className="text-foreground">{resultCount}</strong>
          {isFiltered && totalCount != null && ` of ${totalCount}`} {entityLabel}
        </span>
        {pageInfo && <span>{pageInfo}</span>}
      </div>
    </div>
  );
}
