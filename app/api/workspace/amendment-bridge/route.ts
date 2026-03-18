/**
 * Amendment Bridge API — AI-generated bridging statements for amendment drafts.
 *
 * POST: gather section sentiments + draft reviews, invoke the amendment-bridge
 *       AI skill, and return bridging statements that synthesize opposing views.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { AmendmentBridgeSchema } from '@/lib/api/schemas/workspace';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { createAIProvider } from '@/lib/ai/provider';
import { assemblePersonalContext, formatPersonalContext } from '@/lib/ai/context';
import { logger } from '@/lib/logger';
import type { AmendmentBridgeOutput, SectionSentiment } from '@/lib/constitution/types';
import type { SkillContext } from '@/lib/ai/skills/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST — generate bridging statements
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request, ctx) => {
    // Feature flag check
    const enabled = await getFeatureFlag('ai_skills_engine');
    if (!enabled) {
      return NextResponse.json({ error: 'AI skills engine is not enabled' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = AmendmentBridgeSchema.parse(body);

    const admin = getSupabaseAdmin();

    // 1. Fetch section sentiments for this draft
    const { data: sentimentRows, error: sentErr } = await admin
      .from('amendment_section_sentiment')
      .select('section_id, sentiment, comment')
      .eq('draft_id', parsed.draftId);

    if (sentErr) {
      return NextResponse.json({ error: 'Failed to fetch sentiments' }, { status: 500 });
    }

    // Aggregate sentiments per section
    const sections: Record<string, SectionSentiment & { comments: string[] }> = {};
    for (const row of sentimentRows ?? []) {
      const sid = row.section_id as string;
      if (!sections[sid]) {
        sections[sid] = {
          sectionId: sid,
          support: 0,
          oppose: 0,
          neutral: 0,
          total: 0,
          comments: [],
        };
      }
      const s = row.sentiment as string;
      if (s === 'support') sections[sid].support++;
      else if (s === 'oppose') sections[sid].oppose++;
      else if (s === 'neutral') sections[sid].neutral++;
      sections[sid].total++;
      if (row.comment) sections[sid].comments.push(row.comment as string);
    }

    // 2. Fetch draft reviews for context
    const { data: reviews, error: revErr } = await admin
      .from('draft_reviews')
      .select('feedback_text, feedback_themes, impact_score, feasibility_score')
      .eq('draft_id', parsed.draftId)
      .limit(50);

    if (revErr) {
      logger.warn('[amendment-bridge] Failed to fetch reviews, continuing without', {
        draftId: parsed.draftId,
      });
    }

    // 3. Build the AI prompt
    const sentimentSummary = Object.values(sections)
      .map(
        (s) =>
          `Section ${s.sectionId}: ${s.support} support, ${s.oppose} oppose, ${s.neutral} neutral` +
          (s.comments.length > 0 ? `\n  Comments: ${s.comments.slice(0, 5).join(' | ')}` : ''),
      )
      .join('\n');

    const reviewSummary =
      reviews && reviews.length > 0
        ? reviews
            .slice(0, 20)
            .map(
              (r, i) =>
                `Review ${i + 1}: ${(r.feedback_text as string).slice(0, 300)}` +
                (r.feedback_themes
                  ? ` [themes: ${(r.feedback_themes as string[]).join(', ')}]`
                  : ''),
            )
            .join('\n')
        : 'No reviews available yet.';

    const systemPrompt = `You are a governance consensus analyst for the Cardano blockchain.
Your task is to find bridging statements that can unite opposing perspectives on proposed constitutional amendments.
A bridging statement is a formulation that acknowledges concerns from both sides and proposes common ground.

Output ONLY valid JSON matching this schema:
{
  "bridges": [
    {
      "id": "string (unique identifier)",
      "statement": "string (the consensus-building statement)",
      "rationale": "string (why this bridges perspectives)",
      "relevantSections": ["string (section IDs)"],
      "supportPercentage": number (0-100, estimated agreement)
    }
  ],
  "consensusAreas": ["string (sections with broad agreement)"],
  "divisionAreas": ["string (sections with significant disagreement)"]
}`;

    const userPrompt = `Analyze the following community sentiment and review feedback for a constitutional amendment draft, then generate bridging statements.

## Section Sentiments
${sentimentSummary || 'No section-level sentiment data available yet.'}

## Community Reviews
${reviewSummary}

Generate 2-5 bridging statements that could help build consensus. Focus on sections with the most disagreement. If there is insufficient data, generate statements based on common constitutional amendment concerns.`;

    // 4. Execute via AI provider
    const stakeAddress = ctx.wallet ?? '';
    const personalContext = await assemblePersonalContext(stakeAddress, 'drep');
    const personalContextStr = formatPersonalContext(personalContext);

    const skillContext: SkillContext = {
      personalContext,
      personalContextStr,
      keySource: 'platform',
    };

    const ai = await createAIProvider({
      userId: ctx.userId,
      stakeAddress,
    });
    skillContext.keySource = ai.keySource;

    const result = await ai.generateText(userPrompt, {
      system: systemPrompt,
      model: 'FAST',
      maxTokens: 2048,
    });

    if (!result.data) {
      return NextResponse.json(
        { error: 'AI generation failed. Please try again.' },
        { status: 503 },
      );
    }

    // 5. Parse output
    let output: AmendmentBridgeOutput;
    try {
      // Extract JSON from possible markdown code fences
      const jsonStr = result.data
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```/g, '')
        .trim();
      output = JSON.parse(jsonStr) as AmendmentBridgeOutput;
    } catch {
      logger.error('[amendment-bridge] Failed to parse AI output', {
        draftId: parsed.draftId,
        raw: result.data.slice(0, 500),
      });
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
    }

    // 6. Log provenance
    await ai.logActivity({
      skillName: 'amendment-bridge',
      draftId: parsed.draftId,
      inputSummary: `sections=${Object.keys(sections).length} reviews=${reviews?.length ?? 0}`,
    });

    return NextResponse.json({
      output,
      provenance: {
        skillName: 'amendment-bridge',
        model: result.provenance.model,
        keySource: result.provenance.keySource,
        tokensUsed: result.provenance.tokensUsed,
        executedAt: new Date().toISOString(),
      },
    });
  },
  { auth: 'optional', rateLimit: { max: 10, window: 60 } },
);
