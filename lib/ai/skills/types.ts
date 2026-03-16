/**
 * AI Skills type definitions.
 *
 * A skill is a governance-specific AI workflow that takes structured input,
 * produces structured output, and records invocation for provenance tracking.
 *
 * Skills produce **thinking frameworks** (structured questions + relevant data),
 * not finished conclusions. The personal context injection ensures outputs
 * diverge per user rather than converging on generic analysis.
 */

import type { ZodType } from 'zod';
import type { PersonalContext } from '@/lib/ai/context';

/** Context provided to every skill invocation */
export interface SkillContext {
  /** The invoking user's personal governance context */
  personalContext: PersonalContext;
  /** Formatted personal context string for prompt injection */
  personalContextStr: string;
  /** Whether the user is using BYOK */
  keySource: 'platform' | 'byok';
}

/** Definition of an AI skill */
export interface SkillDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique skill identifier (e.g., 'constitutional-check', 'research-precedent') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping: authoring | review | shared */
  category: 'authoring' | 'review' | 'shared';
  /** Zod schema for validating input */
  inputSchema: ZodType<TInput>;
  /** Build the system prompt (can use personal context) */
  systemPrompt: string | ((ctx: SkillContext) => string);
  /** Build the user prompt from validated input */
  buildPrompt: (input: TInput, ctx: SkillContext) => string;
  /** Parse the raw AI text response into structured output */
  parseOutput: (raw: string) => TOutput;
  /** Model preference: FAST for quick analysis, DRAFT for longer generation */
  model?: 'FAST' | 'DRAFT';
  /** Max tokens for the response */
  maxTokens?: number;
  /** Whether this skill requires authentication */
  requiresAuth?: boolean;
}

/** Result of invoking a skill */
export interface SkillResult<T = unknown> {
  /** The structured output from the skill */
  output: T;
  /** Provenance metadata */
  provenance: {
    skillName: string;
    model: string;
    keySource: 'platform' | 'byok';
    tokensUsed?: number;
    executedAt: string;
  };
}

/** Skill invocation request (from the API) */
export interface SkillInvocationRequest {
  /** Skill name to invoke */
  skill: string;
  /** Input data (validated against the skill's inputSchema) */
  input: Record<string, unknown>;
}
