'use client';

/**
 * ReviewIntelBrief — scrollable intelligence brief for proposal reviewers.
 *
 * Replaces the tabbed IntelPanel with a continuous, scrollable document.
 * Sections are ordered by the review brief registry with role-adaptive defaults.
 */

import { useEffect, useMemo } from 'react';
import { posthog } from '@/lib/posthog';
import { BriefShell, type SectionConfig } from './BriefShell';
import { getReviewSections } from '@/lib/workspace/intelligence/registry';
import { ExecutiveSummary } from './sections/ExecutiveSummary';
import { QuickAssessment } from './sections/QuickAssessment';
import { ConstitutionalSection } from './sections/ConstitutionalSection';
import { StakeholderLandscape } from './sections/StakeholderLandscape';
import { SimilarProposalsSection } from './sections/SimilarProposalsSection';
import { ProposerProfileSection } from './sections/ProposerProfileSection';
import { KeyQuestionsSection } from './sections/KeyQuestionsSection';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReviewIntelBriefProps {
  proposalId: string;
  proposalIndex: number;
  proposalType: string;
  proposalContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  interBodyVotes?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
  citizenSentiment?: {
    support: number;
    oppose: number;
    abstain: number;
    total: number;
  } | null;
  aiSummary?: string | null;
  withdrawalAmount?: number | null;
  treasuryTier?: string | null;
  epochsRemaining?: number | null;
  isUrgent?: boolean;
  voterRole: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewIntelBrief({
  proposalId,
  proposalIndex,
  proposalType,
  proposalContent,
  interBodyVotes,
  citizenSentiment,
  aiSummary,
  withdrawalAmount,
  treasuryTier,
  epochsRemaining,
  isUrgent,
  voterRole,
}: ReviewIntelBriefProps) {
  const sections = useMemo(() => getReviewSections(voterRole), [voterRole]);

  useEffect(() => {
    posthog.capture('intelligence_brief_viewed', { stage: 'review', side: 'review', voterRole });
  }, [voterRole]);

  const renderSection = (config: SectionConfig) => {
    switch (config.id) {
      case 'executive-summary':
        return <ExecutiveSummary summary={aiSummary ?? null} />;
      case 'quick-assessment':
        return (
          <QuickAssessment
            withdrawalAmount={withdrawalAmount}
            treasuryTier={treasuryTier}
            epochsRemaining={epochsRemaining}
            isUrgent={isUrgent}
            interBodyVotes={interBodyVotes}
          />
        );
      case 'constitutional':
        return (
          <ConstitutionalSection proposalContent={proposalContent} proposalType={proposalType} />
        );
      case 'stakeholder-landscape':
        return (
          <StakeholderLandscape
            interBodyVotes={interBodyVotes}
            citizenSentiment={citizenSentiment}
            proposalType={proposalType}
          />
        );
      case 'similar-proposals':
        return (
          <SimilarProposalsSection proposalContent={proposalContent} proposalType={proposalType} />
        );
      case 'proposer-profile':
        return <ProposerProfileSection proposalId={proposalId} proposalIndex={proposalIndex} />;
      case 'key-questions':
        return (
          <KeyQuestionsSection proposalContent={proposalContent} proposalType={proposalType} />
        );
      default:
        return null;
    }
  };

  return (
    <BriefShell sections={sections} renderSection={renderSection} stage="review" className="p-2" />
  );
}
