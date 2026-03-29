'use client';

import { useMemo } from 'react';
import type {
  ProposalDraft,
  AuthorDecisionTableItem,
  AuthorTablePhase,
  ConstitutionalRiskLevel,
} from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function mapPhase(status: ProposalDraft['status']): AuthorTablePhase {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'community_review':
    case 'response_revision':
    case 'final_comment':
      return 'in_review';
    case 'submitted':
      return 'on_chain';
    case 'archived':
      return 'archived';
    default:
      return 'draft';
  }
}

function mapConstitutionalRisk(
  check: ProposalDraft['lastConstitutionalCheck'],
): ConstitutionalRiskLevel | null {
  if (!check) return null;
  const { score, flags } = check;
  if (score === 'fail') return 'HIGH';
  if (score === 'warning') {
    const hasCritical = flags.some((f) => f.severity === 'critical');
    return hasCritical ? 'HIGH' : 'MEDIUM';
  }
  return flags.length > 0 ? 'LOW' : 'NONE';
}

function computeCompleteness(draft: ProposalDraft): number {
  const fields = [draft.title, draft.abstract, draft.motivation, draft.rationale];
  const filledCount = fields.filter((f) => f && f.trim().length > 10).length;
  return Math.round((filledCount / fields.length) * 100);
}

function computeNextAction(draft: ProposalDraft, phase: AuthorTablePhase): string {
  // Constitutional failure is highest priority
  if (draft.lastConstitutionalCheck?.score === 'fail') {
    return 'Fix constitutional issue';
  }

  switch (phase) {
    case 'draft': {
      const completeness = computeCompleteness(draft);
      if (completeness < 100) return 'Continue drafting';
      if (!draft.lastConstitutionalCheck) return 'Run constitutional check';
      if (draft.lastConstitutionalCheck.score === 'warning')
        return 'Review constitutional warnings';
      return 'Submit for review';
    }
    case 'in_review':
      return 'Address feedback';
    case 'on_chain':
      return 'Monitor voting';
    case 'archived':
      return 'Archived';
    default:
      return 'Continue drafting';
  }
}

function phaseDate(draft: ProposalDraft, phase: AuthorTablePhase): string | null | undefined {
  switch (phase) {
    case 'in_review':
      return draft.communityReviewStartedAt;
    case 'on_chain':
      return draft.submittedAt;
    default:
      return draft.updatedAt;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuthorTableItems(
  draftsData: { drafts: ProposalDraft[] } | undefined,
): AuthorDecisionTableItem[] {
  return useMemo(() => {
    const drafts = draftsData?.drafts ?? [];

    const items: AuthorDecisionTableItem[] = drafts.map((draft) => {
      const phase = mapPhase(draft.status);
      return {
        id: draft.id,
        phase,
        title: draft.title || 'Untitled Draft',
        proposalType: draft.proposalType,
        constitutionalRisk: mapConstitutionalRisk(draft.lastConstitutionalCheck),
        fieldCompleteness: computeCompleteness(draft),
        feedbackCount: null, // TODO: wire when review counts are available on draft
        daysInPhase: daysSince(phaseDate(draft, phase)),
        updatedAt: draft.updatedAt,
        nextAction: computeNextAction(draft, phase),
        href: `/workspace/author/${draft.id}`,
      };
    });

    // Sort: drafts first, then in_review, then on_chain, then archived
    const phaseOrder: Record<AuthorTablePhase, number> = {
      draft: 0,
      in_review: 1,
      on_chain: 2,
      archived: 3,
    };
    items.sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);

    return items;
  }, [draftsData]);
}
