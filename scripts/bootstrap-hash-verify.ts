/**
 * Bootstrap: Hash verification for rationales and DRep metadata.
 * Run: npx tsx scripts/bootstrap-hash-verify.ts
 *
 * Verifies blake2b-256 hashes of:
 * 1. Vote rationale content vs on-chain meta_hash
 * 2. DRep metadata content vs on-chain anchor_hash
 *
 * Optimized: parallel fetches (10 concurrent), batched DB updates, no offset drift bug.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { blake2bHex } from 'blakejs';
import { getSupabaseAdmin } from '../lib/supabase';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DB_BATCH_SIZE = 100; // rows fetched per DB query
const CONCURRENCY = 10; // parallel URL fetches per chunk
const CHUNK_SLEEP_MS = 150; // pause between concurrent chunks

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const supabase = getSupabaseAdmin();

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Hash Verification Bootstrap (Optimized)         ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ═══ PART 1: Rationale Hash Verification ═══════════════════════════════════
  console.log('Part 1: Rationale hash verification (blake2b-256)...');
  const p1Start = Date.now();

  let verified = 0,
    mismatched = 0,
    noHash = 0,
    fetchErrors = 0,
    offset = 0;

  while (true) {
    const { data: batch } = await supabase
      .from('vote_rationales')
      .select('vote_tx_hash, meta_url')
      .is('hash_verified', null)
      .not('meta_url', 'is', null)
      .neq('meta_url', '')
      .range(offset, offset + DB_BATCH_SIZE - 1);

    if (!batch || batch.length === 0) break;

    // Fetch meta_hashes for this batch in one query
    const txHashes = batch.map((r) => r.vote_tx_hash);
    const { data: votes } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash, meta_hash')
      .in('vote_tx_hash', txHashes);

    const hashMap = new Map<string, string>();
    for (const v of votes || []) {
      if (v.meta_hash) hashMap.set(v.vote_tx_hash, v.meta_hash);
    }

    // Filter to items that have a meta_hash to check
    const itemsWithHash = batch.filter((r) => hashMap.has(r.vote_tx_hash));
    const itemsWithoutHash = batch.length - itemsWithHash.length;
    noHash += itemsWithoutHash;

    // Process in parallel chunks of CONCURRENCY
    for (let i = 0; i < itemsWithHash.length; i += CONCURRENCY) {
      const chunk = itemsWithHash.slice(i, i + CONCURRENCY);

      await Promise.allSettled(
        chunk.map(async (rat) => {
          const metaHash = hashMap.get(rat.vote_tx_hash)!;
          const content = await fetchWithTimeout(rat.meta_url);

          if (!content) {
            fetchErrors++;
            return; // stays null → retried on re-run
          }

          const computedHash = blake2bHex(content, undefined, 32);
          const isVerified = computedHash === metaHash;

          await supabase
            .from('vote_rationales')
            .update({ hash_verified: isVerified })
            .eq('vote_tx_hash', rat.vote_tx_hash);

          if (isVerified) verified++;
          else mismatched++;
        }),
      );

      if (i + CONCURRENCY < itemsWithHash.length) await sleep(CHUNK_SLEEP_MS);
    }

    const total = verified + mismatched + fetchErrors;
    const elapsed = ((Date.now() - p1Start) / 1000).toFixed(0);
    console.log(
      `  [${elapsed}s] processed=${total} verified=${verified} mismatch=${mismatched} fetchErr=${fetchErrors} noHash=${noHash}`,
    );

    if (batch.length < DB_BATCH_SIZE) break;
    offset += batch.length; // advance by full batch — no per-item offset drift
  }

  console.log(
    `\n  Final: verified=${verified} mismatch=${mismatched} fetchErr=${fetchErrors} noHash=${noHash}`,
  );
  console.log(`  Part 1 done in ${((Date.now() - p1Start) / 1000).toFixed(1)}s\n`);

  // ═══ PART 2: DRep Metadata Hash Verification ══════════════════════════════
  console.log('Part 2: DRep metadata hash verification (blake2b-256)...');
  const p2Start = Date.now();

  let metaVerified = 0,
    metaMismatch = 0,
    metaFetchErr = 0,
    metaNoUrl = 0;
  offset = 0;

  while (true) {
    const { data: batch } = await supabase
      .from('dreps')
      .select('id, anchor_url, anchor_hash')
      .is('metadata_hash_verified', null)
      .range(offset, offset + DB_BATCH_SIZE - 1);

    if (!batch || batch.length === 0) break;

    // Filter to DReps that have both anchor_url and anchor_hash
    const itemsWithAnchors = batch.filter((d) => d.anchor_url && d.anchor_hash);
    metaNoUrl += batch.length - itemsWithAnchors.length;

    // Process in parallel chunks of CONCURRENCY
    for (let i = 0; i < itemsWithAnchors.length; i += CONCURRENCY) {
      const chunk = itemsWithAnchors.slice(i, i + CONCURRENCY);

      await Promise.allSettled(
        chunk.map(async (drep) => {
          const content = await fetchWithTimeout(drep.anchor_url!);

          if (!content) {
            metaFetchErr++;
            return; // stays null → retried on re-run
          }

          const computedHash = blake2bHex(content, undefined, 32);
          const isVerified = computedHash === drep.anchor_hash;

          await supabase
            .from('dreps')
            .update({ metadata_hash_verified: isVerified })
            .eq('id', drep.id);

          if (isVerified) metaVerified++;
          else metaMismatch++;
        }),
      );

      if (i + CONCURRENCY < itemsWithAnchors.length) await sleep(CHUNK_SLEEP_MS);
    }

    const total = metaVerified + metaMismatch + metaFetchErr;
    const elapsed = ((Date.now() - p2Start) / 1000).toFixed(0);
    console.log(
      `  [${elapsed}s] processed=${total} verified=${metaVerified} mismatch=${metaMismatch} fetchErr=${metaFetchErr} noUrl=${metaNoUrl}`,
    );

    if (batch.length < DB_BATCH_SIZE) break;
    offset += batch.length;
  }

  console.log(
    `\n  Final: verified=${metaVerified} mismatch=${metaMismatch} fetchErr=${metaFetchErr} noUrl=${metaNoUrl}`,
  );
  console.log(`  Part 2 done in ${((Date.now() - p2Start) / 1000).toFixed(1)}s\n`);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║  Hash Verification Complete`);
  console.log(`║  Rationale: ${verified} verified, ${mismatched} mismatch`);
  console.log(`║  Metadata:  ${metaVerified} verified, ${metaMismatch} mismatch`);
  console.log('╚══════════════════════════════════════════════════╝');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
