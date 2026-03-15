/**
 * CC Briefing Generator — Constitutional Intelligence Pipeline (Chunk 7)
 *
 * Constructs prompts for committee briefings and member dossiers,
 * sends them to generateJSON, and returns typed results.
 */

import { generateJSON } from '@/lib/ai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types — Committee Briefing
// ---------------------------------------------------------------------------

export interface CommitteeBriefingInput {
  memberCount: number;
  avgFidelity: number;
  healthStatus: string;
  trend: string;
  blocSummary: string;
  recentDecisions: string;
  novelInterpretations: string;
  contradictions: string;
  driftEvents: string;
  tensions: string;
  persona: 'citizen' | 'drep' | 'researcher' | 'default';
}

export interface KeyFinding {
  finding: string;
  severity: string;
  evidence_link: string;
}

export interface CommitteeBriefingResult {
  headline: string;
  executive_summary: string;
  key_findings: KeyFinding[];
  what_changed: string;
}

// ---------------------------------------------------------------------------
// Types — Member Dossier
// ---------------------------------------------------------------------------

export interface MemberDossierInput {
  authorName: string | null;
  ccHotId: string;
  fidelityScore: number | null;
  fidelityGrade: string | null;
  rank: number;
  totalMembers: number;
  authorizationEpoch: number | null;
  expirationEpoch: number | null;
  archetypeLabel: string;
  archetypeDescription: string | null;
  mostAlignedMember: string | null;
  mostAlignedPct: number | null;
  mostDivergentMember: string | null;
  mostDivergentPct: number | null;
  blocLabel: string;
  blocInternalAgreement: number | null;
  soleDissenterCount: number;
  participationScore: number | null;
  groundingScore: number | null;
  reasoningScore: number | null;
  rationaleFindings: string;
  interpretationHistory: string;
  contradictions: string;
}

export interface MemberDossierResult {
  executive_summary: string;
  key_finding: string;
  behavioral_patterns: string;
  constitutional_profile: string;
}

// ---------------------------------------------------------------------------
// Persona guidance
// ---------------------------------------------------------------------------

const PERSONA_GUIDANCE: Record<CommitteeBriefingInput['persona'], string> = {
  citizen:
    'Write for a non-technical ADA holder. Use plain language, explain significance, keep it under 100 words.',
  drep: 'Write for an elected governance representative. Focus on how CC decisions affect DRep governance.',
  researcher:
    'Write for a governance researcher. Include specific data points, methodology notes, longer form.',
  default: 'Write for a general governance-interested audience. Balance accessibility and depth.',
};

// ---------------------------------------------------------------------------
// Committee Briefing
// ---------------------------------------------------------------------------

