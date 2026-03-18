/**
 * Amendment-specific types for the constitutional amendment editor.
 *
 * These types extend the proposal workspace to support tracked changes
 * against the Cardano Constitution, section-level community sentiment,
 * amendment genealogy, and AI-surfaced bridging statements.
 */

/** A single tracked change to a constitution article/section. */
export interface AmendmentChange {
  /** Unique identifier for this change (uuid). */
  id: string;
  /** Constitution node ID this change targets (e.g. 'article-2-s3'). */
  articleId: string;
  /** Exact substring from the current constitution text being replaced. */
  originalText: string;
  /** Replacement text proposed by the author. */
  proposedText: string;
  /** Author's justification for this specific change. */
  explanation: string;
  /** Current status of this change. */
  status: 'pending' | 'accepted' | 'rejected';
  /** Stake address of who created this change. */
  createdBy?: string;
  /** ISO timestamp of creation. */
  createdAt?: string;
}

/**
 * Stored in proposal_drafts.type_specific for NewConstitution proposals
 * when the amendment editor is used.
 */
export interface AmendmentTypeSpecific {
  /** Which constitution version this amendment targets. */
  constitutionVersion: string;
  /** All tracked changes to the constitution. */
  amendmentChanges: AmendmentChange[];
  /** AI-generated motivation text (from amendment-translator skill). */
  generatedMotivation?: string;
  /** AI-generated rationale text (from amendment-translator skill). */
  generatedRationale?: string;
}

/** A single event in the genealogy of an amendment change. */
export interface GenealogyEntry {
  /** The amendment change this event relates to. */
  changeId: string;
  /** What happened. */
  action: 'created' | 'accepted' | 'rejected' | 'modified' | 'merged';
  /** Who performed the action (stake address). */
  actionBy: string;
  /** Optional explanation for the action. */
  actionReason?: string;
  /** Where this action originated. */
  sourceType?: 'author' | 'reviewer' | 'ai';
  /** ISO timestamp. */
  timestamp: string;
}

/** Aggregated sentiment for a single constitution section. */
export interface SectionSentiment {
  sectionId: string;
  support: number;
  oppose: number;
  neutral: number;
  total: number;
}

/** An AI-surfaced statement that bridges opposing reviewer perspectives. */
export interface BridgingStatement {
  id: string;
  /** The consensus-building statement text. */
  statement: string;
  /** Why this statement bridges perspectives. */
  rationale: string;
  /** Constitution section IDs this statement is relevant to. */
  relevantSections: string[];
  /** Percentage of reviewers who would likely agree. */
  supportPercentage: number;
}

/** Output from the amendment-translator AI skill. */
export interface AmendmentTranslatorOutput {
  amendments: AmendmentChange[];
  summary: string;
  motivation: string;
  rationale: string;
}

/** Output from the amendment-conflict-check AI skill. */
export interface AmendmentConflict {
  amendedArticle: string;
  conflictingArticle: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface AmendmentConflictCheckOutput {
  conflicts: AmendmentConflict[];
  summary: string;
}

/** Output from the amendment-bridge AI skill. */
export interface AmendmentBridgeOutput {
  bridges: BridgingStatement[];
  consensusAreas: string[];
  divisionAreas: string[];
}
