'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useAISkill } from '@/hooks/useAISkill';
import { useRegisterReviewCommands } from '@/hooks/useRegisterReviewCommands';
import { useVote, type VotePhase } from '@/hooks/useVote';
import { posthog } from '@/lib/posthog';
import type { PanelId } from '@/lib/workspace/store';
import type { ReviewQueueItem } from '@/lib/workspace/types';
import type { VoteChoice } from '@/lib/voting';

interface ReviewItemContent {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
}

export interface ReviewRationaleCitations {
  citations: Array<{ article: string; section?: string; relevance: string }>;
  precedentRefs: Array<{ title: string; outcome: string; relevance: string }>;
  keyQuotes: Array<{ text: string; field: string }>;
}

interface UseReviewDecisionFlowOptions {
  getStatus: (txHash: string, proposalIndex: number) => string | undefined;
  itemContent: ReviewItemContent;
  onVoteSuccess: (vote: VoteChoice) => void;
  selectedItem: ReviewQueueItem;
  segment: string;
  togglePanel: (panel: PanelId) => void;
  voterId: string | null;
}

interface ReviewDecisionFlow {
  currentVoteChoice: VoteChoice | null;
  currentVoted: boolean;
  handleAIDraft: () => Promise<void>;
  handleMobileVoteSelect: (vote: VoteChoice) => void;
  handleVoteSelect: (vote: VoteChoice) => void;
  handleVoteSubmit: () => Promise<void>;
  isDraftingRationale: boolean;
  isVoteProcessing: boolean;
  mobileVoteOpen: boolean;
  rationaleCitations: ReviewRationaleCitations | null;
  rationaleText: string;
  selectedVote: VoteChoice | null;
  setMobileVoteOpen: Dispatch<SetStateAction<boolean>>;
  setRationaleText: Dispatch<SetStateAction<string>>;
  votePhase: VotePhase;
  voterRoleLabel: 'cc_member' | 'SPO' | 'DRep';
}

function getReviewDecisionRoleLabel(segment: string): 'cc_member' | 'SPO' | 'DRep' {
  if (segment === 'cc') return 'cc_member';
  if (segment === 'spo') return 'SPO';
  return 'DRep';
}

