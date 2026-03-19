'use client';

export const dynamic = 'force-dynamic';

/**
 * Proposal Monitoring Dashboard — voting progress, vote activity,
 * deposit tracking, and lifecycle status for a submitted governance action.
 *
 * Route: /workspace/author/[draftId]/monitor
 */

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, Clock, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDraft } from '@/hooks/useDrafts';
import { useProposalMonitor } from '@/hooks/useProposalMonitor';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import { VotingProgress } from '@/components/workspace/author/monitor/VotingProgress';
import { VoteActivity } from '@/components/workspace/author/monitor/VoteActivity';
import { DepositStatus } from '@/components/workspace/author/monitor/DepositStatus';
import type { ProposalMonitorData } from '@/lib/workspace/monitor-types';

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<ProposalMonitorData['status'], { label: string; className: string }> = {
  voting: {
    label: 'In Voting',
    className: 'bg-blue-500/15 text-blue-400',
  },
  ratified: {
    label: 'Ratified',
    className: 'bg-[var(--compass-teal)]/15 text-[var(--compass-teal)]',
  },
  enacted: {
    label: 'Enacted',
    className: 'bg-[var(--compass-teal)]/15 text-[var(--compass-teal)]',
  },
  expired: {
    label: 'Expired',
    className: 'bg-muted text-muted-foreground',
  },
  dropped: {
    label: 'Dropped',
    className: 'bg-destructive/15 text-destructive',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MonitorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.draftId as string;

  // Load the draft to get submittedTxHash
  const { data: draftData, isLoading: draftLoading } = useDraft(draftId);
  const draft = draftData?.draft ?? null;

  // Derive proposalIndex — defaults to 0 since most governance actions
  // submitted through the platform are the first action in their tx
  const proposalIndex = 0;

  // Fetch monitoring data
  const {
    data: monitor,
    isLoading: monitorLoading,
    error: monitorError,
  } = useProposalMonitor(draft?.submittedTxHash ?? null, proposalIndex);

  // Guard: redirect if not submitted
  if (draft && draft.status !== 'submitted') {
    router.replace(`/workspace/author/${draftId}`);
    return null;
  }

  // Loading state
  if (draftLoading || (!monitor && monitorLoading)) {
    return <MonitorSkeleton />;
  }

  // No draft found
  if (!draft) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">Draft not found.</p>
      </div>
    );
  }

  // Monitor data not available yet (proposal may not be synced)
  if (!monitor) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <BackLink />
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <h2 className="font-medium">Waiting for on-chain data</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {monitorError
                ? 'Unable to load monitoring data. The proposal may not have been indexed yet. Data syncs every hour.'
                : 'Your proposal has been submitted. Monitoring data will appear once the next sync cycle completes (up to 1 hour).'}
            </p>
            {draft.submittedTxHash && (
              <a
                href={`https://cardanoscan.io/transaction/${draft.submittedTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
              >
                View transaction on Cardanoscan
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[monitor.status];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <BackLink />

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-display font-semibold">{monitor.title}</h1>
          <Badge variant="outline" className="text-xs">
            {PROPOSAL_TYPE_LABELS[monitor.proposalType as keyof typeof PROPOSAL_TYPE_LABELS] ??
              monitor.proposalType}
          </Badge>
          <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
        </div>

        {/* Epochs remaining */}
        {monitor.epochsRemaining != null && monitor.status === 'voting' && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {monitor.epochsRemaining === 0
                ? 'Expiring this epoch'
                : `${monitor.epochsRemaining} epoch${monitor.epochsRemaining === 1 ? '' : 's'} remaining`}
            </span>
          </div>
        )}
      </div>

      {/* Voting Progress */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <VotingProgress voting={monitor.voting} />
        </CardContent>
      </Card>

      {/* Recent Votes */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <VoteActivity votes={monitor.recentVotes} currentEpoch={monitor.currentEpoch} />
        </CardContent>
      </Card>

      {/* Deposit Status */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <DepositStatus
            deposit={monitor.deposit}
            expirationEpoch={monitor.expirationEpoch}
            status={monitor.status}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Actions
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/proposals/${monitor.txHash}/${monitor.proposalIndex}`;
                navigator.clipboard.writeText(url).catch(() => {});
              }}
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              Share Proposal
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://cardanoscan.io/transaction/${monitor.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View on Cardanoscan
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/workspace/author"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to portfolio
    </Link>
  );
}

function MonitorSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}
