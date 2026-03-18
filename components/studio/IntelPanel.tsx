'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Shield,
  Users,
  Search,
  UserCheck,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISkill } from '@/hooks/useAISkill';
import { useProposerTrackRecord } from '@/hooks/useProposerTrackRecord';

// --- Skill output types (mirror lib/ai/skills definitions) ---

interface ConstitutionalFlag {
  article: string;
  section?: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

interface ConstitutionalCheckOutput {
  flags: ConstitutionalFlag[];
  score: 'pass' | 'warning' | 'fail';
  summary: string;
}

interface SimilarProposal {
  txHash: string;
  title: string;
  proposalType: string;
  withdrawalAmount: number | null;
  status: string;
  comparison: string;
}

interface ResearchPrecedentOutput {
  similarProposals: SimilarProposal[];
  precedentSummary: string;
  questionsToConsider: string[];
}

// --- Props ---

interface IntelPanelProps {
  proposalId: string;
  proposalType: string;
  proposalContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  interBodyVotes?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
  citizenSentiment?: {
    support: number;
    oppose: number;
    abstain: number;
    total: number;
  } | null;
}

// --- Collapsible IntelCard ---

function IntelCard({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  onExpand,
}: {
  title: string;
  icon: typeof Shield;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onExpand?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && onExpand) onExpand();
  }, [open, onExpand]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="px-3 pb-3 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

// --- Vote bar component ---

function VoteBar({
  label,
  yes,
  no,
  abstain,
}: {
  label: string;
  yes: number;
  no: number;
  abstain: number;
}) {
  const total = yes + no + abstain;
  if (total === 0) {
    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="h-2 rounded-full bg-muted/30" />
        <span className="text-[10px] text-muted-foreground/60">No votes yet</span>
      </div>
    );
  }
  const yPct = (yes / total) * 100;
  const nPct = (no / total) * 100;
  const aPct = (abstain / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {total} vote{total !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {yPct > 0 && (
          <div className="bg-emerald-500 transition-all" style={{ width: `${yPct}%` }} />
        )}
        {nPct > 0 && <div className="bg-red-500 transition-all" style={{ width: `${nPct}%` }} />}
        {aPct > 0 && <div className="bg-zinc-500 transition-all" style={{ width: `${aPct}%` }} />}
      </div>
      <div className="flex gap-3 text-[10px] tabular-nums">
        <span className="text-emerald-400">Yes {yes}</span>
        <span className="text-red-400">No {no}</span>
        <span className="text-zinc-400">Abstain {abstain}</span>
      </div>
    </div>
  );
}

// --- Constitutional Check Card ---

function ConstitutionalCheckCard({
  proposalContent,
  proposalType,
}: {
  proposalContent: IntelPanelProps['proposalContent'];
  proposalType: string;
}) {
  const skill = useAISkill<ConstitutionalCheckOutput>();
  const hasFetched = useRef(false);

  const handleExpand = useCallback(() => {
    if (hasFetched.current || skill.isPending) return;
    hasFetched.current = true;
    skill.mutate({
      skill: 'constitutional-check',
      input: {
        title: proposalContent.title,
        abstract: proposalContent.abstract,
        proposalType,
        motivation: proposalContent.motivation,
        rationale: proposalContent.rationale,
      },
    });
  }, [skill, proposalContent, proposalType]);

  const scoreIcon =
    skill.data?.output?.score === 'pass' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    ) : skill.data?.output?.score === 'warning' ? (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
    ) : skill.data?.output?.score === 'fail' ? (
      <XCircle className="h-3.5 w-3.5 text-red-400" />
    ) : null;