export function useReviewDecisionFlow({
  getStatus,
  itemContent,
  onVoteSuccess,
  selectedItem,
  segment,
  togglePanel,
  voterId,
}: UseReviewDecisionFlowOptions): ReviewDecisionFlow {
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [isDraftingRationale, setIsDraftingRationale] = useState(false);
  const [mobileVoteOpen, setMobileVoteOpen] = useState(false);
  const [rationaleCitations, setRationaleCitations] = useState<ReviewRationaleCitations | null>(
    null,
  );

  const rationaleCoderaftEnabled = useFeatureFlag('rationale_codraft');
  const rationaleSkill = useAISkill<{
    structuredRationale: string;
    citations: Array<{ article: string; section?: string; relevance: string }>;
    precedentRefs: Array<{ title: string; outcome: string; relevance: string }>;
    keyQuotes: Array<{ text: string; field: string }>;
  }>();
  const {
    phase: votePhase,
    startVote,
    confirmVote,
    reset: resetVote,
    isProcessing: isVoteProcessing,
  } = useVote();

  useEffect(() => {
    resetVote();
    setSelectedVote(null);
    setRationaleText('');
    setRationaleCitations(null);
    setMobileVoteOpen(false);
  }, [selectedItem.txHash, selectedItem.proposalIndex, resetVote]);

  const successfulVote = votePhase.status === 'success' ? votePhase.vote : null;

  useEffect(() => {
    if (successfulVote) {
      onVoteSuccess(successfulVote);
    }
  }, [onVoteSuccess, successfulVote]);

  const currentVoted =
    !!selectedItem.existingVote ||
    getStatus(selectedItem.txHash, selectedItem.proposalIndex) === 'voted';

  const currentVoteChoice: VoteChoice | null =
    selectedItem.existingVote?.toLowerCase() === 'yes'
      ? 'Yes'
      : selectedItem.existingVote?.toLowerCase() === 'no'
        ? 'No'
        : selectedItem.existingVote?.toLowerCase() === 'abstain'
          ? 'Abstain'
          : null;

  const handleVoteSubmit = useCallback(async () => {
    if (!selectedVote || !voterId) return;

    let anchorUrl: string | undefined;
    let anchorHash: string | undefined;

    if (rationaleText.trim()) {
      try {
        const response = await fetch('/api/rationale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drepId: voterId,
            proposalTxHash: selectedItem.txHash,
            proposalIndex: selectedItem.proposalIndex,
            rationaleText: rationaleText.trim(),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          anchorUrl = data.anchorUrl;
          anchorHash = data.anchorHash;
          posthog.capture('review_rationale_submitted', {
            proposal_tx_hash: selectedItem.txHash,
            proposal_index: selectedItem.proposalIndex,
            rationale_length: rationaleText.trim().length,
          });
        }
      } catch {
        // Continue without an anchor. The vote itself is still useful.
      }
    }

    const voterRole = segment === 'spo' ? 'spo' : 'drep';
    await startVote(
      {
        txHash: selectedItem.txHash,
        txIndex: selectedItem.proposalIndex,
        title: selectedItem.title,
      },
      voterRole,
      voterId,
    );

    await confirmVote(selectedVote, anchorUrl, anchorHash);
  }, [confirmVote, rationaleText, segment, selectedItem, selectedVote, startVote, voterId]);

  const handleAIDraft = useCallback(async () => {
    if (!voterId) return;

    setIsDraftingRationale(true);
    setRationaleCitations(null);

    if (rationaleCoderaftEnabled && selectedVote && rationaleText.length > 10) {
      rationaleSkill.mutate(
        {
          skill: 'rationale-draft',
          input: {
            vote: selectedVote,
            bulletPoints: rationaleText,
            proposalContent: itemContent,
            proposalType: selectedItem.proposalType || 'InfoAction',
          },
        },
        {
          onSuccess: (data) => {
            setRationaleText(data.output.structuredRationale);
            setRationaleCitations({
              citations: data.output.citations,
              precedentRefs: data.output.precedentRefs,
              keyQuotes: data.output.keyQuotes,
            });
            posthog.capture('rationale_codraft_generated', {
              vote: selectedVote,
              citationCount: data.output.citations.length,
              precedentCount: data.output.precedentRefs.length,
            });
            setIsDraftingRationale(false);
          },
          onError: () => {
            setIsDraftingRationale(false);
          },
        },
      );
      return;
    }

    try {
      const response = await fetch('/api/rationale/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drepId: voterId,
          voterRole: segment === 'spo' ? 'spo' : 'drep',
          proposalTitle: selectedItem.title,
          proposalAbstract: selectedItem.abstract || undefined,
          proposalType: selectedItem.proposalType || undefined,
          aiSummary: selectedItem.aiSummary || undefined,
        }),
      });

      if (response.ok) {
        const { draft } = await response.json();
        if (draft) {
          setRationaleText(draft);
        }
      }
    } finally {
      setIsDraftingRationale(false);
    }
  }, [
    itemContent,
    rationaleCoderaftEnabled,
    rationaleSkill,
    rationaleText,
    selectedItem,
    selectedVote,
    segment,
    voterId,
  ]);

  const handleVoteSelect = useCallback(
    (vote: VoteChoice) => {
      setSelectedVote(vote);
      togglePanel('vote');
    },
    [togglePanel],
  );

  const handleMobileVoteSelect = useCallback((vote: VoteChoice) => {
    setSelectedVote(vote);
    setMobileVoteOpen(true);
  }, []);

  useRegisterReviewCommands({
    onYes: () => handleVoteSelect('Yes'),
    onNo: () => handleVoteSelect('No'),
    onAbstain: () => handleVoteSelect('Abstain'),
  });

  return {
    currentVoteChoice,
    currentVoted,
    handleAIDraft,
    handleMobileVoteSelect,
    handleVoteSelect,
    handleVoteSubmit,
    isDraftingRationale,
    isVoteProcessing,
    mobileVoteOpen,
    rationaleCitations,
    rationaleText,
    selectedVote,
    setMobileVoteOpen,
    setRationaleText,
    votePhase,
    voterRoleLabel: getReviewDecisionRoleLabel(segment),
  };
}
