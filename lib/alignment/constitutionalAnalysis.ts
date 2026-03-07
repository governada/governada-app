/**
 * AI-powered constitutional alignment analysis for governance proposals.
 * Compares proposals against relevant Cardano Constitution articles.
 */

import { generateJSON } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRelevantArticles, type ConstitutionalArticle } from '@/lib/constitution';
import { logger } from '@/lib/logger';
import type { ProposalInfo } from '@/types/koios';

export interface ConstitutionalAnalysisResult {
  alignment: 'aligned' | 'tension' | 'neutral';
  confidence: number;
  summary: string;
  relevantArticles: Array<{
    articleId: string;
    articleTitle: string;
    assessment: 'supports' | 'tension' | 'neutral';
    reasoning: string;
  }>;
}

interface AIConstitutionalResponse {
  alignment: 'aligned' | 'tension' | 'neutral';
  confidence: number;
  summary: string;
  articles: Array<{
    article_id: string;
    assessment: 'supports' | 'tension' | 'neutral';
    reasoning: string;
  }>;
}

const CONSTITUTIONAL_SYSTEM = `You are a Cardano governance constitutional analyst. Analyze governance proposals against the Cardano Constitution.
Return a JSON object assessing constitutional alignment. Be specific about which articles are relevant and why.
Focus on substantive constitutional issues, not procedural ones.`;

function buildConstitutionalPrompt(
  proposal: ProposalInfo,
  articles: ConstitutionalArticle[],
): string {
  const title = proposal.meta_json?.body?.title || proposal.meta_json?.title || 'Untitled';
  const abstract = proposal.meta_json?.body?.abstract || proposal.meta_json?.abstract || '';
  const motivation = proposal.meta_json?.body?.motivation || proposal.meta_json?.motivation || '';

  let withdrawalInfo = '';
  if (proposal.withdrawal?.length) {
    try {
      const total =
        proposal.withdrawal.reduce((sum, w) => sum + BigInt(w.amount || '0'), BigInt(0)) /
        BigInt(1_000_000);
      withdrawalInfo = `\nWithdrawal amount: ${total} ADA`;
    } catch {
      withdrawalInfo = '\nWithdrawal amount: unknown';
    }
  }

  const paramInfo = proposal.param_proposal
    ? `\nParameter changes: ${JSON.stringify(proposal.param_proposal).slice(0, 500)}`
    : '';

  const articleText = articles.map((a) => `[${a.id}] ${a.title}: ${a.text}`).join('\n\n');

  return `Analyze this Cardano governance proposal for constitutional alignment.

PROPOSAL:
Type: ${proposal.proposal_type}
Title: ${title}
Abstract: ${abstract.slice(0, 1000)}
Motivation: ${motivation.slice(0, 500)}${withdrawalInfo}${paramInfo}

RELEVANT CONSTITUTIONAL ARTICLES:
${articleText}

Assess alignment with each relevant article. Return JSON:
{
  "alignment": "aligned" | "tension" | "neutral",
  "confidence": 0.0-1.0,
  "summary": "1-2 sentence overall assessment",
  "articles": [
    {
      "article_id": "Article ID from above",
      "assessment": "supports" | "tension" | "neutral",
      "reasoning": "1 sentence explaining why"
    }
  ]
}

Only include articles that are substantively relevant. If the proposal is straightforward and clearly constitutional, say so concisely.`;
}

/**
 * Analyze a batch of proposals for constitutional alignment.
 * Caches results in proposal_classifications.constitutional_analysis.
 */
export async function analyzeConstitutionalAlignment(
  proposals: ProposalInfo[],
): Promise<Map<string, ConstitutionalAnalysisResult>> {
  if (proposals.length === 0) return new Map();

  const supabase = getSupabaseAdmin();
  const results = new Map<string, ConstitutionalAnalysisResult>();

  // Check which proposals already have constitutional analysis
  const txHashes = [...new Set(proposals.map((p) => p.proposal_tx_hash))];
  const { data: existing } = await supabase
    .from('proposal_classifications')
    .select('proposal_tx_hash, proposal_index, constitutional_analysis')
    .in('proposal_tx_hash', txHashes)
    .not('constitutional_analysis', 'is', null);

  const existingKeys = new Set<string>();
  for (const row of existing || []) {
    const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
    existingKeys.add(key);
    results.set(key, row.constitutional_analysis as ConstitutionalAnalysisResult);
  }

  const unanalyzed = proposals.filter(
    (p) => !existingKeys.has(`${p.proposal_tx_hash}-${p.proposal_index}`),
  );

  if (unanalyzed.length === 0) return results;

  // Analyze in batches of 5 (constitutional analysis is more token-heavy)
  const BATCH_SIZE = 5;
  for (let i = 0; i < unanalyzed.length; i += BATCH_SIZE) {
    const batch = unanalyzed.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (proposal) => {
        const articles = getRelevantArticles(proposal.proposal_type);
        const prompt = buildConstitutionalPrompt(proposal, articles);

        const aiResult = await generateJSON<AIConstitutionalResponse>(prompt, {
          system: CONSTITUTIONAL_SYSTEM,
          maxTokens: 512,
        });

        if (!aiResult) return null;

        const articleMap = new Map(articles.map((a) => [a.id, a]));
        const result: ConstitutionalAnalysisResult = {
          alignment: aiResult.alignment,
          confidence: Math.max(0, Math.min(1, aiResult.confidence || 0.5)),
          summary: aiResult.summary?.slice(0, 500) || 'Analysis unavailable',
          relevantArticles: (aiResult.articles || [])
            .filter((a) => articleMap.has(a.article_id))
            .map((a) => ({
              articleId: a.article_id,
              articleTitle: articleMap.get(a.article_id)!.title,
              assessment: a.assessment,
              reasoning: a.reasoning?.slice(0, 300) || '',
            })),
        };

        return { proposal, result };
      }),
    );

    for (const settled of batchResults) {
      if (settled.status !== 'fulfilled' || !settled.value) continue;
      const { proposal, result } = settled.value;
      const key = `${proposal.proposal_tx_hash}-${proposal.proposal_index}`;
      results.set(key, result);

      // Persist to DB
      await supabase
        .from('proposal_classifications')
        .update({ constitutional_analysis: result })
        .eq('proposal_tx_hash', proposal.proposal_tx_hash)
        .eq('proposal_index', proposal.proposal_index);
    }
  }

  logger.info('[constitutional] Analyzed proposals', {
    total: unanalyzed.length,
    successful: results.size - existingKeys.size,
  });

  return results;
}
