'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Vote, BookOpen, Sparkles, Check, GitCompareArrows } from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainer, fadeInUp } from '@/lib/animations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparisonMember {
  ccHotId: string;
  authorName: string | null;
  fidelityScore: number | null;
  fidelityGrade: string | null;
  participationScore: number | null;
  constitutionalGroundingScore: number | null;
  reasoningQualityScore: number | null;
  rationaleProvisionRate: number | null;
  votesCast: number | null;
  eligibleProposals: number | null;
}

interface CCComparisonViewProps {
  members: ComparisonMember[];
  allMembers: ComparisonMember[];
}

// ---------------------------------------------------------------------------
// Grade utilities
// ---------------------------------------------------------------------------

const GRADE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  B: { text: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  C: { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  D: { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  F: { text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

function pillarBarColor(score: number | null): string {
  if (score == null) return 'bg-muted';
  if (score >= 80) return 'bg-emerald-500/80';
  if (score >= 60) return 'bg-sky-500/80';
  if (score >= 40) return 'bg-amber-500/80';
  return 'bg-rose-500/80';
}

const MEMBER_COLORS = ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500'] as const;

function displayName(m: ComparisonMember): string {
  return m.authorName ?? `${m.ccHotId.slice(0, 8)}...${m.ccHotId.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Member Selector
// ---------------------------------------------------------------------------

function MemberSelector({
  allMembers,
  selected,
  onToggle,
  onCompare,
}: {
  allMembers: ComparisonMember[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onCompare: () => void;
}) {
  const sorted = useMemo(
    () =>
      [...allMembers].sort((a, b) => {
        if (a.fidelityScore != null && b.fidelityScore != null)
          return b.fidelityScore - a.fidelityScore;
        if (a.fidelityScore != null) return -1;
        if (b.fidelityScore != null) return 1;
        return 0;
      }),
    [allMembers],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Select Members to Compare</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose 2-4 members for side-by-side comparison
          </p>
        </div>
        <button
          onClick={onCompare}
          disabled={selected.size < 2}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            selected.size >= 2
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          <GitCompareArrows className="h-4 w-4" />
          Compare ({selected.size})
        </button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((member) => {
          const isSelected = selected.has(member.ccHotId);
          const gradeStyle = member.fidelityGrade ? GRADE_COLORS[member.fidelityGrade] : null;
          const isDisabled = !isSelected && selected.size >= 4;

          return (
            <button
              key={member.ccHotId}
              onClick={() => !isDisabled && onToggle(member.ccHotId)}
              disabled={isDisabled}
              className={cn(
                'relative rounded-xl border p-4 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border/60 hover:bg-muted/40',
                isDisabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              <div className="flex items-center gap-3">
                {/* Grade badge */}
                {gradeStyle && member.fidelityGrade ? (
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold',
                      gradeStyle.bg,
                      gradeStyle.text,
                      gradeStyle.border,
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
                  <span className="block text-sm font-medium truncate">{displayName(member)}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {member.fidelityScore ?? '—'} / 100
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar comparison bars
// ---------------------------------------------------------------------------

interface PillarComparisonProps {
  label: string;
  icon: React.ReactNode;
  weight: string;
  members: ComparisonMember[];
  getValue: (m: ComparisonMember) => number | null;
}

function PillarComparison({ label, icon, weight, members, getValue }: PillarComparisonProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">{weight}</span>
      </div>

      <div className="space-y-2">
        {members.map((member, idx) => {
          const score = getValue(member);
          return (
            <div key={member.ccHotId} className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full shrink-0',
                  MEMBER_COLORS[idx % MEMBER_COLORS.length],
                )}
              />
              <span className="text-xs text-muted-foreground w-20 truncate shrink-0">
                {displayName(member).split(' ')[0]}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', pillarBarColor(score))}
                  initial={{ width: 0 }}
                  animate={{ width: `${score ?? 0}%` }}
                  transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.2 + idx * 0.1 }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                {score != null ? Math.round(score) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Comparison (columns)
// ---------------------------------------------------------------------------

function ScoreComparison({ members }: { members: ComparisonMember[] }) {
  const gridClass =
    members.length === 2
      ? 'grid-cols-2'
      : members.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className="space-y-6">
      {/* Member columns */}
      <div className={cn('grid gap-4', gridClass)}>
        {members.map((member, idx) => {
          const grade = member.fidelityGrade ? GRADE_COLORS[member.fidelityGrade] : null;
          const voteRate =
            member.votesCast != null &&
            member.eligibleProposals != null &&
            member.eligibleProposals > 0
              ? Math.round((member.votesCast / member.eligibleProposals) * 100)
              : null;

          return (
            <motion.div
              key={member.ccHotId}
              variants={fadeInUp}
              className="rounded-xl border border-border/60 bg-card/30 overflow-hidden"
            >
              {/* Color bar */}
              <div className={cn('h-1', MEMBER_COLORS[idx % MEMBER_COLORS.length])} />

              <div className="p-4 space-y-4">
                {/* Name + Grade */}
                <div className="text-center space-y-2">
                  <Link
                    href={`/governance/committee/${encodeURIComponent(member.ccHotId)}`}
                    className="text-sm font-medium hover:text-primary transition-colors line-clamp-2"
                  >
                    {displayName(member)}
                  </Link>
                  {grade && member.fidelityGrade && (
                    <div
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5',
                        grade.bg,
                        grade.border,
                      )}
                    >
                      <span className={cn('text-2xl font-bold tabular-nums', grade.text)}>
                        {member.fidelityScore}
                      </span>
                      <span className={cn('text-xs font-bold', grade.text)}>
                        {member.fidelityGrade}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Votes</span>
                    <span className="font-mono tabular-nums">
                      {member.votesCast ?? '—'}
                      {member.eligibleProposals != null ? ` / ${member.eligibleProposals}` : ''}
                    </span>
                  </div>
                  {voteRate != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Vote Rate</span>
                      <span className="font-mono tabular-nums">{voteRate}%</span>
                    </div>
                  )}
                  {member.rationaleProvisionRate != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rationale Rate</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(member.rationaleProvisionRate)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pillar comparison bars */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Pillar Comparison</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <PillarComparison
            label="Participation"
            icon={<Vote className="h-3.5 w-3.5" />}
            weight="30%"
            members={members}
            getValue={(m) => m.participationScore}
          />
          <PillarComparison
            label="Constitutional Grounding"
            icon={<BookOpen className="h-3.5 w-3.5" />}
            weight="40%"
            members={members}
            getValue={(m) => m.constitutionalGroundingScore}
          />
          <PillarComparison
            label="Reasoning Quality"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            weight="30%"
            members={members}
            getValue={(m) => m.reasoningQualityScore}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        {members.map((member, idx) => (
          <span key={member.ccHotId} className="flex items-center gap-1.5">
            <span
              className={cn('h-2.5 w-2.5 rounded-full', MEMBER_COLORS[idx % MEMBER_COLORS.length])}
            />
            {displayName(member)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CCComparisonView({ members, allMembers }: CCComparisonViewProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(members.map((m) => m.ccHotId)),
  );

  const showComparison = members.length >= 2;

  function handleToggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

  function handleCompare() {
    if (selected.size < 2) return;
    const ids = Array.from(selected).join(',');
    router.push(`/governance/committee/compare?members=${encodeURIComponent(ids)}`);
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Back link */}
      <motion.div variants={fadeInUp}>
        <Link
          href="/governance/committee"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Committee
        </Link>
      </motion.div>

      {/* Title */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-2xl font-bold">Compare Members</h1>
        {showComparison && (
          <p className="text-sm text-muted-foreground mt-1">
            Side-by-side comparison of {members.length} CC members
          </p>
        )}
      </motion.div>

      {/* Comparison or Selector */}
      {showComparison ? (
        <motion.div variants={fadeInUp}>
          <ScoreComparison members={members} />
        </motion.div>
      ) : (
        <motion.div variants={fadeInUp}>
          <MemberSelector
            allMembers={allMembers}
            selected={selected}
            onToggle={handleToggle}
            onCompare={handleCompare}
          />
        </motion.div>
      )}

      {/* If showing comparison, also show selector below to modify selection */}
      {showComparison && (
        <motion.div variants={fadeInUp}>
          <MemberSelector
            allMembers={allMembers}
            selected={selected}
            onToggle={handleToggle}
            onCompare={handleCompare}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
