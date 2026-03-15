'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Scale,
  BookOpen,
  Users,
  TrendingUp,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownContent } from '@/components/MarkdownContent';
import { ShareActions } from '@/components/ShareActions';
import { BriefFeedback } from './BriefFeedback';
import { cn } from '@/lib/utils';
import { getRelevantArticles } from '@/lib/constitution';
import { getVotingBodies } from '@/lib/governance/votingBodies';
import type { ProposalBriefContent } from '@/lib/proposalBrief';
import type { NclUtilization } from '@/lib/treasury';

interface LivingBriefProps {
  brief: ProposalBriefContent | null;
  briefId: string | null;
  isLoading?: boolean;
  isStale?: boolean;
  rationaleCount: number;
  rationales: Array<{
    drepId: string;
    drepName: string | null;
    vote: 'Yes' | 'No' | 'Abstain';
    rationaleText: string | null;
    rationaleAiSummary: string | null;
  }>;
  aiSummary: string | null;
  txHash: string;
  proposalIndex: number;
  // First Look context
  proposalType: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  historicalContext: string | null;
  nclUtilization?: NclUtilization | null;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/** Section card used in both First Look and full brief */
function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon?: typeof Scale;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-lg border border-border/30 bg-background/30 p-4 space-y-2', className)}
    >
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Inline rationale card for early voices */
function InlineRationaleCard({
  drepId,
  drepName,
  vote,
  text,
}: {
  drepId: string;
  drepName: string | null;
  vote: string;
  text: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayText = text || 'No rationale text provided';
  const isLong = displayText.length > 200;

  const voteColor =
    vote === 'Yes' ? 'bg-emerald-500' : vote === 'No' ? 'bg-red-500' : 'bg-zinc-400';

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full shrink-0', voteColor)} />
        <Link
          href={`/drep/${drepId}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate"
        >
          {drepName || `${drepId.slice(0, 16)}...`}
        </Link>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {vote}
        </Badge>
      </div>
      <p
        className={cn(
          'text-sm text-foreground/80 leading-relaxed',
          !expanded && isLong && 'line-clamp-3',
        )}
      >
        {displayText}
      </p>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

/** Loading skeleton for the brief */
function BriefSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <div className="pt-2 space-y-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voting requirements helper
// ---------------------------------------------------------------------------

function getVotingRequirementsSummary(proposalType: string): string {
  const bodies = getVotingBodies(proposalType);
  const hasSpo = bodies.includes('spo');
  const hasCc = bodies.includes('cc');

  if (proposalType === 'InfoAction') {
    return 'This is an advisory action — DReps vote but there is no binding threshold. The result signals community sentiment.';
  }

  const parts: string[] = ['Requires DRep approval'];
  if (hasSpo) parts.push('SPO approval');
  if (hasCc) parts.push('Constitutional Committee confirmation');

  if (parts.length === 1) {
    return `${parts[0]}. SPOs and the Constitutional Committee do not vote on this type of proposal.`;
  }

  const last = parts.pop()!;
  return `${parts.join(', ')}, and ${last}.`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LivingBrief({
  brief: initialBrief,
  briefId: initialBriefId,
  isLoading,
  isStale: initialIsStale,
  rationaleCount,
  rationales,
  aiSummary,
  txHash,
  proposalIndex,
  proposalType,
  yesCount,
  noCount,
  abstainCount,
  historicalContext,
  nclUtilization,
}: LivingBriefProps) {
  const briefUrl = `https://governada.io/proposal/${encodeURIComponent(txHash)}/${proposalIndex}`;
  const shareText = `Living Brief on this Cardano governance proposal via @Governada`;

  // Client-side brief fetching: triggers generation + polls when brief is missing but rationales exist
  const [fetchedBrief, setFetchedBrief] = useState<ProposalBriefContent | null>(null);
  const [fetchedBriefId, setFetchedBriefId] = useState<string | null>(null);
  const [fetchedIsStale, setFetchedIsStale] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldFetch = !initialBrief && rationaleCount >= 3;

  useEffect(() => {
    if (!shouldFetch) return;

    let cancelled = false;
    setIsGenerating(true);

    async function fetchBrief() {
      try {
        const res = await fetch(
          `/api/proposal/brief?txHash=${encodeURIComponent(txHash)}&index=${proposalIndex}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();

        if (data.brief) {
          setFetchedBrief(data.brief.content);
          setFetchedBriefId(data.brief.id);
          setFetchedIsStale(data.brief.isStale ?? false);
          setIsGenerating(false);
        } else if (data.reason === 'generating') {
          // Poll again in 10 seconds
          pollRef.current = setTimeout(() => {
            if (!cancelled) fetchBrief();
          }, 10_000);
        } else {
          // insufficient_rationales or other — stop polling
          setIsGenerating(false);
        }
      } catch {
        setIsGenerating(false);
      }
    }

    fetchBrief();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [shouldFetch, txHash, proposalIndex]);

  // Use fetched brief if initial was null
  const brief = initialBrief ?? fetchedBrief;
  const briefId = initialBriefId ?? fetchedBriefId;
  const isStale = initialIsStale ?? fetchedIsStale;

  // Loading state (generating brief)
  if (isLoading || (isGenerating && !brief)) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Living Brief</h2>
            {isGenerating && (
              <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/30">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Generating...
              </Badge>
            )}
          </div>
        </div>
        <div className="p-6">
          <BriefSkeleton />
          {isGenerating && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Synthesizing {rationaleCount} DRep rationales into an intelligence brief...
            </p>
          )}
        </div>
      </section>
    );
  }

  // ─── First Look: pre-brief intelligence (0-2 rationales or brief not yet generated) ──
  if (rationaleCount <= 2 || !brief) {
    return (
      <FirstLook
        aiSummary={aiSummary}
        proposalType={proposalType}
        yesCount={yesCount}
        noCount={noCount}
        abstainCount={abstainCount}
        historicalContext={historicalContext}
        rationaleCount={rationaleCount}
        rationales={rationales}
        nclUtilization={nclUtilization ?? null}
      />
    );
  }

  // ─── Full Living Brief ────────────────────────────────────────────────
  return (
    <section className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Living Brief</h2>
            {isStale && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 text-amber-500 border-amber-500/30"
              >
                <RefreshCw className="h-3 w-3 animate-spin" />
                Updating...
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Based on {rationaleCount} rationale{rationaleCount !== 1 ? 's' : ''}
            </span>
            <ShareActions
              url={briefUrl}
              text={shareText}
              surface="living-brief"
              variant="compact"
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Debate status summary */}
        {brief.debateStatus && (
          <div className="bg-primary/5 border-l-2 border-primary/40 rounded-r-lg px-4 py-2.5">
            <p className="text-sm font-medium text-foreground/90">{brief.debateStatus}</p>
          </div>
        )}

        {/* Brief sections */}
        {brief.sections.map((section, idx) => (
          <div
            key={section.title || idx}
            className="rounded-lg border border-border/30 bg-background/30 p-4 space-y-2"
          >
            {section.title && (
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            )}
            <MarkdownContent
              content={section.content}
              className="text-sm leading-relaxed text-foreground/80"
            />
            {section.citedDReps && section.citedDReps.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Cited:</span>
                {section.citedDReps.map((drep) => (
                  <Link
                    key={drep.drepId}
                    href={`/drep/${drep.drepId}`}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {drep.name || `${drep.drepId.slice(0, 12)}...`}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Brief feedback */}
        {briefId && <BriefFeedback briefId={briefId} helpfulCount={0} notHelpfulCount={0} />}

        {/* AI disclaimer */}
        <p className="text-[10px] text-muted-foreground text-center pt-2">
          AI-generated summary based on {rationaleCount} DRep rationale
          {rationaleCount !== 1 ? 's' : ''}. This analysis may not reflect all perspectives.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// First Look — structured context before the debate develops
// ---------------------------------------------------------------------------

function FirstLook({
  aiSummary,
  proposalType,
  yesCount,
  noCount,
  abstainCount,
  historicalContext,
  rationaleCount,
  rationales,
  nclUtilization,
}: {
  aiSummary: string | null;
  proposalType: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  historicalContext: string | null;
  rationaleCount: number;
  rationales: LivingBriefProps['rationales'];
  nclUtilization: NclUtilization | null;
}) {
  const totalVotes = yesCount + noCount + abstainCount;
  const articles = getRelevantArticles(proposalType);
  const votingRequirements = getVotingRequirementsSummary(proposalType);
  const rationalesWithText = rationales.filter((r) => r.rationaleAiSummary || r.rationaleText);

  // Build the early signal message
  let watchMessage: string;
  if (totalVotes === 0 && rationaleCount === 0) {
    watchMessage =
      'Voting has not begun yet. The Living Brief will build automatically as DReps cast votes and publish their reasoning.';
  } else if (rationaleCount === 0) {
    watchMessage = `${totalVotes} DRep${totalVotes !== 1 ? 's have' : ' has'} voted but none have published rationale yet. The Living Brief will synthesize the debate once representatives explain their reasoning.`;
  } else {
    watchMessage = `${totalVotes} DRep${totalVotes !== 1 ? 's have' : ' has'} voted, ${rationaleCount} with published rationale. The full Living Brief will generate once 3 or more rationales are available.`;
  }

  return (
    <section className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">First Look</h2>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Awaiting debate
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* 1. What This Means */}
        {aiSummary && (
          <SectionCard icon={BookOpen} title="What This Means">
            <MarkdownContent
              content={aiSummary}
              className="text-sm leading-relaxed text-foreground/80"
            />
          </SectionCard>
        )}

        {/* 2. Scale & Context (treasury proposals only) */}
        {(historicalContext || nclUtilization) && proposalType === 'TreasuryWithdrawals' && (
          <SectionCard icon={TrendingUp} title="Scale & Context">
            {historicalContext && <p className="text-sm text-foreground/80">{historicalContext}</p>}
            {nclUtilization && (
              <div className="space-y-1.5 pt-1">
                <p className="text-sm text-foreground/80">
                  If approved, budget utilization rises from{' '}
                  {Math.round(nclUtilization.utilizationPct)}% to{' '}
                  {Math.round(nclUtilization.projectedUtilizationPct)}%.
                </p>
                {nclUtilization.projectedUtilizationPct > 80 && (
                  <p className="text-sm font-medium text-amber-500">
                    Projected utilization exceeds 80% of the budget period limit — elevated
                    stewardship scrutiny expected.
                  </p>
                )}
                {nclUtilization.epochsRemaining > 0 &&
                  nclUtilization.epochsRemaining * (5 / 30.44) < 24 && (
                    <p className="text-sm text-foreground/70">
                      {Math.round(nclUtilization.epochsRemaining * (5 / 30.44))} months remaining in
                      the current budget period.
                    </p>
                  )}
              </div>
            )}
          </SectionCard>
        )}

        {/* 3. Constitutional Guardrails */}
        {articles.length > 0 && (
          <SectionCard icon={Scale} title="Constitutional Guardrails">
            <p className="text-sm text-foreground/80 mb-2">
              DReps will evaluate this proposal against these sections of the Cardano Constitution:
            </p>
            <div className="space-y-1.5">
              {articles
                .filter((a) => !a.id.startsWith('Article I') && !a.id.startsWith('Article II'))
                .slice(0, 3)
                .map((article) => (
                  <div
                    key={article.id}
                    className="text-xs text-foreground/70 bg-muted/30 rounded px-2.5 py-1.5"
                  >
                    <span className="font-medium text-foreground/80">{article.id}</span>
                    {' — '}
                    {article.text.length > 160 ? article.text.slice(0, 160) + '...' : article.text}
                  </div>
                ))}
            </div>
          </SectionCard>
        )}

        {/* 4. What Needs to Happen */}
        <SectionCard icon={Users} title="What Needs to Happen">
          <p className="text-sm text-foreground/80">{votingRequirements}</p>
          {totalVotes > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-emerald-500 font-medium">{yesCount} Yes</span>
              <span className="text-xs text-red-500 font-medium">{noCount} No</span>
              <span className="text-xs text-muted-foreground font-medium">
                {abstainCount} Abstain
              </span>
            </div>
          )}
        </SectionCard>

        {/* 5. Early Voices (1-2 rationales) */}
        {rationalesWithText.length > 0 && (
          <SectionCard icon={MessageSquare} title="Early Voices">
            <p className="text-xs text-muted-foreground mb-2">
              First perspectives from DReps who have explained their vote
            </p>
            <div className="space-y-3">
              {rationalesWithText.map((r) => (
                <InlineRationaleCard
                  key={r.drepId}
                  drepId={r.drepId}
                  drepName={r.drepName}
                  vote={r.vote}
                  text={r.rationaleAiSummary || r.rationaleText}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {/* 6. Watch This Space */}
        <div className="bg-muted/30 rounded-lg px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">{watchMessage}</p>
        </div>
      </div>
    </section>
  );
}
