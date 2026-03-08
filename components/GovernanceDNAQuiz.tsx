'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dna, ArrowRight, Loader2, ChevronRight } from 'lucide-react';
import { GovernanceDNAReveal, type QuizResult } from '@/components/GovernanceDNAReveal';
import { hapticLight } from '@/lib/haptics';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { cn } from '@/lib/utils';

interface QuizProposal {
  txHash: string;
  index: number;
  proposalType: string;
  title: string;
  summary: string | null;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  discriminationLabel?: string;
  stakesLabel?: string | null;
  dimensionTags?: string[];
}

type VoteChoice = 'yes' | 'no' | 'abstain';

interface QuizVote {
  txHash: string;
  index: number;
  vote: VoteChoice;
}

interface GovernanceDNAQuizProps {
  onQuizComplete?: (matchData: Record<string, number>) => void;
}

export function GovernanceDNAQuiz({ onQuizComplete }: GovernanceDNAQuizProps) {
  const { sessionAddress } = useWallet();
  const [phase, setPhase] = useState<'cta' | 'loading' | 'quiz' | 'submitting' | 'results'>('cta');
  const [proposals, setProposals] = useState<QuizProposal[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [votes, setVotes] = useState<QuizVote[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  const fetchProposals = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await fetch('/api/governance/quiz-proposals');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (!data.proposals?.length) {
        setPhase('cta');
        return;
      }
      setProposals(data.proposals);
      setCurrentIdx(0);
      setVotes([]);
      setPhase('quiz');
      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('governance_dna_quiz_started', {
            proposal_count: data.proposals.length,
          });
        })
        .catch(() => {});
    } catch {
      setPhase('cta');
    }
  }, []);

  const submitVote = useCallback(async (proposal: QuizProposal, vote: VoteChoice) => {
    const token = getStoredSession();
    if (!token) return;

    await fetch('/api/polls/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        proposalTxHash: proposal.txHash,
        proposalIndex: proposal.index,
        vote,
        source: 'quiz',
      }),
    }).catch(console.error);
  }, []);

  const handleVote = useCallback(
    async (vote: VoteChoice) => {
      hapticLight();
      const proposal = proposals[currentIdx];
      if (!proposal) return;

      const newVotes = [...votes, { txHash: proposal.txHash, index: proposal.index, vote }];
      setVotes(newVotes);

      const isLastVote = !(currentIdx + 1 < proposals.length && newVotes.length < 7);

      if (isLastVote) {
        await submitVote(proposal, vote);
      } else {
        submitVote(proposal, vote);
      }

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('governance_dna_quiz_vote', {
            vote,
            proposal_type: proposal.proposalType,
            question_number: newVotes.length,
          });
        })
        .catch(() => {});

      if (!isLastVote) {
        setCurrentIdx(currentIdx + 1);
      } else {
        setPhase('submitting');
        try {
          const token = getStoredSession();
          if (token) {
            const res = await fetch('/api/governance/matches', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              const matchMap: Record<string, number> = {};
              for (const m of data.matches || []) {
                matchMap[m.drepId] = m.matchScore;
              }
              setResult({
                votesCount: newVotes.length,
                topMatches: (data.matches || []).slice(0, 3).map((m: any) => ({
                  drepId: m.drepId,
                  name: m.drepName || m.drepId.slice(0, 12) + '...',
                  matchScore: m.matchScore,
                  agreed: m.agreed,
                  total: m.overlapping,
                  confidence: m.confidence,
                  agreeDimensions: m.agreeDimensions,
                  differDimensions: m.differDimensions,
                  alignments: m.alignments ?? null,
                })),
                currentDRepMatch: data.currentDRepMatch ?? null,
                overallConfidence: data.overallConfidence,
                matchMethod: data.matchMethod,
                userAlignments: data.userAlignments ?? null,
                confidenceBreakdown: data.confidenceBreakdown ?? null,
              });
              onQuizComplete?.(matchMap);
              import('@/lib/posthog')
                .then(({ posthog }) => {
                  posthog.capture('governance_dna_quiz_completed', {
                    votes_count: newVotes.length,
                    top_match_score: data.matches?.[0]?.matchScore ?? null,
                    matches_found: data.matches?.length ?? 0,
                  });
                })
                .catch(() => {});
            }
          }
        } catch (err) {
          console.error('Failed to fetch matches after quiz:', err);
        }
        setPhase('results');
      }
    },
    [proposals, currentIdx, votes, submitVote, onQuizComplete],
  );

  const handleRetake = () => {
    import('@/lib/posthog')
      .then(({ posthog }) => {
        posthog.capture('governance_dna_quiz_retake', {
          previous_votes_count: votes.length,
        });
      })
      .catch(() => {});
    setVotes([]);
    setCurrentIdx(0);
    setPhase('cta');
  };

  // CTA state
  if (phase === 'cta') {
    if (!sessionAddress) return null;
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 shrink-0">
            <Dna className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-semibold">Find Your Ideal DRep in 60 Seconds</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vote on 5 real governance decisions. We&apos;ll match you with DReps who think like
              you.
            </p>
          </div>
          <Button onClick={fetchProposals} className="gap-2 shrink-0">
            Start Quiz <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading
  if (phase === 'loading' || phase === 'submitting') {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-center gap-3 p-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {phase === 'loading'
              ? 'Loading governance proposals...'
              : 'Calculating your matches...'}
          </span>
        </CardContent>
      </Card>
    );
  }

  // Results
  if (phase === 'results' && result) {
    return <GovernanceDNAReveal result={result} onRetake={handleRetake} />;
  }

  // Quiz in progress
  const proposal = proposals[currentIdx];
  if (!proposal) return null;
  const progress = (votes.length / Math.min(proposals.length, 7)) * 100;

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dna className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Governance DNA Quiz</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {votes.length + 1} of {Math.min(proposals.length, 7)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              {proposal.proposalType.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
            {proposal.stakesLabel && (
              <Badge variant="secondary" className="text-[10px]">
                {proposal.stakesLabel}
              </Badge>
            )}
            {!proposal.stakesLabel && proposal.withdrawalAmount && (
              <Badge variant="secondary" className="text-[10px]">
                {proposal.withdrawalAmount >= 1_000_000
                  ? `${(proposal.withdrawalAmount / 1_000_000).toFixed(1)}M ADA`
                  : `${Math.round(proposal.withdrawalAmount).toLocaleString()} ADA`}
              </Badge>
            )}
            {proposal.discriminationLabel && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {proposal.discriminationLabel}
              </Badge>
            )}
          </div>
          <h4 className="font-semibold text-base leading-snug">{proposal.title}</h4>
          {proposal.summary && (
            <p className="text-sm text-muted-foreground line-clamp-3">{proposal.summary}</p>
          )}
          {proposal.dimensionTags && proposal.dimensionTags.length > 0 && (
            <div className="flex gap-1">
              {proposal.dimensionTags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {(['yes', 'no', 'abstain'] as VoteChoice[]).map((choice) => (
            <Button
              key={choice}
              variant="outline"
              onClick={() => handleVote(choice)}
              className={cn(
                'flex-1 capitalize',
                choice === 'yes' &&
                  'hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30',
                choice === 'no' && 'hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30',
                choice === 'abstain' &&
                  'hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30',
              )}
            >
              {choice}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
