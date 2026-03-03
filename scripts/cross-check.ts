/**
 * Cross-check: compare our per-vote power sums against Koios canonical tallies.
 * Read-only diagnostic.
 * Run: npx tsx scripts/cross-check.ts
 */
import { config } from 'dotenv';
config({ path: require('path').resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

const KOIOS = 'https://api.koios.rest/api/v1';

async function main() {
  const sb = getSupabaseAdmin();

  // Pick a ratified proposal we have votes for
  const txHash = 'c21b00f90f18fce4003edf42b0b0d455126e01c946e80cc5341a9f9750caf795';
  const proposalIndex = 0;

  console.log('=== CROSS-CHECK: Our data vs Koios canonical ===\n');
  console.log(`Proposal: ${txHash.slice(0, 20)}... (ParameterChange, ratified epoch 613)\n`);

  // Our data: sum voting_power_lovelace by vote type
  const { data: ourVotes } = await sb
    .from('drep_votes')
    .select('vote, voting_power_lovelace')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex);

  const ourTotals = { Yes: 0n, No: 0n, Abstain: 0n, count: { Yes: 0, No: 0, Abstain: 0 } };
  let withPower = 0,
    withoutPower = 0;

  for (const v of ourVotes || []) {
    const voteType = v.vote as 'Yes' | 'No' | 'Abstain';
    if (v.voting_power_lovelace != null) {
      ourTotals[voteType] += BigInt(v.voting_power_lovelace);
      ourTotals.count[voteType]++;
      withPower++;
    } else {
      withoutPower++;
    }
  }

  console.log(
    `Our data: ${ourVotes?.length} total votes (${withPower} with power, ${withoutPower} without)\n`,
  );
  console.log('             Our Sum (lovelace)          Koios Canonical              Delta');
  console.log('─'.repeat(90));

  // Koios canonical (hardcoded from the API response above)
  const koios = {
    drep_yes_votes_cast: 224,
    drep_active_yes_vote_power: 4995622431737537n,
    drep_no_votes_cast: 4,
    drep_active_no_vote_power: 183751165868532n,
    drep_abstain_votes_cast: 6,
    drep_active_abstain_vote_power: 21167569375007n,
  };

  const formatADA = (lovelace: bigint) => `${(Number(lovelace) / 1_000_000).toLocaleString()} ADA`;
  const pctDiff = (ours: bigint, theirs: bigint) => {
    if (theirs === 0n) return ours === 0n ? '0%' : 'N/A';
    return ((Number(ours - theirs) / Number(theirs)) * 100).toFixed(2) + '%';
  };

  console.log(
    `Yes:    ${formatADA(ourTotals.Yes).padEnd(30)} ${formatADA(koios.drep_active_yes_vote_power).padEnd(30)} ${pctDiff(ourTotals.Yes, koios.drep_active_yes_vote_power)}`,
  );
  console.log(
    `No:     ${formatADA(ourTotals.No).padEnd(30)} ${formatADA(koios.drep_active_no_vote_power).padEnd(30)} ${pctDiff(ourTotals.No, koios.drep_active_no_vote_power)}`,
  );
  console.log(
    `Abstain:${formatADA(ourTotals.Abstain).padEnd(30)} ${formatADA(koios.drep_active_abstain_vote_power).padEnd(30)} ${pctDiff(ourTotals.Abstain, koios.drep_active_abstain_vote_power)}`,
  );

  console.log(
    `\nVote counts: Yes ${ourTotals.count.Yes} (Koios: ${koios.drep_yes_votes_cast}), No ${ourTotals.count.No} (Koios: ${koios.drep_no_votes_cast}), Abstain ${ourTotals.count.Abstain} (Koios: ${koios.drep_abstain_votes_cast})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
