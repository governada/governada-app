/**
 * Unified AI skill execution endpoint.
 *
 * POST /api/ai/skill
 * Body: { skill: string, input: Record<string, unknown> }
 *
 * Validates input against the skill's schema, injects personal context,
 * executes via the AI provider, logs provenance, and returns structured output.
 *
 * When `embedding_ai_quality` flag is ON and a draftId is provided,
 * embeds the draft before and after skill execution to compute AI influence.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createAIProvider } from '@/lib/ai/provider';
import { assemblePersonalContext, formatPersonalContext } from '@/lib/ai/context';
import { getSkill, loadBuiltinSkills } from '@/lib/ai/skills/registry';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import type { SkillContext } from '@/lib/ai/skills/types';

export const dynamic = 'force-dynamic';

const SkillRequestSchema = z.object({
  skill: z.string().min(1, 'skill name is required'),
  input: z.record(z.string(), z.unknown()),
  /** Optional: proposal context for provenance logging */
  proposalTxHash: z.string().optional(),
  proposalIndex: z.number().optional(),
  draftId: z.string().optional(),
});

/**
 * Embed the current draft content and return the embedding vector.
 * Returns null if the draft is not found or embedding fails.
 */
async function embedDraft(draftId: string): Promise<number[] | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase');
    const { composeProposalDraft } = await import('@/lib/embeddings/compose');
    const { generateEmbedding } = await import('@/lib/embeddings/provider');

    const supabase = getSupabaseAdmin();
    const { data: draft } = await supabase
      .from('proposal_drafts')
      .select('id, title, abstract, motivation, rationale')
      .eq('id', draftId)
      .single();

    if (!draft) return null;

    const composed = composeProposalDraft({
      draft_id: draft.id,
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
    });

    if (composed.text.length < 20) return null;

    return await generateEmbedding(composed.text);
  } catch (err) {
    logger.warn('[ai-quality] Failed to embed draft', { draftId, error: err });
    return null;
  }
}

/**
 * Post-skill: compute AI influence, store the post-embedding, and update the draft score.
 * Runs asynchronously — errors are logged but do not block the response.
 */
async function computeAndStoreAiInfluence(draftId: string, preEmbedding: number[]): Promise<void> {
  try {
    const postEmbedding = await embedDraft(draftId);
    if (!postEmbedding) return;

    const { computeAiInfluence } = await import('@/lib/workspace/aiQuality');
    const influence = computeAiInfluence(preEmbedding, postEmbedding);

    // Store post-embedding in the embeddings table
    const { getSupabaseAdmin } = await import('@/lib/supabase');
    const supabase = getSupabaseAdmin();

    // Upsert the embedding (delete + insert pattern from generate.ts)
    await supabase
      .from('embeddings')
      .delete()
      .eq('entity_type', 'proposal_draft')
      .eq('entity_id', draftId)
      .is('secondary_id', null);

    const { createHash } = await import('crypto');
    const { composeProposalDraft } = await import('@/lib/embeddings/compose');
    const { data: draft } = await supabase
      .from('proposal_drafts')
      .select('id, title, abstract, motivation, rationale')
      .eq('id', draftId)
      .single();

    if (draft) {
      const composed = composeProposalDraft({
        draft_id: draft.id,
        title: draft.title,
        abstract: draft.abstract,
        motivation: draft.motivation,
        rationale: draft.rationale,
      });

      await supabase.from('embeddings').insert({
        entity_type: 'proposal_draft',
        entity_id: draftId,
        secondary_id: null,
        embedding: JSON.stringify(postEmbedding),
        content_hash: createHash('sha256').update(composed.text).digest('hex'),
        model: 'text-embedding-3-large',
        dimensions: 3072,
        metadata: { source: 'ai_skill_lifecycle' },
        updated_at: new Date().toISOString(),
      });
    }

    // High-water mark: only update if new score > existing
    const { data: existingDraft } = await supabase
      .from('proposal_drafts')
      .select('ai_influence_score')
      .eq('id', draftId)
      .single();

    if (
      existingDraft &&
      (existingDraft.ai_influence_score === null || influence > existingDraft.ai_influence_score)
    ) {
      await supabase
        .from('proposal_drafts')
        .update({ ai_influence_score: influence })
        .eq('id', draftId);
    }

    logger.info('[ai-quality] AI influence computed', {
      draftId,
      influence: Math.round(influence * 10) / 10,
    });
  } catch (err) {
    logger.warn('[ai-quality] Failed to compute AI influence', { draftId, error: err });
  }
}

