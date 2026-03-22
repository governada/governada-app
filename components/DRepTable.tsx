'use client';

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDRepDisplayName } from '@/utils/display';
import { formatAda, getDRepScoreBadgeClass, getSizeBadgeClass } from '@/utils/scoring';
import { EnrichedDRep } from '@/lib/koios';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Heart,
  UserPlus,
  GitCompareArrows,
  Vote,
} from 'lucide-react';
import { SortConfig, SortKey } from './DRepTableClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScoreBreakdownTooltip } from './ScoreBreakdown';
import { SocialIcons } from './SocialIcons';

import { cn } from '@/lib/utils';

interface DRepTableProps {
  dreps: EnrichedDRep[];
  sortConfig?: SortConfig;
  onSort?: (key: SortKey) => void;
  watchlist?: string[];
  onWatchlistToggle?: (drepId: string) => void;
  isConnected?: boolean;
  delegatedDrepId?: string | null;
  compareSelection?: Set<string>;
  onCompareToggle?: (drepId: string) => void;
  matchData?: Record<string, number>;
}

export function DRepTable({
  dreps,
  sortConfig,
  onSort,
  watchlist = [],
  onWatchlistToggle,
  isConnected = false,
  delegatedDrepId,
  compareSelection = new Set(),
  onCompareToggle,
  matchData = {},
}: DRepTableProps) {
  const router = useRouter();
  const hasMatch = Object.keys(matchData).length > 0;
  const showCompare = !!onCompareToggle;

  if (dreps.length === 0) {
    return null;
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    );
  };

  const alignClasses: Record<string, { head: string; flex: string; ml: string }> = {
    left: { head: 'text-left', flex: '', ml: '-ml-4' },
    center: { head: 'text-center', flex: 'justify-center', ml: '' },
    right: { head: 'text-right', flex: 'justify-end', ml: '' },
  };

  const SortableHeader = ({
    columnKey,
    label,
    tooltip,
    align = 'left',
  }: {
    columnKey: SortKey;
    label: string;
    tooltip: string;
    align?: 'left' | 'center' | 'right';
  }) => {
    const ac = alignClasses[align];
    return (
      <TableHead className={ac.head}>
        <div className={`flex items-center ${ac.flex}`}>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onSort?.(columnKey);
            }}
            className={`${ac.ml} hover:bg-transparent hover:text-primary font-semibold`}
          >
            {label}
            <SortIcon columnKey={columnKey} />
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground ml-1 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableHead>
    );
  };

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {showCompare && (
              <TableHead className="w-10">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GitCompareArrows className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Select 2-3 DReps to compare</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
            )}
            <SortableHeader
              columnKey="drepScore"
              label="DRep Score"
              tooltip="An objective 0-100 accountability score based on Engagement Quality (40%), Effective Participation (25%), Reliability (25%), and Governance Identity (10%). Hover over the score for breakdown."
              align="center"
            />

            {hasMatch && (
              <SortableHeader
                columnKey="match"
                label="Match"
                tooltip="How well this DRep represents your governance positions, based on vote agreement on proposals you've voted on."
                align="center"
              />
            )}

            <TableHead className="text-left font-semibold">DRep</TableHead>

            <SortableHeader
              columnKey="sizeTier"
              label="Size"
              tooltip="DRep size tier based on voting power. Small (<100k ADA), Medium (100k-5M ADA), Large (5M-50M ADA), or Whale (>50M ADA)."
              align="center"
            />

            <SortableHeader
              columnKey="votingPower"
              label="Voting Power"
              tooltip="Total ADA delegated to this DRep."
              align="right"
            />

            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dreps.map((drep) => {
            const match = matchData[drep.drepId];

            return (
              <TableRow
                key={drep.drepId}
                className={cn(
                  'cursor-pointer hover:bg-muted/50 transition-colors',
                  compareSelection.has(drep.drepId) && 'bg-primary/5',
                )}
                onClick={() => router.push(`/drep/${encodeURIComponent(drep.drepId)}`)}
              >
                {/* Compare Checkbox */}
                {showCompare && (
                  <TableCell className="text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCompareToggle?.(drep.drepId);
                      }}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        compareSelection.has(drep.drepId)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30 hover:border-primary/60',
                      )}
                      aria-label={
                        compareSelection.has(drep.drepId)
                          ? 'Remove from comparison'
                          : 'Add to comparison'
                      }
                    >
                      {compareSelection.has(drep.drepId) && (
                        <svg
                          viewBox="0 0 12 12"
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </button>
                  </TableCell>
                )}
                {/* DRep Score */}
                <TableCell className="text-center">
                  <ScoreBreakdownTooltip drep={drep}>
                    <div className="flex flex-col items-center min-w-[40px] cursor-help mx-auto">
                      <span className="text-xl font-bold tabular-nums text-foreground leading-none">
                        {drep.drepScore ?? 0}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 h-4 font-medium mt-1 ${getDRepScoreBadgeClass(drep.drepScore ?? 0)}`}
                      >
                        {(drep.drepScore ?? 0) >= 80
                          ? 'Strong'
                          : (drep.drepScore ?? 0) >= 60
                            ? 'Good'
                            : 'Low'}
                      </Badge>
                    </div>
                  </ScoreBreakdownTooltip>
                </TableCell>

                {/* Match column - behavioral representation match */}
                {hasMatch && (
                  <TableCell className="text-center">
                    {match != null ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-semibold tabular-nums',
                          match >= 70
                            ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                            : match >= 50
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
                        )}
                      >
                        {match}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}

                {/* DRep Identity & Socials */}
                <TableCell>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {getDRepDisplayName(drep)}
                      </span>
                      {drep.handle && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 font-mono text-muted-foreground"
                        >
                          {drep.handle}
                        </Badge>
                      )}
                    </div>
                    <SocialIcons metadata={drep.metadata} />
                  </div>
                </TableCell>

                {/* Size Tier Badge */}
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${getSizeBadgeClass(drep.sizeTier)}`}
                  >
                    {drep.sizeTier}
                  </Badge>
                </TableCell>

                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatAda(drep.votingPower)} ADA
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onWatchlistToggle?.(drep.drepId);
                            }}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                            aria-label={
                              watchlist.includes(drep.drepId)
                                ? 'Remove from watchlist'
                                : 'Add to watchlist'
                            }
                          >
                            <Heart
                              className={cn(
                                'h-4 w-4 transition-colors',
                                watchlist.includes(drep.drepId)
                                  ? 'fill-red-500 text-red-500'
                                  : 'text-muted-foreground hover:text-red-400',
                              )}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {watchlist.includes(drep.drepId)
                              ? 'Remove from watchlist'
                              : 'Add to watchlist'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/drep/${encodeURIComponent(drep.drepId)}`);
                            }}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                            aria-label={
                              delegatedDrepId === drep.drepId
                                ? 'Your current DRep'
                                : 'Delegate to this DRep'
                            }
                          >
                            <Vote
                              className={cn(
                                'h-4 w-4 transition-colors',
                                delegatedDrepId === drep.drepId
                                  ? 'fill-primary text-primary'
                                  : 'text-muted-foreground hover:text-primary',
                              )}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {delegatedDrepId === drep.drepId
                              ? 'Your current DRep'
                              : 'Delegate to this DRep'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {isConnected && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/drep/${encodeURIComponent(drep.drepId)}#claim`);
                              }}
                              className="p-2 hover:bg-muted rounded-full transition-colors"
                              aria-label="Claim this profile"
                            >
                              <UserPlus className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Claim this DRep profile</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
