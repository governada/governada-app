'use client';

import Link from 'next/link';
import {
  ChevronRight,
  Vote,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDRepReportCard,
  useGovernancePulse,
  useDRepVotes,
  useGovernanceEpochRecap,
} from '@/hooks/queries';
import {
  tierKey,
  TIER_SCORE_COLOR,
  TIER_BADGE_BG,
  TIER_BORDER,
} from '@/components/governada/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';
import { generateActions } from '@/lib/actionFeed';
import { ActionFeed } from './ActionFeed';

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(100, score)}%` }}
      />
    </div>
  );
}

// ── Score Sparkline ──────────────────────────────────────────────────────────
function ScoreSparkline({ history }: { history: Array<{ epoch_no: number; score: number }> }) {
  if (history.length < 2) return null;
  const scores = history.map((h) => h.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 160;
  const h = 32;
  const pad = 2;
  const points = history
    .map((pt, i) => {
      const x = pad + (i / (history.length - 1)) * (w - pad * 2);
      const y = h - pad - ((pt.score - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const trending = scores[scores.length - 1] >= scores[0];
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
        Score History ({history.length} epochs)
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={trending ? '#34d399' : '#fb7185'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>E{history[0].epoch_no}</span>
        <span>E{history[history.length - 1].epoch_no}</span>
      </div>
    </div>
  );
}

// ── Alignment Bars ───────────────────────────────────────────────────────────
const ALIGNMENT_DIMS: Array<{ key: string; label: string; color: string }> = [
  { key: 'treasuryConservative', label: 'Treasury Conservative', color: 'bg-amber-500' },
  { key: 'treasuryGrowth', label: 'Treasury Growth', color: 'bg-emerald-500' },
  { key: 'decentralization', label: 'Decentralization', color: 'bg-blue-500' },
  { key: 'security', label: 'Security', color: 'bg-rose-500' },
  { key: 'innovation', label: 'Innovation', color: 'bg-violet-500' },
  { key: 'transparency', label: 'Transparency', color: 'bg-cyan-500' },
];

function AlignmentBars({ alignment }: { alignment: Record<string, number | null> }) {
  const hasAny = ALIGNMENT_DIMS.some((d) => alignment[d.key] != null);
  if (!hasAny) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
        DRep Governance Alignment
      </p>
      <div className="space-y-2">
        {ALIGNMENT_DIMS.map((dim) => {
          const val = alignment[dim.key];
          if (val == null) return null;
          const offset = val - 50; // deviation from neutral
          return (
            <div key={dim.key} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{dim.label}</span>
                <span className="tabular-nums text-foreground/70">{Math.round(val)}</span>
              </div>
              <div className="relative h-1.5 bg-border rounded-full overflow-hidden">
                {/* Center line marker */}
                <div className="absolute left-1/2 top-0 h-full w-px bg-muted-foreground/30" />
                {/* Value bar from center */}
                <div
                  className={cn('absolute h-full rounded-full', dim.color)}
                  style={{
                    left: offset >= 0 ? '50%' : `${50 + offset}%`,
                    width: `${Math.abs(offset)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tier Progress ────────────────────────────────────────────────────────────
function TierProgressBar({
  tierProgress,
}: {
  tierProgress: {
    currentTier: string;
    percentWithinTier: number;
    pointsToNext: number | null;
    nextTier: string | null;
  };
}) {
  const tk = tierKey(tierProgress.currentTier);
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Tier Progress
        </p>
        <span
          className={cn(
            'text-[11px] font-bold px-2 py-0.5 rounded-full',
            TIER_BADGE_BG[tk],
            TIER_SCORE_COLOR[tk],
          )}
        >
          {tierProgress.currentTier}
        </span>
      </div>
      <div className="w-full h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${tierProgress.percentWithinTier}%` }}
        />
      </div>
      {tierProgress.nextTier && tierProgress.pointsToNext != null && (
        <p className="text-[10px] text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground/70">
            {tierProgress.pointsToNext}
          </span>{' '}
          points to {tierProgress.nextTier}
        </p>
      )}
    </div>
  );
}

