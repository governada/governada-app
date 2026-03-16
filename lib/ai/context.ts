/**
 * Personal context assembler for AI interactions.
 *
 * Fetches a user's governance philosophy, voting history, and alignment data
 * to inject into AI skill prompts. This ensures AI outputs are personalized
 * to the individual's perspective rather than producing generic analysis.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface PersonalContext {
  role: 'drep' | 'spo' | 'citizen';
  /** Governance philosophy / objectives (DRep/SPO) */
  philosophy: string | null;
  /** Recent voting positions (last 10) */
  recentVotes: Array<{
    proposalTitle: string;
    vote: string;
    rationaleSnippet: string | null;
  }>;
  /** Personality/alignment label from PCA */
  personalityLabel: string | null;
  /** Alignment scores (6D) */
  alignmentScores: Record<string, number> | null;
}

/**
 * Assemble personal context for an AI call.
 * Returns a structured context string that gets injected into skill system prompts.
 */
export async function assemblePersonalContext(
  stakeAddress: string,
  role: 'drep' | 'spo' | 'citizen',
): Promise<PersonalContext> {
  const supabase = getSupabaseAdmin();
  const context: PersonalContext = {
    role,
    philosophy: null,
    recentVotes: [],
    personalityLabel: null,
    alignmentScores: null,
  };

  try {
    // Fetch DRep metadata (objectives, motivations, philosophy)
    if (role === 'drep') {
      const { data: drep } = await supabase
        .from('dreps')
        .select('metadata, drep_id')
        .eq('drep_id', stakeAddress)
        .maybeSingle();

      if (drep?.metadata) {
        const meta = drep.metadata as Record<string, unknown>;
        const parts: string[] = [];
        if (meta.objectives) parts.push(`Objectives: ${meta.objectives}`);
        if (meta.motivations) parts.push(`Motivations: ${meta.motivations}`);
        if (meta.qualifications) parts.push(`Qualifications: ${meta.qualifications}`);
        context.philosophy = parts.join('\n') || null;
      }

      // Fetch recent votes with rationale snippets
      const { data: votes } = await supabase
        .from('drep_votes')
        .select('vote, proposal_tx_hash, proposal_index, block_time, proposals!inner(title)')
        .eq('drep_id', stakeAddress)
        .order('block_time', { ascending: false })
        .limit(10);

      if (votes) {
        context.recentVotes = votes.map((v) => ({
          proposalTitle: (v.proposals as { title?: string })?.title ?? 'Unknown',
          vote: v.vote ?? 'Unknown',
          rationaleSnippet: null,
        }));
      }
    }

    // Fetch alignment profile
    const { data: profile } = await supabase
      .from('user_governance_profiles')
      .select('personality_label, alignment_scores')
      .eq('wallet_address', stakeAddress)
      .maybeSingle();

    if (profile) {
      context.personalityLabel = profile.personality_label;
      context.alignmentScores = profile.alignment_scores as Record<string, number> | null;
    }
  } catch (err) {
    logger.error('[AI Context] Failed to assemble personal context', { error: err });
  }

  return context;
}

/**
 * Format personal context into a string for injection into AI prompts.
 */
export function formatPersonalContext(ctx: PersonalContext): string {
  const lines: string[] = [];

  lines.push(`Role: ${ctx.role.toUpperCase()}`);

  if (ctx.philosophy) {
    lines.push(`\nGovernance Philosophy:\n${ctx.philosophy}`);
  }

  if (ctx.personalityLabel) {
    lines.push(`\nGovernance Personality: ${ctx.personalityLabel}`);
  }

  if (ctx.alignmentScores) {
    const scores = Object.entries(ctx.alignmentScores)
      .map(([dim, score]) => `  ${dim}: ${score}/100`)
      .join('\n');
    lines.push(`\nAlignment Scores:\n${scores}`);
  }

  if (ctx.recentVotes.length > 0) {
    const votes = ctx.recentVotes.map((v) => `  - ${v.vote} on "${v.proposalTitle}"`).join('\n');
    lines.push(`\nRecent Votes (last ${ctx.recentVotes.length}):\n${votes}`);
  }

  return lines.join('\n');
}
