'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity,
  Database, Shield, Clock, TrendingUp, TrendingDown, Minus, Zap, Info, ChevronDown, ChevronUp,
  RotateCw, Wrench, Lightbulb,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface IntegrityData {
  timestamp: string;
  vote_power: {
    total_votes: number; with_power: number; null_power: number;
    exact_count: number; nearest_count: number; coverage_pct: string;
  };
  ai_summaries: {
    total_proposals: number; proposals_with_summary: number; proposals_with_abstract: number;
    total_rationales: number; rationales_with_text: number; rationales_with_summary: number;
  };
  hash_verification: {
    rationale_verified: number; rationale_mismatch: number; rationale_pending: number;
    rationale_unreachable: number; mismatch_rate_pct: string;
  };
  metadata_verification: {
    drep_verified: number; drep_mismatch: number; drep_pending: number; drep_with_anchor_hash: number;
  };
  canonical_summaries: {
    total_proposals: number; with_proposal_id: number; with_canonical_summary: number;
  };
  sync_health: Record<string, {
    sync_type: string; last_run: string | null; last_finished: string | null;
    last_duration_ms: number | null; last_success: boolean | null; last_error: string | null;
    success_count: number; failure_count: number; stale_minutes: number | null;
  }>;
  system_stats: {
    total_dreps: number; total_votes: number; total_proposals: number;
    total_rationales: number; total_power_snapshots: number; dreps_with_snapshots: number;
    newest_vote_time: string | null; newest_summary_fetch: string | null;
  };
  sync_history: {
    id: number; sync_type: string; started_at: string; finished_at: string | null;
    duration_ms: number | null; success: boolean; error_message: string | null;
  }[];
  alerts: { level: 'critical' | 'warning'; metric: string; value: string; threshold: string }[];
  comparison: Record<string, { previous: number; delta: number; snapshot_date: string }> | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string): string {
  return Number(n).toLocaleString();
}

