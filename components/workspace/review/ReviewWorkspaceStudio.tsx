'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { SearchPopover } from '@/components/studio/SearchPopover';
import { WorkspacePanels } from '@/components/workspace/layout/WorkspacePanels';
import { ProposalEditor } from '@/components/workspace/editor/ProposalEditor';
import {
  ReviewWorkspaceDecisionPanel,
  ReviewWorkspaceMobileDecisionTray,
} from '@/components/workspace/review/ReviewWorkspaceDecisionPanels';
import { AmendmentReviewWrapper } from '@/components/workspace/review/AmendmentReviewWrapper';
import { IntelligenceStrip } from '@/components/workspace/review/IntelligenceStrip';
import { SenecaSummary } from '@/components/workspace/review/SenecaSummary';
import { BatchProgressBar } from '@/components/workspace/review/BatchProgressBar';
import { ReviewIntelBrief } from '@/components/intelligence/ReviewIntelBrief';
import { StudioProvider, useStudio } from '@/components/studio/StudioProvider';
import { useReviewDecisionFlow } from '@/hooks/useReviewDecisionFlow';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalDraft, ProposalType, ReviewQueueItem } from '@/lib/workspace/types';
import type { VoteChoice } from '@/lib/voting';
import type { Editor } from '@tiptap/core';

const PROPOSAL_SECTIONS = [
  { id: 'abstract', label: 'Abstract' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'rationale', label: 'Rationale' },
];

