'use client';

/**
 * OutcomeDebrief — post-mortem view for proposals with terminal on-chain status.
 *
 * Shows final voting breakdown, where the proposal fell short (if applicable),
 * review feedback summary, and a "Fork & Revise" CTA to iterate.
 */

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Copy,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import { useDuplicateDraft } from '@/hooks/useDraftActions';
import { useSegment } from '@/components/providers/SegmentProvider';
import type { ProposalDraft } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnChainProposal {
  txHash: string;
  proposalIndex: number;
  proposalType: string;
  ratifiedEpoch: number | null;
  expiredEpoch: number | null;
  droppedEpoch: number | null;
  enactedEpoch: number | null;
}

interface VotingSummary {
  drepYesPower: number;
  drepNoPower: number;
  drepAbstainPower: number;
  drepYesCount: number;
  drepNoCount: number;
  drepAbstainCount: number;
  ccYesCount: number;
  ccNoCount: number;
  ccAbstainCount: number;
  spoYesCount: number;
  spoNoCount: number;
  spoAbstainCount: number;
}

type TerminalStatus = 'ratified' | 'expired' | 'dropped' | 'active';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function useOnChainProposal(txHash: string | null) {
  return useQuery<{ proposal: OnChainProposal | null }>({
    queryKey: ['debrief-proposal', txHash],
    queryFn: () => fetchJson(`/api/workspace/proposals/${encodeURIComponent(txHash!)}/debrief`),
    enabled: !!txHash,
    staleTime: 60_000,
  });
}

