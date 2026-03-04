'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scale, CheckCircle2, AlertCircle, XCircle, Clock, Send } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { posthog } from '@/lib/posthog';
import { useTreasuryAccountability } from '@/hooks/queries';

interface Poll {
  proposal_tx_hash: string;
  proposal_index: number;
  cycle_number: number;
  opened_epoch: number;
  closes_epoch: number;
  status: string;
  results_summary: { ratings?: Record<string, number>; totalResponses?: number } | null;
}

interface Props {
  txHash: string;
  proposalIndex: number;
  isEnacted: boolean;
}

const RATING_OPTIONS = [
  {
    value: 'delivered',
    label: 'Delivered',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'partial',
    label: 'Partially Delivered',
    icon: AlertCircle,
    color: 'text-amber-600 dark:text-amber-400',
  },
  { value: 'not_delivered', label: 'Did Not Deliver', icon: XCircle, color: 'text-red-500' },
  { value: 'too_early', label: 'Too Early to Tell', icon: Clock, color: 'text-muted-foreground' },
] as const;

const APPROVAL_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
] as const;

export function TreasuryAccountabilityPoll({ txHash, proposalIndex, isEnacted }: Props) {
  const { address, isAuthenticated } = useWallet();
  const { data: rawPollData, isLoading } = useTreasuryAccountability(txHash, proposalIndex);
  const polls: Poll[] = (rawPollData as any)?.polls ?? [];
  const [selectedRating, setSelectedRating] = useState<string>('');
  const [selectedApproval, setSelectedApproval] = useState<string>('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isEnacted || isLoading) return null;

  const openPoll = polls.find((p) => p.status === 'open');
  const closedPolls = polls
    .filter((p) => p.status === 'closed')
    .sort((a, b) => b.cycle_number - a.cycle_number);

  const handleSubmit = async () => {
    if (!selectedRating || !selectedApproval || !address || !openPoll) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/treasury/accountability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          index: proposalIndex,
          cycleNumber: openPoll.cycle_number,
          userAddress: address,
          deliveredRating: selectedRating,
          wouldApproveAgain: selectedApproval,
          evidenceText: evidence || null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        posthog.capture('treasury_accountability_vote', {
          rating: selectedRating,
          approval: selectedApproval,
          cycle: openPoll.cycle_number,
        });
      }
    } catch {
      // silently fail
    }
    setSubmitting(false);
  };

  if (!openPoll && closedPolls.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          <Clock className="h-5 w-5 mx-auto mb-2 opacity-50" />
          Accountability poll not yet open. Polls are scheduled based on proposal size and time
          since enactment.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          Treasury Accountability
          {openPoll && (
            <Badge variant="secondary" className="text-xs">
              Cycle {openPoll.cycle_number}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Poll */}
        {openPoll && !submitted && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Did this proposal deliver on its stated goals?
            </p>

            <div className="grid grid-cols-2 gap-2">
              {RATING_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedRating(opt.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                      selectedRating === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${opt.color}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {selectedRating && (
              <>
                <p className="text-sm text-muted-foreground">
                  Knowing the outcome, would you approve this spending again?
                </p>
                <div className="flex gap-2">
                  {APPROVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedApproval(opt.value)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        selectedApproval === opt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedApproval && (
              <div>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Optional: Share evidence or reasoning (max 500 chars)"
                  maxLength={500}
                  className="w-full p-3 rounded-lg border bg-background text-sm resize-none"
                  rows={3}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {evidence.length}/500
                </div>
              </div>
            )}

            {isAuthenticated && selectedRating && selectedApproval && (
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting...' : 'Submit Assessment'}
              </Button>
            )}

            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground text-center">
                Connect your wallet to participate in accountability polls.
              </p>
            )}
          </div>
        )}

        {submitted && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium">Assessment submitted</p>
            <p className="text-xs text-muted-foreground">
              Thank you for contributing to treasury accountability.
            </p>
          </div>
        )}

        {/* Historical Results */}
        {closedPolls.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground">Previous Assessments</div>
            {closedPolls.map((poll) => {
              const ratings = poll.results_summary?.ratings || {};
              const total = poll.results_summary?.totalResponses || 0;
              return (
                <div key={poll.cycle_number} className="p-3 rounded-lg bg-muted/30 text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Cycle {poll.cycle_number}</span>
                    <span className="text-xs text-muted-foreground">{total} responses</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    {Object.entries(ratings).map(([key, count]) => {
                      const ratingOpt = RATING_OPTIONS.find((r) => r.value === key);
                      if (!ratingOpt) return null;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <span key={key} className={ratingOpt.color}>
                          {ratingOpt.label}: {pct}%
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