function SectionTOC() {
  const scrollToSection = (sectionId: string) => {
    const element = document.querySelector(`[data-section-field="${sectionId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

export interface ReviewWorkspaceStudioProps {
  selectedItem: ReviewQueueItem;
  selectedIndex: number;
  items: ReviewQueueItem[];
  progress: { reviewed: number; total: number };
  goNext: () => void;
  goPrev: () => void;
  handleVoteSuccess: (vote: VoteChoice) => void;
  handleEditorReady: (editor: Editor) => void;
  handleQueueJump: (index: number) => void;
  stakeAddress: string | null;
  voterId: string | null;
  segmentBadge: { label: string; color: string } | undefined;
  unreadCount: number;
  voteToast: { vote: string; visible: boolean } | null;
  getStatus: (txHash: string, proposalIndex: number) => string | undefined;
  queueLabels: string[];
  segment: string;
  onSelectIndex: (index: number) => void;
  currentDraft?: ProposalDraft;
  reviewSession: {
    reviewed: number;
    total: number;
    avgSecondsPerProposal: number | null;
    estimatedRemaining: number | null;
    isComplete: boolean;
  };
}

export function ReviewWorkspaceStudio({
  selectedItem,
  selectedIndex,
  items,
  progress,
  goNext,
  goPrev,
  handleVoteSuccess: onVoteSuccess,
  handleEditorReady,
  handleQueueJump,
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
  reviewSession,
}: ReviewWorkspaceStudioProps) {
  const { panelOpen, activePanel, togglePanel, isFullWidth, toggleFullWidth } = useStudio();

  const [searchOpen, setSearchOpen] = useState(false);

  const typeLabel = selectedItem
    ? (PROPOSAL_TYPE_LABELS[selectedItem.proposalType as ProposalType] ?? selectedItem.proposalType)
    : '';

  const itemContent = useMemo(
    () => ({
      title: selectedItem.title || '',
      abstract: selectedItem.abstract || '',
      motivation: selectedItem.motivation || '',
      rationale: selectedItem.rationale || '',
    }),
    [selectedItem.abstract, selectedItem.motivation, selectedItem.rationale, selectedItem.title],
  );

  const {
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
    voterRoleLabel,
  } = useReviewDecisionFlow({
    getStatus,
    itemContent,
    onVoteSuccess,
    selectedItem,
    segment,
    togglePanel,
    voterId,
  });

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

            <BatchProgressBar
              reviewed={reviewSession.reviewed}
              total={reviewSession.total}
              avgSeconds={reviewSession.avgSecondsPerProposal}
              estimatedRemaining={reviewSession.estimatedRemaining}
              isComplete={reviewSession.isComplete}
            />

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
                const nextIndex = items.findIndex((item) => item.txHash === txHash);
                if (nextIndex >= 0) {
                  onSelectIndex(nextIndex);
                  setSearchOpen(false);
                }
              }}
            />
          </>
        }
        main={
          <div className="flex h-full">
            <SectionTOC />

            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  'mx-auto px-4 py-4 lg:px-6 lg:py-6',
                  isFullWidth ? 'max-w-6xl' : 'max-w-4xl',
                )}
              >
                <IntelligenceStrip
                  interBodyVotes={selectedItem.interBodyVotes}
                  citizenSentiment={selectedItem.citizenSentiment}
                  withdrawalAmount={selectedItem.withdrawalAmount}
                  treasuryTier={selectedItem.treasuryTier}
                  epochsRemaining={selectedItem.epochsRemaining}
                  isUrgent={selectedItem.isUrgent}
                />

                <SenecaSummary summary={selectedItem.aiSummary} />

                <div
                  key={`proposal-${selectedItem.txHash}-${selectedItem.proposalIndex}`}
                  className="animate-in fade-in duration-150"
                >
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
            <ReviewWorkspaceDecisionPanel
              currentVoteChoice={currentVoteChoice}
              currentVoted={currentVoted}
              handleAIDraft={handleAIDraft}
              handleVoteSelect={handleVoteSelect}
              handleVoteSubmit={handleVoteSubmit}
              isDraftingRationale={isDraftingRationale}
              isVoteProcessing={isVoteProcessing}
              intelContent={
                <ReviewIntelBrief
                  proposalId={selectedItem.txHash}
                  proposalIndex={selectedItem.proposalIndex}
                  proposalType={selectedItem.proposalType}
                  paramChanges={selectedItem.paramChanges}
                  proposalContent={itemContent}
                  interBodyVotes={selectedItem.interBodyVotes}
                  citizenSentiment={selectedItem.citizenSentiment}
                  aiSummary={selectedItem.aiSummary}
                  withdrawalAmount={selectedItem.withdrawalAmount}
                  treasuryTier={selectedItem.treasuryTier}
                  epochsRemaining={selectedItem.epochsRemaining}
                  isUrgent={selectedItem.isUrgent}
                  voterRole={voterRoleLabel}
                  onCCAccept={(text) => setRationaleText(text)}
                />
              }
              proposalTitle={selectedItem.title || 'Untitled'}
              rationaleCitations={rationaleCitations}
              rationaleText={rationaleText}
              selectedVote={selectedVote}
              setRationaleText={setRationaleText}
              votePhase={votePhase}
              voterId={voterId ?? ''}
              voterRole={voterRoleLabel}
            />
          ) : undefined
        }
        statusBar={
          <StudioActionBar
            mode="review"
            currentVote={isFullWidth ? selectedVote : undefined}
            onVoteSelect={isFullWidth && !currentVoted ? handleVoteSelect : undefined}
            voteDisabled={currentVoted}
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

      <ReviewWorkspaceMobileDecisionTray
        currentVoteChoice={currentVoteChoice}
        currentVoted={currentVoted}
        handleAIDraft={handleAIDraft}
        handleMobileVoteSelect={handleMobileVoteSelect}
        handleVoteSelect={handleVoteSelect}
        handleVoteSubmit={handleVoteSubmit}
        isDraftingRationale={isDraftingRationale}
        isVoteProcessing={isVoteProcessing}
        mobileVoteOpen={mobileVoteOpen}
        onMobileVoteOpenChange={setMobileVoteOpen}
        proposalTitle={selectedItem.title || 'Untitled'}
        rationaleCitations={rationaleCitations}
        rationaleText={rationaleText}
        selectedVote={selectedVote}
        setRationaleText={setRationaleText}
        votePhase={votePhase}
        voterId={voterId ?? ''}
        voterRole={voterRoleLabel}
      />

      {voteToast?.visible && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--compass-teal)] text-primary-foreground text-sm font-medium shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          <CheckCircle2 className="h-4 w-4" />
          Vote recorded - {voteToast.vote}
        </div>
      )}
    </>
  );
}

export function ReviewWorkspaceStudioShell(props: ReviewWorkspaceStudioProps) {
  return (
    <StudioProvider>
      <ReviewWorkspaceStudio {...props} />
    </StudioProvider>
  );
}
