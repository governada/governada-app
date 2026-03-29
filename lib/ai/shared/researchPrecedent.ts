/**
 * Shared research precedent logic.
 *
 * Extracted from the research-precedent skill so that both the interactive
 * skill (via API route) and the background pre-computation pipeline (Inngest)
 * can call the same analysis without going through the skill registry.
 */

import { MODELS, generateTextWithModel } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { semanticSearch } from '@/lib/embeddings';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchPrecedentInput {
  proposalTitle: string;
  proposalAbstract?: string;
  proposalType: string;
  withdrawalAmount?: number;
}

export interface ResearchPrecedentOutput {
  questionsToConsider: string[];
  precedentSummary: string;
}

type SimilarProposalRow = {
  tx_hash: string;
  title: string;
  proposal_type: string;
  withdrawal_amount: number | null;
  ratified_epoch: number | null;
  expired_epoch: number | null;
  dropped_epoch: number | null;
};

// ---------------------------------------------------------------------------
// Core analysis function
// ---------------------------------------------------------------------------

/**
 * Run research precedent analysis to generate key questions and precedent summary.
 *
 * Uses existing proposal data for context and AI to generate governance-specific
 * questions a reviewer should consider. This version does NOT personalize to a
 * specific reviewer — it generates shared questions useful for all reviewers.
 */
export async function runResearchPrecedent(
  input: ResearchPrecedentInput,
): Promise<ResearchPrecedentOutput> {
  const systemPrompt = `You are a governance research assistant for the Cardano blockchain.
Your job is to analyze governance proposals and generate insightful questions and precedent summaries.

Produce a JSON response with this structure:
{
  "precedentSummary": "A 2-3 sentence summary of what precedent tells us about this type of proposal",
  "questionsToConsider": ["Important question 1", "Important question 2", ...]
}

Generate 3-5 substantive, non-generic questions that a thoughtful governance participant should consider when reviewing this proposal. Questions should be specific to the proposal content and type, not generic governance questions.`;

  const promptParts = [
    `Proposal to analyze: "${input.proposalTitle}"`,
    `Type: ${input.proposalType}`,
  ];
  if (input.proposalAbstract) promptParts.push(`Abstract: ${input.proposalAbstract}`);
  if (input.withdrawalAmount) promptParts.push(`Requested amount: ${input.withdrawalAmount} ADA`);

  // Fetch similar proposals for context
  const similar = await fetchSimilarProposals(
    input.proposalType,
    input.proposalTitle,
    5,
    input.proposalAbstract,
  );

  if (similar.length > 0) {
    promptParts.push('\nSimilar past proposals:');
    for (const p of similar) {
      const status = p.ratified_epoch
        ? 'ratified'
        : p.expired_epoch
          ? 'expired'
          : p.dropped_epoch
            ? 'dropped'
            : 'active';
      promptParts.push(`- "${p.title}" (${p.proposal_type}, ${status})`);
    }
  }

  promptParts.push(
    '\nBased on this proposal and its precedents, generate key questions for reviewers and a precedent summary.',
  );

  try {
    const { text } = await generateTextWithModel(promptParts.join('\n'), MODELS.FAST, {
      system: systemPrompt,
      maxTokens: 1024,
    });
    if (!text) {
      return { questionsToConsider: [], precedentSummary: 'Analysis could not be completed.' };
    }

    return parseResearchOutput(text);
  } catch (err) {
    logger.error('[researchPrecedent] Analysis failed', { error: err });
    return {
      questionsToConsider: [],
      precedentSummary: 'Precedent analysis could not be completed.',
    };
  }
}

// ---------------------------------------------------------------------------
// Similar proposal fetching (reused from skill)
// ---------------------------------------------------------------------------

async function fetchSimilarProposals(
  proposalType: string,
  title: string,
  limit = 5,
  proposalAbstract?: string,
): Promise<SimilarProposalRow[]> {
  const useEmbeddings = await getFeatureFlag('embedding_research_precedent', false);

  if (useEmbeddings) {
    try {
      const results = await fetchSimilarByEmbedding(title, limit, proposalAbstract);
      if (results.length > 0) return results;
    } catch (err) {
      logger.warn('[researchPrecedent] Semantic search failed, falling back to type match', {
        error: err,
      });
    }
  }

  return fetchSimilarByType(proposalType, limit);
}

async function fetchSimilarByType(
  proposalType: string,
  limit: number,
): Promise<SimilarProposalRow[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('proposals')
    .select(
      'tx_hash, title, proposal_type, withdrawal_amount, ratified_epoch, expired_epoch, dropped_epoch',
    )
    .eq('proposal_type', proposalType)
    .not('title', 'is', null)
    .order('block_time', { ascending: false })
    .limit(limit);

  return data ?? [];
}

async function fetchSimilarByEmbedding(
  title: string,
  limit: number,
  proposalAbstract?: string,
): Promise<SimilarProposalRow[]> {
  const queryText = proposalAbstract ? `${title}\n\n${proposalAbstract}` : title;

  const semanticResults = await semanticSearch(queryText, 'proposal', {
    threshold: 0.4,
    limit,
  });

  if (semanticResults.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const txHashes = semanticResults.map((r) => r.entity_id);

  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, title, proposal_type, withdrawal_amount, ratified_epoch, expired_epoch, dropped_epoch',
    )
    .in('tx_hash', txHashes)
    .not('title', 'is', null);

  if (!proposals || proposals.length === 0) return [];

  const proposalMap = new Map(proposals.map((p) => [p.tx_hash, p]));
  const ordered: SimilarProposalRow[] = [];
  for (const result of semanticResults) {
    const proposal = proposalMap.get(result.entity_id);
    if (proposal) ordered.push(proposal);
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseResearchOutput(raw: string): ResearchPrecedentOutput {
  try {
    const cleaned = raw
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      questionsToConsider: Array.isArray(parsed.questionsToConsider)
        ? parsed.questionsToConsider
        : [],
      precedentSummary: typeof parsed.precedentSummary === 'string' ? parsed.precedentSummary : '',
    };
  } catch {
    return {
      questionsToConsider: [],
      precedentSummary: raw.slice(0, 500),
    };
  }
}
