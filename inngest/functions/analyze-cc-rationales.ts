/**
 * CC Rationale AI Analysis — Inngest function
 *
 * Runs after syncCcRationales completes. For each unanalyzed rationale:
 * 1. Finds unanalyzed rationales (LEFT JOIN on cc_rationale_analysis)
 * 2. Runs AI analysis in batches of 5
 * 3. Inserts results into cc_rationale_analysis + cc_interpretation_history
 * 4. Links precedents between decisions citing overlapping articles
 * 5. Emits cc/analysis.completed event
 *
 * Part of the Constitutional Intelligence pipeline (Chunk 3).
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeRationale } from '@/lib/cc/rationaleAnalysis';
import { classifyPrecedent } from '@/lib/cc/precedentLinker';
import { EXPECTED_ARTICLES } from '@/lib/cc/fidelityScore';
import { logger } from '@/lib/logger';
import type { RationaleAnalysisInput, PriorInterpretation } from '@/lib/cc/rationaleAnalysis';
import type { PrecedentInput } from '@/lib/cc/precedentLinker';

// ---------------------------------------------------------------------------
// Types for internal use
// ---------------------------------------------------------------------------

interface UnanalyzedRationale {
  cc_hot_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
}

interface RationaleRow {
  cc_hot_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  author_name: string | null;
  summary: string | null;
  rationale_statement: string | null;
  cited_articles: unknown;
  internal_vote: string | null;
}

interface ProposalRow {
  tx_hash: string;
  proposal_index: number;
  title: string | null;
  proposal_type: string;
  proposed_epoch: number | null;
}

interface InterpretationRow {
  cc_hot_id: string;
  article: string;
  proposal_title: string | null;
  epoch_no: number;
  stance: string;
  interpretation_summary: string | null;
}

interface AnalyzedDecision {
  cc_hot_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  proposal_title: string | null;
  proposal_type: string;
  proposed_epoch: number | null;
  cited_articles: string[];
  interpretation_stance: string | null;
  vote: string | null;
}

// ---------------------------------------------------------------------------
// Inngest Function
// ---------------------------------------------------------------------------

export const analyzeCcRationales = inngest.createFunction(
  {
    id: 'analyze-cc-rationales',
    concurrency: [{ scope: 'env', key: 'cc-analysis', limit: 1 }],
    retries: 1,
  },
  { event: 'cc/rationales.synced' },
  async ({ step }) => {
    // Step 1: Find unanalyzed rationales
    const unanalyzed = await step.run('find-unanalyzed', async () => {
      const supabase = getSupabaseAdmin();

      // Get all rationale keys
      const { data: allRationales } = await supabase
        .from('cc_rationales')
        .select('cc_hot_id, proposal_tx_hash, proposal_index');

      if (!allRationales?.length) return [];

      // Get already-analyzed keys
      const { data: analyzed } = await supabase
        .from('cc_rationale_analysis')
        .select('cc_hot_id, proposal_tx_hash, proposal_index');

      const analyzedKeys = new Set(
        (analyzed ?? []).map((a) => `${a.cc_hot_id}:${a.proposal_tx_hash}:${a.proposal_index}`),
      );

      const result: UnanalyzedRationale[] = allRationales
        .filter(
          (r) => !analyzedKeys.has(`${r.cc_hot_id}:${r.proposal_tx_hash}:${r.proposal_index}`),
        )
        .slice(0, 20); // Limit to 20 per run

      logger.info('[analyze-cc-rationales] Found unanalyzed rationales', {
        total: allRationales.length,
        alreadyAnalyzed: analyzedKeys.size,
        toAnalyze: result.length,
      });

      return result;
    });

    if (unanalyzed.length === 0) {
      return { analyzed: 0, precedents: 0, status: 'nothing_to_analyze' };
    }

    // Step 2: Analyze in batches of 5
    let totalAnalyzed = 0;
    const newlyAnalyzedKeys: string[] = [];

    for (let batchIdx = 0; batchIdx < unanalyzed.length; batchIdx += 5) {
      const batch = unanalyzed.slice(batchIdx, batchIdx + 5);
      const batchNum = Math.floor(batchIdx / 5) + 1;

      const batchResult = await step.run(`analyze-batch-${batchNum}`, async () => {
        const supabase = getSupabaseAdmin();
        let analyzed = 0;
        const analyzedKeys: string[] = [];

        for (const item of batch) {
          try {
            // Fetch full rationale data
            const { data: rationale } = await supabase
              .from('cc_rationales')
              .select(
                'cc_hot_id, proposal_tx_hash, proposal_index, author_name, summary, rationale_statement, cited_articles, internal_vote',
              )
              .eq('cc_hot_id', item.cc_hot_id)
              .eq('proposal_tx_hash', item.proposal_tx_hash)
              .eq('proposal_index', item.proposal_index)
              .single();

            if (!rationale) {
              logger.warn('[analyze-cc-rationales] Rationale not found', {
                key: `${item.cc_hot_id}:${item.proposal_tx_hash}:${item.proposal_index}`,
              });
              continue;
            }

            const typedRationale = rationale as RationaleRow;

            // Fetch proposal info
            const { data: proposal } = await supabase
              .from('proposals')
              .select('tx_hash, proposal_index, title, proposal_type, proposed_epoch')
              .eq('tx_hash', item.proposal_tx_hash)
              .eq('proposal_index', item.proposal_index)
              .single();

            const typedProposal = proposal as ProposalRow | null;
            const proposalType = typedProposal?.proposal_type ?? 'InfoAction';

            // Fetch prior interpretation history for this member
            const { data: priorInterps } = await supabase
              .from('cc_interpretation_history')
              .select(
                'cc_hot_id, article, proposal_title, epoch_no, stance, interpretation_summary',
              )
              .eq('cc_hot_id', item.cc_hot_id)
              .order('epoch_no', { ascending: false })
              .limit(20);

            const priorInterpretations: PriorInterpretation[] = (
              (priorInterps ?? []) as InterpretationRow[]
            ).map((p) => ({
              article: p.article,
              proposalTitle: p.proposal_title ?? 'Unknown',
              epoch: p.epoch_no,
              stance: p.stance,
              summary: p.interpretation_summary ?? '',
            }));

            // Build rationale text from available fields
            const rationaleText = [typedRationale.summary, typedRationale.rationale_statement]
              .filter(Boolean)
              .join('\n\n');

            if (!rationaleText) {
              logger.warn('[analyze-cc-rationales] Empty rationale text, skipping', {
                key: `${item.cc_hot_id}:${item.proposal_tx_hash}:${item.proposal_index}`,
              });
              continue;
            }

            const citedArticles = Array.isArray(typedRationale.cited_articles)
              ? (typedRationale.cited_articles as string[])
              : [];

            const expectedArticles =
              EXPECTED_ARTICLES[proposalType] ?? EXPECTED_ARTICLES['InfoAction'] ?? [];

            // Get vote from cc_votes
            const { data: voteData } = await supabase
              .from('cc_votes')
              .select('vote')
              .eq('cc_hot_id', item.cc_hot_id)
              .eq('proposal_tx_hash', item.proposal_tx_hash)
              .eq('proposal_index', item.proposal_index)
              .single();

            const vote = voteData?.vote ?? typedRationale.internal_vote ?? 'Unknown';

            const input: RationaleAnalysisInput = {
              ccHotId: item.cc_hot_id,
              authorName: typedRationale.author_name,
              proposalTitle: typedProposal?.title ?? null,
              proposalType,
              vote,
              rationaleSummary: rationaleText,
              citedArticles,
              expectedArticles,
              priorInterpretations,
              priorRationaleSummaries: await getPriorRationaleSummaries(
                supabase,
                item.cc_hot_id,
                item.proposal_tx_hash,
                item.proposal_index,
              ),
            };

            // Run AI analysis
            const result = await analyzeRationale(input);
            if (!result) {
              logger.warn('[analyze-cc-rationales] AI analysis returned null', {
                key: `${item.cc_hot_id}:${item.proposal_tx_hash}:${item.proposal_index}`,
              });
              continue;
            }

            // Insert into cc_rationale_analysis
            const { error: analysisError } = await supabase.from('cc_rationale_analysis').upsert(
              {
                cc_hot_id: item.cc_hot_id,
                proposal_tx_hash: item.proposal_tx_hash,
                proposal_index: item.proposal_index,
                interpretation_stance: result.interpretation_stance,
                key_arguments: result.key_arguments,
                logical_structure: result.logical_structure,
                rationality_score: result.rationality_score,
                reciprocity_score: result.reciprocity_score,
                clarity_score: result.clarity_score,
                deliberation_quality: result.deliberation_quality,
                articles_analyzed: result.articles_analyzed,
                novel_interpretation: result.novel_interpretation,
                contradicts_own_precedent: result.contradicts_own_precedent,
                notable_finding: result.notable_finding,
                finding_severity: result.finding_severity,
                boilerplate_score: result.boilerplate_score ?? null,
                confidence: result.confidence ?? null,
                analyzed_at: new Date().toISOString(),
                model_version: 'claude-sonnet-4-5',
              },
              {
                onConflict: 'cc_hot_id,proposal_tx_hash,proposal_index',
              },
            );

            if (analysisError) {
              logger.error('[analyze-cc-rationales] Failed to upsert analysis', {
                error: analysisError.message,
              });
              continue;
            }

            // Also update reasoning_quality_score on cc_rationales
            await supabase
              .from('cc_rationales')
              .update({
                reasoning_quality_score: result.deliberation_quality,
              })
              .eq('cc_hot_id', item.cc_hot_id)
              .eq('proposal_tx_hash', item.proposal_tx_hash)
              .eq('proposal_index', item.proposal_index);

            // Extract per-article interpretations into cc_interpretation_history
            for (const articleAnalysis of result.articles_analyzed) {
              // Check for prior interpretation of same member + article
              const priorForArticle = priorInterpretations.find(
                (p) => p.article === articleAnalysis.article,
              );

              const consistentWithPrior =
                priorForArticle != null ? priorForArticle.stance === articleAnalysis.stance : null;

              const driftNote =
                priorForArticle != null && !consistentWithPrior
                  ? `Shifted from ${priorForArticle.stance} to ${articleAnalysis.stance}`
                  : null;

              const { error: interpError } = await supabase
                .from('cc_interpretation_history')
                .upsert(
                  {
                    cc_hot_id: item.cc_hot_id,
                    article: articleAnalysis.article,
                    proposal_tx_hash: item.proposal_tx_hash,
                    proposal_index: item.proposal_index,
                    proposal_title: typedProposal?.title ?? null,
                    epoch_no: typedProposal?.proposed_epoch ?? 0,
                    stance: articleAnalysis.stance,
                    interpretation_summary: articleAnalysis.interpretation,
                    consistent_with_prior: consistentWithPrior,
                    drift_note: driftNote,
                    recorded_at: new Date().toISOString(),
                  },
                  {
                    onConflict: 'cc_hot_id,article,proposal_tx_hash,proposal_index',
                  },
                );

              if (interpError) {
                logger.error('[analyze-cc-rationales] Failed to upsert interpretation', {
                  error: interpError.message,
                  article: articleAnalysis.article,
                });
              }
            }

            analyzed++;
            analyzedKeys.push(`${item.cc_hot_id}:${item.proposal_tx_hash}:${item.proposal_index}`);
          } catch (err) {
            // Never block on a single failure
            logger.error('[analyze-cc-rationales] Error processing rationale', {
              error: err instanceof Error ? err.message : String(err),
              key: `${item.cc_hot_id}:${item.proposal_tx_hash}:${item.proposal_index}`,
            });
          }
        }

        return { analyzed, analyzedKeys };
      });

      totalAnalyzed += batchResult.analyzed;
      newlyAnalyzedKeys.push(...batchResult.analyzedKeys);
    }

    // Step 3: Link precedents for newly analyzed rationales
    let totalPrecedents = 0;

    if (newlyAnalyzedKeys.length > 0) {
      totalPrecedents = await step.run('link-precedents', async () => {
        const supabase = getSupabaseAdmin();
        let precedentsLinked = 0;

        for (const key of newlyAnalyzedKeys) {
          try {
            const [ccHotId, proposalTxHash, proposalIndexStr] = key.split(':');
            const proposalIndex = parseInt(proposalIndexStr, 10);

            // Get the source analysis data
            const { data: sourceAnalysis } = await supabase
              .from('cc_rationale_analysis')
              .select(
                'cc_hot_id, proposal_tx_hash, proposal_index, interpretation_stance, articles_analyzed',
              )
              .eq('cc_hot_id', ccHotId)
              .eq('proposal_tx_hash', proposalTxHash)
              .eq('proposal_index', proposalIndex)
              .single();

            if (!sourceAnalysis) continue;

            // Get proposal info for the source
            const { data: sourceProposal } = await supabase
              .from('proposals')
              .select('title, proposal_type, proposed_epoch')
              .eq('tx_hash', proposalTxHash)
              .eq('proposal_index', proposalIndex)
              .single();

            if (!sourceProposal) continue;

            const sourceArticles = Array.isArray(sourceAnalysis.articles_analyzed)
              ? (
                  sourceAnalysis.articles_analyzed as {
                    article: string;
                    interpretation: string;
                    stance: string;
                  }[]
                ).map((a) => a.article)
              : [];

            if (sourceArticles.length === 0) continue;

            // Get vote for source
            const { data: sourceVote } = await supabase
              .from('cc_votes')
              .select('vote')
              .eq('cc_hot_id', ccHotId)
              .eq('proposal_tx_hash', proposalTxHash)
              .eq('proposal_index', proposalIndex)
              .single();

            // Find prior analyzed decisions by same member that:
            // 1. Are the same proposal type OR
            // 2. Cite overlapping articles
            const { data: priorAnalyses } = await supabase
              .from('cc_rationale_analysis')
              .select(
                'cc_hot_id, proposal_tx_hash, proposal_index, interpretation_stance, articles_analyzed',
              )
              .eq('cc_hot_id', ccHotId)
              .neq('proposal_tx_hash', proposalTxHash);

            if (!priorAnalyses?.length) continue;

            // Build candidate list with relevance scores
            const candidates: AnalyzedDecision[] = [];

            for (const prior of priorAnalyses) {
              const priorArticles = Array.isArray(prior.articles_analyzed)
                ? (
                    prior.articles_analyzed as {
                      article: string;
                      interpretation: string;
                      stance: string;
                    }[]
                  ).map((a) => a.article)
                : [];

              // Check for overlapping articles
              const overlapping = sourceArticles.filter((a) => priorArticles.includes(a));
              if (overlapping.length === 0) continue;

              // Get proposal info for the target
              const { data: targetProposal } = await supabase
                .from('proposals')
                .select('title, proposal_type, proposed_epoch')
                .eq('tx_hash', prior.proposal_tx_hash)
                .eq('proposal_index', prior.proposal_index)
                .single();

              const { data: targetVote } = await supabase
                .from('cc_votes')
                .select('vote')
                .eq('cc_hot_id', ccHotId)
                .eq('proposal_tx_hash', prior.proposal_tx_hash)
                .eq('proposal_index', prior.proposal_index)
                .single();

              candidates.push({
                cc_hot_id: prior.cc_hot_id,
                proposal_tx_hash: prior.proposal_tx_hash,
                proposal_index: prior.proposal_index,
                proposal_title: targetProposal?.title ?? null,
                proposal_type: targetProposal?.proposal_type ?? 'InfoAction',
                proposed_epoch: targetProposal?.proposed_epoch ?? null,
                cited_articles: priorArticles,
                interpretation_stance: prior.interpretation_stance,
                vote: targetVote?.vote ?? null,
              });
            }

            // Take top 3 most relevant (most overlapping articles, then most recent)
            candidates.sort((a, b) => {
              const aOverlap = sourceArticles.filter((art) =>
                a.cited_articles.includes(art),
              ).length;
              const bOverlap = sourceArticles.filter((art) =>
                b.cited_articles.includes(art),
              ).length;
              if (bOverlap !== aOverlap) return bOverlap - aOverlap;
              return (b.proposed_epoch ?? 0) - (a.proposed_epoch ?? 0);
            });

            const topCandidates = candidates.slice(0, 3);

            for (const target of topCandidates) {
              try {
                // Build interpretation summary for source
                const sourceInterpretation =
                  typeof sourceAnalysis.interpretation_stance === 'string'
                    ? sourceAnalysis.interpretation_stance
                    : 'Not determined';

                const targetInterpretation =
                  typeof target.interpretation_stance === 'string'
                    ? target.interpretation_stance
                    : 'Not determined';

                const input: PrecedentInput = {
                  sourceTitle: sourceProposal.title ?? 'Untitled Proposal',
                  sourceType: sourceProposal.proposal_type,
                  sourceEpoch: sourceProposal.proposed_epoch ?? 0,
                  sourceOutcome: sourceVote?.vote ?? 'Unknown',
                  sourceArticles,
                  sourceInterpretation,
                  targetTitle: target.proposal_title ?? 'Untitled Proposal',
                  targetType: target.proposal_type,
                  targetEpoch: target.proposed_epoch ?? 0,
                  targetOutcome: target.vote ?? 'Unknown',
                  targetArticles: target.cited_articles,
                  targetInterpretation,
                };

                const result = await classifyPrecedent(input);
                if (!result) continue;

                const { error: linkError } = await supabase.from('cc_precedent_links').upsert(
                  {
                    source_tx_hash: proposalTxHash,
                    source_proposal_index: proposalIndex,
                    target_tx_hash: target.proposal_tx_hash,
                    target_proposal_index: target.proposal_index,
                    cc_hot_id: ccHotId,
                    relationship: result.relationship,
                    shared_articles: result.shared_articles,
                    explanation: result.explanation,
                    linked_at: new Date().toISOString(),
                  },
                  {
                    onConflict:
                      'source_tx_hash,source_proposal_index,target_tx_hash,target_proposal_index,cc_hot_id',
                  },
                );

                if (linkError) {
                  logger.error('[analyze-cc-rationales] Failed to upsert precedent link', {
                    error: linkError.message,
                  });
                } else {
                  precedentsLinked++;
                }
              } catch (err) {
                logger.error('[analyze-cc-rationales] Error classifying precedent', {
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
          } catch (err) {
            logger.error('[analyze-cc-rationales] Error in precedent linking for key', {
              error: err instanceof Error ? err.message : String(err),
              key,
            });
          }
        }

        return precedentsLinked;
      });
    }

    // Step 4: Emit completion event
    await step.sendEvent('cc-analysis-complete', {
      name: 'cc/analysis.completed',
      data: {
        analyzed: totalAnalyzed,
        precedents: totalPrecedents,
      },
    });

    logger.info('[analyze-cc-rationales] Pipeline complete', {
      analyzed: totalAnalyzed,
      precedents: totalPrecedents,
    });

    return {
      analyzed: totalAnalyzed,
      precedents: totalPrecedents,
      status: 'completed',
    };
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch 3 most recent rationale summaries for this member (for boilerplate detection). */
async function getPriorRationaleSummaries(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  ccHotId: string,
  excludeTxHash: string,
  excludeIndex: number,
): Promise<string[]> {
  const { data } = await supabase
    .from('cc_rationales')
    .select('summary, rationale_statement, proposal_tx_hash, proposal_index')
    .eq('cc_hot_id', ccHotId)
    .order('fetched_at', { ascending: false })
    .limit(4); // fetch 4 to allow excluding current

  return (data ?? [])
    .filter((r) => !(r.proposal_tx_hash === excludeTxHash && r.proposal_index === excludeIndex))
    .slice(0, 3)
    .map((r) => [r.summary, r.rationale_statement].filter(Boolean).join(' ').slice(0, 300))
    .filter((s) => s.length > 0);
}
