'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDRepVotes } from '@/hooks/queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface VoteRecord {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle?: string;
  proposalType?: string;
  vote: string;
  blockTime?: number;
  hasRationale?: boolean;
}

/**
 * WorkspaceVotesPage — DRep voting record with rationale status.
 *
 * JTBD: "What have I voted on, and did I explain why?"
 */
export function WorkspaceVotesPage() {
  const { segment, drepId } = useSegment();
  const { data: votesRaw, isLoading } = useDRepVotes(drepId);

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
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/workspace"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Voting Record</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <VotesList votes={(votesRaw as { votes?: VoteRecord[] })?.votes ?? []} />
      )}
    </div>
  );
}

function VotesList({ votes }: { votes: VoteRecord[] }) {
  if (votes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-base font-semibold text-foreground">No votes yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your voting record will appear here once you cast your first vote.
        </p>
      </div>
    );
  }

  const voteColorMap: Record<string, string> = {
    Yes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    No: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    Abstain: 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300',
  };

  return (
    <div className="space-y-2">
      {votes.map((v) => (
        <Link
          key={`${v.proposalTxHash}-${v.proposalIndex}`}
          href={`/proposal/${v.proposalTxHash}/${v.proposalIndex}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors"
        >
          <Badge className={voteColorMap[v.vote] ?? voteColorMap.Abstain}>{v.vote}</Badge>
          <span className="flex-1 text-sm text-foreground truncate">
            {v.proposalTitle || `Proposal ${v.proposalTxHash.slice(0, 8)}...`}
          </span>
          {v.hasRationale ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          )}
        </Link>
      ))}
    </div>
  );
}
