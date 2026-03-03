/**
 * DRep Outreach Extraction Script
 * Extracts contact info from DRep metadata anchors and generates claim links.
 * Run with: npx tsx scripts/outreach-extract.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseAdmin } from '../lib/supabase';
import { writeFileSync } from 'fs';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io';

interface DRepRow {
  id: string;
  info: Record<string, any> | null;
  metadata: Record<string, any> | null;
  score: number;
  anchor_url: string | null;
}

interface OutreachRecord {
  drepId: string;
  name: string;
  score: number;
  claimed: boolean;
  twitter: string | null;
  github: string | null;
  website: string | null;
  email: string | null;
  anchorUrl: string | null;
  claimLink: string;
}

function extractSocialFromMetadata(metadata: Record<string, any> | null): {
  twitter: string | null;
  github: string | null;
  website: string | null;
  email: string | null;
} {
  const result = {
    twitter: null as string | null,
    github: null as string | null,
    website: null as string | null,
    email: null as string | null,
  };
  if (!metadata) return result;

  const refs: Array<{ uri?: unknown; label?: unknown }> = metadata.references || [];
  for (const ref of refs) {
    const uri = typeof ref.uri === 'string' ? ref.uri.toLowerCase() : '';
    const label = typeof ref.label === 'string' ? ref.label.toLowerCase() : '';
    if (uri && (uri.includes('twitter.com') || uri.includes('x.com'))) {
      result.twitter = ref.uri as string;
    } else if (uri && uri.includes('github.com')) {
      result.github = ref.uri as string;
    } else if (
      label &&
      (label.includes('website') || label.includes('homepage') || label.includes('blog'))
    ) {
      result.website = typeof ref.uri === 'string' ? ref.uri : null;
    }
  }

  if (metadata.email) result.email = metadata.email;

  return result;
}

async function fetchAnchorSocials(anchorUrl: string): Promise<{
  twitter: string | null;
  github: string | null;
  website: string | null;
  email: string | null;
}> {
  const result = {
    twitter: null as string | null,
    github: null as string | null,
    website: null as string | null,
    email: null as string | null,
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(anchorUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return result;

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return result;
    }

    const body = json.body || json;
    const refs: Array<{ uri?: unknown; label?: unknown }> = body?.references || [];

    for (const ref of refs) {
      const uri = typeof ref.uri === 'string' ? ref.uri.toLowerCase() : '';
      if (uri && (uri.includes('twitter.com') || uri.includes('x.com')))
        result.twitter = ref.uri as string;
      else if (uri && uri.includes('github.com')) result.github = ref.uri as string;
    }

    if (body?.email) result.email = body.email;
  } catch {
    // Timeout or network error — skip
  }
  return result;
}

async function main() {
  const supabase = getSupabaseAdmin();
  console.log('Fetching DReps from Supabase...');

  const { data: dreps, error } = await supabase
    .from('dreps')
    .select('id, info, metadata, score, anchor_url')
    .order('score', { ascending: false });

  if (error || !dreps) {
    console.error('Failed to fetch DReps:', error);
    process.exit(1);
  }

  console.log(`Found ${dreps.length} DReps. Checking claim status...`);

  const { data: claimedUsers } = await supabase
    .from('users')
    .select('claimed_drep_id')
    .not('claimed_drep_id', 'is', null);

  const claimedSet = new Set((claimedUsers || []).map((u) => u.claimed_drep_id));
  console.log(`${claimedSet.size} DReps already claimed.`);

  const records: OutreachRecord[] = [];

  for (let i = 0; i < dreps.length; i++) {
    const d = dreps[i] as DRepRow;
    const name = d.info?.name || d.info?.handle || d.id.slice(0, 20) + '…';
    const claimed = claimedSet.has(d.id);
    const metaSocials = extractSocialFromMetadata(d.metadata);

    let anchorSocials = {
      twitter: null as string | null,
      github: null as string | null,
      website: null as string | null,
      email: null as string | null,
    };
    if (!claimed && d.anchor_url && !metaSocials.twitter && !metaSocials.github) {
      if (i < 100) {
        anchorSocials = await fetchAnchorSocials(d.anchor_url);
      }
    }

    records.push({
      drepId: d.id,
      name,
      score: d.score || 0,
      claimed,
      twitter: metaSocials.twitter || anchorSocials.twitter,
      github: metaSocials.github || anchorSocials.github,
      website: metaSocials.website || anchorSocials.website,
      email: metaSocials.email || anchorSocials.email,
      anchorUrl: d.anchor_url,
      claimLink: `${SITE_URL}/claim/${encodeURIComponent(d.id)}`,
    });

    if ((i + 1) % 50 === 0) {
      console.log(`Processed ${i + 1}/${dreps.length}...`);
    }
  }

  const unclaimed = records.filter((r) => !r.claimed);
  const withContact = unclaimed.filter((r) => r.twitter || r.github || r.email);

  console.log(`\nResults:`);
  console.log(`  Total DReps: ${records.length}`);
  console.log(`  Claimed: ${records.length - unclaimed.length}`);
  console.log(`  Unclaimed: ${unclaimed.length}`);
  console.log(`  Unclaimed with contact info: ${withContact.length}`);

  // Write full JSON
  writeFileSync('outreach-data.json', JSON.stringify(records, null, 2));
  console.log(`\nWrote outreach-data.json`);

  // Write CSV for unclaimed DReps with contact info
  const csvHeader = 'drepId,name,score,twitter,github,email,website,claimLink';
  const csvRows = withContact.map((r) =>
    [
      r.drepId,
      `"${r.name.replace(/"/g, '""')}"`,
      r.score,
      r.twitter || '',
      r.github || '',
      r.email || '',
      r.website || '',
      r.claimLink,
    ].join(','),
  );
  writeFileSync('outreach-contacts.csv', [csvHeader, ...csvRows].join('\n'));
  console.log(`Wrote outreach-contacts.csv (${withContact.length} rows)`);

  // Write simple claim links for batch DMs
  const claimLinks = unclaimed
    .slice(0, 100)
    .map((r) => `${r.name} (Score: ${r.score}) — ${r.claimLink}`)
    .join('\n');
  writeFileSync('outreach-claim-links.txt', claimLinks);
  console.log(`Wrote outreach-claim-links.txt (top 100 unclaimed)`);
}

main().catch(console.error);