function pct1(n: number): string {
  return n % 1 === 0 ? `${n}%` : `${n.toFixed(1)}%`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function coverageStatus(pct: number): 'good' | 'warning' | 'critical' {
  if (pct >= 99) return 'good';
  if (pct >= 95) return 'warning';
  return 'critical';
}

const ALERT_HINTS: Record<string, string> = {
  'Vote power coverage': 'Auto-heals on nightly full sync.',
  'Hash mismatch rate': 'Review mismatches — DReps may have changed rationale content post-vote.',
  'Proposal AI summary coverage': 'Auto-heals slowly (10/run). Run bootstrap-ai-summaries.ts for bulk.',
  'Fast sync stale': 'Check Inngest dashboard for failures.',
  'Full sync stale': 'Check Railway logs — may be timing out.',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground/60 cursor-help inline-block ml-1" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ className?: string }>; title: string; description: string;
}) {
  return (
    <div className="mb-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function GuidanceNote({ type, children }: {
  type: 'auto-heals' | 'action-needed' | 'expected'; children: React.ReactNode;
}) {
  const config = {
    'auto-heals': { icon: RotateCw, label: 'Auto-heals', cls: 'text-green-600 bg-green-500/10 border-green-500/20' },
    'action-needed': { icon: Wrench, label: 'Action needed', cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    'expected': { icon: Lightbulb, label: 'Expected', cls: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  }[type];
  const BadgeIcon = config.icon;
  return (
    <div className="flex items-start gap-2 text-[11px] leading-relaxed">
      <Badge variant="outline" className={`${config.cls} text-[9px] px-1.5 py-0 mt-0.5 shrink-0 gap-1`}>
        <BadgeIcon className="h-2.5 w-2.5" /> {config.label}
      </Badge>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

function GuidancePanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? 'Hide guidance' : 'What should I do?'}
      </button>
      {open && (
        <Card className="mt-1.5 border-dashed">
          <CardContent className="pt-3 pb-2.5 px-3 space-y-2">
            {children}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeltaBadge({ delta, invertColor, unit = '' }: {
  delta: number; invertColor?: boolean; unit?: string;
}) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" /> 0{unit}
      </span>
    );
  }
  const isPositive = delta > 0;
  const isGood = invertColor ? !isPositive : isPositive;
  const colorCls = isGood ? 'text-green-600' : 'text-red-500';
  const DeltaIcon = isPositive ? TrendingUp : TrendingDown;
  const formatted = Math.abs(delta) < 0.1
    ? Math.abs(delta).toFixed(2)
    : Math.abs(delta) < 10
      ? Math.abs(delta).toFixed(1)
      : Math.round(Math.abs(delta)).toLocaleString();
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${colorCls}`}>
      <DeltaIcon className="h-2.5 w-2.5" />
      {isPositive ? '+' : '-'}{formatted}{unit}
    </span>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, status, tooltip, delta }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>; status?: 'good' | 'warning' | 'critical'; tooltip?: string;
  delta?: { value: number; invertColor?: boolean; unit?: string; label?: string };
}) {
  const statusColors = {
    good: 'text-green-500',
    warning: 'text-amber-500',
    critical: 'text-red-500',
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              {title}
              {tooltip && <InfoTip text={tooltip} />}
            </p>
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-bold ${status ? statusColors[status] : ''}`}>{value}</p>
              {delta && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">
                      <DeltaBadge delta={delta.value} invertColor={delta.invertColor} unit={delta.unit} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {delta.label || 'vs previous day'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Icon className={`h-4 w-4 mt-0.5 ${status ? statusColors[status] : 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SyncRow({ entry }: { entry: IntegrityData['sync_history'][0] }) {
  return (
    <tr className="border-b border-border/50 text-xs">
      <td className="py-1.5 pr-3">
        <Badge variant={entry.sync_type === 'full' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
          {entry.sync_type}
        </Badge>
      </td>
      <td className="py-1.5 pr-3 text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">{relativeTime(entry.started_at)}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {new Date(entry.started_at).toLocaleString()}
          </TooltipContent>
        </Tooltip>
      </td>
      <td className="py-1.5 pr-3 font-mono">{formatDuration(entry.duration_ms)}</td>
      <td className="py-1.5">
        {entry.success
          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          : <Tooltip>
              <TooltipTrigger asChild>
                <XCircle className="h-3.5 w-3.5 text-red-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px] text-xs">
                {entry.error_message || 'Unknown error'}
              </TooltipContent>
            </Tooltip>}
      </td>
    </tr>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function IntegrityDashboard({ adminAddress }: { adminAddress: string }) {
  const [data, setData] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/integrity?address=${encodeURIComponent(adminAddress)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [adminAddress]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-red-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="h-5 w-5" />
            <p>Failed to load integrity data: {error}</p>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const vpc = data.vote_power;
  const ai = data.ai_summaries;
  const hv = data.hash_verification;
  const cs = data.canonical_summaries;
  const stats = data.system_stats;
  const cmp = data.comparison;
  const vpPct = parseFloat(vpc.coverage_pct);
  const proposalAiPct = ai.proposals_with_abstract > 0
    ? Math.round(ai.proposals_with_summary / ai.proposals_with_abstract * 100) : 100;
  const rationaleAiPct = ai.rationales_with_text > 0
    ? Math.round(ai.rationales_with_summary / ai.rationales_with_text * 100) : 100;
  const canonicalPct = cs.total_proposals > 0
    ? Math.round(cs.with_canonical_summary / cs.total_proposals * 100) : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">

        {/* ── Alerts Banner ───────────────────────────────────────────────── */}
        {data.alerts.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-500">
                  {data.alerts.length} alert{data.alerts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1.5">
                {data.alerts.map((a, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.level === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {a.level}
                      </Badge>
                      <span className="text-foreground">{a.metric}: <strong>{a.value}</strong></span>
                      <span className="text-muted-foreground">(threshold: {a.threshold})</span>
                    </div>
                    {ALERT_HINTS[a.metric] && (
                      <p className="text-[10px] text-muted-foreground ml-[52px] mt-0.5 italic">
                        {ALERT_HINTS[a.metric]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Data Integrity</h2>
            <p className="text-xs text-muted-foreground">
              Updated {relativeTime(data.timestamp)}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default ml-1 underline decoration-dotted">
                    ({new Date(data.timestamp).toLocaleTimeString()})
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {new Date(data.timestamp).toLocaleString()}
                </TooltipContent>
              </Tooltip>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* ── Data Coverage ───────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            icon={Database}
            title="Data Coverage"
            description="How complete is the enriched data layer powering the app."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              title="Vote Power" value={pct1(vpPct)}
              subtitle={`${fmt(vpc.with_power)} / ${fmt(vpc.total_votes)}`}
              icon={Zap} status={coverageStatus(vpPct)}
              tooltip="Percentage of votes with voting power attributed from Koios power history."
              delta={cmp?.vote_power_coverage ? { value: cmp.vote_power_coverage.delta, unit: 'pp' } : undefined}
            />
            <MetricCard
              title="Canonical Summaries" value={pct1(canonicalPct)}
              subtitle={`${fmt(cs.with_canonical_summary)} / ${fmt(cs.total_proposals)}`}
              icon={CheckCircle2} status={coverageStatus(canonicalPct)}
              tooltip="Percentage of proposals with official vote tally from Koios /proposal_voting_summary."
              delta={cmp?.canonical_summary ? { value: cmp.canonical_summary.delta, unit: 'pp' } : undefined}
            />
            <MetricCard
              title="AI Proposals" value={pct1(proposalAiPct)}
              subtitle={`${fmt(ai.proposals_with_summary)} / ${fmt(ai.proposals_with_abstract)}`}
              icon={TrendingUp} status={coverageStatus(proposalAiPct)}
              tooltip="Percentage of proposals (with abstracts) that have an AI-generated summary."
              delta={cmp?.ai_proposal ? { value: cmp.ai_proposal.delta, unit: 'pp' } : undefined}
            />
            <MetricCard
              title="AI Rationales" value={pct1(rationaleAiPct)}
              subtitle={`${fmt(ai.rationales_with_summary)} / ${fmt(ai.rationales_with_text)}`}
              icon={TrendingUp} status={coverageStatus(rationaleAiPct)}
              tooltip="Percentage of rationales (with text) that have an AI-generated summary."
              delta={cmp?.ai_rationale ? { value: cmp.ai_rationale.delta, unit: 'pp' } : undefined}
            />
          </div>
          <GuidancePanel>
            <GuidanceNote type="auto-heals">
              <strong>Vote Power</strong> — Full sync runs a two-tier power backfill nightly. If stuck for 2+ days,
              run <code className="bg-muted px-1 rounded text-[10px]">npx tsx scripts/bootstrap-ai-summaries.ts</code> (Part 1).
            </GuidanceNote>
            <GuidanceNote type="auto-heals">
              <strong>Canonical Summaries</strong> — Full sync fetches vote tallies for all proposals nightly. New proposals covered on next run.
            </GuidanceNote>
            <GuidanceNote type="auto-heals">
              <strong>AI Proposals/Rationales</strong> — Full sync generates 10 proposal + 20 rationale summaries per run. For bulk catch-up,
              run <code className="bg-muted px-1 rounded text-[10px]">npx tsx scripts/bootstrap-ai-summaries.ts</code>.
            </GuidanceNote>
          </GuidancePanel>
        </div>

        {/* ── Power Source ────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            icon={Zap}
            title="Power Source"
            description="Breakdown of how vote power was attributed — exact epoch match vs nearest."
          />
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex gap-4 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span>Exact: <strong>{fmt(vpc.exact_count)}</strong></span>
                  <InfoTip text="Power matched to the exact epoch the vote was cast in." />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Nearest: <strong>{fmt(vpc.nearest_count)}</strong></span>
                  <InfoTip text="Power from the closest available epoch (within 1-2 epochs)." />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>NULL: <strong>{fmt(vpc.null_power)}</strong></span>
                  <InfoTip text="No power data available from Koios for this vote's epoch range." />
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
                <div className="bg-green-500 h-full" style={{ width: `${vpc.total_votes ? vpc.exact_count / vpc.total_votes * 100 : 0}%` }} />
                <div className="bg-amber-500 h-full" style={{ width: `${vpc.total_votes ? vpc.nearest_count / vpc.total_votes * 100 : 0}%` }} />
                <div className="bg-red-500 h-full" style={{ width: `${vpc.total_votes ? vpc.null_power / vpc.total_votes * 100 : 0}%` }} />
              </div>
            </CardContent>
          </Card>
          <GuidancePanel>
            <GuidanceNote type="auto-heals">
              <strong>NULL votes</strong> — Nightly backfill attempts to fill these. If count is stuck, Koios may not have power history for those epochs.
            </GuidanceNote>
            <GuidanceNote type="expected">
              <strong>Nearest-epoch</strong> — These are acceptable. They use the closest available epoch data (within 1-2 epochs of the actual vote).
            </GuidanceNote>
          </GuidancePanel>
        </div>

        {/* ── Hash Integrity ──────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            icon={Shield}
            title="Hash Integrity"
            description="On-chain hash verification of DRep rationale content."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              title="Verified" value={fmt(hv.rationale_verified)} icon={CheckCircle2} status="good"
              tooltip="Rationales where fetched content hash matches the on-chain hash."
            />
            <MetricCard
              title="Mismatch" value={fmt(hv.rationale_mismatch)}
              subtitle={`${hv.mismatch_rate_pct}% rate`}
              icon={AlertTriangle} status={hv.rationale_mismatch > 0 ? 'warning' : 'good'}
              tooltip="Rationales where content was modified after the on-chain hash was recorded."
              delta={cmp?.hash_mismatch_rate ? { value: cmp.hash_mismatch_rate.delta, unit: 'pp', invertColor: true } : undefined}
            />
            <MetricCard
              title="Pending" value={fmt(hv.rationale_pending)} icon={Clock}
              tooltip="Rationales that haven't been hash-checked yet."
            />
            <MetricCard
              title="Unreachable" value={fmt(hv.rationale_unreachable)} icon={XCircle}
              status={hv.rationale_unreachable > 100 ? 'warning' : undefined}
              tooltip="URLs that returned errors (404, timeout, CORS) when attempting verification."
            />
          </div>
          <GuidancePanel>
            <GuidanceNote type="auto-heals">
              <strong>Pending</strong> — Full sync verifies up to 50 hashes per run. For bulk catch-up,
              run <code className="bg-muted px-1 rounded text-[10px]">npx tsx scripts/bootstrap-hash-verify.ts</code>.
            </GuidanceNote>
            <GuidanceNote type="action-needed">
              <strong>Mismatch</strong> — A DRep changed their rationale content after voting. If growing, review the specific mismatches. Users already see a warning shield icon on affected votes.
            </GuidanceNote>
            <GuidanceNote type="expected">
              <strong>Unreachable</strong> — URLs that returned errors (404, timeout). The system won&apos;t re-check these. No action needed unless the count grows unexpectedly.
            </GuidanceNote>
          </GuidancePanel>
        </div>

        {/* ── Sync Health ─────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            icon={Activity}
            title="Sync Health"
            description="Status of automated data pipelines (fast: every 30min, full: nightly 2AM)."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {(['fast', 'full'] as const).map(type => {
              const s = data.sync_health[type];
              if (!s) return (
                <Card key={type}>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground capitalize">{type} sync</p>
                    <p className="text-sm text-muted-foreground mt-1">Waiting for first sync run. Data will appear after the next scheduled check.</p>
                  </CardContent>
                </Card>
              );
              const staleOk = type === 'fast' ? (s.stale_minutes ?? 999) <= 90 : (s.stale_minutes ?? 999) <= 1560;
              return (
                <Card key={type}>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground capitalize">{type} sync</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Badge variant={staleOk ? 'secondary' : 'destructive'} className="text-[10px] cursor-default">
                              {relativeTime(s.last_run)}
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {s.last_run ? new Date(s.last_run).toLocaleString() : 'Never run'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs">
                      {s.last_success
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      <span className="font-mono">{formatDuration(s.last_duration_ms)}</span>
                      <span className="text-muted-foreground">
                        {fmt(s.success_count)} ok / {fmt(s.failure_count)} fail
                      </span>
                    </div>
                    {s.last_error && (
                      <p className="text-[10px] text-red-400 mt-1 truncate">{s.last_error}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <GuidancePanel>
            <GuidanceNote type="action-needed">
              <strong>Fast sync stale &gt; 90min</strong> — Check Inngest dashboard for the sync-fast function. Likely a deployment issue or Inngest misconfiguration.
            </GuidanceNote>
            <GuidanceNote type="action-needed">
              <strong>Full sync stale &gt; 26hr</strong> — Check Railway logs. The full sync may be timing out (known issue with Phase 5 complexity).
            </GuidanceNote>
            <GuidanceNote type="action-needed">
              <strong>Last sync failed</strong> — Check the error message above. Common causes: Koios rate limits, Supabase connection issues, Railway function timeout.
            </GuidanceNote>
          </GuidancePanel>

          {data.sync_history.length > 0 && (
            <Card className="mt-3">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Recent Sync Runs</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-muted-foreground border-b border-border">
                      <th className="text-left pb-1">Type</th>
                      <th className="text-left pb-1">When</th>
                      <th className="text-left pb-1">Duration</th>
                      <th className="text-left pb-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sync_history.slice(0, 10).map(entry => (
                      <SyncRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── System Scale ────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            icon={Database}
            title="System Scale"
            description="Total row counts across all tables."
          />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <MetricCard title="DReps" value={fmt(stats.total_dreps)} icon={Database}
              tooltip="Total DRep records in the database."
              delta={cmp?.total_dreps ? { value: cmp.total_dreps.delta } : undefined}
            />
            <MetricCard title="Votes" value={fmt(stats.total_votes)} icon={Activity}
              tooltip="Total individual vote records across all DReps and proposals."
              delta={cmp?.total_votes ? { value: cmp.total_votes.delta } : undefined}
            />
            <MetricCard title="Proposals" value={fmt(stats.total_proposals)} icon={TrendingUp}
              tooltip="Total governance proposals tracked."
              delta={cmp?.total_proposals ? { value: cmp.total_proposals.delta } : undefined}
            />
            <MetricCard title="Rationales" value={fmt(stats.total_rationales)} icon={Shield}
              tooltip="Total vote rationale documents fetched from DRep metadata URLs."
              delta={cmp?.total_rationales ? { value: cmp.total_rationales.delta } : undefined}
            />
            <MetricCard title="Snapshots" value={fmt(stats.total_power_snapshots)} icon={Clock}
              tooltip="Total epoch-level voting power snapshots stored for DReps."
            />
            <MetricCard title="DReps w/ Snaps" value={fmt(stats.dreps_with_snapshots)} icon={Zap}
              tooltip="Number of unique DReps that have at least one power snapshot."
            />
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
