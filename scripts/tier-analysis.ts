/**
 * Read-only analysis: How many votes fall into each backfill tier?
 * Measures the epoch gap between votes and available Koios history.
 * Run: npx tsx scripts/tier-analysis.ts
 */
import { config } from 'dotenv';
config({ path: require('path').resolve(process.cwd(), '.env.local') });

import { fetchDRepVotingPowerHistory } from '../utils/koios';
import { getSupabaseAdmin } from '../lib/supabase';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sb = getSupabaseAdmin();

  // Total counts
  const { count: totalVotes } = await sb
    .from('drep_votes')
    .select('*', { count: 'exact', head: true });
  const { count: withPower } = await sb
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .not('voting_power_lovelace', 'is', null);
  const { count: nullPower } = await sb
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .is('voting_power_lovelace', null);

  console.log('=== VOTE POWER COVERAGE ===');
  console.log(`Total votes: ${totalVotes}`);
  console.log(
    `With power:  ${withPower} (${(((withPower || 0) / (totalVotes || 1)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `NULL power:  ${nullPower} (${(((nullPower || 0) / (totalVotes || 1)) * 100).toFixed(1)}%)\n`,
  );

  // Get a representative sample of NULL-power votes with their DRep IDs
  // Paginate to get ALL null-power DRep+epoch combos
  const nullVotesByDrep = new Map<string, number[]>();
  let offset = 0;
  while (true) {
    const { data } = await sb
      .from('drep_votes')
      .select('drep_id, epoch_no')
      .is('voting_power_lovelace', null)
      .not('epoch_no', 'is', null)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (!nullVotesByDrep.has(row.drep_id)) nullVotesByDrep.set(row.drep_id, []);
      nullVotesByDrep.get(row.drep_id)!.push(row.epoch_no);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Also count votes with NULL epoch_no
  const { count: nullEpoch } = await sb
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .is('voting_power_lovelace', null)
    .is('epoch_no', null);

  console.log(`NULL-power votes with NULL epoch_no: ${nullEpoch || 0}`);
  console.log(`NULL-power DReps to analyze: ${nullVotesByDrep.size}`);
  console.log(
    `NULL-power votes with valid epoch: ${[...nullVotesByDrep.values()].reduce((s, e) => s + e.length, 0)}\n`,
  );

  // Sample up to 50 DReps (prioritize those with most NULL votes)
  const sorted = [...nullVotesByDrep.entries()].sort((a, b) => b[1].length - a[1].length);

  const sampleSize = Math.min(50, sorted.length);
  const sampled = sorted.slice(0, sampleSize);

  let tier1Count = 0; // exact match
  let tier2Count = 0; // nearest epoch (with gap tracking)
  let tier3Count = 0; // no Koios history at all
  let tier2Gaps: number[] = []; // epoch gap sizes for tier 2
  let koiosEmpty = 0;
  let totalSampledVotes = 0;

  console.log(`Analyzing ${sampleSize} DReps (by most NULL votes)...\n`);

  for (let i = 0; i < sampled.length; i++) {
    const [drepId, voteEpochs] = sampled[i];
    totalSampledVotes += voteEpochs.length;

    try {
      const history = await fetchDRepVotingPowerHistory(drepId);

      if (history.length === 0) {
        koiosEmpty++;
        tier3Count += voteEpochs.length;
        if (i < 5)
          console.log(
            `  ${drepId.slice(0, 30)}...: ${voteEpochs.length} votes, NO Koios history → Tier 3`,
          );
      } else {
        const historyEpochs = new Set(history.map((h) => h.epoch_no));
        const minHistory = Math.min(...history.map((h) => h.epoch_no));
        const maxHistory = Math.max(...history.map((h) => h.epoch_no));

        let t1 = 0,
          t2 = 0;
        for (const voteEpoch of voteEpochs) {
          if (historyEpochs.has(voteEpoch)) {
            t1++;
            tier1Count++;
          } else {
            // Find nearest epoch
            const nearest = history.reduce((best, h) =>
              Math.abs(h.epoch_no - voteEpoch) < Math.abs(best.epoch_no - voteEpoch) ? h : best,
            );
            const gap = Math.abs(nearest.epoch_no - voteEpoch);
            tier2Count++;
            t2++;
            tier2Gaps.push(gap);
          }
        }

        if (i < 10) {
          console.log(
            `  ${drepId.slice(0, 30)}...: ${voteEpochs.length} votes, history epochs ${minHistory}-${maxHistory} (${history.length} epochs), T1=${t1} T2=${t2}`,
          );
        }
      }
    } catch (err) {
      tier3Count += voteEpochs.length;
      if (i < 3)
        console.error(
          `  Error for ${drepId.slice(0, 30)}...: ${err instanceof Error ? err.message : err}`,
        );
    }

    await sleep(500);
    if ((i + 1) % 20 === 0) console.log(`  ...processed ${i + 1}/${sampleSize} DReps`);
  }

  // Extrapolate from sample to full population
  const totalNullVotes = [...nullVotesByDrep.values()].reduce((s, e) => s + e.length, 0);
  const sampleRatio = totalNullVotes / (totalSampledVotes || 1);

  console.log('\n=== TIER DISTRIBUTION (sampled) ===');
  console.log(`Sampled: ${totalSampledVotes} votes across ${sampleSize} DReps`);
  console.log(
    `Tier 1 (exact match):     ${tier1Count} (${((tier1Count / totalSampledVotes) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Tier 2 (nearest epoch):   ${tier2Count} (${((tier2Count / totalSampledVotes) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Tier 3 (no Koios data):   ${tier3Count} (${((tier3Count / totalSampledVotes) * 100).toFixed(1)}%)`,
  );
  console.log(`DReps with empty history: ${koiosEmpty}/${sampleSize}`);

  console.log('\n=== TIER 2 GAP ANALYSIS ===');
  if (tier2Gaps.length > 0) {
    tier2Gaps.sort((a, b) => a - b);
    const gapCounts: Record<number, number> = {};
    for (const g of tier2Gaps) gapCounts[g] = (gapCounts[g] || 0) + 1;

    console.log('Gap distribution (epochs between vote and nearest history):');
    for (const [gap, count] of Object.entries(gapCounts).sort(
      (a, b) => Number(a[0]) - Number(b[0]),
    )) {
      const pct = ((count / tier2Gaps.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.ceil((count / tier2Gaps.length) * 30));
      console.log(`  ${gap} epoch(s): ${count} votes (${pct}%) ${bar}`);
    }
    console.log(
      `  Min gap: ${tier2Gaps[0]}, Max gap: ${tier2Gaps[tier2Gaps.length - 1]}, Median: ${tier2Gaps[Math.floor(tier2Gaps.length / 2)]}`,
    );
  } else {
    console.log('No Tier 2 votes in sample.');
  }

  // Extrapolated estimates
  console.log('\n=== EXTRAPOLATED ESTIMATES (full dataset) ===');
  const estT1 = Math.round(tier1Count * sampleRatio);
  const estT2 = Math.round(tier2Count * sampleRatio);
  const estT3 = Math.round(tier3Count * sampleRatio);
  console.log(`Est. Tier 1 (exact):   ~${estT1} votes`);
  console.log(`Est. Tier 2 (nearest): ~${estT2} votes`);
  console.log(`Est. Tier 3 (no data): ~${estT3} votes`);
  console.log(`\nOf all ${totalVotes} votes:`);
  console.log(
    `  Already have power: ${withPower} (${(((withPower || 0) / (totalVotes || 1)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Will get exact:    ~${estT1} (${((estT1 / (totalVotes || 1)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Will get nearest:  ~${estT2} (${((estT2 / (totalVotes || 1)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Will get current:  ~${estT3} (${((estT3 / (totalVotes || 1)) * 100).toFixed(1)}%)`,
  );
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
