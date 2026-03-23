/**
 * Methodology metadata & AI ensemble configuration.
 *
 * Constants referenced by the methodology page and provenance tracking.
 * Centralizes version info and AI model details so they stay in sync
 * across the scoring engine, methodology UI, and API responses.
 */

export const METHODOLOGY_VERSION = '3.2.1';
export const METHODOLOGY_DATE = '2026-03-23';

/**
 * AI models used across the scoring and analysis pipeline.
 * Each key identifies a role in the ensemble; values identify the
 * model and provider for provenance tracking.
 */
export const AI_MODELS_USED = {
  /** Primary scoring model for rationale quality assessment */
  primaryScoring: 'Claude Sonnet 4.6 (Anthropic)',
  /** Secondary scoring model for ensemble divergence detection */
  secondaryScoring: 'GPT-4o (OpenAI)',
  /** CC constitutional analysis — higher-capability model for complex legal reasoning */
  ccAnalysis: 'Claude Opus 4.6 (Anthropic)',
  /** Lightweight validation pass for hallucination filtering */
  validationPass: 'Claude Haiku 4.5 (Anthropic)',
  /** Embedding model for semantic similarity and rationale diversity */
  embeddings: 'text-embedding-3-large (OpenAI)',
} as const;

/**
 * Ensemble scoring configuration.
 *
 * When primary and secondary models disagree by more than divergenceThreshold
 * points, the score is flagged for review and the weighted average is used
 * instead of the primary score alone.
 */
export const ENSEMBLE_CONFIG = {
  /** Score difference (0-100) that triggers divergence handling */
  divergenceThreshold: 15,
  /** Weight assigned to primary model score in the ensemble average */
  primaryWeight: 0.55,
  /** Weight assigned to secondary model score in the ensemble average */
  secondaryWeight: 0.45,
} as const;
