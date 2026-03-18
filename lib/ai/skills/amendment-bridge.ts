/**
 * Skill: Amendment Bridge
 *
 * Analyzes section-level community sentiment and reviewer comments to surface
 * bridging statements that can build consensus on divisive amendment changes.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';
import { CONSTITUTION_NODES, CONSTITUTION_VERSION } from '@/lib/constitution/fullText';
import type { AmendmentBridgeOutput, BridgingStatement } from '@/lib/constitution/types';

const inputSchema = z.object({
  amendments: z.array(
    z.object({
      articleId: z.string(),
      originalText: z.string(),
      proposedText: z.string(),
    }),
  ),
  sectionSentiments: z.array(
    z.object({
      sectionId: z.string(),
      support: z.number(),
      oppose: z.number(),
      neutral: z.number(),
    }),
  ),
  reviewComments: z.array(
    z.object({
      sentiment: z.string(),
      comment: z.string(),
      section: z.string().optional(),
    }),
  ),
});

type Input = z.infer<typeof inputSchema>;

/** Build a concise constitution reference for relevant sections. */
function buildRelevantSections(articleIds: string[]): string {
  const relevant = CONSTITUTION_NODES.filter((n) => articleIds.includes(n.id));
  if (relevant.length === 0) return '';
  return relevant.map((n) => `[${n.id}] ${n.title}\n${n.text}`).join('\n\n---\n\n');
}

registerSkill<Input, AmendmentBridgeOutput>({
  name: 'amendment-bridge',
  description:
    'Analyze community sentiment and reviewer comments to surface bridging statements that build consensus on divisive amendments.',
  category: 'review',
  inputSchema,
  model: 'FAST',
  maxTokens: 2048,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance consensus analyst. Your role is to find common ground between opposing viewpoints on constitutional amendments and propose bridging statements that a majority could accept.

${ctx.personalContextStr ? `The reviewer's governance perspective:\n${ctx.personalContextStr}\n\nConsider this perspective when evaluating what bridging statements would resonate.\n` : ''}
Constitution version: ${CONSTITUTION_VERSION}

A bridging statement is a concrete compromise or reframing that:
- Acknowledges the legitimate concerns of BOTH supporters and opponents
- Proposes specific language or approach modifications that address core objections
- Preserves the essential intent of the amendment while reducing opposition
- Is actionable — the amendment author can use it to revise their proposal

You will receive:
1. The proposed amendments (original vs. proposed text)
2. Section-level sentiment data (support/oppose/neutral counts)
3. Reviewer comments with their sentiment

Return ONLY valid JSON with this exact structure:
{
  "bridges": [
    {
      "id": "bridge-1",
      "statement": "The bridging proposal text",
      "rationale": "Why this bridges the opposing perspectives",
      "relevantSections": ["article-X-sY"],
      "supportPercentage": 65
    }
  ],
  "consensusAreas": ["Description of areas where most reviewers agree"],
  "divisionAreas": ["Description of areas with the deepest disagreement"]
}

Guidelines:
- Generate 1-5 bridging statements, prioritized by potential impact
- The supportPercentage is your estimate of what share of reviewers would accept the bridge
- consensusAreas and divisionAreas should each have 1-3 entries
- Be specific and actionable, not generic platitudes`,

  buildPrompt: (input: Input) => {
    const articleIds = input.amendments.map((a) => a.articleId);
    const sectionRef = buildRelevantSections(articleIds);

    const parts = ['Proposed amendments:', ''];
    for (const amendment of input.amendments) {
      parts.push(
        `Section: ${amendment.articleId}`,
        `Original: "${amendment.originalText}"`,
        `Proposed: "${amendment.proposedText}"`,
        '',
      );
    }

    parts.push('Section sentiment data:');
    for (const s of input.sectionSentiments) {
      const total = s.support + s.oppose + s.neutral;
      const supportPct = total > 0 ? Math.round((s.support / total) * 100) : 0;
      const opposePct = total > 0 ? Math.round((s.oppose / total) * 100) : 0;
      parts.push(`  ${s.sectionId}: ${supportPct}% support, ${opposePct}% oppose (${total} votes)`);
    }

    parts.push('', 'Reviewer comments:');
    for (const c of input.reviewComments) {
      const sectionLabel = c.section ? ` [${c.section}]` : '';
      parts.push(`  [${c.sentiment}]${sectionLabel}: ${c.comment}`);
    }

    if (sectionRef) {
      parts.push('', 'Relevant constitution sections for reference:', '', sectionRef);
    }

    parts.push(
      '',
      'Identify consensus areas, divisions, and propose bridging statements. Return valid JSON only.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): AmendmentBridgeOutput => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        bridges: Array.isArray(parsed.bridges)
          ? parsed.bridges.map(
              (
                b: {
                  id?: string;
                  statement?: string;
                  rationale?: string;
                  relevantSections?: string[];
                  supportPercentage?: number;
                },
                i: number,
              ) => ({
                id: String(b.id ?? `bridge-${i + 1}`),
                statement: String(b.statement ?? ''),
                rationale: String(b.rationale ?? ''),
                relevantSections: Array.isArray(b.relevantSections)
                  ? b.relevantSections.map(String)
                  : [],
                supportPercentage:
                  typeof b.supportPercentage === 'number'
                    ? Math.min(100, Math.max(0, b.supportPercentage))
                    : 50,
              }),
            )
          : [],
        consensusAreas: Array.isArray(parsed.consensusAreas)
          ? parsed.consensusAreas.map(String)
          : [],
        divisionAreas: Array.isArray(parsed.divisionAreas) ? parsed.divisionAreas.map(String) : [],
      };
    } catch {
      // Regex fallback for malformed JSON
      const extractArray = (name: string): string[] => {
        const regex = new RegExp(`"${name}"\\s*:\\s*\\[([^\\]]*)\\]`, 's');
        const match = raw.match(regex);
        if (!match) return [];
        const items: string[] = [];
        const strRegex = /"((?:[^"\\]|\\.)*)"/g;
        let m: RegExpExecArray | null;
        while ((m = strRegex.exec(match[1])) !== null) {
          items.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'));
        }
        return items;
      };

      // Try to extract bridges array
      const bridgesMatch = raw.match(/"bridges"\s*:\s*\[([\s\S]*?)\]\s*[,}]/);
      const bridges: BridgingStatement[] = [];
      if (bridgesMatch) {
        const objRegex = /\{[^{}]*\}/g;
        let m: RegExpExecArray | null;
        while ((m = objRegex.exec(bridgesMatch[1])) !== null) {
          try {
            const obj = JSON.parse(m[0]);
            bridges.push({
              id: String(obj.id ?? `bridge-${bridges.length + 1}`),
              statement: String(obj.statement ?? ''),
              rationale: String(obj.rationale ?? ''),
              relevantSections: Array.isArray(obj.relevantSections)
                ? obj.relevantSections.map(String)
                : [],
              supportPercentage:
                typeof obj.supportPercentage === 'number'
                  ? Math.min(100, Math.max(0, obj.supportPercentage))
                  : 50,
            });
          } catch {
            // skip malformed bridge object
          }
        }
      }

      return {
        bridges,
        consensusAreas: extractArray('consensusAreas'),
        divisionAreas: extractArray('divisionAreas'),
      };
    }
  },
});
