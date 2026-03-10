'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommitteeMembers } from '@/hooks/queries';
import type { CommitteeMemberQuickView } from '@/hooks/queries';
import { DiscoverFilterBar } from '@/components/civica/discover/DiscoverFilterBar';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  B: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
  C: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  D: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  F: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
};

function VoteBar({ yes, no, abstain }: { yes: number; no: number; abstain: number }) {
  const total = yes + no + abstain;
  if (total === 0) return null;
  const yPct = (yes / total) * 100;
  const nPct = (no / total) * 100;
  return (
    <div
      className="flex h-1.5 rounded-full overflow-hidden bg-muted"
      title={`${yes} Yes / ${no} No / ${abstain} Abstain`}
    >
      {yPct > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${yPct}%` }} />}
      {nPct > 0 && <div className="bg-rose-500 transition-all" style={{ width: `${nPct}%` }} />}
    </div>
  );
}

function MemberRow({ member }: { member: CommitteeMemberQuickView }) {
  const displayName = member.name || `${member.ccHotId.slice(0, 12)}…${member.ccHotId.slice(-6)}`;
  const gradeStyle = member.transparencyGrade ? GRADE_COLORS[member.transparencyGrade] || '' : '';

  return (
    <Link
      href={`/committee#${member.ccHotId.slice(0, 12)}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
    >
      {/* Transparency grade badge */}
      {member.transparencyGrade ? (
        <span
          className={cn(
            'text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center border shrink-0',
            gradeStyle,
          )}
        >
          {member.transparencyGrade}
        </span>
      ) : (
        <span className="w-6 h-6 rounded flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-medium shrink-0">
          —
        </span>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{displayName}</span>
        <span className="text-[10px] text-muted-foreground">
          {member.voteCount} votes · {member.approvalRate}% approval
        </span>
      </div>

      {/* Vote breakdown bar */}
      <div className="w-24 shrink-0">
        <VoteBar yes={member.yesCount} no={member.noCount} abstain={member.abstainCount} />
      </div>
    </Link>
  );
}

function CommitteeSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-6 w-6 rounded" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-1.5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CommitteeDiscovery() {
  const { data, isLoading } = useCommitteeMembers();
  const members: CommitteeMemberQuickView[] = useMemo(() => data?.members ?? [], [data]);

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.name?.toLowerCase().includes(q) || m.ccHotId.toLowerCase().includes(q),
    );
  }, [members, search]);

  const isFiltered = search !== '';
  const resetFilters = () => setSearch('');

  if (isLoading) return <CommitteeSkeleton />;

  if (members.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-muted-foreground text-sm">
          No Constitutional Committee votes recorded yet.
        </p>
        <p className="text-xs text-muted-foreground/70">
          CC members will appear here once they participate in on-chain governance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DiscoverFilterBar
        search={search}
        onSearchChange={(v) => setSearch(v)}
        searchPlaceholder="Search CC member name or ID…"
        resultCount={filtered.length}
        totalCount={members.length}
        entityLabel="CC members"
        isFiltered={isFiltered}
        onReset={resetFilters}
      />

      {/* Link to full transparency page */}
      <div className="flex items-center justify-end">
        <Link href="/governance/committee" className="text-xs text-primary hover:underline">
          View full Transparency Index →
        </Link>
      </div>

      {/* Member list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No CC members match your search.
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
          {filtered.map((member, i) => (
            <div
              key={member.ccHotId}
              className="animate-in fade-in duration-200 fill-mode-backwards"
              style={{ animationDelay: `${Math.min(i, 14) * 20}ms` }}
            >
              <MemberRow member={member} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
