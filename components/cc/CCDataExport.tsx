'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  FileJson,
  Vote,
  BookOpen,
  Sparkles,
  Scale,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainer, fadeInUp } from '@/lib/animations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataMember {
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

export interface CitationData {
  ccHotId: string;
  citedArticles: string[];
}

interface CCDataExportProps {
  members: DataMember[];
  citations: CitationData[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_ARTICLES = [
  'Article II, § 6',
  'Article II, § 7',
  'Article III',
  'Article III, § 6',
  'Article V',
  'Article VI',
];

const EXPECTED_ARTICLES: Record<string, string[]> = {
  TreasuryWithdrawals: ['Article II, § 6', 'Article II, § 7'],
  ParameterChange: ['Article II, § 6', 'Article III'],
  HardForkInitiation: ['Article II, § 6', 'Article III, § 6'],
  InfoAction: ['Article II, § 6'],
  NoConfidence: ['Article II, § 6', 'Article V'],
  NewCommittee: ['Article II, § 6', 'Article V'],
  NewConstitutionalCommittee: ['Article II, § 6', 'Article V'],
  NewConstitution: ['Article II, § 6', 'Article VI'],
  UpdateConstitution: ['Article II, § 6', 'Article VI'],
};

const GRADE_BOUNDARIES = [
  { grade: 'A', min: 85, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { grade: 'B', min: 70, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  { grade: 'C', min: 55, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { grade: 'D', min: 40, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { grade: 'F', min: 0, color: 'text-rose-500', bg: 'bg-rose-500/10' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayName(m: DataMember): string {
  return m.authorName ?? `${m.ccHotId.slice(0, 12)}...`;
}

function matchArticle(cited: string, article: string): boolean {
  const parts = article.split(/[,§\s]+/).filter(Boolean);
  return parts.every((part) => cited.includes(part));
}

function heatmapColor(count: number): string {
  if (count === 0) return 'bg-muted/50 text-muted-foreground';
  if (count <= 2) return 'bg-sky-500/15 text-sky-600 dark:text-sky-400';
  if (count <= 5) return 'bg-sky-500/30 text-sky-700 dark:text-sky-300';
  return 'bg-sky-500/50 text-sky-800 dark:text-sky-200 font-medium';
}

// ---------------------------------------------------------------------------
// Article Citation Heatmap
// ---------------------------------------------------------------------------

function CitationHeatmap({
  members,
  citations,
}: {
  members: DataMember[];
  citations: CitationData[];
}) {
  // Build citation count map: memberId -> article -> count
  const heatmapData = useMemo(() => {
    const memberCounts = new Map<string, Map<string, number>>();

    for (const c of citations) {
      if (!memberCounts.has(c.ccHotId)) {
        memberCounts.set(c.ccHotId, new Map());
      }
      const articleMap = memberCounts.get(c.ccHotId)!;
      for (const cited of c.citedArticles) {
        for (const knownArticle of KNOWN_ARTICLES) {
          if (matchArticle(cited, knownArticle)) {
            articleMap.set(knownArticle, (articleMap.get(knownArticle) ?? 0) + 1);
          }
        }
      }
    }

    return memberCounts;
  }, [citations]);

  // Only show members who have at least one citation
  const membersWithData = useMemo(
    () => members.filter((m) => heatmapData.has(m.ccHotId)),
    [members, heatmapData],
  );

  if (membersWithData.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/30 p-5 text-center">
        <p className="text-sm text-muted-foreground">No article citation data available yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Article Citation Heatmap</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        How often each CC member cites specific constitutional articles across their rationales.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-3 font-medium text-muted-foreground min-w-[120px]">
                Member
              </th>
              {KNOWN_ARTICLES.map((article) => (
                <th
                  key={article}
                  className="text-center py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap"
                >
                  {article.replace('Article ', 'Art. ').replace(', §', ' §')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {membersWithData.map((member) => {
              const articleMap = heatmapData.get(member.ccHotId);
              return (
                <tr key={member.ccHotId} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/governance/committee/${encodeURIComponent(member.ccHotId)}`}
                      className="text-xs font-medium hover:text-primary transition-colors truncate block max-w-[140px]"
                      title={displayName(member)}
                    >
                      {displayName(member)}
                    </Link>
                  </td>
                  {KNOWN_ARTICLES.map((article) => {
                    const count = articleMap?.get(article) ?? 0;
                    return (
                      <td key={article} className="py-2 px-1.5 text-center">
                        <span
                          className={cn(
                            'inline-flex h-7 w-10 items-center justify-center rounded text-xs tabular-nums',
                            heatmapColor(count),
                          )}
                        >
                          {count > 0 ? count : '·'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Heatmap legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-2 border-t border-border/30">
        <span>Intensity:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-muted/50" /> 0
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-sky-500/15" /> 1-2
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-sky-500/30" /> 3-5
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-sky-500/50" /> 6+
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Export Section
// ---------------------------------------------------------------------------

function DataExportButtons({ members }: { members: DataMember[] }) {
  const generateCSV = useCallback(() => {
    const headers = [
      'Member Name',
      'Hot Key ID',
      'Fidelity Score',
      'Grade',
      'Participation',
      'Constitutional Grounding',
      'Reasoning Quality',
      'Votes Cast',
      'Eligible Proposals',
      'Rationale Rate',
    ];

    const rows = members.map((m) => [
      m.authorName ?? '',
      m.ccHotId,
      m.fidelityScore?.toString() ?? '',
      m.fidelityGrade ?? '',
      m.participationScore?.toString() ?? '',
      m.constitutionalGroundingScore?.toString() ?? '',
      m.reasoningQualityScore?.toString() ?? '',
      m.votesCast?.toString() ?? '',
      m.eligibleProposals?.toString() ?? '',
      m.rationaleProvisionRate != null ? `${Math.round(m.rationaleProvisionRate)}%` : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');

    downloadFile(csvContent, 'cc-members-fidelity.csv', 'text/csv');
  }, [members]);

  const generateJSON = useCallback(() => {
    const data = members.map((m) => ({
      memberName: m.authorName,
      hotKeyId: m.ccHotId,
      fidelityScore: m.fidelityScore,
      grade: m.fidelityGrade,
      participation: m.participationScore,
      constitutionalGrounding: m.constitutionalGroundingScore,
      reasoningQuality: m.reasoningQualityScore,
      votesCast: m.votesCast,
      eligibleProposals: m.eligibleProposals,
      rationaleRate: m.rationaleProvisionRate,
    }));

    downloadFile(JSON.stringify(data, null, 2), 'cc-members-fidelity.json', 'application/json');
  }, [members]);

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Data Export</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Download CC member fidelity scores and metrics for research and analysis.
      </p>

      <div className="flex gap-3">
        <button
          onClick={generateCSV}
          className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-4 py-2.5 text-sm font-medium hover:bg-muted/60 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Export CSV
        </button>
        <button
          onClick={generateJSON}
          className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-4 py-2.5 text-sm font-medium hover:bg-muted/60 transition-colors"
        >
          <FileJson className="h-4 w-4" />
          Export JSON
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {members.length} members &middot; Scores updated with each governance action sync
      </p>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Methodology Section
// ---------------------------------------------------------------------------

function FullMethodology() {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-5 space-y-6">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Full Scoring Methodology</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        The Constitutional Fidelity Score measures how well a CC member fulfills their
        constitutional role — not how often they agree with DReps. It is a composite of three
        weighted pillars.
      </p>

      {/* Composite formula */}
      <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-2">
        <h3 className="text-sm font-semibold">Composite Score</h3>
        <p className="text-xs text-muted-foreground font-mono">
          Fidelity = (Participation × 0.30) + (Constitutional Grounding × 0.40) + (Reasoning Quality
          × 0.30)
        </p>
        <p className="text-xs text-muted-foreground">Range: 0-100</p>
      </div>

      {/* Grade boundaries */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Grade Boundaries</h3>
        <div className="flex gap-2 flex-wrap">
          {GRADE_BOUNDARIES.map((g) => (
            <span
              key={g.grade}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
                g.bg,
                g.color,
                'border-current/20',
              )}
            >
              <span className="font-bold">{g.grade}</span>
              <span className="text-muted-foreground">
                {g.grade === 'F' ? '< 40' : `>= ${g.min}`}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Pillar 1 */}
      <div className="rounded-lg border border-border/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-sky-500" />
          <h3 className="text-sm font-semibold">Pillar 1: Participation (30%)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Measures the CC member&apos;s vote rate on proposals they were eligible to vote on.
        </p>
        <div className="bg-muted/20 rounded-md p-3">
          <p className="text-xs font-mono text-muted-foreground">
            Participation Score = (Votes Cast / Eligible Proposals) × 100
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Eligible proposals are determined by the member&apos;s authorization period — only
          proposals created while the member was an active CC member count.
        </p>
      </div>

      {/* Pillar 2 */}
      <div className="rounded-lg border border-border/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold">Pillar 2: Constitutional Grounding (40%)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Measures how well the member grounds their votes in the Cardano Constitution. Composed of
          two sub-scores:
        </p>
        <div className="bg-muted/20 rounded-md p-3 space-y-2">
          <p className="text-xs font-mono text-muted-foreground">
            Constitutional Grounding = (Rationale Provision × 0.35) + (Article Coverage × 0.65)
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Rationale Provision</strong> — Percentage of votes that include a CIP-136
            rationale document.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Article Coverage</strong> — How well cited articles match the expected
            constitutional articles for each proposal type. Average coverage across all votes with
            rationales.
          </p>
        </div>

        {/* Expected articles table */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium">Expected Articles per Proposal Type</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 pr-3 font-medium">Proposal Type</th>
                  <th className="text-left py-1.5 font-medium">Expected Articles</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(EXPECTED_ARTICLES).map(([type, articles]) => (
                  <tr key={type} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-mono">{type}</td>
                    <td className="py-1.5 text-muted-foreground">{articles.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pillar 3 */}
      <div className="rounded-lg border border-border/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold">Pillar 3: Reasoning Quality (30%)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          AI-assessed depth and quality of constitutional analysis in vote rationales. Each
          rationale is scored on:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>Depth of constitutional argument (not just mentioning articles)</li>
          <li>Logical coherence and structured reasoning</li>
          <li>Consideration of counterarguments</li>
          <li>Precedent discussion where applicable</li>
        </ul>
        <div className="bg-muted/20 rounded-md p-3">
          <p className="text-xs font-mono text-muted-foreground">
            Reasoning Quality = Average AI score across all rationales (0-100)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fallback when AI scoring unavailable: Article Coverage score is used as a proxy.
          </p>
        </div>
      </div>

      {/* Data sources */}
      <div className="rounded-lg border border-border/40 p-4 space-y-2">
        <h3 className="text-sm font-semibold">Data Sources</h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>
            <strong>Votes:</strong> On-chain CC votes via Koios API, synced every epoch
          </li>
          <li>
            <strong>Rationales:</strong> CIP-136 rationale documents fetched from member-provided
            URLs
          </li>
          <li>
            <strong>Proposals:</strong> Governance actions from Koios with type classification
          </li>
          <li>
            <strong>AI Scoring:</strong> Reasoning quality assessed via LLM analysis of rationale
            text
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CCDataExport({ members, citations }: CCDataExportProps) {
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
        <h1 className="text-2xl font-bold">Data & Methodology</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Full scoring methodology, article citation analysis, and data export for researchers.
        </p>
      </motion.div>

      {/* Section 1: Citation Heatmap */}
      <motion.div variants={fadeInUp}>
        <CitationHeatmap members={members} citations={citations} />
      </motion.div>

      {/* Section 2: Data Export */}
      <motion.div variants={fadeInUp}>
        <DataExportButtons members={members} />
      </motion.div>

      {/* Section 3: Full Methodology */}
      <motion.div variants={fadeInUp}>
        <FullMethodology />
      </motion.div>
    </motion.div>
  );
}
