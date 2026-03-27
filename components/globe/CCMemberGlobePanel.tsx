'use client';

/**
 * CCMemberGlobePanel — Constitutional Committee member detail for the globe panel overlay.
 *
 * Enhanced version of CCMemberPeek with richer data display.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink, Vote, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommitteeMembers } from '@/hooks/queries';
import type { CommitteeMemberQuickView } from '@/hooks/queries';

interface CCMemberGlobePanelProps {
  ccHotId: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  B: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  C: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  D: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  F: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};

function fidelityBarColor(score: number | null): string {
  if (score == null) return 'bg-muted';
  if (score >= 85) return 'bg-emerald-500/80';
  if (score >= 70) return 'bg-sky-500/80';
  if (score >= 55) return 'bg-amber-500/80';
  if (score >= 40) return 'bg-orange-500/80';
  return 'bg-rose-500/80';
}

export function CCMemberGlobePanel({ ccHotId }: CCMemberGlobePanelProps) {
  const { data, isLoading } = useCommitteeMembers();

  const member: CommitteeMemberQuickView | null = useMemo(() => {
    const members = data?.members ?? [];
    return members.find((m) => m.ccHotId === ccHotId) ?? null;
  }, [data, ccHotId]);

  if (isLoading || !member) {
    return <PanelSkeleton />;
  }

  const displayName = member.name || `${ccHotId.slice(0, 12)}...${ccHotId.slice(-6)}`;
  const gradeStyle = member.fidelityGrade ? (GRADE_COLORS[member.fidelityGrade] ?? '') : '';
  const totalVotes = member.yesCount + member.noCount + member.abstainCount;
  const yesPct = totalVotes > 0 ? Math.round((member.yesCount / totalVotes) * 100) : 0;
  const noPct = totalVotes > 0 ? Math.round((member.noCount / totalVotes) * 100) : 0;
  const abstainPct = totalVotes > 0 ? Math.round((member.abstainCount / totalVotes) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Constitutional Committee Member
        </p>
        <h3 className="text-lg font-semibold leading-snug">{displayName}</h3>
        <div className="flex items-center gap-3">
          {member.fidelityGrade && (
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold',
                gradeStyle,
              )}
            >
              {member.fidelityGrade}
            </span>
          )}
          <div>
            <span className="text-3xl font-bold tabular-nums">{member.fidelityScore ?? '—'}</span>
            <span className="text-xs text-muted-foreground block">Fidelity Score</span>
          </div>
        </div>
      </div>

      {/* Constitutional fidelity bar */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Constitutional Fidelity</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              fidelityBarColor(member.fidelityScore),
            )}
            style={{ width: `${member.fidelityScore ?? 0}%` }}
          />
        </div>
      </div>

      {/* Narrative verdict */}
      {member.narrativeVerdict && (
        <p className="text-xs text-muted-foreground italic leading-relaxed rounded-lg border border-border/30 bg-muted/10 p-3">
          &ldquo;{member.narrativeVerdict}&rdquo;
        </p>
      )}

      {/* Vote record */}
      <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Vote className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Vote Record
          </span>
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {member.voteCount} votes
          </span>
        </div>

        {totalVotes > 0 && (
          <>
            <div className="h-2 rounded-full overflow-hidden flex">
              {yesPct > 0 && <div className="bg-emerald-500/80" style={{ width: `${yesPct}%` }} />}
              {noPct > 0 && <div className="bg-red-500/80" style={{ width: `${noPct}%` }} />}
              {abstainPct > 0 && (
                <div className="bg-amber-500/60" style={{ width: `${abstainPct}%` }} />
              )}
            </div>
            <div className="flex gap-3 text-[10px] tabular-nums">
              <span className="text-emerald-400">Yes {yesPct}%</span>
              <span className="text-red-400">No {noPct}%</span>
              <span className="text-amber-400">Abstain {abstainPct}%</span>
            </div>
          </>
        )}
      </div>

      {/* Approval rate */}
      {member.approvalRate != null && (
        <div className="flex items-center justify-between text-xs rounded-lg border border-border/30 bg-muted/10 p-3">
          <span className="text-muted-foreground">Approval Rate</span>
          <span className="font-semibold tabular-nums text-lg">
            {Math.round(member.approvalRate)}%
          </span>
        </div>
      )}

      {/* Open full link */}
      <Link
        href={`/governance/committee/${encodeURIComponent(ccHotId)}`}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg',
          'text-sm font-medium transition-colors',
          'bg-primary/10 text-primary hover:bg-primary/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
      >
        Open full profile
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <div className="flex gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
      <Skeleton className="h-6 rounded-lg" />
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
