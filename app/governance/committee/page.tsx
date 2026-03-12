'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Vote, BookOpen, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommitteeMembers } from '@/hooks/queries';
import type { CommitteeMemberQuickView } from '@/hooks/queries';
import { CCHealthVerdict } from '@/components/cc/CCHealthVerdict';
import { CCInsightCard } from '@/components/cc/CCInsightCard';
import { PageViewTracker } from '@/components/PageViewTracker';
import { useSegment } from '@/components/providers/SegmentProvider';
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
// Member Card (mobile)
// ---------------------------------------------------------------------------

function MemberCard({ member }: { member: CommitteeMemberQuickView }) {
  const displayName = member.name || `${member.ccHotId.slice(0, 12)}…${member.ccHotId.slice(-6)}`;
  const gradeStyle = member.transparencyGrade ? (GRADE_COLORS[member.transparencyGrade] ?? '') : '';

  return (
    <Link
      href={`/governance/committee/${encodeURIComponent(member.ccHotId)}`}
      className="group block rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="flex items-start gap-3">
        {/* Grade badge */}
        {member.transparencyGrade ? (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold',
              gradeStyle,
            )}
          >
            {member.transparencyGrade}
          </span>
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
            —
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {displayName}
            </span>
            {member.rank != null && (
              <span className="shrink-0 text-xs font-mono tabular-nums text-muted-foreground">
                #{member.rank}
              </span>
            )}
          </div>

          {/* Transparency bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${transparencyBarColor(member.transparencyIndex)}`}
                style={{ width: `${member.transparencyIndex ?? 0}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {member.transparencyIndex ?? '—'}
            </span>
          </div>

          {/* Narrative verdict */}
          {member.narrativeVerdict && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
              {member.narrativeVerdict}
            </p>
          )}
        </div>
      </div>
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
  const { segment } = useSegment();

  const members = useMemo(() => data?.members ?? [], [data]);
  const health = data?.health;

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.transparencyIndex != null && b.transparencyIndex != null)
          return b.transparencyIndex - a.transparencyIndex;
        if (a.transparencyIndex != null) return -1;
        if (b.transparencyIndex != null) return 1;
        return b.voteCount - a.voteCount;
      }),
    [members],
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

          {/* Section 2: Key Insight (persona-adapted) */}
          <CCInsightCard health={health} members={members} segment={segment} />

          {/* Section 3: Member Rankings */}
          <motion.div variants={fadeInUp} className="space-y-3">
            <h2 className="text-base font-semibold">Member Rankings</h2>

            {sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No CC member data available yet.
              </div>
            ) : (
              <>
                {/* Desktop: compact rows */}
                <div className="hidden sm:block rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                  {sorted.map((member) => (
                    <MemberRow key={member.ccHotId} member={member} />
                  ))}
                </div>
                {/* Mobile: touch-friendly cards */}
                <div className="grid gap-3 sm:hidden">
                  {sorted.map((member) => (
                    <MemberCard key={member.ccHotId} member={member} />
                  ))}
                </div>
              </>
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
