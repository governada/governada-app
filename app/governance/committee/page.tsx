'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, ChevronDown, ChevronUp, Vote, BookOpen, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useCommitteeMembers } from '@/hooks/queries';
import type { CommitteeMemberQuickView } from '@/hooks/queries';
import { CCHealthVerdict } from '@/components/cc/CCHealthVerdict';
import { CCInsightCard } from '@/components/cc/CCInsightCard';
import { PageViewTracker } from '@/components/PageViewTracker';
import { staggerContainer, fadeInUp } from '@/lib/animations';

// ---------------------------------------------------------------------------
// Grade utilities
// ---------------------------------------------------------------------------

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  B: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  C: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  D: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  F: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};

function transparencyBarColor(score: number | null): string {
  if (score == null) return 'bg-muted';
  if (score >= 85) return 'bg-emerald-500/80';
  if (score >= 70) return 'bg-sky-500/80';
  if (score >= 55) return 'bg-amber-500/80';
  if (score >= 40) return 'bg-orange-500/80';
  return 'bg-rose-500/80';
}

// ---------------------------------------------------------------------------
// Member Row
// ---------------------------------------------------------------------------

function MemberRow({ member }: { member: CommitteeMemberQuickView }) {
  const displayName = member.name || `${member.ccHotId.slice(0, 12)}…${member.ccHotId.slice(-6)}`;
  const gradeStyle = member.transparencyGrade ? (GRADE_COLORS[member.transparencyGrade] ?? '') : '';

  return (
    <Link
      href={`/governance/committee/${encodeURIComponent(member.ccHotId)}`}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
    >
      {/* Rank */}
      <span className="w-7 shrink-0 text-center font-mono text-xs text-muted-foreground tabular-nums">
        {member.rank ?? '—'}
      </span>

      {/* Grade badge */}
      {member.transparencyGrade ? (
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
            gradeStyle,
          )}
        >
          {member.transparencyGrade}
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
          —
        </span>
      )}

      {/* Name + verdict */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium group-hover:text-primary transition-colors">
          {displayName}
        </span>
        {member.narrativeVerdict && (
          <span className="block truncate text-xs text-muted-foreground mt-0.5">
            {member.narrativeVerdict}
          </span>
        )}
      </div>

      {/* Transparency bar (hidden on mobile) */}
      <div className="hidden sm:flex items-center gap-2 w-36 shrink-0">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${transparencyBarColor(member.transparencyIndex)}`}
            style={{ width: `${member.transparencyIndex ?? 0}%` }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground w-7 text-right">
          {member.transparencyIndex ?? '—'}
        </span>
      </div>

      {/* Vote count (hidden on small screens) */}
      <span className="hidden md:block w-16 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {member.voteCount} votes
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Methodology (collapsed)
// ---------------------------------------------------------------------------

function Methodology() {
  const [open, setOpen] = useState(false);

  const pillars = [
    { icon: Vote, label: 'Participation', weight: '39%', desc: 'Vote rate on eligible proposals' },
    {
      icon: BookOpen,
      label: 'Rationale Quality',
      weight: '33%',
      desc: 'Constitutional article citations in vote rationales',
    },
    {
      icon: Clock,
      label: 'Responsiveness',
      weight: '17%',
      desc: 'Timeliness of voting relative to deadlines',
    },
    {
      icon: Sparkles,
      label: 'Independence',
      weight: '11%',
      desc: 'Independent judgment vs. always voting with the majority',
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>How is the Transparency Index calculated?</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Each CC member is scored on 4 pillars of accountability. The weighted average produces
            the Transparency Index (0-100).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div key={p.label} className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <p.icon className="h-3.5 w-3.5" />
                  {p.label}
                  <span className="text-muted-foreground">({p.weight})</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function CommitteePageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-20 rounded-xl" />
      <div className="rounded-xl border divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-7" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="hidden sm:block h-1.5 w-36 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CommitteePage() {
  const { data, isLoading } = useCommitteeMembers();
  const [search, setSearch] = useState('');

  const members = useMemo(() => data?.members ?? [], [data]);
  const health = data?.health;

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.name?.toLowerCase().includes(q) || m.ccHotId.toLowerCase().includes(q),
    );
  }, [members, search]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.transparencyIndex != null && b.transparencyIndex != null)
          return b.transparencyIndex - a.transparencyIndex;
        if (a.transparencyIndex != null) return -1;
        if (b.transparencyIndex != null) return 1;
        return b.voteCount - a.voteCount;
      }),
    [filtered],
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageViewTracker event="governance_committee_viewed" />

      {isLoading || !health ? (
        <CommitteePageSkeleton />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Section 1: Health Verdict (dominant) */}
          <motion.div variants={fadeInUp}>
            <CCHealthVerdict health={health} />
          </motion.div>

          {/* Section 2: Key Insight */}
          <CCInsightCard health={health} members={members} />

          {/* Section 3: Member Rankings */}
          <motion.div variants={fadeInUp} className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold">Member Rankings</h2>
              {members.length > 5 && (
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              )}
            </div>

            {sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {search ? 'No members match your search.' : 'No CC member data available yet.'}
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                {sorted.map((member) => (
                  <MemberRow key={member.ccHotId} member={member} />
                ))}
              </div>
            )}
          </motion.div>

          {/* Section 4: Methodology (collapsed) */}
          <motion.div variants={fadeInUp}>
            <Methodology />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
