'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useRegisterReviewCommands } from '@/hooks/useRegisterReviewCommands';
import { useAISkill } from '@/hooks/useAISkill';
import { useVote } from '@/hooks/useVote';
import { posthog } from '@/lib/posthog';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { SearchPopover } from '@/components/studio/SearchPopover';
import { WorkspacePanels } from '@/components/workspace/layout/WorkspacePanels';
import { ProposalEditor } from '@/components/workspace/editor/ProposalEditor';
import { AmendmentReviewWrapper } from '@/components/workspace/review/AmendmentReviewWrapper';
import { IntelligenceStrip } from '@/components/workspace/review/IntelligenceStrip';
import { SenecaSummary } from '@/components/workspace/review/SenecaSummary';
import { DecisionPanel } from '@/components/workspace/review/DecisionPanel';
import { MobileVoteBar } from '@/components/workspace/review/MobileVoteBar';
import { BatchProgressBar } from '@/components/workspace/review/BatchProgressBar';
import { ReviewIntelBrief } from '@/components/intelligence/ReviewIntelBrief';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StudioProvider, useStudio } from '@/components/studio/StudioProvider';
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

  const [selectedVote, setSelectedVote] = useState<'Yes' | 'No' | 'Abstain' | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [isDraftingRationale, setIsDraftingRationale] = useState(false);
  const [mobileVoteOpen, setMobileVoteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [rationaleCitations, setRationaleCitations] = useState<{
    citations: Array<{ article: string; section?: string; relevance: string }>;
    precedentRefs: Array<{ title: string; outcome: string; relevance: string }>;
    keyQuotes: Array<{ text: string; field: string }>;
  } | null>(null);
  const rationaleCoderaftEnabled = useFeatureFlag('rationale_codraft');

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
  }, [selectedItem.txHash, selectedItem.proposalIndex, resetVote]);

  useEffect(() => {
    if (votePhase.status === 'success') {
      onVoteSuccess(votePhase.vote);
    }
  }, [onVoteSuccess, votePhase]);

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

  const currentVoted =
    !!selectedItem.existingVote ||
    getStatus(selectedItem.txHash, selectedItem.proposalIndex) === 'voted';

  const currentVoteChoice = useMemo(() => {
    if (!selectedItem.existingVote) return null;

    const existingVote = String(selectedItem.existingVote).toLowerCase();
    if (existingVote === 'yes') return 'Yes' as const;
    if (existingVote === 'no') return 'No' as const;
    if (existingVote === 'abstain') return 'Abstain' as const;
    return null;
  }, [selectedItem.existingVote]);

  const rationaleSkill = useAISkill<{
    structuredRationale: string;
    citations: Array<{ article: string; section?: string; relevance: string }>;
    precedentRefs: Array<{ title: string; outcome: string; relevance: string }>;
    keyQuotes: Array<{ text: string; field: string }>;
  }>();

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
      voterRole as 'drep' | 'spo',
      voterId,
    );

    await confirmVote(selectedVote as VoteChoice, anchorUrl, anchorHash);
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
    (vote: 'Yes' | 'No' | 'Abstain') => {
      setSelectedVote(vote);
      togglePanel('vote');
    },
    [togglePanel],
  );

  const voteYes = useCallback(() => handleVoteSelect('Yes'), [handleVoteSelect]);
  const voteNo = useCallback(() => handleVoteSelect('No'), [handleVoteSelect]);
  const voteAbstain = useCallback(() => handleVoteSelect('Abstain'), [handleVoteSelect]);

  useRegisterReviewCommands({
    onYes: voteYes,
    onNo: voteNo,
    onAbstain: voteAbstain,
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
            <DecisionPanel
              selectedVote={selectedVote}
              onVoteChange={handleVoteSelect}
              onSubmit={handleVoteSubmit}
              isSubmitting={isVoteProcessing}
              votePhase={votePhase}
              hasVoted={currentVoted}
              currentVoteChoice={currentVoteChoice}
              rationale={rationaleText}
              onRationaleChange={setRationaleText}
              onAIDraft={handleAIDraft}
              isDraftingRationale={isDraftingRationale}
              proposalTitle={selectedItem.title || 'Untitled'}
              voterId={voterId ?? ''}
              voterRole={segment === 'cc' ? 'cc_member' : segment === 'spo' ? 'SPO' : 'DRep'}
              rationaleCitations={rationaleCitations}
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
                  voterRole={segment === 'cc' ? 'cc_member' : segment === 'spo' ? 'SPO' : 'DRep'}
                  onCCAccept={(text) => setRationaleText(text)}
                />
              }
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

      <MobileVoteBar
        onVoteSelect={(choice) => {
          setSelectedVote(choice);
          setMobileVoteOpen(true);
        }}
        hasVoted={currentVoted}
        currentVote={selectedVote}
      />

      <Sheet open={mobileVoteOpen} onOpenChange={setMobileVoteOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto lg:hidden">
          <SheetHeader>
            <SheetTitle className="text-sm">Your Decision</SheetTitle>
          </SheetHeader>
          <DecisionPanel
            selectedVote={selectedVote}
            onVoteChange={handleVoteSelect}
            onSubmit={handleVoteSubmit}
            isSubmitting={isVoteProcessing}
            votePhase={votePhase}
            hasVoted={currentVoted}
            currentVoteChoice={currentVoteChoice}
            rationale={rationaleText}
            onRationaleChange={setRationaleText}
            onAIDraft={handleAIDraft}
            isDraftingRationale={isDraftingRationale}
            proposalTitle={selectedItem.title || 'Untitled'}
            voterId={voterId ?? ''}
            voterRole={segment === 'cc' ? 'cc_member' : segment === 'spo' ? 'SPO' : 'DRep'}
            rationaleCitations={rationaleCitations}
          />
        </SheetContent>
      </Sheet>

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
