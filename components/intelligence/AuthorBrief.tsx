'use client';

/**
 * AuthorBrief — stage-driven scrollable intelligence brief for proposal authors.
 *
 * Reads the draft's lifecycle stage, looks up the section registry, and renders
 * appropriate sections via BriefShell. Replaces the empty Intel tab placeholder.
 */

import { useEffect, useMemo } from 'react';
import { posthog } from '@/lib/posthog';
import { BriefShell, type SectionConfig } from './BriefShell';
import { getAuthorSections } from '@/lib/workspace/intelligence/registry';
import { ConstitutionalSection } from './sections/ConstitutionalSection';
import { ReadinessSection } from './sections/ReadinessSection';
import { SimilarProposalsSection } from './sections/SimilarProposalsSection';
import { RiskRegisterSection } from './sections/RiskRegisterSection';
import { ReviewSummarySection } from './sections/ReviewSummarySection';
import { FeedbackTriageBoard } from './sections/FeedbackTriageBoard';
import { SubmissionChecklist } from './sections/SubmissionChecklist';
import { MonitorEmbed } from './sections/MonitorEmbed';
import type { ProposalDraft, DraftStatus, ConstitutionalCheckResult } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuthorBriefProps {
  draft: ProposalDraft;
  draftId: string;
  /** From useAmbientConstitutionalCheck — pass cached result to avoid re-running AI */
  constitutionalResult?: ConstitutionalCheckResult | null;
  /** Whether the current user can edit this draft (owner/lead/editor) */
  canEdit?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuthorBrief({ draft, draftId, constitutionalResult, canEdit }: AuthorBriefProps) {
  const stage = (draft.status ?? 'draft') as DraftStatus;
  const sections = useMemo(() => getAuthorSections(stage), [stage]);

  // Track brief view
  useEffect(() => {
    posthog.capture('intelligence_brief_viewed', { stage, side: 'author' });
  }, [stage]);

  // Derive content completeness
  const fieldsComplete = useMemo(() => {
    let count = 0;
    if (draft.title?.trim()) count++;
    if (draft.abstract?.trim()) count++;
    if (draft.motivation?.trim()) count++;
    if (draft.rationale?.trim()) count++;
    return count;
  }, [draft.title, draft.abstract, draft.motivation, draft.rationale]);

  const proposalContent = useMemo(
    () => ({
      title: draft.title ?? '',
      abstract: draft.abstract ?? '',
      motivation: draft.motivation ?? '',
      rationale: draft.rationale ?? '',
    }),
    [draft.title, draft.abstract, draft.motivation, draft.rationale],
  );

  const renderSection = (config: SectionConfig) => {
    switch (config.id) {
      case 'constitutional':
        return (
          <ConstitutionalSection
            proposalContent={proposalContent}
            proposalType={draft.proposalType}
            cachedResult={constitutionalResult}
          />
        );
      case 'readiness':
        return (
          <ReadinessSection
            draftId={draftId}
            constitutionalCheck={constitutionalResult?.score ?? null}
            fieldsComplete={fieldsComplete}
          />
        );
      case 'similar-proposals':
        return (
          <SimilarProposalsSection
            proposalContent={proposalContent}
            proposalType={draft.proposalType}
          />
        );
      case 'risk-register':
        return (
          <RiskRegisterSection
            constitutionalFlags={constitutionalResult?.flags}
            withdrawalAmount={
              (draft.typeSpecific as Record<string, unknown> | null)?.withdrawalAmount as
                | number
                | undefined
            }
            proposalType={draft.proposalType}
          />
        );
      case 'review-summary':
        return <ReviewSummarySection draftId={draftId} proposalTxHash={draft.submittedTxHash} />;
      case 'feedback-triage':
        return (
          <FeedbackTriageBoard
            proposalTxHash={draft.submittedTxHash}
            proposalIndex={0}
            canAddress={canEdit ?? false}
          />
        );
      case 'submission-checklist':
        return (
          <SubmissionChecklist
            draftId={draftId}
            constitutionalScore={constitutionalResult?.score ?? null}
            fieldsComplete={fieldsComplete}
            proposalTxHash={draft.submittedTxHash}
          />
        );
      case 'monitor-embed':
        return draft.submittedTxHash ? (
          <MonitorEmbed txHash={draft.submittedTxHash} proposalIndex={0} />
        ) : (
          <p className="text-xs text-muted-foreground/60 py-2">
            Monitoring available after submission
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <BriefShell
      key={stage}
      sections={sections}
      renderSection={renderSection}
      stage={stage}
      className="p-2"
    />
  );
}
