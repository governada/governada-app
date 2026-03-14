/**
 * Prompt template for AI-generated civic identity narrative.
 * Generates a 2-3 sentence paragraph that weaves together a citizen's
 * governance story — archetype, ring strengths, milestones, trajectory.
 */

interface NarrativeContext {
  archetype: string | null;
  drepName: string | null;
  delegationAgeDays: number | null;
  participationTier: string;
  pulse: number;
  pulseLabel: string;
  delegationRing: number; // 0-1
  coverageRing: number; // 0-1
  engagementRing: number; // 0-1
  milestonesEarned: number;
  proposalsInfluenced: number;
}

export function buildNarrativePrompt(ctx: NarrativeContext): string {
  const epochsDelegated =
    ctx.delegationAgeDays != null ? Math.floor(ctx.delegationAgeDays / 5) : null;

  const ringSummary = [
    `Delegation Health: ${Math.round(ctx.delegationRing * 100)}%`,
    `Representation Coverage: ${Math.round(ctx.coverageRing * 100)}%`,
    `Civic Engagement: ${Math.round(ctx.engagementRing * 100)}%`,
  ].join(', ');

  // Identify strongest and weakest rings
  const rings = [
    { name: 'Delegation Health', value: ctx.delegationRing },
    { name: 'Representation Coverage', value: ctx.coverageRing },
    { name: 'Civic Engagement', value: ctx.engagementRing },
  ].sort((a, b) => b.value - a.value);

  return `You are writing a brief, warm identity narrative for a citizen participating in Cardano blockchain governance through the Governada platform.

Given this citizen's governance data, write exactly 2-3 sentences that feel personal and insightful. The tone should be encouraging but honest — acknowledge strengths and gently note areas for growth. Use second person ("you").

Do NOT use technical jargon. Do NOT mention scores, percentages, or numbers directly. Instead, translate data into plain-language observations. Do NOT use emojis or exclamation marks.

Citizen data:
- Governance archetype: ${ctx.archetype ?? 'Not yet determined'}
- DRep (representative): ${ctx.drepName ?? 'Not delegated'}
- Delegation duration: ${epochsDelegated != null ? `${epochsDelegated} epochs (${ctx.delegationAgeDays} days)` : 'Not yet delegated'}
- Participation tier: ${ctx.participationTier}
- Governance Pulse: ${ctx.pulse}/100 (${ctx.pulseLabel})
- Ring values: ${ringSummary}
- Strongest area: ${rings[0].name}
- Area with most room to grow: ${rings[rings.length - 1].name}
- Milestones earned: ${ctx.milestonesEarned}
- Proposals influenced: ${ctx.proposalsInfluenced}

Write the narrative now. Output ONLY the 2-3 sentence paragraph, nothing else.`;
}