  return (
    <IntelCard title="Constitutional Check" icon={Shield} onExpand={handleExpand}>
      {skill.isPending && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Analyzing constitutional compliance...</span>
        </div>
      )}
      {skill.isError && <p className="text-red-400 py-1">{skill.error.message}</p>}
      {skill.data?.output && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {scoreIcon}
            <span
              className={cn(
                'text-xs font-medium',
                skill.data.output.score === 'pass' && 'text-emerald-400',
                skill.data.output.score === 'warning' && 'text-amber-400',
                skill.data.output.score === 'fail' && 'text-red-400',
              )}
            >
              {skill.data.output.score === 'pass'
                ? 'Pass'
                : skill.data.output.score === 'warning'
                  ? 'Warning'
                  : 'Fail'}
            </span>
            {skill.data.output.flags.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60">
                {skill.data.output.flags.length} flag
                {skill.data.output.flags.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {skill.data.output.summary}
          </p>
          {skill.data.output.flags.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {skill.data.output.flags.map((flag, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded px-2 py-1.5 text-[11px] leading-relaxed',
                    flag.severity === 'critical' && 'bg-red-500/10 text-red-300',
                    flag.severity === 'warning' && 'bg-amber-500/10 text-amber-300',
                    flag.severity === 'info' && 'bg-blue-500/10 text-blue-300',
                  )}
                >
                  <span className="font-medium">
                    {flag.article}
                    {flag.section ? `, ${flag.section}` : ''}
                  </span>
                  {' — '}
                  {flag.concern}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!skill.isPending && !skill.isError && !skill.data && (
        <p className="text-muted-foreground/60 py-1">Expand to run constitutional check</p>
      )}
    </IntelCard>
  );
}

// --- Community Sentiment Card ---

function CommunitySentimentCard({
  interBodyVotes,
  citizenSentiment,
}: {
  interBodyVotes?: IntelPanelProps['interBodyVotes'];
  citizenSentiment?: IntelPanelProps['citizenSentiment'];
}) {
  return (
    <IntelCard title="Community Sentiment" icon={Users} defaultOpen={true}>
      <div className="space-y-3">
        {interBodyVotes ? (
          <>
            <VoteBar label="DRep" {...interBodyVotes.drep} />
            <VoteBar label="SPO" {...interBodyVotes.spo} />
            <VoteBar label="CC" {...interBodyVotes.cc} />
          </>
        ) : (
          <p className="text-muted-foreground/60">No vote data available</p>
        )}
        {citizenSentiment && citizenSentiment.total > 0 && (
          <div className="pt-2 border-t border-border">
            <VoteBar
              label="Citizen Sentiment"
              yes={citizenSentiment.support}
              no={citizenSentiment.oppose}
              abstain={citizenSentiment.abstain}
            />
          </div>
        )}
      </div>
    </IntelCard>
  );
}

// --- Similar Proposals Card ---

function SimilarProposalsCard({
  proposalContent,
  proposalType,
}: {
  proposalContent: IntelPanelProps['proposalContent'];
  proposalType: string;
}) {
  const skill = useAISkill<ResearchPrecedentOutput>();
  const hasFetched = useRef(false);

  const handleExpand = useCallback(() => {
    if (hasFetched.current || skill.isPending) return;
    hasFetched.current = true;
    skill.mutate({
      skill: 'research-precedent',
      input: {
        proposalTitle: proposalContent.title,
        proposalAbstract: proposalContent.abstract,
        proposalType,
      },
    });
  }, [skill, proposalContent, proposalType]);

  return (
    <IntelCard title="Similar Proposals" icon={Search} onExpand={handleExpand}>
      {skill.isPending && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Researching precedents...</span>
        </div>
      )}
      {skill.isError && <p className="text-red-400 py-1">{skill.error.message}</p>}
      {skill.data?.output && (
        <div className="space-y-3">
          {skill.data.output.similarProposals.length > 0 ? (
            <div className="space-y-2">
              {skill.data.output.similarProposals.map((p, i) => (
                <div key={i} className="rounded bg-muted/20 px-2 py-1.5 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground truncate">{p.title}</span>
                    <span
                      className={cn(
                        'text-[10px] shrink-0 font-medium',
                        p.status === 'ratified'
                          ? 'text-emerald-400'
                          : p.status === 'expired'
                            ? 'text-amber-400'
                            : p.status === 'dropped'
                              ? 'text-red-400'
                              : 'text-muted-foreground',
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {p.comparison}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground/60">No similar proposals found</p>
          )}
          {skill.data.output.precedentSummary && (
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
              {skill.data.output.precedentSummary}
            </p>
          )}
          {skill.data.output.questionsToConsider.length > 0 && (
            <div className="border-t border-border pt-2 space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                Consider
              </span>
              <ul className="space-y-1">
                {skill.data.output.questionsToConsider.map((q, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-muted-foreground leading-relaxed pl-2 border-l-2 border-muted"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {!skill.isPending && !skill.isError && !skill.data && (
        <p className="text-muted-foreground/60 py-1">Expand to search for precedents</p>
      )}
    </IntelCard>
  );
}

// --- Proposer Track Record Card ---

function ProposerTrackRecordCard({
  proposalId,
  proposalIndex,
}: {
  proposalId: string;
  proposalIndex: number;
}) {
  const { data, isLoading, isError, error } = useProposerTrackRecord(proposalId, proposalIndex);

  return (
    <IntelCard title="Proposer Track Record" icon={UserCheck}>
      {isLoading && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Loading track record...</span>
        </div>
      )}
      {isError && (
        <p className="text-red-400 py-1">
          {error instanceof Error ? error.message : 'Failed to load'}
        </p>
      )}
      {data && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="Total proposals" value={data.totalProposals} />
            <StatCell label="Ratified" value={data.ratifiedCount} color="text-emerald-400" />
            <StatCell label="Expired" value={data.expiredCount} color="text-amber-400" />
            <StatCell label="Dropped" value={data.droppedCount} color="text-red-400" />
          </div>
          {(data.deliveredCount > 0 || data.partialCount > 0 || data.notDeliveredCount > 0) && (
            <div className="border-t border-border pt-2">
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                Delivery
              </span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <StatCell label="Delivered" value={data.deliveredCount} color="text-emerald-400" />
                <StatCell label="Partial" value={data.partialCount} color="text-amber-400" />
                <StatCell
                  label="Not delivered"
                  value={data.notDeliveredCount}
                  color="text-red-400"
                />
              </div>
            </div>
          )}
          {data.avgCommunityScore !== null && (
            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Avg community score</span>
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {data.avgCommunityScore}/5
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </IntelCard>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
      <p className={cn('text-sm font-semibold tabular-nums', color ?? 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}

// --- Main IntelPanel ---

export function IntelPanel({
  proposalId,
  proposalType,
  proposalContent,
  interBodyVotes,
  citizenSentiment,
}: IntelPanelProps) {
  return (
    <div className="p-3 space-y-2">
      <CommunitySentimentCard interBodyVotes={interBodyVotes} citizenSentiment={citizenSentiment} />
      <ConstitutionalCheckCard proposalContent={proposalContent} proposalType={proposalType} />
      <SimilarProposalsCard proposalContent={proposalContent} proposalType={proposalType} />
      <ProposerTrackRecordCard proposalId={proposalId} proposalIndex={0} />
    </div>
  );
}
