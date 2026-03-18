/**
 * Gaming Signal Detection — Inngest batch job.
 *
 * Runs every 12 hours. Detects embedding-based gaming patterns:
 * 1. Rationale farming (per DRep)
 * 2. Template usage (per proposal)
 * 3. Profile-vote hypocrisy (per DRep)
 * 4. Enhanced sybil detection (embedding-enriched)
 *
 * Results stored in scoring metadata via `drep_score_metadata` JSONB field.
 * Gated behind `embedding_anti_gaming` feature flag.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import {
  detectRationaleFarming,
  detectTemplateUsage,
  detectProfileVoteHypocrisy,
} from '@/lib/scoring/gamingDetection';
import { detectSybilPairs, enhanceSybilWithEmbeddings } from '@/lib/scoring/sybilDetection';

export const detectGamingSignals = inngest.createFunction(
  {
    id: 'detect-gaming-signals',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"gaming-detection"' },
  },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    // Step 1: Check feature flag
    const enabled = await step.run('check-flag', async () => {
      return getFeatureFlag('embedding_anti_gaming', false);
    });

    if (!enabled) return { skipped: true, reason: 'feature flag disabled' };

    // Step 2: Rationale farm detection across DReps with sufficient rationales
    const farmingResult = await step.run('detect-rationale-farming', async () => {
      const supabase = getSupabaseAdmin();

      // Get DReps with 10+ rationale embeddings
      const { data: drepCounts } = await supabase
        .from('embeddings')
        .select('secondary_id')
        .eq('entity_type', 'rationale')
        .not('secondary_id', 'is', null);

      if (!drepCounts?.length) return { checked: 0, suspects: 0, details: [] };

      // Count per DRep
      const countMap = new Map<string, number>();
      for (const row of drepCounts) {
        if (row.secondary_id) {
          countMap.set(row.secondary_id, (countMap.get(row.secondary_id) ?? 0) + 1);
        }
      }

      const eligibleDreps = Array.from(countMap.entries())
        .filter(([, count]) => count >= 10)
        .map(([id]) => id);

      const suspects: { drepId: string; rationaleCount: number; meanSimilarity: number }[] = [];

      for (const drepId of eligibleDreps) {
        const result = await detectRationaleFarming(drepId);
        if (result.isSuspect) {
          suspects.push({
            drepId,
            rationaleCount: result.rationaleCount,
            meanSimilarity: result.meanSimilarity,
          });
        }
      }

      return { checked: eligibleDreps.length, suspects: suspects.length, details: suspects };
    });

    // Step 3: Template detection for recent proposals
    const templateResult = await step.run('detect-template-usage', async () => {
      const supabase = getSupabaseAdmin();

      // Get distinct proposal entity IDs that have rationale embeddings
      const { data: proposalIds } = await supabase
        .from('embeddings')
        .select('entity_id')
        .eq('entity_type', 'rationale')
        .limit(500);

      if (!proposalIds?.length) return { checked: 0, clustersFound: 0 };

      const uniqueProposals = [...new Set(proposalIds.map((p) => p.entity_id))];
      let totalClusters = 0;

      for (const proposalId of uniqueProposals) {
        const result = await detectTemplateUsage(proposalId);
        totalClusters += result.templateClusters.length;
      }

      return { checked: uniqueProposals.length, clustersFound: totalClusters };
    });

    // Step 4: Profile-vote hypocrisy check
    const hypocrisyResult = await step.run('detect-hypocrisy', async () => {
      const supabase = getSupabaseAdmin();

      // Get DReps with both profile and rationale embeddings
      const { data: profileDreps } = await supabase
        .from('embeddings')
        .select('entity_id')
        .eq('entity_type', 'drep_profile')
        .limit(500);

      if (!profileDreps?.length) return { checked: 0, mismatches: 0 };

      const drepIds = profileDreps.map((p) => p.entity_id);
      let mismatches = 0;

      for (const drepId of drepIds) {
        const result = await detectProfileVoteHypocrisy(drepId);
        if (result.isMismatch) {
          mismatches++;
        }
      }

      return { checked: drepIds.length, mismatches };
    });

    // Step 5: Enhanced sybil detection with rationale embedding correlation
    const sybilResult = await step.run('enhanced-sybil-detection', async () => {
      const supabase = getSupabaseAdmin();

      // Get SPO votes for standard sybil detection
      const { data: spoVotes } = await supabase
        .from('spo_votes')
        .select('pool_id, proposal_tx_hash, proposal_index, vote')
        .limit(5000);

      if (!spoVotes?.length) return { pairs: 0, highConfidence: 0 };

      // Build vote map
      const poolVoteMap = new Map<string, Map<string, 'Yes' | 'No' | 'Abstain'>>();
      for (const v of spoVotes) {
        const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
        const votes = poolVoteMap.get(v.pool_id) ?? new Map();
        votes.set(key, v.vote as 'Yes' | 'No' | 'Abstain');
        poolVoteMap.set(v.pool_id, votes);
      }

      // Run standard detection
      const standardFlags = detectSybilPairs(poolVoteMap);

      // Enhance with embedding correlation
      const enhancedFlags = await enhanceSybilWithEmbeddings(standardFlags);

      const highConfidenceCount = enhancedFlags.filter((f) => f.highConfidence).length;

      return {
        pairs: enhancedFlags.length,
        highConfidence: highConfidenceCount,
      };
    });

    // Step 6: Store results summary
    await step.run('store-results', async () => {
      const supabase = getSupabaseAdmin();

      const summary = {
        timestamp: new Date().toISOString(),
        farming: farmingResult,
        templates: templateResult,
        hypocrisy: hypocrisyResult,
        sybil: sybilResult,
      };

      // Store as a gaming_signals record in a lightweight table
      // Using the existing sync_health pattern: upsert by key
      await supabase.from('kv_store').upsert(
        {
          key: 'gaming_signals_latest',
          value: summary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );

      logger.info('[detect-gaming-signals] Scan complete', summary);
    });

    return {
      farming: farmingResult,
      templates: templateResult,
      hypocrisy: hypocrisyResult,
      sybil: sybilResult,
    };
  },
);
