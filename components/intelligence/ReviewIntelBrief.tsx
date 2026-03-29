'use client';

/**
 * ReviewIntelBrief — scrollable intelligence brief for proposal reviewers.
 *
 * Replaces the tabbed IntelPanel with a continuous, scrollable document.
 * Sections are ordered by the review brief registry with role-adaptive defaults.
 *
 * Phase 5B: Orchestrates cache loading from the pre-computation pipeline.
 * Cached sections render instantly; uncached fall back to on-demand AI.
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
import { PassagePrediction } from './sections/PassagePrediction';
import { CCExpressPanel } from '@/components/workspace/review/CCExpressPanel';
import { useIntelligenceCache } from '@/hooks/useIntelligenceCache';

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
  /** Callback when CC member accepts constitutional assessment (populates rationale) */
  onCCAccept?: (rationaleText: string) => void;
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
  onCCAccept,
}: ReviewIntelBriefProps) {
  const sections = useMemo(() => getReviewSections(voterRole), [voterRole]);

  // Pre-computed intelligence cache
  const { data: cache } = useIntelligenceCache(proposalId, proposalIndex);

  useEffect(() => {
    posthog.capture('intelligence_brief_viewed', { stage: 'review', side: 'review', voterRole });
  }, [voterRole]);

  // Track cache hits/misses for analytics
  useEffect(() => {
    if (cache) {
      if (cache.constitutional)
        posthog.capture('intelligence_cache_hit', { section: 'constitutional' });
      else posthog.capture('intelligence_cache_miss', { section: 'constitutional' });
      if (cache.key_questions)
        posthog.capture('intelligence_cache_hit', { section: 'key_questions' });
      else posthog.capture('intelligence_cache_miss', { section: 'key_questions' });
    }
  }, [cache]);

  const renderSection = (config: SectionConfig) => {
    switch (config.id) {
      case 'executive-summary':
        return (
          <ExecutiveSummary
            summary={aiSummary ?? null}
            proposalContent={proposalContent}
            proposalType={proposalType}
            interBodyVotes={interBodyVotes}
            withdrawalAmount={withdrawalAmount ?? undefined}
          />
        );
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
      case 'passage-prediction':
        return <PassagePrediction prediction={cache?.passage_prediction ?? null} />;
      case 'constitutional':
        return (
          <ConstitutionalSection
            proposalContent={proposalContent}
            proposalType={proposalType}
            cachedResult={
              cache?.constitutional
                ? {
                    flags: cache.constitutional.flags,
                    score: cache.constitutional.score,
                    checkedAt: cache.constitutional.cachedAt,
                    model: 'precomputed',
                  }
                : undefined
            }
          />
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
          <KeyQuestionsSection
            proposalContent={proposalContent}
            proposalType={proposalType}
            cachedQuestions={cache?.key_questions?.questionsToConsider ?? null}
            cachedPrecedentSummary={cache?.key_questions?.precedentSummary ?? null}
          />
        );
      case 'cc-express':
        return (
          <CCExpressPanel
            proposalContent={proposalContent}
            proposalType={proposalType}
            onAcceptAll={(text) => onCCAccept?.(text)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <BriefShell sections={sections} renderSection={renderSection} stage="review" className="p-2" />
  );
}
