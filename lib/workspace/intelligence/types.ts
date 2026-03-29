/**
 * Intelligence Brief — type definitions for the stage-driven scrollable brief.
 *
 * The brief replaces the tabbed intelligence sidebar with a continuous,
 * scrollable document that transforms based on proposal lifecycle stage.
 */

import type { DraftStatus, ProposalDraft } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Section configuration
// ---------------------------------------------------------------------------

/** Unique identifier for each intelligence section. */
export type SectionId =
  // Author sections
  | 'constitutional'
  | 'readiness'
  | 'similar-proposals'
  | 'risk-register'
  | 'review-summary'
  | 'feedback-triage'
  | 'submission-checklist'
  | 'monitor-embed'
  // Review sections
  | 'executive-summary'
  | 'quick-assessment'
  | 'stakeholder-landscape'
  | 'proposer-profile'
  | 'key-questions'
  | 'cc-express'
  | 'passage-prediction';

/** Configuration for a single section in the brief. */
export interface SectionConfig {
  /** Unique section identifier */
  id: SectionId;
  /** Display title in the section header */
  title: string;
  /** Priority for ordering (lower = higher in the brief) */
  priority: number;
  /** Whether the section is expanded by default */
  defaultExpanded: boolean;
  /** Whether this section lazy-loads AI (shows "expand to load" prompt) */
  lazyAI?: boolean;
  /** Lucide icon name for the section header */
  icon: string;
}

// ---------------------------------------------------------------------------
// Brief context (data passed to all sections)
// ---------------------------------------------------------------------------

/** Shared context available to author brief sections. */
export interface AuthorBriefContext {
  draft: ProposalDraft;
  draftId: string;
}

/** Shared context available to review brief sections. */
export interface ReviewBriefContext {
  proposalId: string;
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
  voterRole: string;
}

// ---------------------------------------------------------------------------
// Stage type alias (re-export for convenience)
// ---------------------------------------------------------------------------

export type BriefStage = DraftStatus;
