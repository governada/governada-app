'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useReviewQueue, useQueueState } from '@/hooks/useReviewQueue';
import { useReviewableDrafts } from '@/hooks/useReviewableDrafts';
import { useRegisterReviewCommands } from '@/hooks/useRegisterReviewCommands';
import { useRevisionNotifications } from '@/hooks/useRevisionNotifications';
import { useAgent } from '@/hooks/useAgent';
import { trackProposalView } from '@/lib/workspace/engagement';
import { StudioProvider, useStudio } from '@/components/studio/StudioProvider';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { StudioPanel } from '@/components/studio/StudioPanel';
import { buildEditorContext, injectInlineComment } from '@/components/studio/studioEditorHelpers';
import { SearchPopover } from '@/components/studio/SearchPopover';
// VotePanel replaced by DecisionPanel (Phase 3)
import { WorkspacePanels } from '@/components/workspace/layout/WorkspacePanels';
import { ProposalEditor, injectProposedEdit } from '@/components/workspace/editor/ProposalEditor';
import {
  AmendmentReviewWrapper,
  AmendmentIntelContent,
} from '@/components/workspace/review/AmendmentReviewWrapper';
import { IntelligenceStrip } from '@/components/workspace/review/IntelligenceStrip';
import { SenecaSummary } from '@/components/workspace/review/SenecaSummary';
import { DecisionPanel } from '@/components/workspace/review/DecisionPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AgentChatPanel } from '@/components/workspace/agent/AgentChatPanel';
import { IntelPanel } from '@/components/studio/IntelPanel';
import { ReviewIntelBrief } from '@/components/intelligence/ReviewIntelBrief';
import { NotesPanel } from '@/components/studio/NotesPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import { extractAmendmentChanges } from '@/lib/constitution/utils';
import type { ProposalDraft, ProposalType, ReviewQueueItem } from '@/lib/workspace/types';
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

// ProposalMetaStrip removed — replaced by IntelligenceStrip + SenecaSummary

// ---------------------------------------------------------------------------
// SectionTOC — floating table of contents for proposal sections
// ---------------------------------------------------------------------------

const PROPOSAL_SECTIONS = [
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
    <nav className="hidden xl:block sticky top-16 self-start shrink-0 w-28 space-y-1 pr-2 pt-6">
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
  voteContent?: React.ReactNode;
  existingVote?: string | null;
  votingPowerSummary?: {
    yesPower: number;
    noPower: number;
    abstainPower: number;
    totalActivePower: number;
    threshold: number | null;
    thresholdLabel: string | null;
  };
  /** If this is a NewConstitution draft, provide it for amendment intel content. */
  amendmentDraft?: ProposalDraft;
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
  voteContent,
  existingVote,
  votingPowerSummary,
  amendmentDraft,
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
        amendmentDraft?.proposalType === 'NewConstitution' ? (
          <AmendmentIntelContent
            draftId={amendmentDraft.id}
            amendments={extractAmendmentChanges(amendmentDraft.typeSpecific)}
          />
        ) : (
          <ReviewIntelBrief
            proposalId={proposalId}
            proposalIndex={proposalIndex}
            proposalType={proposalType}
            proposalContent={content}
            interBodyVotes={interBodyVotes}
            citizenSentiment={citizenSentiment}
            voterRole={userRole}
          />
        )
      }
      notesContent={
        <NotesPanel
          proposalTxHash={proposalId}
          proposalIndex={proposalIndex}
          voterId={voterId}
          priorVotes={
            existingVote
              ? [{ vote: existingVote, epochNo: 0, blockTime: new Date().toISOString() }]
              : undefined
          }
        />
      }
      voteContent={voteContent}
    />
  );
}

// ---------------------------------------------------------------------------
// StudioReviewInner — renders inside StudioProvider, has access to useStudio()
// ---------------------------------------------------------------------------

interface StudioReviewInnerProps {
  selectedItem: ReviewQueueItem;
  selectedIndex: number;
  items: ReviewQueueItem[];
  progress: { reviewed: number; total: number };
  goNext: () => void;
  goPrev: () => void;
  handleVoteSuccess: (vote: VoteChoice) => void;
  handleEditorReady: (editor: Editor) => void;
  handleQueueJump: (index: number) => void;
  editorRef: React.RefObject<Editor | null>;
  agentUserRole: 'proposer' | 'reviewer' | 'cc_member';
  stakeAddress: string | null;
  voterId: string | null;
  segmentBadge: { label: string; color: string } | undefined;
  unreadCount: number;
  voteToast: { vote: string; visible: boolean } | null;
  getStatus: (txHash: string, proposalIndex: number) => string | undefined;
  queueLabels: string[];
  segment: string;
  onSelectIndex: (index: number) => void;
  /** If the selected item is a draft, provides the full draft object (for NewConstitution). */
  currentDraft?: ProposalDraft;
}