export async function generateCommitteeBriefing(
  input: CommitteeBriefingInput,
): Promise<CommitteeBriefingResult | null> {
  const personaGuidance = PERSONA_GUIDANCE[input.persona];

  const prompt = `You are the governance intelligence analyst for Governada, the constitutional
intelligence platform for Cardano.

Write a committee briefing for the current epoch.

## Committee State
- Active members: ${input.memberCount}
- Average fidelity: ${input.avgFidelity}
- Health status: ${input.healthStatus}
- Trend: ${input.trend}

## Voting Blocs
${input.blocSummary}

## Recent Decisions (this epoch)
${input.recentDecisions}

## Interpretation Developments
- New interpretations: ${input.novelInterpretations}
- Precedent contradictions: ${input.contradictions}
- Interpretation drift events: ${input.driftEvents}

## Tensions
- CC-DRep divergences: ${input.tensions}

## Persona: ${input.persona}
${personaGuidance}

## Instructions
Generate a briefing with:

1. **headline** (max 12 words): The single most important thing about the CC right now.
   Not generic ("CC continues governance work"). Specific ("First CC split on treasury
   since Epoch 510 signals interpretation shift").

2. **executive_summary** (3-4 sentences): What's happening, why it matters, what to watch.
   Write for ${input.persona} audience. Citizens need plain language and significance.
   Researchers need precision and data references.

3. **key_findings** (2-4 items): Array of {finding, severity, evidence_link}
   - Each finding must reference specific proposals, members, or articles
   - severity: 'info' | 'noteworthy' | 'concern' | 'critical'
   - evidence_link: description of the data source (e.g., "cc_rationale for Member X on Proposal Y")

4. **what_changed** (2-3 bullets): What's different since last epoch. Specific, not generic.

Return JSON matching this schema. Every claim must be grounded in the provided data.
Do not invent information.`;

  try {
    const result = await generateJSON<CommitteeBriefingResult>(prompt, {
      model: 'DRAFT',
      maxTokens: 2048,
      temperature: 0.3,
    });

    if (!result) {
      logger.warn('[briefing-generator] Committee briefing AI returned null');
      return null;
    }

    // Basic validation
    if (!result.headline || !result.executive_summary || !Array.isArray(result.key_findings)) {
      logger.warn('[briefing-generator] Committee briefing missing required fields');
      return null;
    }

    return result;
  } catch (err) {
    logger.error('[briefing-generator] Committee briefing generation failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Member Dossier
// ---------------------------------------------------------------------------

export async function generateMemberDossier(
  input: MemberDossierInput,
): Promise<MemberDossierResult | null> {
  const prompt = `You are writing an intelligence dossier on a CC member for Governada.

## Member Profile
- Name: ${input.authorName ?? 'Unknown'}
- Score: ${input.fidelityScore ?? 'N/A'}/100 (Grade ${input.fidelityGrade ?? 'N/A'})
- Rank: ${input.rank}/${input.totalMembers}
- Term: Epoch ${input.authorizationEpoch ?? 'Unknown'} – ${input.expirationEpoch ?? 'Unknown'}
- Archetype: ${input.archetypeLabel} — ${input.archetypeDescription ?? 'No description'}

## Chamber Position
- Most aligned with: ${input.mostAlignedMember ?? 'Unknown'} (${input.mostAlignedPct ?? 'N/A'}%)
- Most divergent from: ${input.mostDivergentMember ?? 'Unknown'} (${input.mostDivergentPct ?? 'N/A'}%)
- Bloc assignment: ${input.blocLabel} (${input.blocInternalAgreement ?? 'N/A'}% internal cohesion)
- Sole dissenter: ${input.soleDissenterCount} times

## Pillar Scores
- Participation: ${input.participationScore ?? 'N/A'}/100
- Constitutional Grounding: ${input.groundingScore ?? 'N/A'}/100
- Reasoning Quality: ${input.reasoningScore ?? 'N/A'}/100

## Key Rationale Findings
${input.rationaleFindings}

## Interpretation History
${input.interpretationHistory}

## Contradictions / Drift
${input.contradictions}

## Instructions
Write a dossier with:

1. **executive_summary** (1 paragraph): Who this person is as a constitutional guardian.
   Lead with their defining characteristic, not their score. Reference their archetype
   and chamber position. Mention their strongest and weakest accountability dimension.

2. **key_finding** (1 sentence): The single most notable fact about this member.
   Must be concrete and surprising. Not "has good participation" but "is the only
   CC member who has never cited Article III despite voting on 4 hard fork proposals."

3. **behavioral_patterns** (2-3 sentences): What patterns emerge from their voting
   history? Are they fast or slow voters? Do they specialize in certain proposal types?
   Do they drift or stay consistent?

4. **constitutional_profile** (2-3 sentences): How do they interpret the constitution?
   Are they strict or broad? On which articles? Has their interpretation shifted?

Return JSON: {executive_summary, key_finding, behavioral_patterns, constitutional_profile}
Every claim must reference specific data from the context provided.`;

  try {
    const result = await generateJSON<MemberDossierResult>(prompt, {
      model: 'DRAFT',
      maxTokens: 1536,
      temperature: 0.3,
    });

    if (!result) {
      logger.warn('[briefing-generator] Member dossier AI returned null', {
        ccHotId: input.ccHotId,
      });
      return null;
    }

    if (
      !result.executive_summary ||
      !result.key_finding ||
      !result.behavioral_patterns ||
      !result.constitutional_profile
    ) {
      logger.warn('[briefing-generator] Member dossier missing required fields', {
        ccHotId: input.ccHotId,
      });
      return null;
    }

    return result;
  } catch (err) {
    logger.error('[briefing-generator] Member dossier generation failed', {
      error: err instanceof Error ? err.message : String(err),
      ccHotId: input.ccHotId,
    });
    return null;
  }
}
