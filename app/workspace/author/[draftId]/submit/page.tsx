'use client';

export const dynamic = 'force-dynamic';

/**
 * Submission Ceremony Page — full-page multi-step governance action submission.
 *
 * Replaces the compact modal with a deliberate, ceremony-grade experience
 * proportional to the 100,000 ADA commitment. Left panel shows the journey
 * summary; right panel progresses through submission steps.
 *
 * Wrapped in <FeatureGate flag="governance_action_submission">.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';
import { FeatureGate } from '@/components/FeatureGate';
import { useDraft } from '@/hooks/useDrafts';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import { useTeam } from '@/hooks/useTeam';
import { useGovernanceAction } from '@/hooks/useGovernanceAction';
import { computeConfidence } from '@/lib/workspace/confidence';
import type { GovernanceActionTarget } from '@/lib/workspace/types';
import { JourneySummary } from '@/components/workspace/author/submission/JourneySummary';
import { FinancialSimulation } from '@/components/workspace/author/submission/FinancialSimulation';
import { MetadataPreview } from '@/components/workspace/author/submission/MetadataPreview';

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
      <Shield className="h-4 w-4 text-[var(--compass-teal)]" />
      <span className="font-medium text-foreground">
        Step {current + 1} of {total}
      </span>
      <span className="mx-1">—</span>
      <span>{labels[current]}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component (inside FeatureGate)
// ---------------------------------------------------------------------------

function SubmissionPageInner() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;

  // Data fetching
  const { data: draftData, isLoading: draftLoading } = useDraft(draftId);
  const { data: reviewsData } = useDraftReviews(draftId);
  const { data: teamData } = useTeam(draftId);

  // Governance action hook
  const { phase, startSubmission } = useGovernanceAction();

  // Step wizard state
  const [currentStep, setCurrentStep] = useState(0);

  const draft = draftData?.draft ?? null;
  const versions = draftData?.versions ?? [];

  // Redirect if draft not in final_comment status
  useEffect(() => {
    if (
      !draftLoading &&
      draft &&
      draft.status !== 'final_comment' &&
      draft.status !== 'submitted'
    ) {
      router.replace(`/workspace/author/${draftId}`);
    }
  }, [draft, draftLoading, draftId, router]);

  // Trigger preflight on mount
  useEffect(() => {
    if (!draft || phase.status !== 'idle') return;
    const target: GovernanceActionTarget = {
      type: draft.proposalType,
      anchorUrl: '',
      anchorHash: '',
    };
    startSubmission(target);
  }, [draft, phase.status, startSubmission]);

  // Compute review summary
  const reviewSummary = useMemo(() => {
    if (!reviewsData) return { total: 0, nonStale: 0, averageScore: null, allAddressed: false };

    const { reviews, responsesByReview, nonStaleReviewCount } = reviewsData;
    const total = reviews.length;
    const nonStale = nonStaleReviewCount;

    // Average across all review dimensions
    const scores = reviews
      .map((r) => {
        const dims = [
          r.impactScore,
          r.feasibilityScore,
          r.constitutionalScore,
          r.valueScore,
        ].filter((s): s is number => s !== null);
        return dims.length > 0 ? dims.reduce((a, b) => a + b, 0) / dims.length : null;
      })
      .filter((s): s is number => s !== null);

    const averageScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    // Check if all reviews have responses
    const allAddressed = reviews.every((r) => {
      const responses = responsesByReview[r.id] ?? [];
      return responses.length > 0;
    });

    return { total, nonStale, averageScore, allAddressed };
  }, [reviewsData]);

  // Compute confidence
  const confidence = useMemo(() => {
    if (!draft) {
      return computeConfidence({
        totalReviews: 0,
        nonStaleReviews: 0,
        averageScore: null,
        respondedCount: 0,
        totalReviewsToRespond: 0,
        constitutionalCheck: null,
        fieldsComplete: 0,
      });
    }

    const fieldsComplete = [draft.title, draft.abstract, draft.motivation, draft.rationale].filter(
      (f) => f && f.trim().length > 0,
    ).length;

    const respondedCount = reviewsData
      ? reviewsData.reviews.filter((r) => (reviewsData.responsesByReview[r.id] ?? []).length > 0)
          .length
      : 0;

    return computeConfidence({
      totalReviews: reviewSummary.total,
      nonStaleReviews: reviewSummary.nonStale,
      averageScore: reviewSummary.averageScore,
      respondedCount,
      totalReviewsToRespond: reviewSummary.total,
      constitutionalCheck: draft.lastConstitutionalCheck?.score ?? null,
      fieldsComplete,
    });
  }, [draft, reviewsData, reviewSummary]);

  // Team members
  const teamMembers = useMemo(() => {
    if (!teamData?.members) return undefined;
    return teamData.members.map((m) => ({
      stakeAddress: m.stakeAddress,
      role: m.role,
    }));
  }, [teamData]);

  // Has team?
  const hasTeam = teamMembers && teamMembers.length > 1;

  // Step configuration
  // Steps: financial, metadata, (team if exists - not built yet), confirm (not built yet)
  // For Session 1A we build steps 1 and 2 only
  const stepLabels = useMemo(() => {
    const labels = ['Financial Impact', 'Metadata Preview'];
    if (hasTeam) labels.push('Team Sign-Off');
    labels.push('Final Confirmation');
    return labels;
  }, [hasTeam]);

  const totalSteps = stepLabels.length;

  // Navigation
  const handleNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  // Loading state
  if (draftLoading || !draft) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--compass-teal)] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Preflight data
  const preflight = phase.status === 'confirming' ? phase.preflight : null;
  const preflightLoading = phase.status === 'idle' || phase.status === 'preflight';

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href={`/workspace/author/${draftId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to editor
          </Link>
          <h1 className="text-xl font-display font-semibold text-foreground">
            Submit: {draft.title || 'Untitled Proposal'}
          </h1>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left panel: Journey Summary (~35%) */}
          <div className="lg:w-[35%] shrink-0">
            <div className="lg:sticky lg:top-6">
              <JourneySummary
                draft={draft}
                reviews={reviewSummary}
                confidence={confidence}
                versionCount={versions.length}
                teamMembers={teamMembers}
              />
            </div>
          </div>

          {/* Right panel: Submission Steps (~65%) */}
          <div className="flex-1 min-w-0">
            <StepIndicator current={currentStep} total={totalSteps} labels={stepLabels} />

            {currentStep === 0 && (
              <FinancialSimulation
                preflight={preflight}
                proposalType={draft.proposalType}
                isLoading={preflightLoading}
                onContinue={handleNext}
                onBack={() => router.push(`/workspace/author/${draftId}`)}
              />
            )}

            {currentStep === 1 && (
              <MetadataPreview draft={draft} onContinue={handleNext} onBack={handleBack} />
            )}

            {/* Steps 2+ (Team Sign-Off, Final Confirmation) — built in Session 1B */}
            {currentStep >= 2 && (
              <div className="rounded-lg border border-border bg-card p-8 text-center space-y-4">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
                <h2 className="text-lg font-display font-semibold text-foreground">
                  {stepLabels[currentStep]}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  This step will be available in the next update. Use the back button to return.
                </p>
                <button
                  onClick={handleBack}
                  className="text-sm text-[var(--compass-teal)] hover:underline"
                >
                  Go back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported page (wrapped in FeatureGate)
// ---------------------------------------------------------------------------

export default function SubmissionCeremonyPage() {
  return (
    <FeatureGate flag="governance_action_submission">
      <SubmissionPageInner />
    </FeatureGate>
  );
}
