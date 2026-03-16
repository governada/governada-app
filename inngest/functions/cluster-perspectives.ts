import { inngest } from '@/lib/inngest';
import { generateJSON } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';

interface PerspectiveClusterAI {
  label: string;
  summary: string;
  size: number;
  representativeQuotes: string[];
  isMinority: boolean;
}

interface ClusterResult {
  clusters: PerspectiveClusterAI[];
  bridgingPoints: string[];
}

const MIN_RATIONALES = 5;

/**
 * Cluster governance rationales into perspective groups using AI.
 * Triggered on-demand or by a 6h cron.
 */
export const clusterPerspectives = inngest.createFunction(
  {
    id: 'cluster-perspectives',
    name: 'Cluster Proposal Perspectives',
    retries: 2,
    concurrency: { limit: 3 },
  },
  { event: 'governada/proposal.perspectives.cluster' },
  async ({ event, step }) => {
    const { txHash, proposalIndex } = event.data as {
      txHash: string;
      proposalIndex: number;
    };

    const result = await step.run('cluster-rationales', async () => {
      const supabase = getSupabaseAdmin();

      // Fetch votes for this proposal to get vote tx hashes
      const { data: votes } = await supabase
        .from('drep_votes')
        .select('vote_tx_hash')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex);

      if (!votes || votes.length === 0) {
        return { status: 'skipped', reason: 'no_votes' };
      }

      const voteTxHashes = votes.map((v) => v.vote_tx_hash);

      // Fetch rationales for those votes
      const { data: rationales } = await supabase
        .from('vote_rationales')
        .select('rationale_text, voter_id')
        .in('vote_tx_hash', voteTxHashes)
        .not('rationale_text', 'is', null);

      if (!rationales || rationales.length < MIN_RATIONALES) {
        return {
          status: 'skipped',
          reason: 'insufficient_rationales',
          count: rationales?.length ?? 0,
        };
      }

      const rationaleTexts = rationales.map((r) => r.rationale_text).filter(Boolean);

      // Build prompt for AI clustering
      const prompt = `You are analyzing governance rationales from Cardano DReps about a specific proposal. Cluster these rationales into 2-5 distinct perspective groups.

For each cluster, provide:
- label: A short descriptive label (3-6 words)
- summary: A 1-2 sentence summary of the shared perspective
- size: Number of rationales in this cluster
- representativeQuotes: 1-2 direct quotes (truncated to 200 chars each) that best represent this cluster
- isMinority: true if this cluster contains less than 20% of total rationales

Also identify bridging points — specific arguments or concerns that appear across multiple clusters.

Return JSON in this exact format:
{
  "clusters": [
    {
      "label": "...",
      "summary": "...",
      "size": N,
      "representativeQuotes": ["..."],
      "isMinority": false
    }
  ],
  "bridgingPoints": ["...", "..."]
}

Here are the ${rationaleTexts.length} rationales:

${rationaleTexts.map((text, i) => `[${i + 1}] ${text}`).join('\n\n')}`;

      const startMs = Date.now();
      const aiResult = await generateJSON<ClusterResult>(prompt, {
        model: 'FAST',
        maxTokens: 2048,
        system:
          'You are a governance analysis expert specializing in Cardano blockchain governance. Analyze rationales objectively and identify meaningful perspective clusters. Always return valid JSON.',
      });

      const generationTimeMs = Date.now() - startMs;

      if (!aiResult || !aiResult.clusters || aiResult.clusters.length === 0) {
        logger.warn('[PerspectiveClusters] AI returned no clusters', {
          txHash,
          proposalIndex,
        });
        return { status: 'failed', reason: 'ai_no_result' };
      }

      // Upsert into perspective_clusters
      const { error: upsertError } = await supabase.from('perspective_clusters').upsert(
        {
          proposal_tx_hash: txHash,
          proposal_index: proposalIndex,
          clusters: aiResult.clusters,
          bridging_points: aiResult.bridgingPoints ?? [],
          rationale_count: rationaleTexts.length,
        },
        {
          onConflict: 'proposal_tx_hash,proposal_index',
        },
      );

      if (upsertError) {
        logger.error('[PerspectiveClusters] Upsert failed', {
          txHash,
          proposalIndex,
          error: upsertError,
        });
        return { status: 'failed', reason: 'db_error' };
      }

      captureServerEvent('perspective_cluster_generated', {
        tx_hash: txHash,
        proposal_index: proposalIndex,
        cluster_count: aiResult.clusters.length,
        rationale_count: rationaleTexts.length,
        minority_count: aiResult.clusters.filter((c) => c.isMinority).length,
        bridging_points_count: (aiResult.bridgingPoints ?? []).length,
        generation_time_ms: generationTimeMs,
      });

      return {
        status: 'generated',
        clusterCount: aiResult.clusters.length,
        rationaleCount: rationaleTexts.length,
        generationTimeMs,
      };
    });

    return result;
  },
);
