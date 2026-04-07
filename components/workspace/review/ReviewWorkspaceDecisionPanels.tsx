'use client';

import type { ReactNode } from 'react';
import { DecisionPanel } from '@/components/workspace/review/DecisionPanel';
import { MobileVoteBar } from '@/components/workspace/review/MobileVoteBar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ReviewRationaleCitations } from '@/hooks/useReviewDecisionFlow';
import type { VotePhase } from '@/hooks/useVote';
import type { VoteChoice } from '@/lib/voting';

interface SharedDecisionPanelProps {
  currentVoteChoice: VoteChoice | null;
  currentVoted: boolean;
  handleAIDraft: () => Promise<void>;
  handleVoteSelect: (vote: VoteChoice) => void;
  handleVoteSubmit: () => Promise<void>;
  intelContent?: ReactNode;
  isDraftingRationale: boolean;
  isVoteProcessing: boolean;
  proposalTitle: string;
  rationaleCitations: ReviewRationaleCitations | null;
  rationaleText: string;
  selectedVote: VoteChoice | null;
  setRationaleText: (text: string) => void;
  votePhase: VotePhase;
  voterId: string;
  voterRole: string;
}

interface ReviewWorkspaceMobileDecisionTrayProps extends SharedDecisionPanelProps {
  handleMobileVoteSelect: (vote: VoteChoice) => void;
  mobileVoteOpen: boolean;
  onMobileVoteOpenChange: (open: boolean) => void;
}

export function ReviewWorkspaceDecisionPanel({
  currentVoteChoice,
  currentVoted,
  handleAIDraft,
  handleVoteSelect,
  handleVoteSubmit,
  intelContent,
  isDraftingRationale,
  isVoteProcessing,
  proposalTitle,
  rationaleCitations,
  rationaleText,
  selectedVote,
  setRationaleText,
  votePhase,
  voterId,
  voterRole,
}: SharedDecisionPanelProps) {
  return (
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
      proposalTitle={proposalTitle}
      voterId={voterId}
      voterRole={voterRole}
      rationaleCitations={rationaleCitations}
      intelContent={intelContent}
    />
  );
}

export function ReviewWorkspaceMobileDecisionTray({
  currentVoteChoice,
  currentVoted,
  handleAIDraft,
  handleMobileVoteSelect,
  handleVoteSelect,
  handleVoteSubmit,
  isDraftingRationale,
  isVoteProcessing,
  mobileVoteOpen,
  onMobileVoteOpenChange,
  proposalTitle,
  rationaleCitations,
  rationaleText,
  selectedVote,
  setRationaleText,
  votePhase,
  voterId,
  voterRole,
}: ReviewWorkspaceMobileDecisionTrayProps) {
  return (
    <>
      <MobileVoteBar
        onVoteSelect={handleMobileVoteSelect}
        hasVoted={currentVoted}
        currentVote={selectedVote}
      />

      <Sheet open={mobileVoteOpen} onOpenChange={onMobileVoteOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto lg:hidden">
          <SheetHeader>
            <SheetTitle className="text-sm">Your Decision</SheetTitle>
            <SheetDescription className="sr-only">
              Review your vote selection and rationale before submitting it for {proposalTitle}.
            </SheetDescription>
          </SheetHeader>
          <ReviewWorkspaceDecisionPanel
            currentVoteChoice={currentVoteChoice}
            currentVoted={currentVoted}
            handleAIDraft={handleAIDraft}
            handleVoteSelect={handleVoteSelect}
            handleVoteSubmit={handleVoteSubmit}
            isDraftingRationale={isDraftingRationale}
            isVoteProcessing={isVoteProcessing}
            proposalTitle={proposalTitle}
            rationaleCitations={rationaleCitations}
            rationaleText={rationaleText}
            selectedVote={selectedVote}
            setRationaleText={setRationaleText}
            votePhase={votePhase}
            voterId={voterId}
            voterRole={voterRole}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