// ── Intelligence Headline ────────────────────────────────────────────────────
function IntelligenceHeadline({
  delegatedDrep,
  drepName,
  drepScore,
  drepIsActive,
  scoreDelta,
  activeProposals,
  criticalProposals,
  healthStatus,
  loading,
}: {
  delegatedDrep: string | null | undefined;
  drepName: string;
  drepScore: number;
  drepIsActive: boolean;
  scoreDelta: number | undefined;
  activeProposals: number;
  criticalProposals: number;
  healthStatus: 'green' | 'yellow' | 'red';
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  let headline: string;
  let subline: string;
  let accent: 'emerald' | 'amber' | 'rose' | 'cyan' = 'cyan';

  if (!delegatedDrep) {
    headline =
      activeProposals > 0
        ? `${activeProposals} governance proposal${activeProposals > 1 ? 's' : ''} ${activeProposals > 1 ? 'are' : 'is'} live right now.`
        : 'Cardano governance is active and evolving.';
    subline = 'Connect your wallet to see how proposals affect your stake.';
    accent = 'cyan';
  } else if (healthStatus === 'red') {
    headline = !drepIsActive
      ? `${drepName} is currently inactive.`
      : `${drepName} scored ${drepScore} — your delegation needs attention.`;
    subline = 'Consider reviewing alternatives to protect your governance voice.';
    accent = 'rose';
  } else if (criticalProposals > 0) {
    headline = `${criticalProposals} critical proposal${criticalProposals > 1 ? 's' : ''} ${criticalProposals > 1 ? 'need' : 'needs'} attention.`;
    subline = `${drepName} is representing your vote — check their stance.`;
    accent = 'amber';
  } else if (scoreDelta != null && scoreDelta < -3) {
    headline = `${drepName}'s score dropped ${Math.abs(scoreDelta).toFixed(1)} points this epoch.`;
    subline = 'Review their recent voting activity to understand why.';
    accent = 'amber';
  } else if (scoreDelta != null && scoreDelta > 3) {
    headline = `${drepName} is rising — up ${scoreDelta.toFixed(1)} points this epoch.`;
    subline = 'Your governance position is strengthening.';
    accent = 'emerald';
  } else if (healthStatus === 'green') {
    headline =
      activeProposals > 0
        ? `${drepName} is actively voting across ${activeProposals} open proposal${activeProposals > 1 ? 's' : ''}.`
        : `${drepName} is up to date on all governance matters.`;
    subline = 'Your delegation is healthy. No action required.';
    accent = 'emerald';
  } else {
    headline = `${drepName} has a moderate governance score of ${drepScore}.`;
    subline = 'Monitor their activity and compare with higher-scoring DReps.';
    accent = 'amber';
  }

  const borderMap = {
    emerald: 'border-emerald-800/30',
    amber: 'border-amber-800/30',
    rose: 'border-rose-800/30',
    cyan: 'border-cyan-800/30',
  };
  const bgMap = {
    emerald: 'bg-emerald-950/10',
    amber: 'bg-amber-950/10',
    rose: 'bg-rose-950/10',
    cyan: 'bg-cyan-950/10',
  };
  const textMap = {
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    cyan: 'text-cyan-300',
  };

  return (
    <div className={cn('rounded-xl border px-5 py-4 space-y-1', borderMap[accent], bgMap[accent])}>
      <p className={cn('text-sm font-semibold', textMap[accent])}>{headline}</p>
      <p className="text-xs text-muted-foreground">{subline}</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CitizenCommandCenter({
  delegatedDrep,
}: {
  delegatedDrep: string | null | undefined;
}) {
  const { data: rawCard, isLoading: drepLoading } = useDRepReportCard(delegatedDrep);
  const { data: rawPulse, isLoading: pulseLoading } = useGovernancePulse();
  const { data: rawVotes, isLoading: votesLoading } = useDRepVotes(delegatedDrep);
  const { data: rawRecap } = useGovernanceEpochRecap();

  const card = rawCard as Record<string, unknown> | undefined;
  const pulse = rawPulse as
    | { activeProposals?: number; criticalProposals?: number; [key: string]: unknown }
    | undefined;
  const votesObj = rawVotes as Record<string, unknown> | undefined;
  const votes: Record<string, unknown>[] =
    (votesObj?.votes as Record<string, unknown>[]) ?? (rawVotes as Record<string, unknown>[]) ?? [];
  const recentVotes = Array.isArray(votes) ? votes.slice(0, 3) : [];
  const recap = rawRecap as
    | {
        epoch?: number;
        proposals_submitted?: number;
        proposals_ratified?: number;
        drep_participation_pct?: number;
        treasury_withdrawn_ada?: number;
        ai_narrative?: string;
        [key: string]: unknown;
      }
    | undefined;

  const drepScore: number = (card?.score as number) ?? 0;
  const drepName: string = (card?.name as string) ?? delegatedDrep ?? '\u2014';
  const drepIsActive: boolean = (card?.isActive as boolean) ?? true;
  const drepTier = tierKey(computeTier(drepScore));
  const scoreDelta: number | undefined = card?.momentum as number | undefined;

  // New data from report card API (previously unused)
  const scoreHistory: Array<{ epoch_no: number; score: number }> =
    (card?.scoreHistory as Array<{ epoch_no: number; score: number }>) ?? [];
  const alignment: Record<string, number | null> =
    (card?.alignment as Record<string, number | null>) ?? {};
  const tierProgress = card?.tierProgress as
    | {
        currentTier: string;
        percentWithinTier: number;
        pointsToNext: number | null;
        nextTier: string | null;
      }
    | undefined;

  const activeProposals: number = pulse?.activeProposals ?? 0;
  const criticalProposals: number = pulse?.criticalProposals ?? 0;

  const actions = generateActions({
    segment: 'citizen',
    activeProposals,
    criticalProposals,
    delegatedDrep,
    delegatedDrepScore: drepScore,
    delegatedDrepIsActive: drepIsActive,
  });

  const DeltaIcon =
    scoreDelta == null
      ? Minus
      : scoreDelta > 0
        ? TrendingUp
        : scoreDelta < 0
          ? TrendingDown
          : Minus;
  const deltaColor =
    scoreDelta == null
      ? 'text-muted-foreground'
      : scoreDelta > 0
        ? 'text-emerald-400'
        : 'text-rose-400';

  const healthStatus: 'green' | 'yellow' | 'red' =
    !delegatedDrep || drepLoading
      ? 'yellow'
      : drepScore >= 70 && drepIsActive
        ? 'green'
        : drepScore >= 40 && drepIsActive
          ? 'yellow'
          : 'red';

  const HealthIcon =
    healthStatus === 'green' ? CheckCircle2 : healthStatus === 'yellow' ? AlertTriangle : XCircle;

  const healthLabel =
    healthStatus === 'green'
      ? 'Healthy'
      : healthStatus === 'yellow'
        ? 'Needs attention'
        : 'At risk';

  const healthColor =
    healthStatus === 'green'
      ? 'text-emerald-400'
      : healthStatus === 'yellow'
        ? 'text-amber-400'
        : 'text-rose-400';

  return (
    <div className="space-y-6">
      {/* Intelligence headline */}
      <IntelligenceHeadline
        delegatedDrep={delegatedDrep}
        drepName={drepName}
        drepScore={drepScore}
        drepIsActive={drepIsActive}
        scoreDelta={scoreDelta}
        activeProposals={activeProposals}
        criticalProposals={criticalProposals}
        healthStatus={healthStatus}
        loading={drepLoading || pulseLoading}
      />

      {/* Delegation health card */}
      {delegatedDrep ? (
        <Link href={`/drep/${delegatedDrep}`} className="block group">
          <div
            className={cn(
              'rounded-xl border p-5 space-y-4 transition-colors group-hover:border-primary/30',
              TIER_BORDER[drepTier],
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    Your Delegated DRep
                  </p>
                  {!drepLoading && (
                    <div className={cn('flex items-center gap-1', healthColor)}>
                      <HealthIcon className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {healthLabel}
                      </span>
                    </div>
                  )}
                </div>
                {drepLoading ? (
                  <Skeleton className="h-6 w-40" />
                ) : (
                  <p className="text-lg font-bold leading-tight truncate max-w-[220px]">
                    {drepName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      'text-[11px] font-bold px-2 py-0.5 rounded-full',
                      TIER_BADGE_BG[drepTier],
                      TIER_SCORE_COLOR[drepTier],
                    )}
                  >
                    {drepTier}
                  </span>
                  {!drepIsActive && (
                    <span className="text-[11px] text-rose-400 font-medium">Inactive</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {drepLoading ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  <>
                    <p
                      className={cn(
                        'font-display text-3xl font-bold tabular-nums',
                        TIER_SCORE_COLOR[drepTier],
                      )}
                    >
                      {drepScore.toFixed(0)}
                    </p>
                    {scoreDelta != null && (
                      <div
                        className={cn('flex items-center justify-end gap-0.5 text-xs', deltaColor)}
                      >
                        <DeltaIcon className="h-3 w-3" />
                        {scoreDelta > 0 ? '+' : ''}
                        {scoreDelta.toFixed(1)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <ScoreBar score={drepScore} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
              View full profile <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">Find Your DRep</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Delegate to a DRep aligned with your values to participate in Cardano governance. It
              takes 60 seconds.
            </p>
          </div>
          <Link
            href="/match"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Quick Match <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <p className="text-xs text-muted-foreground">
            Or{' '}
            <Link href="/governance/representatives" className="text-primary hover:underline">
              browse all DReps
            </Link>
          </p>
        </div>
      )}

      {/* DRep intelligence section — score sparkline, alignment, tier progress */}
      {delegatedDrep && !drepLoading && (
        <>
          {scoreHistory.length >= 2 && <ScoreSparkline history={scoreHistory} />}
          <AlignmentBars alignment={alignment} />
          {tierProgress && <TierProgressBar tierProgress={tierProgress} />}
        </>
      )}

      {/* Epoch context */}
      {recap?.epoch != null && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Epoch {recap.epoch}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recap.proposals_submitted != null && (
              <div>
                <p className="text-lg font-bold tabular-nums">{recap.proposals_submitted}</p>
                <p className="text-[10px] text-muted-foreground">Submitted</p>
              </div>
            )}
            {recap.proposals_ratified != null && (
              <div>
                <p className="text-lg font-bold tabular-nums text-sky-400">
                  {recap.proposals_ratified}
                </p>
                <p className="text-[10px] text-muted-foreground">Ratified</p>
              </div>
            )}
            {recap.drep_participation_pct != null && (
              <div>
                <p className="text-lg font-bold tabular-nums">
                  {Math.round(recap.drep_participation_pct)}%
                </p>
                <p className="text-[10px] text-muted-foreground">DRep Participation</p>
              </div>
            )}
            {recap.treasury_withdrawn_ada != null && recap.treasury_withdrawn_ada > 0 && (
              <div>
                <p className="text-lg font-bold tabular-nums text-emerald-400">
                  {(recap.treasury_withdrawn_ada / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-[10px] text-muted-foreground">Treasury (ADA)</p>
              </div>
            )}
          </div>
          {recap.ai_narrative && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {String(recap.ai_narrative)}
            </p>
          )}
        </div>
      )}

      {/* Open proposals callout */}
      {!pulseLoading && activeProposals > 0 && (
        <Link href="/governance/proposals" className="block group">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <Vote className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {activeProposals} open proposal{activeProposals > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {criticalProposals > 0 ? `${criticalProposals} critical` : 'Your DRep is voting'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      )}

      {/* Recent DRep votes */}
      {!votesLoading && recentVotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent DRep Votes
            </p>
            <Link
              href={delegatedDrep ? `/drep/${delegatedDrep}` : '/governance/representatives'}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              See all
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentVotes.map((vote, idx: number) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <p className="text-sm truncate max-w-[200px]">
                  {(vote.proposalTitle as string) ?? (vote.title as string) ?? 'Proposal'}
                </p>
                <span
                  className={cn(
                    'text-xs font-bold shrink-0 ml-2',
                    vote.vote === 'Yes'
                      ? 'text-emerald-400'
                      : vote.vote === 'No'
                        ? 'text-rose-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {(vote.vote as string) ?? (vote.voteDirection as string) ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action feed */}
      {actions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recommended Actions
          </p>
          <ActionFeed actions={actions} />
        </div>
      ) : delegatedDrep ? (
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-4 text-center space-y-1">
          <p className="text-sm font-medium text-emerald-300">Your governance is healthy</p>
          <p className="text-xs text-muted-foreground">
            {drepName !== '—'
              ? `${drepName} voted on all proposals this epoch. No action needed.`
              : 'Your DRep is active and participating. No action needed.'}
          </p>
        </div>
      ) : null}

      {/* Wrapped CTA */}
      {delegatedDrep && (
        <Link href="/my-gov/wrapped/latest" className="block group">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <Gift className="h-4 w-4 text-violet-400" />
              <div>
                <p className="text-sm font-medium">Your Governance Wrapped</p>
                <p className="text-xs text-muted-foreground">
                  See your governance journey — and share it
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      )}
    </div>
  );
}
