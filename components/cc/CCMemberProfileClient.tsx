'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Vote,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Users,
  Scale,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';

const CCTransparencyTrend = dynamic(
  () =>
    import('@/components/cc/CCTransparencyTrend').then((m) => ({ default: m.CCTransparencyTrend })),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-xl" /> },
);
import { CCRecentVotes } from '@/components/cc/CCRecentVotes';
import { CCConstitutionalReasoning } from '@/components/cc/CCConstitutionalReasoning';
import { CCKeyFinding } from '@/components/cc/CCKeyFinding';
import { CCDossierSummary } from '@/components/cc/CCDossierSummary';
import { CCChamberPosition } from '@/components/cc/CCChamberPosition';
import { CCInterpretationProfile } from '@/components/cc/CCInterpretationProfile';
import { CopyableAddress } from '@/components/CopyableAddress';
import { useCCMemberIntelligence } from '@/hooks/queries';
import type { CCMemberIntelligence } from '@/hooks/queries';
import {
  interpretFidelityScore,
  interpretParticipation,
  interpretRationaleQuality,
  interpretConstitutionalGrounding,
  interpretPillarStrengthWeakness,
} from '@/lib/cc/interpretations';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import type { CCFidelitySnapshot, CCProposalFidelitySnapshot } from '@/lib/data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RationaleAnalysis {
  proposalTxHash: string;
  proposalIndex: number;
  deliberationQuality: number;
  rationalityScore: number;
  reciprocityScore: number;
  clarityScore: number;
  boilerplateScore: number | null;
  confidence: number | null;
  notableFinding: string | null;
  findingSeverity: string | null;
}

export interface EnrichedVote {
  proposalTxHash: string;
  proposalIndex: number;
  vote: string;
  epoch: number;
  hasRationale: boolean;
  proposalTitle: string | null;
  proposalType: string;
  rationaleSummary: string | null;
  citedArticles: string[];
  drepMajority: string | null;
  spoMajority: string | null;
}

interface PillarScores {
  participation: number | null;
  constitutionalGrounding: number | null;
  reasoningQuality: number | null;
}

interface ProfileData {
  ccHotId: string;
  authorName: string | null;
  fidelityScore: number | null;
  fidelityGrade: string | null;
  status: string | null;
  expirationEpoch: number | null;
  authorizationEpoch: number | null;
  rank: number | null;
  totalScored: number;
  totalVotes: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  withRationale: number;
  votesCast: number;
  eligibleProposals: number | null;
  rationaleProvisionRate: number | null;
  constitutionalGroundingScore: number | null;
  drepAgree: number;
  drepCompare: number;
  spoAgree: number;
  spoCompare: number;
  pillarScores: PillarScores | null;
  enrichedVotes: EnrichedVote[];
  fidelityHistory: CCFidelitySnapshot[];
  proposalFidelityHistory?: CCProposalFidelitySnapshot[];
  rationaleAnalyses?: RationaleAnalysis[];
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

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  if (score >= 60) return 'text-sky-500 bg-sky-500/10 border-sky-500/30';
  if (score >= 40) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-500 bg-rose-500/10 border-rose-500/30';
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-rose-500';
    case 'concern':
      return 'text-amber-500';
    case 'noteworthy':
      return 'text-sky-500';
    default:
      return 'text-muted-foreground';
  }
}

const VOTES_PER_PAGE = 10;

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

