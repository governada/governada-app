'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, Clock, AlertTriangle, ExternalLink, Vote } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useReviewQueue, useQueueState } from '@/hooks/useReviewQueue';
import { useReviewableDrafts } from '@/hooks/useReviewableDrafts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRevisionNotifications } from '@/hooks/useRevisionNotifications';
import { useAgent } from '@/hooks/useAgent';
import { trackProposalView } from '@/lib/workspace/engagement';
import { ReviewActionZone } from './ReviewActionZone';
import { StudioProvider, useStudio } from '@/components/studio/StudioProvider';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { StudioPanel } from '@/components/studio/StudioPanel';
import { buildEditorContext, injectInlineComment } from '@/components/studio/studioEditorHelpers';
import { ProposalEditor, injectProposedEdit } from '@/components/workspace/editor/ProposalEditor';
import { AgentChatPanel } from '@/components/workspace/agent/AgentChatPanel';
import { IntelPanel } from '@/components/studio/IntelPanel';
import { NotesPanel } from '@/components/studio/NotesPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalType, ReviewQueueItem } from '@/lib/workspace/types';
import type { VoteChoice } from '@/lib/voting';
import type { ProposedEdit, ProposedComment } from '@/lib/workspace/editor/types';
import type { Editor } from '@tiptap/core';
import { posthog } from '@/lib/posthog';

interface ReviewWorkspaceProps {
  initialProposalKey?: string;
}

// ---------------------------------------------------------------------------
// Map ProposalDraft to ReviewQueueItem for uniform rendering
// ---------------------------------------------------------------------------