function StudioReviewInner({
  selectedItem,
  selectedIndex,
  items,
  progress,
  goNext,
  goPrev,
  handleVoteSuccess: _handleVoteSuccess,
  handleEditorReady,
  handleQueueJump,
  editorRef,
  agentUserRole,
  stakeAddress,
  voterId,
  segmentBadge,
  unreadCount,
  voteToast,
  getStatus,
  queueLabels,
  segment,
  onSelectIndex,
  currentDraft,
}: StudioReviewInnerProps) {
  const { panelOpen, activePanel, togglePanel, isFullWidth, toggleFullWidth } = useStudio();

  // Vote state (for VotePanel in side panel)
  const [selectedVote, setSelectedVote] = useState<'Yes' | 'No' | 'Abstain' | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [isDraftingRationale, setIsDraftingRationale] = useState(false);
  const [mobileVoteOpen, setMobileVoteOpen] = useState(false);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);

  const typeLabel = selectedItem
    ? (PROPOSAL_TYPE_LABELS[selectedItem.proposalType as ProposalType] ?? selectedItem.proposalType)
    : '';

  const itemContent = {
    title: selectedItem.title || '',
    abstract: selectedItem.abstract || '',
    motivation: selectedItem.motivation || '',
    rationale: selectedItem.rationale || '',
  };

  const currentVoted =
    !!selectedItem.existingVote ||
    getStatus(selectedItem.txHash, selectedItem.proposalIndex) === 'voted';

  // Determine the current vote choice for display
  const currentVoteChoice = useMemo(() => {
    if (selectedItem.existingVote) {
      // Normalize existing vote to our display format
      const v = String(selectedItem.existingVote);
      if (v.toLowerCase() === 'yes') return 'Yes' as const;
      if (v.toLowerCase() === 'no') return 'No' as const;
      if (v.toLowerCase() === 'abstain') return 'Abstain' as const;
    }
    return null;
  }, [selectedItem.existingVote]);

  // AI rationale draft handler
  const handleAIDraft = useCallback(async () => {
    if (!voterId) return;
    setIsDraftingRationale(true);
    try {
      const res = await fetch('/api/rationale/draft', {
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
      if (res.ok) {
        const { draft } = await res.json();
        if (draft) setRationaleText(draft);
      }
    } finally {
      setIsDraftingRationale(false);
    }
  }, [voterId, segment, selectedItem]);

  const handleVoteSelect = useCallback(
    (vote: 'Yes' | 'No' | 'Abstain') => {
      setSelectedVote(vote);
      togglePanel('vote');
    },
    [togglePanel],
  );

  // Register vote keyboard shortcuts (y/n/a) — these need handleVoteSelect which lives here
  const voteYes = useCallback(() => handleVoteSelect('Yes'), [handleVoteSelect]);
  const voteNo = useCallback(() => handleVoteSelect('No'), [handleVoteSelect]);
  const voteAbstain = useCallback(() => handleVoteSelect('Abstain'), [handleVoteSelect]);
  useRegisterReviewCommands({
    onYes: voteYes,
    onNo: voteNo,
    onAbstain: voteAbstain,
  });

  // Estimated voting power (based on vote counts as proxy)
  const estimatedVotingPower = useMemo(() => {
    if (!selectedItem.interBodyVotes) return undefined;
    const drep = selectedItem.interBodyVotes.drep;
    const total = drep.yes + drep.no + drep.abstain;
    if (total === 0) return undefined;
    const THRESHOLDS: Record<string, number> = {
      'Treasury Withdrawal': 0.67,
      'Parameter Change': 0.67,
      'Hard Fork': 0.75,
      'New Constitution': 0.75,
      'No Confidence': 0.67,
      'Update Committee': 0.67,
      'Info Action': 0.51,
    };
    const threshold = THRESHOLDS[selectedItem.proposalType] ?? null;
    return {
      yesPower: drep.yes,
      noPower: drep.no,
      abstainPower: drep.abstain,
      totalActivePower: total,
      threshold,
      thresholdLabel: threshold ? `${Math.round(threshold * 100)}% DRep approval needed` : null,
    };
  }, [selectedItem]);

  return (
    <>
      <WorkspacePanels
        layoutId="review"
        toolbar={
          <>
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
              actions={
                <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
                  <button className="px-3 py-1 text-[11px] font-medium rounded-sm bg-background text-foreground shadow-sm cursor-default">
                    Review
                  </button>
                  <button
                    disabled
                    className="px-3 py-1 text-[11px] font-medium rounded-sm text-muted-foreground/40 cursor-not-allowed"
                    title="No previous revisions available for comparison"
                  >
                    Diff
                  </button>
                </div>
              }
              panelOpen={panelOpen}
              activePanel={activePanel}
              onPanelToggle={togglePanel}
              isFullWidth={isFullWidth}
              onFullWidthToggle={toggleFullWidth}
              onSearchToggle={() => setSearchOpen(!searchOpen)}
              searchOpen={searchOpen}
            />

            {/* Search popover */}
            <SearchPopover
              isOpen={searchOpen}
              onClose={() => setSearchOpen(false)}
              proposalContent={itemContent}
              queueItems={items.map((item) => ({
                txHash: item.txHash,
                title: item.title,
                abstract: item.abstract,
              }))}
              onSelectQueueItem={(txHash: string) => {
                const idx = items.findIndex((item) => item.txHash === txHash);
                if (idx >= 0) {
                  onSelectIndex(idx);
                  setSearchOpen(false);
                }
              }}
            />
          </>
        }
        main={
          <div className="flex h-full">
            {/* Section TOC (floating left on xl+) */}
            <SectionTOC />

            {/* Editor area */}
            <div className="flex-1 min-w-0">
              <div className={cn('mx-auto px-6 py-6', isFullWidth ? 'max-w-6xl' : 'max-w-4xl')}>
                {/* Intelligence strip — compact AI-enriched metadata */}
                <IntelligenceStrip
                  interBodyVotes={selectedItem.interBodyVotes}
                  citizenSentiment={selectedItem.citizenSentiment}
                  withdrawalAmount={selectedItem.withdrawalAmount}
                  treasuryTier={selectedItem.treasuryTier}
                  epochsRemaining={selectedItem.epochsRemaining}
                  isUrgent={selectedItem.isUrgent}
                />

                {/* Seneca AI summary */}
                <SenecaSummary summary={selectedItem.aiSummary} />

                <div
                  key={`proposal-${selectedItem.txHash}-${selectedItem.proposalIndex}`}
                  className="animate-in fade-in duration-150"
                >
                  {/* NewConstitution drafts use the amendment review wrapper */}
                  {currentDraft?.proposalType === 'NewConstitution' ? (
                    <AmendmentReviewWrapper
                      draft={currentDraft}
                      draftId={currentDraft.id}
                      currentUserId={stakeAddress ?? undefined}
                    />
                  ) : (
                    <ProposalEditor
                      content={itemContent}
                      mode="review"
                      readOnly={true}
                      currentUserId={stakeAddress ?? 'anonymous'}
                      onEditorReady={handleEditorReady}
                      excludeFields={['title']}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        }
        context={
          !isFullWidth ? (
            <DecisionPanel
              selectedVote={selectedVote}
              onVoteChange={handleVoteSelect}
              onSubmit={() => {}}
              isSubmitting={false}
              hasVoted={currentVoted}
              currentVoteChoice={currentVoteChoice}
              rationale={rationaleText}
              onRationaleChange={setRationaleText}
              onAIDraft={handleAIDraft}
              isDraftingRationale={isDraftingRationale}
              proposalTitle={selectedItem.title || 'Untitled'}
              voterId={voterId ?? ''}
              voterRole={segment === 'spo' ? 'SPO' : 'DRep'}
              intelContent={
                <ReviewIntelBrief
                  proposalId={selectedItem.txHash}
                  proposalIndex={selectedItem.proposalIndex}
                  proposalType={selectedItem.proposalType}
                  proposalContent={itemContent}
                  interBodyVotes={selectedItem.interBodyVotes}
                  citizenSentiment={selectedItem.citizenSentiment}
                  aiSummary={selectedItem.aiSummary}
                  withdrawalAmount={selectedItem.withdrawalAmount}
                  treasuryTier={selectedItem.treasuryTier}
                  epochsRemaining={selectedItem.epochsRemaining}
                  isUrgent={selectedItem.isUrgent}
                  voterRole={segment === 'spo' ? 'SPO' : 'DRep'}
                />
              }
            />
          ) : undefined
        }
        statusBar={
          <StudioActionBar
            mode="review"
            statusInfo={
              <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                <span>
                  {progress.reviewed} of {progress.total} reviewed
                </span>
                {currentVoted && (
                  <span className="inline-flex items-center gap-1 text-[var(--compass-teal)]">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="hidden sm:inline">Voted: {currentVoteChoice}</span>
                  </span>
                )}
                {selectedItem.isUrgent && !currentVoted && (
                  <span className="inline-flex items-center gap-1 text-[var(--wayfinder-amber)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--wayfinder-amber)] animate-pulse" />
                    <span className="hidden sm:inline">Urgent</span>
                  </span>
                )}
              </span>
            }
          />
        }
      />

      {/* Mobile: DecisionPanel as bottom sheet (context panel is hidden lg:block) */}
      {!currentVoted && (
        <button
          type="button"
          onClick={() => {
            setMobileVoteOpen(true);
            posthog.capture('workspace_mobile_vote_opened');
          }}
          className="fixed bottom-20 right-4 z-40 lg:hidden flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Open vote panel"
        >
          <Vote className="h-5 w-5" />
        </button>
      )}
      <Sheet open={mobileVoteOpen} onOpenChange={setMobileVoteOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto lg:hidden">
          <SheetHeader>
            <SheetTitle className="text-sm">Your Decision</SheetTitle>
          </SheetHeader>
          <DecisionPanel
            selectedVote={selectedVote}
            onVoteChange={handleVoteSelect}
            onSubmit={() => {
              setMobileVoteOpen(false);
            }}
            isSubmitting={false}
            hasVoted={currentVoted}
            currentVoteChoice={currentVoteChoice}
            rationale={rationaleText}
            onRationaleChange={setRationaleText}
            onAIDraft={handleAIDraft}
            isDraftingRationale={isDraftingRationale}
            proposalTitle={selectedItem.title || 'Untitled'}
            voterId={voterId ?? ''}
            voterRole={segment === 'spo' ? 'SPO' : 'DRep'}
          />
        </SheetContent>
      </Sheet>

      {/* Vote success toast */}
      {voteToast?.visible && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--compass-teal)] text-primary-foreground text-sm font-medium shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          <CheckCircle2 className="h-4 w-4" />
          Vote recorded — {voteToast.vote}
        </div>
      )}
    </>
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

  // Lookup the full ProposalDraft if the selected item came from drafts (for NewConstitution)
  const drafts = draftsData?.drafts;
  const currentDraft = useMemo(() => {
    if (!selectedItem || !drafts) return undefined;
    return drafts.find((d) => d.id === selectedItem.txHash);
  }, [selectedItem, drafts]);

  // Reset editor mode to 'review' when switching proposals
  useEffect(() => {}, [selectedIndex]);

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

  // Register review navigation shortcuts via command registry (j/k + arrows)
  // Vote shortcuts (y/n/a) are registered in StudioReviewInner where handleVoteSelect is available
  useRegisterReviewCommands({
    onNext: goNext,
    onPrev: goPrev,
  });

  // Derive the agent userRole from segment
  const agentUserRole = segment === 'cc' ? ('cc_member' as const) : ('reviewer' as const);

  // Capture editor instance
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

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
          <StudioActionBar
            mode="review"
            statusInfo={
              <span className="text-xs text-muted-foreground tabular-nums">
                {progress.reviewed} of {progress.total} reviewed
              </span>
            }
          />
        </div>
      </StudioProvider>
    );
  }

  // --- Main studio layout ---
  return (
    <StudioProvider>
      <StudioReviewInner
        selectedItem={selectedItem}
        selectedIndex={selectedIndex}
        items={items}
        progress={progress}
        goNext={goNext}
        goPrev={goPrev}
        handleVoteSuccess={handleVoteSuccess}
        handleEditorReady={handleEditorReady}
        handleQueueJump={handleQueueJump}
        editorRef={editorRef}
        agentUserRole={agentUserRole}
        stakeAddress={stakeAddress}
        voterId={voterId}
        segmentBadge={segmentBadge}
        unreadCount={unreadCount}
        voteToast={voteToast}
        getStatus={getStatus}
        queueLabels={queueLabels}
        segment={segment}
        onSelectIndex={setSelectedIndex}
        currentDraft={currentDraft}
      />
    </StudioProvider>
  );
}
