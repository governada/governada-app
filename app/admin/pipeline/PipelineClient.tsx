'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, CheckCircle2, XCircle, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chartTheme } from '@/lib/charts';
import { useChartDimensions } from '@/lib/charts';

interface SyncAggregate {
  sync_type: string;
  total: number;
  successes: number;
  failures: number;
  success_rate: number;
  avg_duration_ms: number | null;
  p95_duration_ms: number | null;
  max_duration_ms: number | null;
  last_run: string;
  recent_errors: string[];
}

interface TimelinePoint {
  hour: string;
  success: number;
  failure: number;
}

interface SyncLog {
  id: number;
  sync_type: string;
  success: boolean;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

interface PipelineData {
  logs: SyncLog[];
  aggregates: SyncAggregate[];
  timeline: TimelinePoint[];
  sync_types: string[];
}

const TIME_RANGES = [
  { label: '6 hours', value: '6' },
  { label: '24 hours', value: '24' },
  { label: '3 days', value: '72' },
  { label: '7 days', value: '168' },
];

function formatDuration(ms: number | null): string {
  if (ms === null) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TimelineChart({ data }: { data: TimelinePoint[] }) {
  const { containerRef, dimensions } = useChartDimensions(180);
  const { width, height } = dimensions;
  const margin = { top: 10, right: 12, bottom: 24, left: 36 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxVal = useMemo(() => Math.max(1, ...data.map((d) => d.success + d.failure)), [data]);

  if (innerW <= 0 || innerH <= 0) {
    return <div ref={containerRef} className="w-full h-[180px]" />;
  }

  const barW = Math.max(2, (innerW / data.length) * 0.7);
  const gap = innerW / data.length;

  return (
    <div ref={containerRef} className="w-full h-[180px]">
      <svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={margin.left}
            x2={width - margin.right}
            y1={margin.top + innerH * (1 - frac)}
            y2={margin.top + innerH * (1 - frac)}
            stroke={chartTheme.colors.grid}
            strokeWidth={0.5}
          />
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const x = margin.left + i * gap + gap / 2 - barW / 2;
          const successH = (d.success / maxVal) * innerH;
          const failH = (d.failure / maxVal) * innerH;

          return (
            <g key={i}>
              {/* Success bar */}
              <rect
                x={x}
                y={margin.top + innerH - successH - failH}
                width={barW}
                height={successH}
                fill="oklch(0.72 0.17 155)"
                rx={1}
                opacity={0.85}
              >
                <title>
                  {d.hour}: {d.success} success, {d.failure} failure
                </title>
              </rect>
              {/* Failure bar stacked on top */}
              {d.failure > 0 && (
                <rect
                  x={x}
                  y={margin.top + innerH - failH}
                  width={barW}
                  height={failH}
                  fill="oklch(0.60 0.20 25)"
                  rx={1}
                  opacity={0.85}
                />
              )}
            </g>
          );
        })}

        {/* Y-axis labels */}
        {[0, Math.round(maxVal / 2), maxVal].map((val, i) => (
          <text
            key={i}
            x={margin.left - 6}
            y={margin.top + innerH * (1 - val / maxVal) + 4}
            textAnchor="end"
            fill={chartTheme.colors.axis}
            fontSize={chartTheme.font.size.tick}
            fontFamily={chartTheme.font.mono}
          >
            {val}
          </text>
        ))}

        {/* X-axis labels (every 6th) */}
        {data
          .filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0)
          .map((d, i) => {
            const origIdx = data.indexOf(d);
            const x = margin.left + origIdx * gap + gap / 2;
            return (
              <text
                key={i}
                x={x}
                y={height - 4}
                textAnchor="middle"
                fill={chartTheme.colors.axis}
                fontSize={chartTheme.font.size.tick}
                fontFamily={chartTheme.font.mono}
              >
                {d.hour.slice(11, 16)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

function SyncTypeCard({ agg }: { agg: SyncAggregate }) {
  const isHealthy = agg.success_rate >= 90;
  const isWarning = agg.success_rate >= 50 && agg.success_rate < 90;

  return (
    <Card
      className={cn(
        'border-l-2',
        isHealthy ? 'border-l-emerald-500' : isWarning ? 'border-l-amber-500' : 'border-l-red-500',
      )}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-semibold">{agg.sync_type}</p>
            <p className="text-xs text-muted-foreground">{formatTimeAgo(agg.last_run)}</p>
          </div>
          <Badge
            variant={isHealthy ? 'default' : isWarning ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {agg.success_rate}%
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Runs</span>
            <p className="font-mono font-medium">{agg.total}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Avg</span>
            <p className="font-mono font-medium">{formatDuration(agg.avg_duration_ms)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">P95</span>
            <p className="font-mono font-medium">{formatDuration(agg.p95_duration_ms)}</p>
          </div>
        </div>
        {agg.recent_errors.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <p className="text-xs text-red-400 truncate" title={agg.recent_errors[0]}>
              {agg.recent_errors[0]}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PipelineClient() {
  const [hours, setHours] = useState('24');
  const [syncTypeFilter, setSyncTypeFilter] = useState<string>('all');

  const { data, isLoading } = useQuery<PipelineData>({
    queryKey: ['admin', 'pipeline', hours, syncTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ hours });
      if (syncTypeFilter !== 'all') params.set('syncType', syncTypeFilter);
      const res = await fetch(`/api/admin/pipeline?${params}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline data');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const totalRuns = data?.aggregates.reduce((sum, a) => sum + a.total, 0) || 0;
  const totalFailures = data?.aggregates.reduce((sum, a) => sum + a.failures, 0) || 0;
  const overallSuccessRate =
    totalRuns > 0 ? Math.round(((totalRuns - totalFailures) / totalRuns) * 100) : 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Health</h1>
          <p className="text-sm text-muted-foreground">
            Inngest sync function performance and reliability
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && data.sync_types.length > 0 && (
            <Select value={syncTypeFilter} onValueChange={setSyncTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {data.sync_types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-[180px] bg-muted rounded-lg" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-3">
                <Activity className="h-8 w-8 text-chart-1" />
                <div>
                  <p className="text-2xl font-bold">{totalRuns}</p>
                  <p className="text-xs text-muted-foreground">Total runs ({hours}h)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-3">
                <Zap
                  className={cn(
                    'h-8 w-8',
                    overallSuccessRate >= 95
                      ? 'text-emerald-500'
                      : overallSuccessRate >= 80
                        ? 'text-amber-500'
                        : 'text-red-500',
                  )}
                />
                <div>
                  <p className="text-2xl font-bold">{overallSuccessRate}%</p>
                  <p className="text-xs text-muted-foreground">Success rate</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-3">
                <AlertTriangle
                  className={cn(
                    'h-8 w-8',
                    totalFailures === 0 ? 'text-emerald-500' : 'text-red-500',
                  )}
                />
                <div>
                  <p className="text-2xl font-bold">{totalFailures}</p>
                  <p className="text-xs text-muted-foreground">Failures</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500/80" /> Success
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-red-500/80" /> Failure
                </span>
              </div>
              <TimelineChart data={data.timeline} />
            </CardContent>
          </Card>

          {/* Per-type breakdown */}
          <div>
            <h2 className="text-base font-semibold mb-3">By Sync Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.aggregates.map((agg) => (
                <SyncTypeCard key={agg.sync_type} agg={agg} />
              ))}
            </div>
          </div>

          {/* Recent logs table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sync Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.success ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.sync_type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatTimeAgo(log.started_at)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatDuration(log.duration_ms)}
                        </TableCell>
                        <TableCell className="text-xs text-red-400 max-w-[200px] truncate">
                          {log.error_message || '--'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