function ProfileHero({
  data,
  intelligence,
}: {
  data: ProfileData;
  intelligence: CCMemberIntelligence | undefined;
}) {
  const displayName =
    data.authorName ?? `${data.ccHotId.slice(0, 12)}\u2026${data.ccHotId.slice(-6)}`;
  const grade = data.fidelityGrade ? GRADE_COLORS[data.fidelityGrade] : null;

  const verdict =
    data.fidelityScore != null && data.rank != null
      ? interpretFidelityScore(data.fidelityScore, data.rank, data.totalScored)
      : null;

  const pillarSummary = data.pillarScores
    ? interpretPillarStrengthWeakness(data.pillarScores)
    : null;

  return (
    <div className="flex flex-col sm:flex-row gap-5">
      {/* Left: Name + badges + verdict */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="space-y-1">
          {data.authorName ? (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{data.authorName}</h1>
              <CopyableAddress address={data.ccHotId} truncate className="text-xs" />
            </>
          ) : (
            <h1 className="text-xl sm:text-2xl font-bold font-mono break-all">{displayName}</h1>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Constitutional Committee
          </Badge>
          {data.status && (
            <Badge
              variant="outline"
              className={
                data.status === 'authorized'
                  ? 'text-emerald-500 border-emerald-500/40'
                  : 'text-muted-foreground'
              }
            >
              {data.status}
            </Badge>
          )}
          {data.expirationEpoch && (
            <Badge variant="secondary" className="text-xs">
              Expires epoch {data.expirationEpoch}
            </Badge>
          )}
          {data.rank != null && data.rank > 0 && (
            <Badge variant="secondary" className="text-xs">
              Rank {data.rank}/{data.totalScored}
            </Badge>
          )}
          {intelligence?.chamberPosition && (
            <Badge variant="secondary" className="text-xs gap-1">
              <ShieldCheck className="h-3 w-3" />
              {intelligence.chamberPosition.archetypeLabel}
            </Badge>
          )}
        </div>

        {/* Narrative verdict */}
        {verdict && <p className="text-sm text-muted-foreground leading-relaxed">{verdict}</p>}
        {pillarSummary && <p className="text-xs text-muted-foreground">{pillarSummary}</p>}
        {intelligence?.chamberPosition?.mostAligned && (
          <p className="text-xs text-muted-foreground">
            Agrees most with {intelligence.chamberPosition.mostAligned.memberId.slice(0, 12)}
            &hellip; ({intelligence.chamberPosition.mostAligned.pct}%)
            {intelligence.chamberPosition.mostDivergent && (
              <>
                {' '}
                &middot; Diverges most from{' '}
                {intelligence.chamberPosition.mostDivergent.memberId.slice(0, 12)}&hellip; (
                {intelligence.chamberPosition.mostDivergent.pct}%)
              </>
            )}
          </p>
        )}
      </div>

      {/* Right: Score card */}
      {data.fidelityScore != null && grade && data.fidelityGrade && (
        <div
          className={cn(
            'shrink-0 w-full sm:w-48 rounded-xl border px-6 py-5 text-center',
            grade.bg,
            grade.border,
          )}
        >
          <p className="text-xs text-muted-foreground mb-1">Constitutional Fidelity</p>
          <p className={cn('text-4xl font-bold tabular-nums', grade.text)}>{data.fidelityScore}</p>
          <p className={cn('text-lg font-bold', grade.text)}>Grade {data.fidelityGrade}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key Stat Cards (3 cards)
// ---------------------------------------------------------------------------

function KeyStats({ data }: { data: ProfileData }) {
  const participationNarrative =
    data.eligibleProposals != null && data.eligibleProposals > 0
      ? interpretParticipation(data.votesCast, data.eligibleProposals)
      : `${data.totalVotes} votes cast`;

  const rationaleNarrative = interpretRationaleQuality(
    data.pillarScores?.reasoningQuality ?? null,
    data.rationaleProvisionRate,
  );

  const groundingNarrative = interpretConstitutionalGrounding(data.constitutionalGroundingScore);

  const stats = [
    {
      label: 'Participation',
      value:
        data.eligibleProposals != null && data.eligibleProposals > 0
          ? `${data.votesCast}/${data.eligibleProposals}`
          : `${data.totalVotes}`,
      sub:
        data.eligibleProposals != null && data.eligibleProposals > 0
          ? `${Math.round((data.votesCast / data.eligibleProposals) * 100)}% vote rate`
          : 'proposals voted on',
      narrative: participationNarrative,
    },
    {
      label: 'Constitutional Grounding',
      value:
        data.constitutionalGroundingScore != null
          ? `${Math.round(data.constitutionalGroundingScore)}`
          : '\u2014',
      sub: data.constitutionalGroundingScore != null ? '/100 score' : 'Not available',
      narrative: groundingNarrative,
    },
    {
      label: 'Reasoning Quality',
      value: `${data.withRationale}/${data.totalVotes}`,
      sub: `${data.totalVotes > 0 ? Math.round((data.withRationale / data.totalVotes) * 100) : 0}% provision rate`,
      narrative: rationaleNarrative,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <motion.div
          key={s.label}
          variants={fadeInUp}
          className="rounded-xl border border-border/60 bg-card/30 px-4 py-3.5 space-y-1"
        >
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="text-xl font-bold tabular-nums">{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed pt-1 border-t border-border/30">
            {s.narrative}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Term Context Line
// ---------------------------------------------------------------------------

function TermContext({ data }: { data: ProfileData }) {
  const parts: string[] = [];
  if (data.authorizationEpoch != null) {
    parts.push(`Authorized since epoch ${data.authorizationEpoch}`);
  }
  if (data.expirationEpoch != null) {
    parts.push(`Term expires epoch ${data.expirationEpoch}`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <ShieldCheck className="h-3 w-3 shrink-0" />
      {parts.join(' \u2022 ')}
    </p>
  );
}

// ---------------------------------------------------------------------------
// PillarBar (reused from old page, adapted)
// ---------------------------------------------------------------------------

function PillarBar({
  icon,
  label,
  weight,
  score,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  weight: string;
  score: number | null;
  delay?: number;
}) {
  const displayScore = score != null ? Math.round(score) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">{weight}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', pillarBarColor(score))}
          initial={{ width: 0 }}
          animate={{ width: `${displayScore ?? 0}%` }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.3 + delay }}
        />
      </div>
      <p className="text-xs tabular-nums text-right text-muted-foreground">
        {displayScore != null ? `${displayScore}/100` : 'Pending'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar Breakdown (extracted for reuse between overview and deep)
// ---------------------------------------------------------------------------

function PillarBreakdown({ data }: { data: ProfileData }) {
  if (!data.pillarScores || data.fidelityScore == null) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Scale className="h-4 w-4" />
        Constitutional Fidelity Breakdown
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <PillarBar
          icon={<Vote className="h-3.5 w-3.5" />}
          label="Participation"
          weight="30%"
          score={data.pillarScores.participation}
          delay={0}
        />
        <PillarBar
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Constitutional Grounding"
          weight="40%"
          score={data.pillarScores.constitutionalGrounding}
          delay={0.1}
        />
        <PillarBar
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Reasoning Quality"
          weight="30%"
          score={data.pillarScores.reasoningQuality}
          delay={0.2}
        />
      </div>
      <a
        href="https://github.com/governada/app/discussions"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
      >
        Disagree with this score?
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voting Record Tab (paginated, with filters for Level 3)
// ---------------------------------------------------------------------------

function VotingRecordTab({
  votes,
  rationaleAnalyses,
}: {
  votes: EnrichedVote[];
  rationaleAnalyses?: RationaleAnalysis[];
}) {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [alignmentFilter, setAlignmentFilter] = useState<'all' | 'aligned' | 'diverged'>('all');
  const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());

  const analysisMap = useMemo(() => {
    const map = new Map<string, RationaleAnalysis>();
    for (const a of rationaleAnalyses ?? []) {
      map.set(`${a.proposalTxHash}:${a.proposalIndex}`, a);
    }
    return map;
  }, [rationaleAnalyses]);

  const toggleExpanded = (key: string) => {
    setExpandedVotes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Available proposal types
  const proposalTypes = useMemo(() => {
    const types = new Set(votes.map((v) => v.proposalType));
    return Array.from(types).sort();
  }, [votes]);

  // Filtered votes
  const filteredVotes = useMemo(() => {
    let result = votes;
    if (typeFilter !== 'all') {
      result = result.filter((v) => v.proposalType === typeFilter);
    }
    if (alignmentFilter !== 'all') {
      result = result.filter((v) => {
        if (!v.drepMajority || v.drepMajority === 'Abstain') return false;
        const isAligned = v.vote === v.drepMajority;
        return alignmentFilter === 'aligned' ? isAligned : !isAligned;
      });
    }
    return result;
  }, [votes, typeFilter, alignmentFilter]);

  const totalPages = Math.ceil(filteredVotes.length / VOTES_PER_PAGE);
  const pageVotes = useMemo(
    () => filteredVotes.slice(page * VOTES_PER_PAGE, (page + 1) * VOTES_PER_PAGE),
    [filteredVotes, page],
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [typeFilter, alignmentFilter]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none rounded-lg border border-border/60 bg-card/30 px-3 py-1.5 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All types</option>
            {proposalTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={alignmentFilter}
            onChange={(e) => setAlignmentFilter(e.target.value as typeof alignmentFilter)}
            className="appearance-none rounded-lg border border-border/60 bg-card/30 px-3 py-1.5 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All alignment</option>
            <option value="aligned">Aligned with DReps</option>
            <option value="diverged">Diverged from DReps</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
        {(typeFilter !== 'all' || alignmentFilter !== 'all') && (
          <button
            onClick={() => {
              setTypeFilter('all');
              setAlignmentFilter('all');
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left px-4 py-3 font-medium">Proposal</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Type</th>
              <th className="text-center px-4 py-3 font-medium">Vote</th>
              <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">
                DRep Majority
              </th>
              <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">Rationale</th>
              <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Epoch</th>
            </tr>
          </thead>
          <tbody>
            {pageVotes.map((v) => {
              const isAligned =
                v.drepMajority && v.drepMajority !== 'Abstain' ? v.vote === v.drepMajority : null;
              const voteKey = `${v.proposalTxHash}:${v.proposalIndex}`;
              const analysis = analysisMap.get(voteKey);
              const isExpanded = expandedVotes.has(voteKey);
              return (
                <tr
                  key={`${v.proposalTxHash}-${v.proposalIndex}`}
                  className="border-b last:border-0 hover:bg-muted/40 transition-colors group"
                >
                  <td colSpan={6} className="p-0">
                    <div className="flex items-center">
                      <div className="flex-1 grid grid-cols-[1fr] md:grid-cols-[1fr_auto_auto_auto_auto_auto] items-center">
                        <div className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {analysis && (
                              <button
                                onClick={() => toggleExpanded(voteKey)}
                                className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
                                aria-label={isExpanded ? 'Collapse analysis' : 'Expand analysis'}
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-3.5 w-3.5 text-muted-foreground transition-transform',
                                    isExpanded && 'rotate-180',
                                  )}
                                />
                              </button>
                            )}
                            <Link
                              href={`/proposal/${v.proposalTxHash}/${v.proposalIndex}`}
                              className="hover:text-primary transition-colors"
                            >
                              {v.proposalTitle ? (
                                <span className="text-sm line-clamp-1">{v.proposalTitle}</span>
                              ) : (
                                <span className="font-mono text-xs">
                                  {v.proposalTxHash.slice(0, 12)}\u2026
                                </span>
                              )}
                            </Link>
                          </div>
                        </div>
                        <div className="px-4 py-3 hidden md:block">
                          <Badge variant="secondary" className="text-[10px]">
                            {v.proposalType}
                          </Badge>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              v.vote === 'Yes'
                                ? 'text-emerald-500 border-emerald-500/40'
                                : v.vote === 'No'
                                  ? 'text-rose-500 border-rose-500/40'
                                  : 'text-amber-500 border-amber-500/40'
                            }
                          >
                            {v.vote}
                          </Badge>
                        </div>
                        <div className="px-4 py-3 text-center hidden sm:block">
                          {v.drepMajority && v.drepMajority !== 'Abstain' ? (
                            <span
                              className={cn(
                                'text-xs',
                                isAligned ? 'text-emerald-500' : 'text-rose-500',
                              )}
                            >
                              {v.drepMajority} {isAligned ? '(aligned)' : '(diverged)'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">\u2014</span>
                          )}
                        </div>
                        <div className="px-4 py-3 text-center hidden lg:block">
                          {v.rationaleSummary ? (
                            <span className="text-xs text-emerald-500" title={v.rationaleSummary}>
                              {v.citedArticles.length > 0
                                ? `${v.citedArticles.length} articles`
                                : 'Provided'}
                            </span>
                          ) : v.hasRationale ? (
                            <span className="text-xs text-amber-500">Pending parse</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </div>
                        <div className="px-4 py-3 text-right hidden sm:block tabular-nums text-muted-foreground">
                          {v.epoch}
                        </div>
                      </div>
                    </div>
                    {/* Collapsible rationale analysis detail */}
                    {analysis && isExpanded && (
                      <div className="px-4 pb-3 pt-0 border-t border-border/30 bg-muted/20">
                        <div className="flex flex-wrap items-center gap-2 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tabular-nums',
                              scoreColor(analysis.rationalityScore),
                            )}
                          >
                            Rationality: {analysis.rationalityScore}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tabular-nums',
                              scoreColor(analysis.reciprocityScore),
                            )}
                          >
                            Reciprocity: {analysis.reciprocityScore}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tabular-nums',
                              scoreColor(analysis.clarityScore),
                            )}
                          >
                            Clarity: {analysis.clarityScore}
                          </span>
                        </div>
                        {analysis.notableFinding && (
                          <p
                            className={cn(
                              'text-[11px] italic leading-relaxed',
                              severityColor(analysis.findingSeverity ?? 'info'),
                            )}
                          >
                            {analysis.notableFinding}
                          </p>
                        )}
                        {analysis.boilerplateScore != null && analysis.boilerplateScore > 50 && (
                          <p className="text-[10px] text-amber-500 mt-1">
                            &#9888; Template reuse detected
                          </p>
                        )}
                        {analysis.confidence != null && analysis.confidence < 60 && (
                          <p className="text-[10px] text-amber-500 mt-1">
                            &#9888; Low AI confidence
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {pageVotes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No votes match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing {page * VOTES_PER_PAGE + 1}-
            {Math.min((page + 1) * VOTES_PER_PAGE, filteredVotes.length)} of {filteredVotes.length}{' '}
            votes
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alignment Tab (enhanced with principled vs silent divergence)
// ---------------------------------------------------------------------------

function AlignmentTab({ data }: { data: ProfileData }) {
  const drepAlignmentPct =
    data.drepCompare > 0 ? Math.round((data.drepAgree / data.drepCompare) * 100) : null;
  const spoAlignmentPct =
    data.spoCompare > 0 ? Math.round((data.spoAgree / data.spoCompare) * 100) : null;

  // Build vote-by-type breakdown
  const typeBreakdown = useMemo(() => {
    const map = new Map<string, { yes: number; no: number; abstain: number }>();
    for (const v of data.enrichedVotes) {
      const type = v.proposalType;
      const counts = map.get(type) ?? { yes: 0, no: 0, abstain: 0 };
      if (v.vote === 'Yes') counts.yes++;
      else if (v.vote === 'No') counts.no++;
      else counts.abstain++;
      map.set(type, counts);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const tA = a[1].yes + a[1].no + a[1].abstain;
      const tB = b[1].yes + b[1].no + b[1].abstain;
      return tB - tA;
    });
  }, [data.enrichedVotes]);

  // Split diverged votes into principled (has rationale) vs silent (no rationale)
  const { principledDivergences, silentDivergences } = useMemo(() => {
    const diverged = data.enrichedVotes.filter(
      (v) => v.drepMajority && v.drepMajority !== 'Abstain' && v.vote !== v.drepMajority,
    );
    return {
      principledDivergences: diverged.filter((v) => v.hasRationale),
      silentDivergences: diverged.filter((v) => !v.hasRationale),
    };
  }, [data.enrichedVotes]);

  const totalDivergences = principledDivergences.length + silentDivergences.length;

  return (
    <div className="space-y-6">
      {/* Inter-body alignment bars */}
      {(drepAlignmentPct != null || spoAlignmentPct != null) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Inter-Body Alignment
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {drepAlignmentPct != null && (
              <div className="space-y-2 rounded-xl border border-border/60 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">DRep Consensus</span>
                  <span className="text-sm font-mono tabular-nums">{drepAlignmentPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500/80"
                    style={{ width: `${drepAlignmentPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Aligned with DRep majority on {data.drepAgree} of {data.drepCompare} proposals
                </p>
              </div>
            )}
            {spoAlignmentPct != null && (
              <div className="space-y-2 rounded-xl border border-border/60 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">SPO Consensus</span>
                  <span className="text-sm font-mono tabular-nums">{spoAlignmentPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500/80"
                    style={{ width: `${spoAlignmentPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Aligned with SPO majority on {data.spoAgree} of {data.spoCompare} proposals
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Principled vs Silent Divergence */}
      {totalDivergences > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            Diverged from DRep Majority ({totalDivergences})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-center space-y-1">
              <p className="text-lg font-bold tabular-nums text-emerald-500">
                {principledDivergences.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Principled (with rationale)</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-center space-y-1">
              <p className="text-lg font-bold tabular-nums text-amber-500">
                {silentDivergences.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Silent (no rationale)</p>
            </div>
          </div>

          {/* Principled divergences */}
          {principledDivergences.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-emerald-500 flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" />
                Principled Divergences
              </h4>
              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                {principledDivergences.map((v) => (
                  <DivergenceRow key={`${v.proposalTxHash}-${v.proposalIndex}`} vote={v} />
                ))}
              </div>
            </div>
          )}

          {/* Silent divergences */}
          {silentDivergences.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-amber-500">Silent Divergences</h4>
              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                {silentDivergences.map((v) => (
                  <DivergenceRow key={`${v.proposalTxHash}-${v.proposalIndex}`} vote={v} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Votes by proposal type */}
      {typeBreakdown.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Votes by Proposal Type</h3>
          <div className="space-y-2.5">
            {typeBreakdown.map(([type, counts]) => {
              const total = counts.yes + counts.no + counts.abstain;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">
                    {type}
                  </span>
                  <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-muted">
                    {counts.yes > 0 && (
                      <div
                        className="bg-emerald-500/70 h-full"
                        style={{ width: `${(counts.yes / total) * 100}%` }}
                      />
                    )}
                    {counts.no > 0 && (
                      <div
                        className="bg-rose-500/70 h-full"
                        style={{ width: `${(counts.no / total) * 100}%` }}
                      />
                    )}
                    {counts.abstain > 0 && (
                      <div
                        className="bg-amber-500/70 h-full"
                        style={{ width: `${(counts.abstain / total) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
                    {total}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500/70" /> Yes
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500/70" /> No
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500/70" /> Abstain
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared divergence row used in both principled/silent lists */
function DivergenceRow({ vote: v }: { vote: EnrichedVote }) {
  return (
    <Link
      href={`/proposal/${v.proposalTxHash}/${v.proposalIndex}`}
      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
    >
      <span className="text-sm truncate">
        {v.proposalTitle ?? `${v.proposalTxHash.slice(0, 12)}\u2026`}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant="outline"
          className={
            v.vote === 'Yes'
              ? 'text-emerald-500 border-emerald-500/40'
              : v.vote === 'No'
                ? 'text-rose-500 border-rose-500/40'
                : 'text-amber-500 border-amber-500/40'
          }
        >
          {v.vote}
        </Badge>
        <span className="text-[10px] text-muted-foreground">vs {v.drepMajority}</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Level 2: Overview Mode (default)
// ---------------------------------------------------------------------------

function OverviewMode({
  data,
  onViewFullRecord,
}: {
  data: ProfileData;
  onViewFullRecord: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Term context */}
      <TermContext data={data} />

      {/* Pillar bars */}
      <PillarBreakdown data={data} />

      {/* Compact trend sparkline */}
      <div className="[&_.card]:border-0 [&_.card]:bg-transparent [&_.card]:shadow-none [&_[style*='height']]:!h-32">
        <CCTransparencyTrend
          history={data.fidelityHistory}
          proposalSnapshots={data.proposalFidelityHistory}
        />
      </div>

      {/* Recent votes */}
      <CCRecentVotes votes={data.enrichedVotes} maxVotes={5} />

      {/* View full record button */}
      <motion.div variants={fadeInUp} className="flex justify-center pt-2">
        <Button variant="outline" onClick={onViewFullRecord} className="gap-2">
          View full record
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 3: Deep Analysis Mode
// ---------------------------------------------------------------------------

function DeepMode({
  data,
  intelligence,
  onBackToOverview,
}: {
  data: ProfileData;
  intelligence: CCMemberIntelligence | undefined;
  onBackToOverview: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBackToOverview} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to overview
        </Button>
        <Link
          href={`/governance/committee/compare?members=${encodeURIComponent(data.ccHotId)}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Compare with others
        </Link>
      </div>

      {/* Full tabbed interface */}
      <Tabs defaultValue="votes">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="votes">
            Voting Record
            <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
              ({data.enrichedVotes.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="reasoning">Constitutional Reasoning</TabsTrigger>
          <TabsTrigger value="alignment">Alignment</TabsTrigger>
          <TabsTrigger value="chamber">
            <Users className="h-3.5 w-3.5 mr-1" />
            Chamber
          </TabsTrigger>
          <TabsTrigger value="interpretation">
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            Interpretation
          </TabsTrigger>
          <TabsTrigger value="trend">
            <TrendingUp className="h-3.5 w-3.5 mr-1" />
            Trend & Context
          </TabsTrigger>
        </TabsList>

        <TabsContent value="votes" className="pt-4">
          <VotingRecordTab votes={data.enrichedVotes} rationaleAnalyses={data.rationaleAnalyses} />
        </TabsContent>

        <TabsContent value="reasoning" className="pt-4">
          <CCConstitutionalReasoning votes={data.enrichedVotes} />
        </TabsContent>

        <TabsContent value="alignment" className="pt-4">
          <AlignmentTab data={data} />
        </TabsContent>

        <TabsContent value="chamber" className="pt-4">
          <CCChamberPosition
            pairwiseAlignment={intelligence?.pairwiseAlignment ?? []}
            allMembers={[]}
          />
        </TabsContent>

        <TabsContent value="interpretation" className="pt-4">
          <CCInterpretationProfile
            interpretationHistory={intelligence?.interpretationHistory ?? []}
          />
        </TabsContent>

        <TabsContent value="trend" className="pt-4">
          <div className="space-y-6">
            <TermContext data={data} />
            <CCTransparencyTrend
              history={data.fidelityHistory}
              proposalSnapshots={data.proposalFidelityHistory}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component that uses useSearchParams (needs Suspense boundary)
// ---------------------------------------------------------------------------

function CCMemberProfileInner({ data }: { data: ProfileData }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: intelligence } = useCCMemberIntelligence(data.ccHotId);
  const [depth, setDepth] = useState<'overview' | 'deep'>(
    searchParams.get('depth') === 'deep' ? 'deep' : 'overview',
  );

  const updateDepth = (newDepth: 'overview' | 'deep') => {
    setDepth(newDepth);
    const params = new URLSearchParams(searchParams.toString());
    if (newDepth === 'deep') {
      params.set('depth', 'deep');
    } else {
      params.delete('depth');
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Hero */}
      <motion.div variants={fadeInUp}>
        <ProfileHero data={data} intelligence={intelligence} />
      </motion.div>

      {/* Key Finding */}
      {intelligence?.keyFinding && (
        <motion.div variants={fadeInUp}>
          <CCKeyFinding
            finding={intelligence.keyFinding.finding}
            severity={
              intelligence.keyFinding.severity as 'info' | 'noteworthy' | 'concern' | 'critical'
            }
          />
        </motion.div>
      )}

      {/* Key Stats */}
      <motion.div variants={fadeInUp}>
        <KeyStats data={data} />
      </motion.div>

      {/* Dossier Summary */}
      {intelligence?.dossier && (
        <motion.div variants={fadeInUp}>
          <CCDossierSummary dossier={intelligence.dossier} />
        </motion.div>
      )}

      {/* Depth-dependent content */}
      <motion.div variants={fadeInUp}>
        {depth === 'overview' ? (
          <OverviewMode data={data} onViewFullRecord={() => updateDepth('deep')} />
        ) : (
          <DeepMode
            data={data}
            intelligence={intelligence}
            onBackToOverview={() => updateDepth('overview')}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Client Component (with Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export function CCMemberProfileClient({ data }: { data: ProfileData }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-32 animate-pulse bg-muted rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-28 animate-pulse bg-muted rounded-xl" />
            <div className="h-28 animate-pulse bg-muted rounded-xl" />
            <div className="h-28 animate-pulse bg-muted rounded-xl" />
          </div>
        </div>
      }
    >
      <CCMemberProfileInner data={data} />
    </Suspense>
  );
}
