import { config } from 'dotenv';
config({ path: require('path').resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';

async function main() {
  const sb = getSupabaseAdmin();

  // Epoch distribution of NULL-power votes (sampled)
  const { data: sample } = await sb
    .from('drep_votes')
    .select('epoch_no')
    .is('voting_power_lovelace', null)
    .not('epoch_no', 'is', null)
    .limit(1000);

  const counts: Record<number, number> = {};
  for (const r of sample || []) counts[r.epoch_no] = (counts[r.epoch_no] || 0) + 1;
  console.log('NULL-power vote epoch distribution (sample of 1000):');
  for (const [e, c] of Object.entries(counts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  epoch ${e}: ${c} votes`);
  }

  // Power snapshot epochs
  const { data: snaps } = await sb.from('drep_power_snapshots').select('epoch_no').limit(1000);
  const snapEpochs = [...new Set((snaps || []).map((r) => r.epoch_no))].sort((a, b) => a - b);
  console.log('\nPower snapshot epochs available:', snapEpochs.join(', ') || 'NONE');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
