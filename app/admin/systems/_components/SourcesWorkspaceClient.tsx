'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SourceHealthSummary, SourceVendor } from '@/lib/sourceHealth';
import { fetchSystemsSection, formatDateTime } from './systems-client';
import { EmptyState, SectionCard, StatusBadge, WorkspaceHero } from './systems-ui';

function formatSource(source: SourceVendor) {
  return source === 'koios' ? 'Koios' : 'Blockfrost';
}

function formatLatency(p50: number, p95: number) {
  return `${p50}ms / ${p95}ms`;
}

function formatSuccessRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatErrorBreakdown(value: Record<string, number>) {
  const entries = Object.entries(value).filter(([, count]) => count > 0);
  if (entries.length === 0) return 'None';
  return entries.map(([key, count]) => `${key}: ${count}`).join(', ');
}

function sourceStatus(rows: SourceHealthSummary[]) {
  if (rows.length === 0) return 'warning';
  if (rows.some((row) => row.successRate < 0.9 || row.p95LatencyMs >= 10_000)) return 'critical';
  if (rows.some((row) => row.successRate < 0.98 || row.p95LatencyMs >= 5_000)) return 'warning';
  return 'good';
}

export function SourcesWorkspaceClient() {
  const query = useQuery({
    queryKey: ['systems', 'sources'],
    queryFn: () => fetchSystemsSection('sources'),
  });

  const grouped = useMemo(() => {
    const groups: Record<SourceVendor, SourceHealthSummary[]> = {
      koios: [],
      blockfrost: [],
    };

    for (const row of query.data?.sourceHealth ?? []) {
      groups[row.source].push(row);
    }

    return groups;
  }, [query.data?.sourceHealth]);

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-2xl border border-border/60 bg-muted/25" />
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl border border-border/60 bg-muted/25" />
          <div className="h-80 animate-pulse rounded-2xl border border-border/60 bg-muted/25" />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Source health unavailable"
        description={
          query.error instanceof Error
            ? query.error.message
            : 'The source health surface could not be loaded.'
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <WorkspaceHero summary={query.data.summary}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['koios', 'blockfrost'] as const).map((source) => {
            const rows = grouped[source];
            return (
              <div key={source} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{formatSource(source)}</p>
                  <StatusBadge status={sourceStatus(rows)} />
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  {rows.reduce((sum, row) => sum + row.callCount, 0)} calls in 24h
                </p>
              </div>
            );
          })}
        </div>
      </WorkspaceHero>

      <div className="grid gap-6 xl:grid-cols-2">
        {(['koios', 'blockfrost'] as const).map((source) => (
          <SourceTable key={source} source={source} rows={grouped[source]} />
        ))}
      </div>
    </div>
  );
}

function SourceTable({ source, rows }: { source: SourceVendor; rows: SourceHealthSummary[] }) {
  return (
    <SectionCard
      title={formatSource(source)}
      description="Endpoint-level call volume, success rate, latency, and recent failure shape."
      action={<StatusBadge status={sourceStatus(rows)} />}
    >
      {rows.length === 0 ? (
        <EmptyState
          title={`${formatSource(source)} has no samples yet`}
          description="The table will populate after the next sync or reconciliation call records source health events."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endpoint</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>p50 / p95</TableHead>
              <TableHead>Last success</TableHead>
              <TableHead>Last failure</TableHead>
              <TableHead>Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.source}:${row.endpoint}`}>
                <TableCell className="font-mono text-xs">{row.endpoint}</TableCell>
                <TableCell className="text-right tabular-nums">{row.callCount}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                    {formatSuccessRate(row.successRate)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatLatency(row.p50LatencyMs, row.p95LatencyMs)}
                </TableCell>
                <TableCell>{formatDateTime(row.lastSuccessAt)}</TableCell>
                <TableCell>{formatDateTime(row.lastFailureAt)}</TableCell>
                <TableCell className="max-w-[16rem] whitespace-normal text-xs text-muted-foreground">
                  {formatErrorBreakdown(row.errorBreakdown)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
