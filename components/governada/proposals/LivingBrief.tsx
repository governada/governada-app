'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownContent } from '@/components/MarkdownContent';
import { ShareActions } from '@/components/ShareActions';
import { BriefFeedback } from './BriefFeedback';
import { cn } from '@/lib/utils';
import type { ProposalBriefContent } from '@/lib/proposalBrief';

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
}

/** Inline rationale card for the 1-2 rationale tier */
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

export function LivingBrief({
  brief,
  briefId,
  isLoading,
  isStale,
  rationaleCount,
  rationales,
  aiSummary,
  txHash,
  proposalIndex,
}: LivingBriefProps) {
  const briefUrl = `https://governada.io/proposal/${encodeURIComponent(txHash)}/${proposalIndex}`;
  const shareText = `Living Brief on this Cardano governance proposal via @Governada`;

  // Loading state
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Living Brief</h2>
          </div>
        </div>
        <div className="p-6">
          <BriefSkeleton />
        </div>
      </section>
    );
  }

  // ─── Tier 1: 0 rationales ────────────────────────────────────────────
  if (rationaleCount === 0) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Living Brief</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {aiSummary ? (
            <div className="bg-primary/5 border-l-2 border-primary/40 rounded-r-lg p-3">
              <MarkdownContent content={aiSummary} className="text-sm leading-relaxed" />
              <p className="text-[10px] text-muted-foreground mt-2">
                AI-generated summary from proposal metadata
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No summary available yet.
            </p>
          )}
          <p className="text-sm text-muted-foreground text-center py-2">
            No DRep rationales submitted yet. The Living Brief will generate automatically once
            representatives begin publishing their reasoning.
          </p>
        </div>
      </section>
    );
  }

  // ─── Tier 2: 1-2 rationales (no full brief) ─────────────────────────
  if (rationaleCount <= 2 || !brief) {
    const rationalesWithText = rationales.filter((r) => r.rationaleAiSummary || r.rationaleText);

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
            <span className="text-xs text-muted-foreground">
              {rationaleCount} rationale{rationaleCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {aiSummary && (
            <div className="bg-primary/5 border-l-2 border-primary/40 rounded-r-lg p-3">
              <MarkdownContent content={aiSummary} className="text-sm leading-relaxed" />
              <p className="text-[10px] text-muted-foreground mt-2">
                AI-generated summary from proposal metadata
              </p>
            </div>
          )}

          {rationalesWithText.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Early Rationales</h3>
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
          )}

          <p className="text-[10px] text-muted-foreground text-center pt-2">
            The full Living Brief will generate once 3+ DRep rationales are available.
          </p>
        </div>
      </section>
    );
  }

  // ─── Tier 3: Full Living Brief ───────────────────────────────────────
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
