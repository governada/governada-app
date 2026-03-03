'use client';

import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@/utils/wallet';
import { createClient } from '@/lib/supabase';
import { CheckCircle2, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface PollFeedbackProps {
  txHash: string;
  proposalIndex: number;
  userVote: string;
  communityYes: number;
  communityNo: number;
  communityTotal: number;
}

type DRepAlignment = 'same' | 'different' | 'not_voted' | 'no_drep';

interface DRepVoteData {
  vote: string;
  alignment: DRepAlignment;
  explanation?: string | null;
}

export function PollFeedback({
  txHash,
  proposalIndex,
  userVote,
  communityYes,
  communityNo,
  communityTotal,
}: PollFeedbackProps) {
  const { delegatedDrepId } = useWallet();
  const [drepData, setDrepData] = useState<DRepVoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const tracked = useRef(false);

  const communityVotes: Record<string, number> = {
    yes: communityYes,
    no: communityNo,
    abstain: Math.max(0, communityTotal - communityYes - communityNo),
  };
  const userCount = communityVotes[userVote] ?? 0;
  const userPercent = communityTotal > 0 ? Math.round((userCount / communityTotal) * 100) : 0;
  const isMajority =
    userCount >= Math.max(communityVotes.yes, communityVotes.no, communityVotes.abstain);

  useEffect(() => {
    let cancelled = false;

    async function fetchDRepVote() {
      if (!delegatedDrepId) {
        setDrepData({ vote: '', alignment: 'no_drep' });
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        const { data: drepVote } = await supabase
          .from('drep_votes')
          .select('vote')
          .eq('drep_id', delegatedDrepId)
          .eq('proposal_tx_hash', txHash)
          .eq('proposal_index', proposalIndex)
          .maybeSingle();

        if (cancelled) return;

        if (!drepVote) {
          setDrepData({ vote: '', alignment: 'not_voted' });
          setLoading(false);
          return;
        }

        const drepVoteLower = drepVote.vote.toLowerCase();
        const alignment: DRepAlignment = drepVoteLower === userVote ? 'same' : 'different';

        let explanation: string | null = null;
        if (alignment === 'different') {
          const { data: explData } = await supabase
            .from('vote_explanations')
            .select('explanation_text')
            .eq('drep_id', delegatedDrepId)
            .eq('proposal_tx_hash', txHash)
            .eq('proposal_index', proposalIndex)
            .maybeSingle();

          if (!cancelled && explData) {
            explanation = explData.explanation_text;
          }
        }

        if (!cancelled) {
          setDrepData({ vote: drepVote.vote, alignment, explanation });
        }
      } catch {
        if (!cancelled) {
          setDrepData({ vote: '', alignment: 'no_drep' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDRepVote();
    return () => {
      cancelled = true;
    };
  }, [delegatedDrepId, txHash, proposalIndex, userVote]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || tracked.current) return;
    tracked.current = true;

    const alignedWithCommunity = isMajority;
    const alignedWithDrep = drepData?.alignment === 'same';

    import('@/lib/posthog')
      .then(({ posthog }) => {
        posthog.capture('poll_feedback_viewed', {
          proposal_tx_hash: txHash,
          proposal_index: proposalIndex,
          aligned_with_drep: alignedWithDrep,
          aligned_with_community: alignedWithCommunity,
          drep_status: drepData?.alignment ?? 'unknown',
        });
      })
      .catch(() => {});
  }, [loading, drepData, isMajority, txHash, proposalIndex]);

  const accentClass =
    drepData?.alignment === 'same'
      ? 'border-green-500/30 bg-green-500/5'
      : drepData?.alignment === 'different'
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-muted bg-muted/30';

  return (
    <div
      className={`overflow-hidden transition-all duration-500 ease-out ${
        visible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className={`rounded-lg border p-3 space-y-2.5 text-sm ${accentClass}`}>
        {/* Community alignment */}
        <p className="text-muted-foreground">
          {isMajority
            ? `You're with ${userPercent}% of the community`
            : `You're in the ${userPercent}% minority`}
        </p>

        {/* DRep alignment */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
            <span>Checking your DRep&apos;s vote…</span>
          </div>
        ) : drepData?.alignment === 'same' ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Your DRep voted the same way</span>
          </div>
        ) : drepData?.alignment === 'different' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Your DRep voted {drepData.vote}</span>
            </div>
            {drepData.explanation && delegatedDrepId && (
              <div className="pl-6 space-y-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  &ldquo;
                  {drepData.explanation.length > 150
                    ? drepData.explanation.slice(0, 150) + '…'
                    : drepData.explanation}
                  &rdquo;
                </p>
                <Link
                  href={`/drep/${delegatedDrepId}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Read more
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        ) : drepData?.alignment === 'not_voted' ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <span>Your DRep hasn&apos;t voted on this yet</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
