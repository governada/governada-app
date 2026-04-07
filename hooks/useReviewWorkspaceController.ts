'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { posthog } from '@/lib/posthog';
import { trackProposalView } from '@/lib/workspace/engagement';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useQueueState, useReviewQueue } from '@/hooks/useReviewQueue';
import { useReviewableDrafts } from '@/hooks/useReviewableDrafts';
import { useRegisterReviewCommands } from '@/hooks/useRegisterReviewCommands';
import { useReviewSession } from '@/hooks/useReviewSession';
import { useRevisionNotifications } from '@/hooks/useRevisionNotifications';
import {
  buildReviewProgress,
  findAutoAdvanceReviewIndex,
  findCurrentDraft,
  findNextUnreviewedIndex,
  findPreviousUnreviewedIndex,
  getReviewSegmentBadge,
  resolveInitialReviewIndex,
} from '@/lib/workspace/reviewWorkspaceController';
import type { ProposalDraft, ReviewQueueItem } from '@/lib/workspace/types';
import type { VoteChoice } from '@/lib/voting';
import type { Editor } from '@tiptap/core';

interface UseReviewWorkspaceControllerOptions {
  initialProposalKey?: string;
}

export interface ReviewWorkspaceController {
  currentDraft?: ProposalDraft;
  draftItems: ReviewQueueItem[];
  error: unknown;
  getStatus: (txHash: string, proposalIndex: number) => string | undefined;
  goNext: () => void;
  goPrev: () => void;
  handleEditorReady: (editor: Editor) => void;
  handleQueueJump: (index: number) => void;
  handleVoteSuccess: (vote: VoteChoice) => void;
  isLoading: boolean;
  items: ReviewQueueItem[];
  queueLabels: string[];
  progress: { reviewed: number; total: number };
  reviewSession: {
    reviewed: number;
    total: number;
    avgSecondsPerProposal: number | null;
    estimatedRemaining: number | null;
    isComplete: boolean;
  };
  segment: string;
  segmentBadge: { label: string; color: string } | undefined;
  selectedIndex: number;
  selectedItem: ReviewQueueItem | null;
  setSelectedIndex: (index: number) => void;
  stakeAddress: string | null;
  unreadCount: number;
  voteToast: { vote: string; visible: boolean } | null;
  voterId: string | null;
}

function draftToQueueItem(draft: ProposalDraft): ReviewQueueItem {
  return {
    txHash: draft.id,
    proposalIndex: 0,
    title: draft.title || 'Untitled Draft',
    abstract: draft.abstract || null,
    aiSummary: null,
    proposalType: draft.proposalType,
    paramChanges: null,
    withdrawalAmount: null,
    treasuryTier: null,
    epochsRemaining: null,
    isUrgent: false,
    interBodyVotes: {
      drep: { yes: 0, no: 0, abstain: 0 },
      spo: { yes: 0, no: 0, abstain: 0 },
      cc: { yes: 0, no: 0, abstain: 0 },
    },
    citizenSentiment: null,
    existingVote: null,
    sealedUntil: null,
    motivation: draft.motivation || null,
    rationale: draft.rationale || null,
    references: null,
  };
}

export function useReviewWorkspaceController({
  initialProposalKey,
}: UseReviewWorkspaceControllerOptions = {}): ReviewWorkspaceController {
  const { segment, drepId, poolId, stakeAddress } = useSegment();
  const { ownDRepId } = useWallet();

  const voterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId || drepId;

  const { data, isLoading, error } = useReviewQueue(voterId, voterRole);
  const { data: draftsData } = useReviewableDrafts();
  const { getStatus, setStatus, reviewedCount } = useQueueState(voterId);
  const { data: notificationsData } = useRevisionNotifications(!!voterId);

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [voteToast, setVoteToast] = useState<{ vote: string; visible: boolean } | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const lastTrackedRef = useRef<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const drafts = draftsData?.drafts;
  const draftItems = useMemo(() => (drafts ?? []).map(draftToQueueItem), [drafts]);
  const unreadCount = notificationsData?.unreadCount ?? 0;

  useEffect(() => {
    posthog.capture('review_workspace_viewed', { voter_role: voterRole });
  }, [voterRole]);

  useEffect(() => {
    const nextIndex = resolveInitialReviewIndex(
      items,
      getStatus,
      selectedIndex,
      initialProposalKey,
    );
    if (nextIndex !== selectedIndex) {
      setSelectedIndex(nextIndex);
    }
  }, [getStatus, initialProposalKey, items, selectedIndex]);

  const selectedItem = items[selectedIndex] ?? null;
  const currentDraft = useMemo(
    () => findCurrentDraft(selectedItem, drafts),
    [drafts, selectedItem],
  );

  useEffect(() => {
    if (!selectedItem) return;

    const key = `${selectedItem.txHash}:${selectedItem.proposalIndex}`;
    if (lastTrackedRef.current === key) return;

    lastTrackedRef.current = key;
    trackProposalView(
      selectedItem.txHash,
      selectedItem.proposalIndex,
      voterId ?? undefined,
      segment,
    );
  }, [selectedItem, segment, voterId]);

  const progress = useMemo(
    () => buildReviewProgress(items, getStatus, reviewedCount),
    [getStatus, items, reviewedCount],
  );

  const goNext = useCallback(() => {
    setSelectedIndex((currentIndex) => Math.min(currentIndex + 1, items.length - 1));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
  }, []);

  const goNextUnreviewed = useCallback(() => {
    setSelectedIndex((currentIndex) => findNextUnreviewedIndex(items, getStatus, currentIndex));
  }, [getStatus, items]);

  const goPrevUnreviewed = useCallback(() => {
    setSelectedIndex((currentIndex) => findPreviousUnreviewedIndex(items, getStatus, currentIndex));
  }, [getStatus, items]);

  useRegisterReviewCommands({
    onNext: goNext,
    onPrev: goPrev,
    onNextUnreviewed: goNextUnreviewed,
    onPrevUnreviewed: goPrevUnreviewed,
  });

  const reviewSession = useReviewSession(items.length, voterId ?? undefined);

  const handleVoteSuccess = useCallback(
    (vote: VoteChoice) => {
      if (!selectedItem) return;

      setStatus(selectedItem.txHash, selectedItem.proposalIndex, 'voted', vote);
      reviewSession.markReviewed();

      setVoteToast({ vote, visible: true });
      setTimeout(() => setVoteToast(null), 2500);

      setTimeout(() => {
        setSelectedIndex((currentIndex) =>
          findAutoAdvanceReviewIndex(items, getStatus, currentIndex),
        );
      }, 1500);
    },
    [getStatus, items, reviewSession, selectedItem, setStatus],
  );

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const queueLabels = useMemo(() => items.map((item) => item.title || 'Untitled'), [items]);

  const segmentBadge = useMemo(() => getReviewSegmentBadge(segment), [segment]);

  const handleQueueJump = useCallback(
    (index: number) => {
      if (index >= 0 && index < items.length) {
        setSelectedIndex(index);
      }
    },
    [items.length],
  );

  return {
    currentDraft,
    draftItems,
    error,
    getStatus,
    goNext,
    goPrev,
    handleEditorReady,
    handleQueueJump,
    handleVoteSuccess,
    isLoading,
    items,
    queueLabels,
    progress,
    reviewSession,
    segment,
    segmentBadge,
    selectedIndex,
    selectedItem,
    setSelectedIndex,
    stakeAddress,
    unreadCount,
    voteToast,
    voterId,
  };
}
