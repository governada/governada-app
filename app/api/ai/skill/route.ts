/**
 * Unified AI skill execution endpoint.
 *
 * POST /api/ai/skill
 * Body: { skill: string, input: Record<string, unknown> }
 *
 * Validates input against the skill's schema, injects personal context,
 * executes via the AI provider, logs provenance, and returns structured output.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createAIProvider } from '@/lib/ai/provider';
import { assemblePersonalContext, formatPersonalContext } from '@/lib/ai/context';
import { getSkill, loadBuiltinSkills } from '@/lib/ai/skills/registry';
import { getFeatureFlag } from '@/lib/featureFlags';
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
    const output = skill.parseOutput(result.data);

    // Log provenance
    await ai.logActivity({
      skillName: parsed.skill,
      proposalTxHash: parsed.proposalTxHash,
      proposalIndex: parsed.proposalIndex,
      draftId: parsed.draftId,
      inputSummary: JSON.stringify(validatedInput).slice(0, 200),
    });

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
