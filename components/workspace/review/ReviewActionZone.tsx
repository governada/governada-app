'use client';

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuestionGate, hasSubmittedQuestion } from './QuestionGate';
import { PostVoteShare } from './PostVoteShare';
import type { ReviewQueueItem } from '@/lib/workspace/types';

interface ReviewActionZoneProps {
  item: ReviewQueueItem;
  drepId: string;
  onVote?: (txHash: string, index: number, vote: string) => void;
  onNextProposal?: () => void;
}

type Phase = 'question' | 'vote' | 'share';

export function ReviewActionZone({ item, drepId, onVote, onNextProposal }: ReviewActionZoneProps) {
  const [submittedVote, setSubmittedVote] = useState<string | null>(null);

  // Determine initial phase: has question been submitted?
  const questionAlreadyDone = hasSubmittedQuestion(drepId, item.txHash, item.proposalIndex);
  const [phase, setPhase] = useState<Phase>(() => {
    if (item.existingVote) return 'vote'; // Already voted — skip gate
    return questionAlreadyDone ? 'vote' : 'question';
  });

  const handleVote = useCallback(
    (vote: string) => {
      setSubmittedVote(vote);
      onVote?.(item.txHash, item.proposalIndex, vote);
      setPhase('share');
    },
    [item.txHash, item.proposalIndex, onVote],
  );

  // Phase: Question Gate
  if (phase === 'question') {
    return (
      <QuestionGate
        txHash={item.txHash}
        index={item.proposalIndex}
        voterId={drepId}
        onQuestionSubmitted={() => setPhase('vote')}
        onSkip={() => setPhase('vote')}
      />
    );
  }

  // Phase: Post-Vote Share Card
  if (phase === 'share' && submittedVote) {
    return (
      <PostVoteShare
        drepId={drepId}
        txHash={item.txHash}
        index={item.proposalIndex}
        vote={submittedVote}
        proposalTitle={item.title || 'Governance Proposal'}
        onNextProposal={onNextProposal}
      />
    );
  }

  // Phase: Vote Buttons
  const alreadyVoted = item.existingVote;

  return (
    <div className="space-y-3">
      {alreadyVoted && (
        <p className="text-sm text-muted-foreground">
          You previously voted <span className="font-semibold">{alreadyVoted}</span>. You can change
          your vote below.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={alreadyVoted === 'Yes' ? 'default' : 'outline'}
          className="flex-1 gap-2"
          onClick={() => handleVote('Yes')}
        >
          <ThumbsUp className="size-4" />
          Yes
        </Button>
        <Button
          variant={alreadyVoted === 'No' ? 'default' : 'outline'}
          className="flex-1 gap-2"
          onClick={() => handleVote('No')}
        >
          <ThumbsDown className="size-4" />
          No
        </Button>
        <Button
          variant={alreadyVoted === 'Abstain' ? 'default' : 'outline'}
          className="flex-1 gap-2"
          onClick={() => handleVote('Abstain')}
        >
          <MinusCircle className="size-4" />
          Abstain
        </Button>
      </div>
    </div>
  );
}