export const POST = withRouteHandler(
  async (request, ctx) => {
    // Check feature flag
    const enabled = await getFeatureFlag('ai_skills_engine');
    if (!enabled) {
      return NextResponse.json({ error: 'AI skills engine is not enabled' }, { status: 403 });
    }

    // Load skills registry
    await loadBuiltinSkills();

    // Parse request
    const body = await request.json();
    const parsed = SkillRequestSchema.parse(body);

    // Find skill
    const skill = getSkill(parsed.skill);
    if (!skill) {
      return NextResponse.json({ error: `Unknown skill: ${parsed.skill}` }, { status: 404 });
    }

    // Validate input against skill's schema
    const validatedInput = skill.inputSchema.parse(parsed.input);

    // --- AI Quality: pre-skill embedding (non-blocking) ---
    let preEmbedding: number[] | null = null;
    const aiQualityEnabled = parsed.draftId
      ? await getFeatureFlag('embedding_ai_quality', false)
      : false;

    if (aiQualityEnabled && parsed.draftId) {
      preEmbedding = await embedDraft(parsed.draftId);
    }

    // Assemble personal context
    const stakeAddress = ctx.wallet ?? '';
    const role = 'drep' as const; // TODO: detect from segment
    const personalContext = await assemblePersonalContext(stakeAddress, role);
    const personalContextStr = formatPersonalContext(personalContext);

    const skillContext: SkillContext = {
      personalContext,
      personalContextStr,
      keySource: 'platform',
    };

    // Build prompts
    const systemPrompt =
      typeof skill.systemPrompt === 'function'
        ? skill.systemPrompt(skillContext)
        : skill.systemPrompt;
    const userPrompt = skill.buildPrompt(validatedInput, skillContext);

    // Execute via provider
    const ai = await createAIProvider({
      userId: ctx.userId,
      stakeAddress,
    });
    skillContext.keySource = ai.keySource;

    const result = await ai.generateText(userPrompt, {
      system: systemPrompt,
      model: skill.model ?? 'FAST',
      maxTokens: skill.maxTokens ?? 1024,
    });

    if (!result.data) {
      return NextResponse.json(
        { error: 'AI generation failed. Please try again.' },
        { status: 503 },
      );
    }

    // Parse output
    let output = skill.parseOutput(result.data);

    // Optional validation pass: run a lightweight check to filter hallucinated flags
    if (skill.validationPass) {
      try {
        const valPrompt = skill.validationPass.buildPrompt(validatedInput, output);
        const valResult = await ai.generateText(valPrompt, {
          system: skill.validationPass.systemPrompt,
          model: 'FAST',
          maxTokens: skill.validationPass.maxTokens ?? 1024,
        });
        if (valResult.data) {
          output = skill.validationPass.parseValidation(valResult.data, output);
        }
      } catch (err) {
        // Validation pass is best-effort — if it fails, use the original output
        logger.warn('[skill] Validation pass failed, using original output', {
          skill: parsed.skill,
          error: err,
        });
      }
    }

    // Log provenance
    await ai.logActivity({
      skillName: parsed.skill,
      proposalTxHash: parsed.proposalTxHash,
      proposalIndex: parsed.proposalIndex,
      draftId: parsed.draftId,
      inputSummary: JSON.stringify(validatedInput).slice(0, 200),
    });

    // --- AI Quality: post-skill embedding + influence score (fire-and-forget) ---
    if (aiQualityEnabled && parsed.draftId && preEmbedding) {
      // Fire and forget — do not await, do not block the response
      void computeAndStoreAiInfluence(parsed.draftId, preEmbedding);
    }

    return NextResponse.json({
      output,
      provenance: {
        skillName: parsed.skill,
        model: result.provenance.model,
        keySource: result.provenance.keySource,
        tokensUsed: result.provenance.tokensUsed,
        executedAt: new Date().toISOString(),
      },
    });
  },
  { auth: 'optional', rateLimit: { max: 20, window: 60 } },
);