function useVotingSummary(txHash: string | null, proposalIndex: number | null) {
  return useQuery<{ summary: VotingSummary | null }>({
    queryKey: ['debrief-voting', txHash, proposalIndex],
    queryFn: () =>
      fetchJson(
        `/api/workspace/proposals/${encodeURIComponent(txHash!)}/${proposalIndex}/voting-summary`,
      ),
    enabled: !!txHash && proposalIndex != null,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTerminalStatus(proposal: OnChainProposal | null): TerminalStatus {
  if (!proposal) return 'active';
  if (proposal.ratifiedEpoch != null) return 'ratified';
  if (proposal.expiredEpoch != null) return 'expired';
  if (proposal.droppedEpoch != null) return 'dropped';
  return 'active';
}

const STATUS_CONFIG: Record<
  TerminalStatus,
  { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }
> = {
  ratified: {
    label: 'Ratified',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    icon: CheckCircle2,
  },
  expired: {
    label: 'Expired',
    color: 'text-[var(--wayfinder-amber)]',
    bgColor: 'bg-[var(--wayfinder-amber)]/10',
    icon: Clock,
  },
  dropped: {
    label: 'Dropped',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    icon: XCircle,
  },
  active: {
    label: 'Active',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: Clock,
  },
};

function computeBodyPercentages(yes: number, no: number, abstain: number) {
  const total = yes + no + abstain;
  if (total === 0) return { yes: 0, no: 0, abstain: 0 };
  return {
    yes: Math.round((yes / total) * 100),
    no: Math.round((no / total) * 100),
    abstain: Math.round((abstain / total) * 100),
  };
}

// Thresholds by proposal type per CIP-1694
function getThresholds(proposalType: string) {
  switch (proposalType) {
    case 'TreasuryWithdrawals':
      return { drep: 67, cc: 51, spo: null };
    case 'ParameterChange':
      return { drep: 67, cc: 51, spo: null };
    case 'HardForkInitiation':
      return { drep: 67, cc: 51, spo: 51 };
    case 'NoConfidence':
      return { drep: 67, cc: null, spo: 51 };
    case 'NewCommittee':
      return { drep: 67, cc: null, spo: 51 };
    case 'NewConstitution':
      return { drep: 75, cc: 67, spo: null };
    case 'InfoAction':
    default:
      return { drep: null, cc: null, spo: null };
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VotingBodyRow({
  label,
  yesPercent,
  noPercent,
  abstainPercent,
  threshold,
  yesCount,
  noCount,
}: {
  label: string;
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  threshold: number | null;
  yesCount: number;
  noCount: number;
}) {
  const passed = threshold != null ? yesPercent >= threshold : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Yes {yesPercent}% / No {noPercent}% / Abstain {abstainPercent}%
          </span>
          {passed != null && (
            <Badge
              variant="outline"
              className={
                passed
                  ? 'border-emerald-500/40 text-emerald-400'
                  : 'border-destructive/40 text-destructive'
              }
            >
              {passed ? 'Passed' : `Missed (${threshold}%)`}
            </Badge>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-3 rounded-full bg-muted overflow-hidden flex relative">
        {yesPercent > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${yesPercent}%` }}
          />
        )}
        {noPercent > 0 && (
          <div
            className="h-full bg-destructive transition-all"
            style={{ width: `${noPercent}%` }}
          />
        )}
        {abstainPercent > 0 && (
          <div
            className="h-full bg-muted-foreground/30 transition-all"
            style={{ width: `${abstainPercent}%` }}
          />
        )}
        {/* Threshold marker */}
        {threshold != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/60"
            style={{ left: `${threshold}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {yesCount} yes / {noCount} no
        </span>
        {threshold != null && <span>{threshold}% threshold</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface OutcomeDebriefProps {
  draft: ProposalDraft;
  draftId: string;
}

export function OutcomeDebrief({ draft, draftId }: OutcomeDebriefProps) {
  const router = useRouter();
  const { stakeAddress } = useSegment();

  // Fetch on-chain proposal data
  const { data: proposalData, isLoading: proposalLoading } = useOnChainProposal(
    draft.submittedTxHash,
  );
  const proposal = proposalData?.proposal ?? null;

  // Fetch voting summary
  const { data: votingData, isLoading: votingLoading } = useVotingSummary(
    draft.submittedTxHash,
    proposal?.proposalIndex ?? null,
  );
  const voting = votingData?.summary ?? null;

  // Fetch reviews
  const { data: reviewsData } = useDraftReviews(draftId);
  const reviews = useMemo(() => reviewsData?.reviews ?? [], [reviewsData]);
  const responsesByReview = useMemo(() => reviewsData?.responsesByReview ?? {}, [reviewsData]);

  // Fork & Revise
  const duplicateMutation = useDuplicateDraft(stakeAddress);

  const handleForkAndRevise = useCallback(() => {
    duplicateMutation.mutate(
      { draftId, titlePrefix: 'Revision of:' },
      {
        onSuccess: (data) => {
          router.push(`/workspace/author/${data.draft.id}`);
        },
      },
    );
  }, [draftId, duplicateMutation, router]);

  // Compute terminal status
  const status = getTerminalStatus(proposal);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // Voting percentages
  const drepPct = voting
    ? computeBodyPercentages(voting.drepYesPower, voting.drepNoPower, voting.drepAbstainPower)
    : null;
  const ccPct = voting
    ? computeBodyPercentages(voting.ccYesCount, voting.ccNoCount, voting.ccAbstainCount)
    : null;
  const spoPct = voting
    ? computeBodyPercentages(voting.spoYesCount, voting.spoNoCount, voting.spoAbstainCount)
    : null;

  const thresholds = getThresholds(draft.proposalType);

  // Declined review feedback
  const declinedReviews = useMemo(() => {
    return reviews.filter((r) => {
      const responses = responsesByReview[r.id] ?? [];
      return responses.some((resp) => resp.responseType === 'decline');
    });
  }, [reviews, responsesByReview]);

  // Average review score
  const avgReviewScore = useMemo(() => {
    const scores = reviews
      .map((r) => {
        const dims = [
          r.impactScore,
          r.feasibilityScore,
          r.constitutionalScore,
          r.valueScore,
        ].filter((s): s is number => s != null);
        return dims.length > 0 ? dims.reduce((a, b) => a + b, 0) / dims.length : null;
      })
      .filter((s): s is number => s != null);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }, [reviews]);

  // Where it fell short
  const shortfalls = useMemo(() => {
    if (!voting || status === 'ratified') return [];
    const items: string[] = [];
    if (thresholds.drep != null && drepPct && drepPct.yes < thresholds.drep) {
      items.push(
        `DRep voting power reached ${drepPct.yes}% but needed ${thresholds.drep}% (missed by ${thresholds.drep - drepPct.yes}%)`,
      );
    }
    if (thresholds.cc != null && ccPct && ccPct.yes < thresholds.cc) {
      items.push(`Constitutional Committee reached ${ccPct.yes}% but needed ${thresholds.cc}%`);
    }
    if (thresholds.spo != null && spoPct && spoPct.yes < thresholds.spo) {
      items.push(`SPO pool vote reached ${spoPct.yes}% but needed ${thresholds.spo}%`);
    }
    if (voting.drepNoCount > 0) {
      items.push(`${voting.drepNoCount} DRep${voting.drepNoCount !== 1 ? 's' : ''} voted No`);
    }
    return items;
  }, [voting, status, thresholds, drepPct, ccPct, spoPct]);

  const isDataLoading = proposalLoading || votingLoading;

  return (
    <div className="space-y-8">
      {/* Status Header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-full ${config.bgColor} flex items-center justify-center shrink-0`}
          >
            <StatusIcon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-display font-bold text-foreground mb-1">
              {draft.title || 'Untitled Proposal'}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
              {!isDataLoading && proposal && status === 'active' && (
                <span className="text-sm text-muted-foreground">
                  Voting is still active. Debrief will be available once voting concludes.
                </span>
              )}
              {!isDataLoading && !proposal && (
                <span className="text-sm text-muted-foreground">
                  On-chain proposal data not yet available. It may take a few epochs to sync.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Final Voting Breakdown */}
      {voting && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          <h3 className="text-base font-semibold text-foreground">Final Voting Breakdown</h3>

          {thresholds.drep != null && drepPct && (
            <VotingBodyRow
              label="DRep"
              yesPercent={drepPct.yes}
              noPercent={drepPct.no}
              abstainPercent={drepPct.abstain}
              threshold={thresholds.drep}
              yesCount={voting.drepYesCount}
              noCount={voting.drepNoCount}
            />
          )}

          {thresholds.cc != null && ccPct && (
            <VotingBodyRow
              label="Constitutional Committee"
              yesPercent={ccPct.yes}
              noPercent={ccPct.no}
              abstainPercent={ccPct.abstain}
              threshold={thresholds.cc}
              yesCount={voting.ccYesCount}
              noCount={voting.ccNoCount}
            />
          )}

          {thresholds.spo != null && spoPct && (
            <VotingBodyRow
              label="SPO"
              yesPercent={spoPct.yes}
              noPercent={spoPct.no}
              abstainPercent={spoPct.abstain}
              threshold={thresholds.spo}
              yesCount={voting.spoYesCount}
              noCount={voting.spoNoCount}
            />
          )}
        </div>
      )}

      {/* Where It Fell Short */}
      {shortfalls.length > 0 && (
        <div className="rounded-lg border border-[var(--wayfinder-amber)]/30 bg-[var(--wayfinder-amber)]/5 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[var(--wayfinder-amber)]" />
            <h3 className="text-base font-semibold text-foreground">Where It Fell Short</h3>
          </div>
          <ul className="space-y-2">
            {shortfalls.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--wayfinder-amber)] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Review Feedback Summary */}
      {reviews.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">
              Review Feedback ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
            </h3>
          </div>

          {avgReviewScore != null && (
            <p className="text-sm text-muted-foreground">
              Average review score:{' '}
              <span className="text-foreground font-medium">{avgReviewScore.toFixed(1)}/5</span>
            </p>
          )}

          {declinedReviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {declinedReviews.length} concern{declinedReviews.length !== 1 ? 's' : ''} were
                declined:
              </p>
              <ul className="space-y-1.5">
                {declinedReviews.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm text-muted-foreground flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
                    <span className="line-clamp-2">
                      {r.feedbackThemes.length > 0
                        ? r.feedbackThemes.join(', ')
                        : r.feedbackText.slice(0, 120)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Loading placeholder for on-chain data */}
      {isDataLoading && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading on-chain voting data...</p>
        </div>
      )}

      {/* Next Steps */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Next Steps</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleForkAndRevise}
            disabled={duplicateMutation.isPending}
            className="flex-1"
            style={{ backgroundColor: 'var(--compass-teal)', color: 'var(--primary-foreground)' }}
          >
            {duplicateMutation.isPending ? (
              'Creating revision...'
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Fork &amp; Revise
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/workspace/author')}
            className="flex-1"
          >
            Return to Portfolio
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fork &amp; Revise creates a new draft based on this proposal with all content preserved.
          Improve based on feedback and re-submit.
        </p>
      </div>
    </div>
  );
}
