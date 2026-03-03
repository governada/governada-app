/**
 * DRep Sync Script
 * Fetches all enriched DReps from Koios API and syncs to Supabase for fast reads
 * Run with: npm run sync
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getEnrichedDReps } from '../lib/koios';
import { getSupabaseAdmin } from '../lib/supabase';

interface SupabaseDRepRow {
  id: string;
  metadata: any;
  info: any;
  votes: any[];
  score: number;
  participation_rate: number;
  rationale_rate: number;
  reliability_score: number;
  reliability_streak: number;
  reliability_recency: number;
  reliability_longest_gap: number;
  reliability_tenure: number;
  deliberation_modifier: number;
  effective_participation: number;
  size_tier: string;
}

async function syncDReps() {
  const startTime = Date.now();

  console.log('[Sync] Starting DRep sync...');
  console.log('[Sync] Fetching enriched DReps from Koios...');

  try {
    // Fetch all enriched DReps from Koios (this takes 10-40s)
    const { allDReps, error } = await getEnrichedDReps(false); // false = get ALL DReps

    if (error) {
      console.error('[Sync] ✗ Failed to fetch DReps from Koios');
      process.exit(1);
    }

    if (!allDReps || allDReps.length === 0) {
      console.warn('[Sync] ⚠ No DReps fetched from Koios');
      process.exit(1);
    }

    console.log(`[Sync] ✓ Fetched ${allDReps.length} DReps from Koios`);
    console.log('[Sync] Transforming data for Supabase...');

    // Transform EnrichedDRep[] to Supabase schema
    const rows: SupabaseDRepRow[] = allDReps.map((drep) => ({
      id: drep.drepId,
      metadata: drep.metadata || {},
      info: {
        drepHash: drep.drepHash,
        handle: drep.handle,
        name: drep.name,
        ticker: drep.ticker,
        description: drep.description,
        votingPower: drep.votingPower,
        votingPowerLovelace: drep.votingPowerLovelace,
        delegatorCount: drep.delegatorCount,
        totalVotes: drep.totalVotes,
        yesVotes: drep.yesVotes,
        noVotes: drep.noVotes,
        abstainVotes: drep.abstainVotes,
        isActive: drep.isActive,
        anchorUrl: drep.anchorUrl,
        epochVoteCounts: drep.epochVoteCounts,
      },
      votes: [], // Note: We don't cache full votes array for space reasons
      score: drep.drepScore,
      participation_rate: drep.participationRate,
      rationale_rate: drep.rationaleRate,
      reliability_score: drep.reliabilityScore,
      reliability_streak: drep.reliabilityStreak,
      reliability_recency: drep.reliabilityRecency,
      reliability_longest_gap: drep.reliabilityLongestGap,
      reliability_tenure: drep.reliabilityTenure,
      deliberation_modifier: drep.deliberationModifier,
      effective_participation: drep.effectiveParticipation,
      size_tier: drep.sizeTier,
    }));

    console.log(`[Sync] ✓ Transformed ${rows.length} rows`);
    console.log('[Sync] Connecting to Supabase...');

    // Get admin client for write access
    const supabase = getSupabaseAdmin();

    // Batch upsert in chunks of 100 (Supabase recommended batch size)
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      console.log(
        `[Sync] Upserting batch ${batchNumber}/${totalBatches} (${batch.length} rows)...`,
      );

      const { data, error } = await supabase.from('dreps').upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: false, // Update existing rows
      });

      if (error) {
        console.error(`[Sync] ✗ Error in batch ${batchNumber}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`[Sync] ✓ Batch ${batchNumber}/${totalBatches} complete`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n[Sync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[Sync] ✓ Sync complete in ${duration}s`);
    console.log(`[Sync] Success: ${successCount} rows`);
    if (errorCount > 0) {
      console.log(`[Sync] Errors: ${errorCount} rows`);
    }
    console.log('[Sync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('[Sync] ✗ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run sync
syncDReps();
