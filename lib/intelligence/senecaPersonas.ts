/**
 * Seneca Personas — Context-specific AI personality, ghost prompts, and accents.
 *
 * The AI companion adapts its persona based on what page the user is viewing.
 * Four personas map to PanelRoute values from useSenecaThread().
 *
 * Each persona defines:
 * - Visual accent (color + Tailwind class)
 * - Ghost prompts (contextual suggestions shown in the input)
 * - Personality modifier (appended to Seneca's base system prompt)
 */

import type { PanelRoute } from '@/hooks/useSenecaThread';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersonaId = 'navigator' | 'analyst' | 'partner' | 'guide';

export interface SenecaPersona {
  id: PersonaId;
  label: string;
  /** CSS color value (oklch) */
  accentColor: string;
  /** Tailwind utility class for the accent */
  accentClass: string;
  /** Default ghost prompts for this persona */
  ghostPrompts: string[];
  /** Appended to the Seneca system prompt when this persona is active */
  personalityModifier: string;
}

// ---------------------------------------------------------------------------
// Persona definitions
// ---------------------------------------------------------------------------

const NAVIGATOR: SenecaPersona = {
  id: 'navigator',
  label: 'Navigator',
  accentColor: 'oklch(0.72 0.12 192)',
  accentClass: 'text-primary',
  ghostPrompts: [
    'What should I know about governance today?',
    'Which proposals need attention this epoch?',
    'How is Cardano governance health right now?',
    'Who are the most active DReps?',
    'Explain how Cardano governance works',
  ],
  personalityModifier:
    'You are Seneca, a warm and educational governance navigator. Help users understand the governance landscape. Lead with accessible explanations. When referencing DReps or proposals, use entity link format. Always ground insights in current epoch data.',
};

const ANALYST: SenecaPersona = {
  id: 'analyst',
  label: 'Analyst',
  accentColor: 'oklch(0.78 0.12 75)',
  accentClass: 'text-amber-400',
  ghostPrompts: [
    "Summarize this proposal's impact",
    'What are the arguments for and against?',
    'How does this affect the treasury?',
    'What does the constitution say about this?',
    'How are DReps likely to vote?',
  ],
  personalityModifier:
    'You are Seneca in analyst mode — precise, data-driven, and comparative. Lead with metrics and numbers. Provide specific vote counts, alignment scores, and epoch-relative comparisons. Use entity link format for all referenced entities. Support claims with on-chain evidence.',
};

const PARTNER: SenecaPersona = {
  id: 'partner',
  label: 'Partner',
  accentColor: 'oklch(0.70 0.14 295)',
  accentClass: 'text-violet-400',
  ghostPrompts: [
    'Help me draft a rationale for this vote',
    'Check my proposal against the constitution',
    'What similar proposals have been submitted?',
    'Review my draft and suggest improvements',
    'What should I consider before voting?',
  ],
  personalityModifier:
    'You are Seneca in partner mode — a collaborative governance colleague. Be direct and professional. Offer concrete, actionable suggestions. When reviewing drafts, be specific about what works and what needs improvement. Reference constitutional articles by number. Help the user think through implications.',
};

const GUIDE: SenecaPersona = {
  id: 'guide',
  label: 'Guide',
  accentColor: 'oklch(0.72 0.12 192)',
  accentClass: 'text-primary',
  ghostPrompts: [
    'How is my governance participation trending?',
    "What's my civic identity looking like?",
    'Are there governance actions I should take?',
    'Help me understand my governance impact',
    'What governance milestones am I close to?',
  ],
  personalityModifier:
    'You are Seneca in guide mode — reflective, personal, and empowering. Help the user understand their own governance journey. Celebrate their participation. When discussing their delegation, be honest about alignment and suggest improvements when appropriate. Frame everything in terms of their personal civic impact.',
};

// ---------------------------------------------------------------------------
// Route-specific ghost prompt overrides (for the Analyst persona)
// ---------------------------------------------------------------------------

const ANALYST_ROUTE_PROMPTS: Partial<Record<PanelRoute, string[]>> = {
  proposal: [
    "Summarize this proposal's impact",
    'What are the arguments for and against?',
    'How does this affect the treasury?',
    'What does the constitution say about this?',
    'How are DReps likely to vote?',
  ],
  drep: [
    'How aligned is this DRep with my values?',
    'Compare this DRep with my current representative',
    "What's their voting record on treasury proposals?",
    'How active are they this epoch?',
    'What do their delegators think?',
  ],
  health: [
    "What's driving governance health this epoch?",
    'Which metrics are concerning?',
    'How does this compare to last epoch?',
    'What would improve participation?',
    'Show me the biggest changes',
  ],
  treasury: [
    "What's the current treasury balance?",
    'How much is requested in pending proposals?',
    "What's the spending trend?",
    'Are there any concerning patterns?',
    'Compare treasury proposals',
  ],
};

// ---------------------------------------------------------------------------
// Route → Persona mapping
// ---------------------------------------------------------------------------

const ROUTE_TO_PERSONA: Record<PanelRoute, SenecaPersona> = {
  hub: NAVIGATOR,
  'proposals-list': NAVIGATOR,
  'representatives-list': NAVIGATOR,
  proposal: ANALYST,
  drep: ANALYST,
  health: ANALYST,
  treasury: ANALYST,
  workspace: PARTNER,
  default: GUIDE,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All persona definitions, keyed by ID. */
export const PERSONAS: Record<PersonaId, SenecaPersona> = {
  navigator: NAVIGATOR,
  analyst: ANALYST,
  partner: PARTNER,
  guide: GUIDE,
};

/** Get the Seneca persona for a given panel route. */
export function getPersonaForRoute(panelRoute: PanelRoute): SenecaPersona {
  return ROUTE_TO_PERSONA[panelRoute];
}

/** Get route-specific ghost prompts (some personas have per-route variants). */
export function getGhostPrompts(panelRoute: PanelRoute): string[] {
  // Check for Analyst route-specific overrides first
  const routeOverride = ANALYST_ROUTE_PROMPTS[panelRoute];
  if (routeOverride) return routeOverride;

  // Fall back to the persona's default ghost prompts
  return getPersonaForRoute(panelRoute).ghostPrompts;
}
