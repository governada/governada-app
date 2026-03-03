import { config } from 'dotenv';
config({ path: require('path').resolve(process.cwd(), '.env.local') });
import { getSupabaseAdmin } from '../lib/supabase';

async function main() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('dreps')
    .select('id, info')
    .order('score', { ascending: false })
    .limit(1);
  if (!data?.length) {
    console.log('No data');
    return;
  }
  const info = data[0].info as Record<string, unknown>;
  console.log('DRep:', data[0].id);
  console.log('Info keys:', Object.keys(info));
  console.log('votingPowerLovelace:', info.votingPowerLovelace);
  console.log('voting_power:', info.voting_power);
  console.log('amount:', info.amount);
  console.log('Full info (first 500 chars):', JSON.stringify(info).slice(0, 500));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
