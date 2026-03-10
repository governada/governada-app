'use client';

import Link from 'next/link';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight, Vote, FileText } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDashboardUrgent } from '@/hooks/queries';
import { useSPOPoolCompetitive, useSPOSummary } from '@/hooks/queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface PendingProposal {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  epochsRemaining: number;
  withdrawalAmount?: number;
}

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M ADA`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K ADA`;
  return `${Math.round(ada).toLocaleString()} ADA`;
}

function ProposalItem({ proposal }: { proposal: PendingProposal }) {
  const epochsRemaining = proposal.epochsRemaining;
  const isUrgent = epochsRemaining <= 1;

  return (
    <Link
      href={`/proposal/${proposal.txHash}/${proposal.index}`}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div
        className={`mt-0.5 rounded-full p-1.5 ${
          isUrgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
        }`}
      >
        {isUrgent ? (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground truncate">{proposal.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {proposal.proposalType}
          </Badge>
          {proposal.withdrawalAmount && proposal.withdrawalAmount > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatAda(proposal.withdrawalAmount)}
            </span>
          )}
          <span
            className={`text-xs font-medium ${
              isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {epochsRemaining === 0
              ? 'Expires this epoch'
              : `${epochsRemaining} epoch${epochsRemaining !== 1 ? 's' : ''} left`}
          </span>
        </div>
      </div>

      <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

/**
 * DRep Action Queue — the default workspace for DReps.
 *
 * JTBD: "What needs my vote right now?"
 * Like Linear's inbox — here's your queue, get to work.
 * Sorted by deadline urgency.
 */
function DRepWorkspace() {
  const { drepId } = useSegment();
  const { data: urgentRaw, isLoading } = useDashboardUrgent(drepId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const urgentData = urgentRaw as Record<string, unknown> | undefined;
  const pendingProposals =
    (urgentData?.pending as PendingProposal[]) ?? (urgentData?.urgent as PendingProposal[]) ?? [];
  const unexplainedVotes =
    (urgentData?.unexplainedVotes as { txHash: string; index: number; title: string }[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Action Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Vote className="h-5 w-5 text-muted-foreground" />
            Pending Votes
          </h2>
          {pendingProposals.length > 0 && (
            <Badge variant="secondary">{pendingProposals.length}</Badge>
          )}
        </div>

        {pendingProposals.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-base font-semibold text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground mt-1">
              No proposals need your vote right now.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingProposals
              .sort((a, b) => a.epochsRemaining - b.epochsRemaining)
              .map((p) => (
                <ProposalItem key={`${p.txHash}-${p.index}`} proposal={p} />
              ))}
          </div>
        )}
      </div>

      {/* Unexplained votes nudge */}
      {unexplainedVotes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Needs Rationale
          </h2>
          <p className="text-sm text-muted-foreground">
            {unexplainedVotes.length} recent vote{unexplainedVotes.length !== 1 ? 's' : ''} without
            a rationale. Adding one builds trust with delegators.
          </p>
          {unexplainedVotes.slice(0, 3).map((v) => (
            <Link
              key={`${v.txHash}-${v.index}`}
              href={`/proposal/${v.txHash}/${v.index}`}
              className="block rounded-lg border border-border bg-card p-3 text-sm text-foreground truncate hover:border-primary/40 transition-colors"
            >
              {v.title}
            </Link>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/votes">Voting Record</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/delegators">Delegators</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/performance">Performance</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * SPO Workspace — Governance score overview for SPOs.
 *
 * JTBD: "What's my governance reputation?"
 * Score with pillar breakdown, top improvement suggestions, trend.
 */
function SPOWorkspace() {
  const { poolId } = useSegment();
  const { data: competitiveRaw, isLoading: compLoading } = useSPOPoolCompetitive(poolId);
  const { data: summaryRaw, isLoading: sumLoading } = useSPOSummary(poolId);

  const isLoading = compLoading || sumLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const competitive = competitiveRaw as Record<string, unknown> | undefined;
  const summary = summaryRaw as Record<string, unknown> | undefined;
  const pool = competitive?.pool as Record<string, unknown> | undefined;
  const score = Math.round((pool?.governance_score as number) ?? 0);
  const rank = (competitive?.rank as number) ?? 0;
  const totalPools = (competitive?.totalPools as number) ?? 0;
  const percentile = Math.round((competitive?.percentile as number) ?? 0);
  const voteCount = (summary?.voteCount as number) ?? (pool?.vote_count as number) ?? 0;
  const participationRate = Math.round((summary?.participationRate as number) ?? 0);

  // Improvement suggestions based on score components
  const suggestions: string[] = [];
  if (voteCount === 0)
    suggestions.push('Cast your first governance vote to appear on the leaderboard');
  if (participationRate < 50)
    suggestions.push('Vote on more proposals to improve participation rate');
  if (score < 50) suggestions.push('Add a governance statement to your pool profile');
  if (suggestions.length === 0) suggestions.push('Keep voting consistently to maintain your rank');

  return (
    <div className="space-y-6">
      {/* Score overview */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Governance Score</h2>
            <p className="text-sm text-muted-foreground">
              Rank {rank} of {totalPools} pools &middot; Top {percentile}%
            </p>
          </div>
          <span className="text-4xl font-bold tabular-nums text-foreground">{score}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{voteCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Votes Cast</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{participationRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
          </div>
        </div>
      </div>

      {/* Improvement suggestions */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Next Steps
        </h3>
        {suggestions.slice(0, 3).map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-border bg-card p-3"
          >
            <span className="text-primary font-bold text-sm">{i + 1}.</span>
            <p className="text-sm text-foreground">{s}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/pool-profile">Pool Profile</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/position">Competitive Position</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/delegators">Delegators</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * WorkspacePage — Dispatches to DRep or SPO workspace.
 *
 * DRep workspace feels like Linear — action queue first.
 * SPO workspace — governance score overview.
 */
export function WorkspacePage() {
  const { segment } = useSegment();

  // Non-DRep/SPO users get redirected
  if (segment !== 'drep' && segment !== 'spo') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Workspace</h1>
        <p className="text-muted-foreground">
          The workspace is for DReps and SPOs who actively participate in governance.
        </p>
        <Button asChild>
          <Link href="/">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-foreground">
        {segment === 'drep' ? 'Action Queue' : 'Governance Overview'}
      </h1>
      {segment === 'drep' ? <DRepWorkspace /> : <SPOWorkspace />}
    </div>
  );
}
