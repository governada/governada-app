/**
 * Validate data integrity after bootstrap backfill.
 * Run: npx tsx scripts/validate-integrity.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

async function main() {
  const supabase = getSupabaseAdmin();

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Data Integrity Validation                       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Vote power coverage
  console.log('── 1. Vote Power Coverage ──');
  const { count: totalVotes } = await supabase
    .from('drep_votes')
    .select('*', { count: 'exact', head: true });
  const { count: withPower } = await supabase
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .not('voting_power_lovelace', 'is', null);
  const { count: nullPower } = await supabase
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .is('voting_power_lovelace', null);
  const { count: exactCount } = await supabase
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .eq('power_source', 'exact');
  const { count: nearestCount } = await supabase
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .eq('power_source', 'nearest');
  console.log(`  Total votes: ${totalVotes}`);
  console.log(
    `  With power: ${withPower} (${totalVotes ? (((withPower || 0) / totalVotes) * 100).toFixed(1) : 0}%)`,
  );
  console.log(`  NULL power: ${nullPower}`);
  console.log(`  Power source: exact=${exactCount}, nearest=${nearestCount}\n`);

  // 2. Proposal voting summaries
  console.log('── 2. Canonical Proposal Voting Summaries ──');
  const { count: totalProposals } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true });
  const { count: withProposalId } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .not('proposal_id', 'is', null);
  const { count: totalSummaries } = await supabase
    .from('proposal_voting_summary')
    .select('*', { count: 'exact', head: true });
  console.log(`  Total proposals: ${totalProposals}`);
  console.log(`  With proposal_id: ${withProposalId}`);
  console.log(`  Canonical summaries: ${totalSummaries}`);
  console.log(
    `  Coverage: ${totalProposals ? (((totalSummaries || 0) / (totalProposals || 1)) * 100).toFixed(1) : 0}%\n`,
  );

  // 3. AI summaries
  console.log('── 3. AI Summaries ──');
  const { count: proposalsWithSummary } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .not('ai_summary', 'is', null);
  const { count: proposalsWithAbstract } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .not('abstract', 'is', null)
    .neq('abstract', '');
  const { count: totalRationales } = await supabase
    .from('vote_rationales')
    .select('*', { count: 'exact', head: true });
  const { count: rationalesWithSummary } = await supabase
    .from('vote_rationales')
    .select('*', { count: 'exact', head: true })
    .not('ai_summary', 'is', null);
  const { count: rationalesWithText } = await supabase
    .from('vote_rationales')
    .select('*', { count: 'exact', head: true })
    .not('rationale_text', 'is', null)
    .neq('rationale_text', '');
  console.log(
    `  Proposals with AI summary: ${proposalsWithSummary}/${proposalsWithAbstract} (with abstract)`,
  );
  console.log(
    `  Rationales with AI summary: ${rationalesWithSummary}/${rationalesWithText} (with text)`,
  );
  console.log(`  Total rationale records: ${totalRationales}\n`);

  // 4. Hash verification
  console.log('── 4. Hash Verification ──');
  const { count: hashVerifiedTrue } = await supabase
    .from('vote_rationales')
    .select('*', { count: 'exact', head: true })
    .eq('hash_verified', true);
  const { count: hashVerifiedFalse } = await supabase
    .from('vote_rationales')
    .select('*', { count: 'exact', head: true })
    .eq('hash_verified', false);
  const { count: hashNull } = await supabase
    .from('vote_rationales')
    .select('*', { count: 'exact', head: true })
    .is('hash_verified', null);
  console.log(
    `  Rationale hash: verified=${hashVerifiedTrue}, mismatch=${hashVerifiedFalse}, pending=${hashNull}`,
  );

  const { count: metaVerifiedTrue } = await supabase
    .from('dreps')
    .select('*', { count: 'exact', head: true })
    .eq('metadata_hash_verified', true);
  const { count: metaVerifiedFalse } = await supabase
    .from('dreps')
    .select('*', { count: 'exact', head: true })
    .eq('metadata_hash_verified', false);
  const { count: metaNull } = await supabase
    .from('dreps')
    .select('*', { count: 'exact', head: true })
    .is('metadata_hash_verified', null);
  console.log(
    `  DRep metadata hash: verified=${metaVerifiedTrue}, mismatch=${metaVerifiedFalse}, pending=${metaNull}\n`,
  );

  // 5. Power snapshots
  console.log('── 5. Power Snapshots ──');
  const { count: snapshotCount } = await supabase
    .from('drep_power_snapshots')
    .select('*', { count: 'exact', head: true });
  const { data: snapshotDreps } = await supabase.from('drep_power_snapshots').select('drep_id');
  const uniqueSnapshotDreps = new Set((snapshotDreps || []).map((r) => r.drep_id)).size;
  console.log(`  Total snapshots: ${snapshotCount} across ${uniqueSnapshotDreps} DReps\n`);

  // 6. Top 5 DRep vote power check
  console.log('── 6. Top 5 DRep Vote Power Validation ──');
  const { data: topDreps } = await supabase
    .from('dreps')
    .select('id, info')
    .order('score', { ascending: false })
    .limit(5);
  for (const d of topDreps || []) {
    const info = d.info as Record<string, unknown> | null;
    const name = (info?.name as string) || d.id.slice(0, 20) + '...';
    const { count: dTotal } = await supabase
      .from('drep_votes')
      .select('*', { count: 'exact', head: true })
      .eq('drep_id', d.id);
    const { count: dPower } = await supabase
      .from('drep_votes')
      .select('*', { count: 'exact', head: true })
      .eq('drep_id', d.id)
      .not('voting_power_lovelace', 'is', null);
    console.log(
      `  ${name}: ${dPower}/${dTotal} votes have power (${dTotal ? Math.round(((dPower || 0) / dTotal) * 100) : 0}%)`,
    );
  }

  // 7. Sample canonical summary cross-check
  console.log('\n── 7. Sample Canonical Summary ──');
  const { data: sampleSummary } = await supabase
    .from('proposal_voting_summary')
    .select('*')
    .limit(1)
    .single();
  if (sampleSummary) {
    console.log(
      `  Proposal: ${sampleSummary.proposal_tx_hash.slice(0, 16)}... (index ${sampleSummary.proposal_index})`,
    );
    console.log(`  Epoch: ${sampleSummary.epoch_no}`);
    console.log(
      `  DRep Yes: ${sampleSummary.drep_yes_votes_cast} votes, ${(sampleSummary.drep_yes_vote_power / 1e6).toFixed(0)}M ADA`,
    );
    console.log(
      `  DRep No: ${sampleSummary.drep_no_votes_cast} votes, ${(sampleSummary.drep_no_vote_power / 1e6).toFixed(0)}M ADA`,
    );
    console.log(`  DRep Abstain: ${sampleSummary.drep_abstain_votes_cast} votes`);
    console.log(
      `  Always Abstain Power: ${(sampleSummary.drep_always_abstain_power / 1e6).toFixed(0)}M ADA`,
    );
    console.log(
      `  Always No Confidence Power: ${(sampleSummary.drep_always_no_confidence_power / 1e6).toFixed(0)}M ADA`,
    );
  } else {
    console.log('  No canonical summaries found!');
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('Validation complete.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
