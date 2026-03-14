'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Vote, BookOpen, Sparkles } from 'lucide-react';
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

function fidelityBarColor(score: number | null): string {
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
  const gradeStyle = member.fidelityGrade ? (GRADE_COLORS[member.fidelityGrade] ?? '') : '';

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
      {member.fidelityGrade ? (
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
            gradeStyle,
          )}
        >
          {member.fidelityGrade}
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

      {/* Fidelity bar (hidden on mobile) */}
      <div className="hidden sm:flex items-center gap-2 w-36 shrink-0">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${fidelityBarColor(member.fidelityScore)}`}
            style={{ width: `${member.fidelityScore ?? 0}%` }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground w-7 text-right">
          {member.fidelityScore ?? '—'}
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
  const gradeStyle = member.fidelityGrade ? (GRADE_COLORS[member.fidelityGrade] ?? '') : '';

  return (
    <Link
      href={`/governance/committee/${encodeURIComponent(member.ccHotId)}`}
      className="group block rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="flex items-start gap-3">
        {/* Grade badge */}
        {member.fidelityGrade ? (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold',
              gradeStyle,
            )}
          >
            {member.fidelityGrade}
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

          {/* Fidelity bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${fidelityBarColor(member.fidelityScore)}`}
                style={{ width: `${member.fidelityScore ?? 0}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {member.fidelityScore ?? '—'}
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
    { icon: Vote, label: 'Participation', weight: '30%', desc: 'Vote rate on eligible proposals' },
    {
      icon: BookOpen,
      label: 'Constitutional Grounding',
      weight: '40%',
      desc: 'Depth of constitutional article citations in vote rationales',
    },
    {
      icon: Sparkles,
      label: 'Reasoning Quality',
      weight: '30%',
      desc: 'Quality and completeness of rationale explanations',
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>How is the Constitutional Fidelity Score calculated?</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Each CC member is scored on 3 pillars of constitutional accountability. The weighted
            average produces the Constitutional Fidelity Score (0-100).
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
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
          <Link
            href="/governance/committee/data"
            className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            View full methodology &amp; data export &rarr;
          </Link>
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
  const stats = data?.stats;

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.fidelityScore != null && b.fidelityScore != null)
          return b.fidelityScore - a.fidelityScore;
        if (a.fidelityScore != null) return -1;
        if (b.fidelityScore != null) return 1;
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

          {/* Section 3: Aggregate Stats */}
          {stats && (
            <motion.div variants={fadeInUp} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border/60 bg-card/30 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{health.activeMembers}</p>
                <p className="text-xs text-muted-foreground">Active Members</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/30 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{stats.totalProposalsReviewed}</p>
                <p className="text-xs text-muted-foreground">Proposals Reviewed</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/30 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {stats.avgRationaleRate != null ? `${stats.avgRationaleRate}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Rationale Rate</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/30 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{stats.totalCCVotes}</p>
                <p className="text-xs text-muted-foreground">Total Votes</p>
              </div>
            </motion.div>
          )}

          {/* Section 4: Member Rankings */}
          <motion.div variants={fadeInUp} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Member Rankings</h2>
              <Link
                href="/governance/committee/compare"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Compare Members
              </Link>
            </div>

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

          {/* Section 5: Methodology (collapsed) */}
          <motion.div variants={fadeInUp}>
            <Methodology />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
