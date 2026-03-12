'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDRepRationales } from '@/hooks/queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface RationaleRecord {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string;
  proposalType: string | null;
  vote: string | null;
  epochNo: number | null;
  blockTime: number | null;
  rationaleText: string;
  aiSummary: string | null;
  hashVerified: boolean | null;
  date: string | null;
  source: 'on-chain' | 'governada';
}

/**
 * WorkspaceRationalesPage — DRep's published governance rationales.
 *
 * JTBD: "What have I said about my votes, and are they verified?"
 */
export function WorkspaceRationalesPage() {
  const { segment, drepId } = useSegment();
  const { data: rationalesRaw, isLoading } = useDRepRationales(drepId);

  if (segment !== 'drep') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">This page is for DReps.</p>
        <Button asChild>
          <Link href="/">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4" data-discovery="ws-rationale">
      <div className="flex items-center gap-3">
        <Link
          href="/workspace"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Rationales</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <RationalesList
          rationales={(rationalesRaw as { rationales?: RationaleRecord[] })?.rationales ?? []}
        />
      )}
    </div>
  );
}

const voteColorMap: Record<string, string> = {
  Yes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  No: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Abstain: 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300',
};

function RationalesList({ rationales }: { rationales: RationaleRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rationales.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-base font-semibold text-foreground">No rationales yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your published rationales will appear here once you add a rationale to a vote.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/workspace/votes">View your votes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {rationales.length} rationale{rationales.length !== 1 ? 's' : ''} published
      </p>

      {rationales.map((r) => {
        const key = `${r.proposalTxHash}:${r.proposalIndex}`;
        const isExpanded = expandedId === key;
        const displayText = r.aiSummary || r.rationaleText;
        const hasLongText = r.rationaleText.length > 200;
        const formattedDate = r.blockTime
          ? new Date(r.blockTime * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : r.date
            ? new Date(r.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : null;

        return (
          <div key={key} className="rounded-xl border border-border bg-card p-4 space-y-2">
            {/* Header: vote badge + title + verification + date */}
            <div className="flex items-start gap-2">
              {r.vote && (
                <Badge className={`shrink-0 ${voteColorMap[r.vote] ?? voteColorMap.Abstain}`}>
                  {r.vote}
                </Badge>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/proposal/${r.proposalTxHash}/${r.proposalIndex}`}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
                >
                  {r.proposalTitle}
                </Link>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {r.proposalType && (
                    <span className="text-xs text-muted-foreground">{r.proposalType}</span>
                  )}
                  {r.epochNo != null && (
                    <span className="text-xs text-muted-foreground">Epoch {r.epochNo}</span>
                  )}
                  {formattedDate && (
                    <span className="text-xs text-muted-foreground">{formattedDate}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {r.hashVerified === true && (
                  <span title="On-chain hash verified">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  </span>
                )}
                {r.hashVerified === false && (
                  <span title="Hash mismatch — rationale may have been modified">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                  </span>
                )}
                {r.source === 'governada' && (
                  <span
                    title="Submitted via Governada"
                    className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                  >
                    CIP-100
                  </span>
                )}
              </div>
            </div>

            {/* Rationale text */}
            <p
              className={`text-sm text-foreground/80 leading-relaxed ${
                !isExpanded ? 'line-clamp-3' : ''
              }`}
            >
              {isExpanded && hasLongText ? r.rationaleText : displayText}
            </p>

            {/* Expand/collapse + link */}
            <div className="flex items-center justify-between">
              {hasLongText ? (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Read full rationale <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              ) : (
                <span />
              )}
              <Link
                href={`/proposal/${r.proposalTxHash}/${r.proposalIndex}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View proposal <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
