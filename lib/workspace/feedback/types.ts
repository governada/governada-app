/**
 * Contract D: Feedback Theme Structure
 *
 * Types for the AI-consolidated community feedback system.
 * Raw annotations are clustered into themes with endorsement counts,
 * key voices, and novel contributions.
 */

/** A consolidated feedback theme (distilled from raw annotations) */
export interface FeedbackTheme {
  id: string;
  /** AI-distilled summary of what reviewers are saying */
  summary: string;
  /** Theme category */
  category: 'concern' | 'support' | 'question' | 'suggestion';
  /** Number of reviewers who endorsed this theme */
  endorsementCount: number;
  /** Most representative/articulate comments */
  keyVoices: Array<{
    reviewerId: string;
    text: string;
    timestamp: string;
  }>;
  /** Genuinely novel additions that expand on the theme */
  novelContributions: Array<{
    reviewerId: string;
    text: string;
    timestamp: string;
  }>;
  /** Proposer's response to this theme */
  addressedStatus: 'open' | 'addressed' | 'deferred' | 'dismissed';
  /** Proposer's reason (for deferred/dismissed) */
  addressedReason?: string;
  /** IDs of raw annotations that form this theme */
  linkedAnnotationIds: string[];
}

/** An individual endorsement on a feedback theme */
export interface ThemeEndorsement {
  themeId: string;
  reviewerUserId: string;
  /** Optional additional context from the endorsing reviewer */
  additionalContext?: string;
  /** Whether the AI determined this adds genuinely new information */
  isNovel: boolean;
}

/** Result of novelty classification for a new annotation */
export interface NoveltyClassification {
  /** Whether the annotation is genuinely novel */
  isNovel: boolean;
  /** If not novel, which existing theme it overlaps with */
  overlappingThemeId?: string;
  /** AI confidence in the classification (0-1) */
  confidence: number;
}