function draftToQueueItem(draft: import('@/lib/workspace/types').ProposalDraft): ReviewQueueItem {
  return {
    txHash: draft.id, // Use draft ID as key
    proposalIndex: 0,
    title: draft.title || 'Untitled Draft',
    abstract: draft.abstract || null,
    aiSummary: null,
    proposalType: draft.proposalType,
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

// ---------------------------------------------------------------------------
// ProposalMetaStrip — key context about the proposal being reviewed
// ---------------------------------------------------------------------------

function ProposalMetaStrip({ item }: { item: ReviewQueueItem }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-4">
      {/* Type badge (visible on mobile where header hides title) */}
      <span className="bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 font-medium">
        {PROPOSAL_TYPE_LABELS[item.proposalType as ProposalType] ?? item.proposalType}
      </span>

      {/* Epochs remaining */}
      {item.epochsRemaining != null && (
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {item.epochsRemaining} epochs remaining
        </span>
      )}

      {/* Urgent flag */}
      {item.isUrgent && (
        <span className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          Urgent
        </span>
      )}

      {/* Treasury withdrawal amount */}
      {item.withdrawalAmount != null && (
        <span className="flex items-center gap-1 tabular-nums">
          ₳ {Number(item.withdrawalAmount).toLocaleString()}
        </span>
      )}

      {/* Treasury tier */}
      {item.treasuryTier && (
        <span className="bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5">
          {item.treasuryTier}
        </span>
      )}

      {/* References */}
      {item.references && Array.isArray(item.references) && item.references.length > 0 && (
        <div className="flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          {item.references.slice(0, 2).map((ref, i) => (
            <a
              key={i}
              href={ref.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {ref.label || 'Reference'}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionTOC — floating table of contents for proposal sections
// ---------------------------------------------------------------------------

const PROPOSAL_SECTIONS = [
  { id: 'title', label: 'Title' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'rationale', label: 'Rationale' },
];

function SectionTOC() {
  const scrollToSection = (sectionId: string) => {
    const el = document.querySelector(`[data-section-field="${sectionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="hidden xl:block fixed left-4 top-1/3 space-y-1 z-10">
      <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">
        Sections
      </p>
      {PROPOSAL_SECTIONS.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollToSection(section.id)}
          className="block w-full text-left text-xs text-muted-foreground/60 hover:text-foreground transition-colors py-0.5 pl-2 border-l border-transparent hover:border-primary cursor-pointer"
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// StudioPanelWrapper — manages agent + panel rendering
// ---------------------------------------------------------------------------

interface StudioPanelWrapperProps {
  proposalId: string;
  proposalType: string;
  proposalIndex: number;
  userRole: 'proposer' | 'reviewer' | 'cc_member';
  content: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  editorRef: React.RefObject<Editor | null>;
  readOnly: boolean;
  interBodyVotes?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
  citizenSentiment?: { support: number; oppose: number; abstain: number; total: number } | null;
  voterId: string | null;
}

function StudioPanelWrapper({
  proposalId,
  proposalType,
  proposalIndex,
  userRole,
  content,
  editorRef,
  readOnly,
  interBodyVotes,
  citizenSentiment,
  voterId,
}: StudioPanelWrapperProps) {
  const { panelOpen, activePanel, panelWidth, closePanel, togglePanel, setPanelWidth } =
    useStudio();

  const {
    sendMessage: agentSendMessage,
    messages: agentMessages,
    isStreaming: agentIsStreaming,
    lastEdit: agentLastEdit,
    lastComment: agentLastComment,
    clearLastEdit: agentClearLastEdit,
    clearLastComment: agentClearLastComment,
    activeToolCall: agentActiveToolCall,
    error: agentError,
  } = useAgent({ proposalId, userRole });

  // --- Agent lastEdit -> inject into editor ---
  useEffect(() => {
    if (!agentLastEdit || !editorRef.current) return;
    injectProposedEdit(editorRef.current, agentLastEdit);
    agentClearLastEdit();
  }, [agentLastEdit, agentClearLastEdit, editorRef]);

  // --- Agent lastComment -> apply inline comment ---
  useEffect(() => {
    if (!agentLastComment || !editorRef.current) return;
    injectInlineComment(editorRef.current, agentLastComment);
    agentClearLastComment();
  }, [agentLastComment, agentClearLastComment, editorRef]);

  // --- Chat send message with editor context ---
  const handleChatSendMessage = useCallback(
    async (message: string) => {
      const ctx = buildEditorContext(editorRef.current, content, 'review');
      posthog.capture('workspace_agent_message_sent', {
        proposal_id: proposalId,
        mode: 'review',
        user_role: userRole,
        has_selection: !!ctx.selectedText,
      });
      await agentSendMessage(message, ctx);
    },
    [agentSendMessage, content, proposalId, userRole, editorRef],
  );

  // --- Apply proposed edit from chat panel ---
  const handleApplyEdit = useCallback(
    (edit: ProposedEdit) => {
      if (!editorRef.current) return;
      injectProposedEdit(editorRef.current, edit);
    },
    [editorRef],
  );

  // --- Apply proposed comment from chat panel ---
  const handleApplyComment = useCallback(
    (comment: ProposedComment) => {
      if (!editorRef.current) return;
      injectInlineComment(editorRef.current, comment);
    },
    [editorRef],
  );

  return (
    <StudioPanel
      isOpen={panelOpen}
      onClose={closePanel}
      activeTab={activePanel}
      onTabChange={(tab) => togglePanel(tab)}
      width={panelWidth}
      onWidthChange={setPanelWidth}
      agentContent={
        <AgentChatPanel
          sendMessage={handleChatSendMessage}
          messages={agentMessages}
          isStreaming={agentIsStreaming}
          activeToolCall={agentActiveToolCall}
          error={agentError}
          onApplyEdit={readOnly ? undefined : handleApplyEdit}
          onApplyComment={handleApplyComment}
        />
      }
      intelContent={
        <IntelPanel
          proposalId={proposalId}
          proposalType={proposalType}
          proposalContent={content}
          interBodyVotes={interBodyVotes}
          citizenSentiment={citizenSentiment}
        />
      }
      notesContent={
        <NotesPanel proposalTxHash={proposalId} proposalIndex={proposalIndex} voterId={voterId} />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// StudioActionBarWrapper — connects action bar to studio context
// ---------------------------------------------------------------------------

interface StudioActionBarWrapperProps {
  progress: { reviewed: number; total: number };
  currentVoted?: boolean;
  currentUrgent?: boolean;
}

function StudioActionBarWrapper({
  progress,
  currentVoted,
  currentUrgent,
}: StudioActionBarWrapperProps) {
  const { panelOpen, activePanel, togglePanel } = useStudio();

  return (
    <StudioActionBar
      activePanel={panelOpen ? activePanel : null}
      onPanelToggle={togglePanel}
      statusInfo={
        <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span>
            {progress.reviewed} of {progress.total} reviewed
          </span>
          {currentVoted && (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span className="hidden sm:inline">Voted</span>
            </span>
          )}
          {currentUrgent && !currentVoted && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Urgent</span>
            </span>
          )}
        </span>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// ReviewWorkspace — main component
// ---------------------------------------------------------------------------

/**
 * ReviewWorkspace — the top-level client component for /workspace/review.
 * Uses the Studio shell (StudioHeader, StudioPanel, StudioActionBar) for a
 * clean, focused review experience. No sidebar, no fullscreen overlay.
 *
 * Auto-selects the first unreviewed proposal on mount. The editor is centered
 * at max-w-3xl, with the agent panel available on-demand from the action bar.
 */
export function ReviewWorkspace({ initialProposalKey }: ReviewWorkspaceProps = {}) {
  const { segment, drepId, poolId, stakeAddress } = useSegment();
  const { ownDRepId } = useWallet();

  // Determine voter identity
  const voterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId || drepId;

  const { data, isLoading, error } = useReviewQueue(voterId, voterRole);
  const { data: draftsData } = useReviewableDrafts();
  const { getStatus, setStatus, reviewedCount } = useQueueState(voterId);

  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = not yet auto-selected
  const [voteToast, setVoteToast] = useState<{ vote: string; visible: boolean } | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'review' | 'diff'>('review');
  const lastTrackedRef = useRef<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const items = useMemo(() => data?.items ?? [], [data?.items]);

  // Convert drafts to queue-compatible items (kept for future use)
  const draftItems = useMemo(() => {
    const drafts = draftsData?.drafts ?? [];
    return drafts.map(draftToQueueItem);
  }, [draftsData?.drafts]);

  // Revision notifications
  const { data: notificationsData } = useRevisionNotifications(!!voterId);
  const unreadCount = notificationsData?.unreadCount ?? 0;

  // Track page view
  useEffect(() => {
    posthog.capture('review_workspace_viewed', { voter_role: voterRole });
  }, [voterRole]);

  // Auto-select first unreviewed item on mount (or from deep-link)
  useEffect(() => {
    if (items.length === 0) return;

    // If deep-link, use that
    if (initialProposalKey) {
      const [targetTxHash, targetIndexStr] = initialProposalKey.split(':');
      if (targetTxHash && targetIndexStr) {
        const targetIndex = parseInt(targetIndexStr, 10);
        if (!isNaN(targetIndex)) {
          const matchIdx = items.findIndex(
            (item) => item.txHash === targetTxHash && item.proposalIndex === targetIndex,
          );
          if (matchIdx >= 0) {
            setSelectedIndex(matchIdx);
            return;
          }
        }
      }
    }

    // Auto-select first unreviewed item
    if (selectedIndex === -1) {
      const firstUnreviewed = items.findIndex(
        (item) => getStatus(item.txHash, item.proposalIndex) !== 'voted' && !item.existingVote,
      );
      setSelectedIndex(firstUnreviewed >= 0 ? firstUnreviewed : 0);
    }
  }, [items, initialProposalKey, selectedIndex, getStatus]);

  const selectedItem = items[selectedIndex] ?? null;

  // Reset editor mode to 'review' when switching proposals
  useEffect(() => {
    setEditorMode('review');
  }, [selectedIndex]);

  // Track proposal view when selection changes
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
  }, [selectedItem, voterId, segment]);

  // Progress computation
  const progress = useMemo(() => {
    const reviewed = reviewedCount(items);
    const alreadyVoted = items.filter(
      (item) => item.existingVote && getStatus(item.txHash, item.proposalIndex) !== 'voted',
    ).length;
    return { reviewed: reviewed + alreadyVoted, total: items.length };
  }, [items, reviewedCount, getStatus]);

  // Navigation callbacks
  const goNext = useCallback(() => {
    setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Vote success handler — auto-advances to next unreviewed proposal after 1.5s
  const handleVoteSuccess = useCallback(
    (vote: VoteChoice) => {
      if (!selectedItem) return;
      setStatus(selectedItem.txHash, selectedItem.proposalIndex, 'voted', vote);

      // Show toast
      setVoteToast({ vote, visible: true });
      setTimeout(() => setVoteToast(null), 2500);

      // Auto-advance after delay
      setTimeout(() => {
        setSelectedIndex((prev) => {
          // Find next unreviewed item
          const nextUnreviewed = items.findIndex(
            (item, idx) =>
              idx > prev &&
              getStatus(item.txHash, item.proposalIndex) !== 'voted' &&
              !item.existingVote,
          );
          if (nextUnreviewed >= 0) return nextUnreviewed;
          // If no more unreviewed, go to next item
          if (prev < items.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);
    },
    [selectedItem, setStatus, items, getStatus],
  );

  // Keyboard shortcuts (arrow keys)
  useKeyboardShortcuts({
    onNext: goNext,
    onPrev: goPrev,
  });

  // J/K keyboard navigation (disabled in text inputs)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // Derive the agent userRole from segment
  const agentUserRole = segment === 'cc' ? ('cc_member' as const) : ('reviewer' as const);

  // Capture editor instance
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // Type label
  const typeLabel = selectedItem
    ? (PROPOSAL_TYPE_LABELS[selectedItem.proposalType as ProposalType] ?? selectedItem.proposalType)
    : '';

  // Queue labels for tooltip display
  const queueLabels = useMemo(() => items.map((item) => item.title || 'Untitled'), [items]);

  // Segment badge
  const segmentBadge = useMemo(() => {
    const badges: Record<string, { label: string; color: string }> = {
      drep: { label: 'DRep', color: '#6366f1' },
      spo: { label: 'SPO', color: '#f59e0b' },
      cc: { label: 'CC', color: '#ef4444' },
    };
    return badges[segment] ?? undefined;
  }, [segment]);

  // Queue jump handler for dots
  const handleQueueJump = useCallback(
    (index: number) => {
      if (index >= 0 && index < items.length) {
        setSelectedIndex(index);
      }
    },
    [items.length],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-12 border-t-2 border-teal-500 border-b border-b-border bg-background px-4 flex items-center shrink-0">
          <Skeleton className="h-5 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex-1 flex items-start justify-center pt-12">
          <div className="max-w-3xl w-full px-6 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        </div>
        <div className="h-12 border-t border-border bg-background shrink-0" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Failed to load review queue</p>
          <p className="text-xs text-muted-foreground/60">{String(error)}</p>
        </div>
      </div>
    );
  }

  // No voter ID (not a DRep/SPO)
  if (!voterId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-base font-semibold text-foreground">Review Workspace</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your wallet as a DRep or SPO to start reviewing proposals.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0 && draftItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">You&apos;re all caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No open proposals need your review right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No selected item yet (shouldn't happen after auto-select, but guard)
  if (!selectedItem) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  // Queue complete celebration
  if (progress.reviewed >= progress.total && progress.total > 0) {
    return (
      <StudioProvider>
        <div className="flex flex-col h-screen">
          <StudioHeader
            backLabel="governada"
            backHref="/workspace"
            queueProgress={{ current: progress.total, total: progress.total }}
            segmentBadge={segmentBadge}
          />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You&apos;ve reviewed all {progress.total} proposal
                  {progress.total !== 1 ? 's' : ''} in the queue.
                </p>
              </div>
              <a
                href="/workspace"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Back to workspace
              </a>
            </div>
          </div>
          <StudioActionBarWrapper progress={progress} />
        </div>
      </StudioProvider>
    );
  }

  // --- Main studio layout ---
  const itemContent = {
    title: selectedItem.title || '',
    abstract: selectedItem.abstract || '',
    motivation: selectedItem.motivation || '',
    rationale: selectedItem.rationale || '',
  };

  return (
    <StudioProvider>
      <div className="flex flex-col h-screen">
        {/* Studio Header */}
        <StudioHeader
          backLabel="governada"
          backHref="/workspace"
          title={selectedItem.title || 'Untitled'}
          proposalType={typeLabel}
          queueProgress={{ current: selectedIndex + 1, total: items.length }}
          onQueueJump={handleQueueJump}
          onPrev={selectedIndex > 0 ? goPrev : undefined}
          onNext={selectedIndex < items.length - 1 ? goNext : undefined}
          queueLabels={queueLabels}
          segmentBadge={segmentBadge}
          notificationCount={unreadCount}
          showModeSwitch={true}
          mode={editorMode}
          onModeChange={setEditorMode}
        />

        {/* Main content area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Section TOC (floating left on xl+) */}
          <SectionTOC />

          {/* Editor area (scrollable) */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6">
              {/* Proposal metadata strip */}
              <ProposalMetaStrip item={selectedItem} />

              <div
                key={`proposal-${selectedItem.txHash}-${selectedItem.proposalIndex}`}
                className="animate-in fade-in duration-150"
              >
                {editorMode === 'diff' ? (
                  <div className="rounded-lg border border-border bg-muted/10 p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No previous version available for comparison.
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Diff view is available when a proposal has multiple versions.
                    </p>
                  </div>
                ) : (
                  <ProposalEditor
                    content={itemContent}
                    mode="review"
                    readOnly={true}
                    currentUserId={stakeAddress ?? 'anonymous'}
                    onEditorReady={handleEditorReady}
                  />
                )}
                {/* ReviewActionZone below editor */}
                <div className="mt-6">
                  <ReviewActionZone
                    item={selectedItem}
                    drepId={voterId}
                    onVote={(_txHash, _index, vote) => handleVoteSuccess(vote as VoteChoice)}
                    onNextProposal={goNext}
                    totalProposals={progress.total}
                    votedCount={progress.reviewed}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Studio Panel (on-demand right panel) */}
          <StudioPanelWrapper
            proposalId={selectedItem.txHash}
            proposalType={selectedItem.proposalType}
            proposalIndex={selectedItem.proposalIndex}
            userRole={agentUserRole}
            content={itemContent}
            editorRef={editorRef}
            readOnly={true}
            interBodyVotes={selectedItem.interBodyVotes}
            citizenSentiment={selectedItem.citizenSentiment}
            voterId={voterId ?? null}
          />
        </div>

        {/* Studio Action Bar */}
        <StudioActionBarWrapper
          progress={progress}
          currentVoted={
            !!selectedItem.existingVote ||
            getStatus(selectedItem.txHash, selectedItem.proposalIndex) === 'voted'
          }
          currentUrgent={selectedItem.isUrgent}
        />

        {/* Vote success toast */}
        {voteToast?.visible && (
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/90 text-white text-sm font-medium shadow-lg animate-in slide-in-from-bottom-2 fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Vote recorded — {voteToast.vote}
          </div>
        )}
      </div>
    </StudioProvider>
  );
}
