/**
 * Slow Sync — runs daily via cron.
 * Handles: rationale pipeline, AI summaries, social link checks,
 * hash verification, vote power backfill, and push notifications.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger as log } from '@/lib/logger';
import { SyncLogger, errMsg, emitPostHog, batchUpsert } from '@/lib/sync-utils';
import { blake2bHex } from 'blakejs';
import { fetchDRepVotingPowerHistory, fetchDRepInfo } from '@/utils/koios';
import { getProposalPriority } from '@/utils/proposalPriority';
import { broadcastDiscord, broadcastEvent } from '@/lib/notifications';
import { precomputeSimilarityCache } from '@/lib/proposalSimilarity';
import * as Sentry from '@sentry/nextjs';

const RATIONALE_FETCH_TIMEOUT_MS = 5000;
const RATIONALE_MAX_CONTENT_SIZE = 50_000;
const RATIONALE_CONCURRENCY = 8;
const RATIONALE_MAX_PER_SYNC = 200;

function truncateToWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
}

function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/ipfs:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractJsonLdString(val: unknown): string | null {
  if (typeof val === 'string') return val.trim() || null;
  if (val && typeof val === 'object' && '@value' in (val as Record<string, unknown>)) {
    const v = (val as Record<string, unknown>)['@value'];
    if (typeof v === 'string') return v.trim() || null;
  }
  if (Array.isArray(val) && val.length > 0) return extractJsonLdString(val[0]);
  return null;
}

async function fetchRationaleFromUrl(url: string): Promise<string | null> {
  try {
    let fetchUrl = url;
    if (url.startsWith('ipfs://')) fetchUrl = `https://ipfs.io/ipfs/${url.slice(7)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RATIONALE_FETCH_TIMEOUT_MS);
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json, text/plain, */*' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > RATIONALE_MAX_CONTENT_SIZE) return null;

    const text = await response.text();
    if (text.length > RATIONALE_MAX_CONTENT_SIZE) return null;

    try {
      const json = JSON.parse(text);
      if (json.body && typeof json.body === 'object') {
        for (const key of ['comment', 'rationale', 'motivation']) {
          const extracted = extractJsonLdString(json.body[key]);
          if (extracted) return extracted;
        }
      }
      for (const key of ['rationale', 'motivation', 'justification', 'reason', 'comment']) {
        const extracted = extractJsonLdString(json[key]);
        if (extracted) return extracted;
      }
      if (typeof json === 'string' && json.trim()) return json.trim();
    } catch {
      if (text.trim() && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
        return text.trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

type SupabaseClient = ReturnType<typeof getSupabaseAdmin>;

// ── Operation 1: Rationale pipeline ──────────────────────────────────────────

async function runRationalePipeline(supabase: SupabaseClient) {
  const { data: votesWithMeta } = await supabase
    .from('drep_votes')
    .select('vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, meta_url, meta_hash')
    .not('meta_url', 'is', null);

  if (!votesWithMeta?.length) return { fetched: 0, cached: 0, inline: 0 };

  const txHashes = votesWithMeta.map((v: Record<string, string>) => v.vote_tx_hash);
  const { data: existingRows } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash')
    .in('vote_tx_hash', txHashes.slice(0, 1000))
    .not('rationale_text', 'is', null);

  const alreadyCached = new Set(
    (existingRows || []).map((r: { vote_tx_hash: string }) => r.vote_tx_hash),
  );
  const uncached = votesWithMeta
    .filter((v: { vote_tx_hash: string }) => !alreadyCached.has(v.vote_tx_hash))
    .slice(0, RATIONALE_MAX_PER_SYNC);

  if (uncached.length === 0) return { fetched: 0, cached: alreadyCached.size, inline: 0 };

  log.info('[SlowSync] Fetching rationales for uncached votes', { count: uncached.length });

  const rationaleRows: Record<string, unknown>[] = [];
  for (let i = 0; i < uncached.length; i += RATIONALE_CONCURRENCY) {
    const chunk = uncached.slice(i, i + RATIONALE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(
        async (v: {
          vote_tx_hash: string;
          drep_id: string;
          proposal_tx_hash: string;
          proposal_index: number;
          meta_url: string;
        }) => {
          const text = await fetchRationaleFromUrl(v.meta_url);
          return {
            vote_tx_hash: v.vote_tx_hash,
            drep_id: v.drep_id,
            proposal_tx_hash: v.proposal_tx_hash,
            proposal_index: v.proposal_index,
            meta_url: v.meta_url,
            rationale_text: text,
          };
        },
      ),
    );
    rationaleRows.push(...results);
  }

  const successRows = rationaleRows.filter((r) => r.rationale_text !== null);
  if (successRows.length > 0) {
    await batchUpsert(supabase, 'vote_rationales', successRows, 'vote_tx_hash', 'Rationale URL');
  }

  await supabase.from('vote_rationales').delete().is('rationale_text', null);

  log.info('[SlowSync] Rationales processed', {
    fetched: successRows.length,
    cached: alreadyCached.size,
  });
  return { fetched: successRows.length, cached: alreadyCached.size, inline: 0 };
}

// ── Operation 2: AI summaries ────────────────────────────────────────────────

async function runAiSummaries(supabase: SupabaseClient) {
  if (!process.env.ANTHROPIC_API_KEY) return { proposals: 0, rationales: 0, skipped: true };

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let proposalSummaries = 0;
  let rationaleSummaries = 0;

  const { data: unsummarized } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount')
    .is('ai_summary', null)
    .not('abstract', 'is', null)
    .neq('abstract', '')
    .limit(10);

  const proposalUpdates: { tx_hash: string; proposal_index: number; ai_summary: string }[] = [];
  for (const row of unsummarized || []) {
    try {
      const amountCtx = row.withdrawal_amount
        ? `\nWithdrawal Amount: ${Number(row.withdrawal_amount).toLocaleString()} ADA`
        : '';
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 80,
        messages: [
          {
            role: 'user',
            content: `Summarize this Cardano governance proposal in 1-2 short sentences for a casual ADA holder. Plain language, no jargon. Neutral tone. No URLs or hashes. Your entire response must be 160 characters or fewer.\n\nTitle: ${row.title || 'Untitled'}\nType: ${row.proposal_type}${amountCtx}\nDescription: ${(row.abstract || '').slice(0, 2000)}`,
          },
        ],
      });
      const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
      const summary = raw ? truncateToWordBoundary(stripUrls(raw), 160) : null;
      if (summary) {
        proposalUpdates.push({
          tx_hash: row.tx_hash,
          proposal_index: row.proposal_index,
          ai_summary: summary,
        });
        proposalSummaries++;
      }
    } catch (e) {
      log.error('[SlowSync] AI proposal summary error', { error: errMsg(e) });
    }
  }
  if (proposalUpdates.length > 0) {
    await batchUpsert(
      supabase,
      'proposals',
      proposalUpdates,
      'tx_hash,proposal_index',
      'AI proposal summary',
    );
  }

  const { data: unsumRationales } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, rationale_text')
    .is('ai_summary', null)
    .not('rationale_text', 'is', null)
    .neq('rationale_text', '')
    .limit(20);

  if (unsumRationales?.length) {
    const txHashes = [
      ...new Set(unsumRationales.map((r: { proposal_tx_hash: string }) => r.proposal_tx_hash)),
    ];
    const { data: pRows } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title')
      .in('tx_hash', txHashes);
    const titles = new Map<string, string>();
    for (const p of pRows || [])
      titles.set(`${p.tx_hash}-${p.proposal_index}`, p.title || 'Untitled');

    const vtxs = unsumRationales.map((r: { vote_tx_hash: string }) => r.vote_tx_hash);
    const { data: vRows } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash, vote')
      .in('vote_tx_hash', vtxs);
    const dirs = new Map<string, string>();
    for (const v of vRows || []) dirs.set(v.vote_tx_hash, v.vote);

    const rationaleUpdates: { vote_tx_hash: string; ai_summary: string }[] = [];
    for (const row of unsumRationales) {
      try {
        const title =
          titles.get(`${row.proposal_tx_hash}-${row.proposal_index}`) || 'this proposal';
        const dir = dirs.get(row.vote_tx_hash) || 'voted';
        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 80,
          messages: [
            {
              role: 'user',
              content: `Summarize this DRep's rationale for voting ${dir} on "${title}" in 1-2 neutral sentences. Plain language, no editorializing. No URLs or hashes. Your entire response must be 160 characters or fewer.\n\nRationale: ${(row.rationale_text || '').slice(0, 1500)}`,
            },
          ],
        });
        const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
        const summary = raw ? truncateToWordBoundary(stripUrls(raw), 160) : null;
        if (summary) {
          rationaleUpdates.push({ vote_tx_hash: row.vote_tx_hash, ai_summary: summary });
          rationaleSummaries++;
        }
      } catch (e) {
        log.error('[SlowSync] AI rationale summary error', { error: errMsg(e) });
      }
    }
    if (rationaleUpdates.length > 0) {
      await batchUpsert(
        supabase,
        'vote_rationales',
        rationaleUpdates,
        'vote_tx_hash',
        'AI rationale summary',
      );
    }
  }

  log.info('[SlowSync] AI summaries', {
    proposals: proposalSummaries,
    rationales: rationaleSummaries,
  });
  return { proposals: proposalSummaries, rationales: rationaleSummaries, skipped: false };
}

// ── Operation 3: Social link checks ─────────────────────────────────────────

async function runSocialLinkChecks(supabase: SupabaseClient) {
  const LINK_CHECK_LIMIT = 50;
  const staleThreshold = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const { data: dreps } = await supabase.from('dreps').select('id, metadata');
  if (!dreps?.length) return { checked: 0 };

  const allLinks: { drep_id: string; uri: string }[] = [];
  const seen = new Set<string>();

  for (const drep of dreps) {
    const refs = (drep.metadata as Record<string, unknown>)?.references;
    if (!Array.isArray(refs)) continue;
    for (const ref of refs) {
      if (ref && typeof ref === 'object' && 'uri' in ref) {
        const uri = (ref as { uri: unknown }).uri;
        if (typeof uri === 'string' && uri.startsWith('http')) {
          const key = `${drep.id}|${uri}`;
          if (seen.has(key)) continue;
          seen.add(key);
          allLinks.push({ drep_id: drep.id, uri });
        }
      }
    }
  }

  if (allLinks.length === 0) return { checked: 0 };

  const { data: existing } = await supabase
    .from('social_link_checks')
    .select('drep_id, uri, last_checked_at')
    .in('uri', allLinks.map((l) => l.uri).slice(0, 500));

  const freshSet = new Set<string>();
  for (const row of existing || []) {
    if (row.last_checked_at && row.last_checked_at > staleThreshold) {
      freshSet.add(`${row.drep_id}|${row.uri}`);
    }
  }

  const toCheck = allLinks
    .filter((l) => !freshSet.has(`${l.drep_id}|${l.uri}`))
    .slice(0, LINK_CHECK_LIMIT);

  const linkResults: Record<string, unknown>[] = [];
  for (const link of toCheck) {
    let status = 'broken';
    let httpStatus: number | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(link.uri, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Governada-LinkChecker/1.0' },
      });
      clearTimeout(timeout);
      httpStatus = res.status;
      status = res.ok ? 'valid' : 'broken';
    } catch {
      /* stays broken */
    }

    linkResults.push({
      drep_id: link.drep_id,
      uri: link.uri,
      status,
      http_status: httpStatus,
      last_checked_at: new Date().toISOString(),
    });
  }

  if (linkResults.length > 0) {
    await batchUpsert(
      supabase,
      'social_link_checks',
      linkResults,
      'drep_id,uri',
      'Social link check',
    );
    log.info('[SlowSync] Social links checked', { count: linkResults.length });
  }
  return { checked: linkResults.length };
}

// ── Operation 4: Vote power backfill ────────────────────────────────────────

async function runVotePowerBackfill(supabase: SupabaseClient) {
  const drepSet = new Set<string>();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .is('voting_power_lovelace', null)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    for (const r of data) drepSet.add(r.drep_id);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const uniqueIds = [...drepSet];
  if (uniqueIds.length === 0) {
    log.info('[SlowSync] Vote power backfill: complete (no NULL rows)');
    return { exact: 0, nearest: 0 };
  }

  log.info('[SlowSync] Backfilling voting power', {
    uniqueDreps: uniqueIds.length,
    processing: 50,
  });
  let exactCount = 0;
  let nearestCount = 0;

  for (const drepId of uniqueIds.slice(0, 50)) {
    try {
      const history = await fetchDRepVotingPowerHistory(drepId);
      if (history.length === 0) continue;

      const snapRows = history.map((h) => ({
        drep_id: drepId,
        epoch_no: h.epoch_no,
        amount_lovelace: parseInt(h.amount, 10) || 0,
      }));
      const { error: snapErr } = await supabase
        .from('drep_power_snapshots')
        .upsert(snapRows, { onConflict: 'drep_id,epoch_no', ignoreDuplicates: true });
      if (snapErr)
        log.error('[SlowSync] power_snapshots upsert error', { drepId, error: snapErr.message });

      const epochPowerMap = new Map(snapRows.map((s) => [s.epoch_no, s.amount_lovelace]));
      const { data: exactVotes } = await supabase
        .from('drep_votes')
        .select('vote_tx_hash, epoch_no')
        .eq('drep_id', drepId)
        .in(
          'epoch_no',
          snapRows.map((s) => s.epoch_no),
        )
        .is('voting_power_lovelace', null);

      const exactUpdates = (exactVotes || []).map(
        (v: { vote_tx_hash: string; epoch_no: number }) => ({
          vote_tx_hash: v.vote_tx_hash,
          voting_power_lovelace: epochPowerMap.get(v.epoch_no)!,
          power_source: 'exact',
        }),
      );
      exactCount += exactUpdates.length;
      if (exactUpdates.length > 0) {
        await batchUpsert(supabase, 'drep_votes', exactUpdates, 'vote_tx_hash', 'Power exact');
      }

      const { data: remaining } = await supabase
        .from('drep_votes')
        .select('vote_tx_hash, epoch_no')
        .eq('drep_id', drepId)
        .is('voting_power_lovelace', null)
        .not('epoch_no', 'is', null);

      const nearestUpdates = (remaining || []).map(
        (vote: { vote_tx_hash: string; epoch_no: number }) => {
          const nearest = history.reduce((best, h) =>
            Math.abs(h.epoch_no - vote.epoch_no) < Math.abs(best.epoch_no - vote.epoch_no)
              ? h
              : best,
          );
          return {
            vote_tx_hash: vote.vote_tx_hash,
            voting_power_lovelace: parseInt(nearest.amount, 10),
            power_source: 'nearest',
          };
        },
      );
      nearestCount += nearestUpdates.length;
      if (nearestUpdates.length > 0) {
        await batchUpsert(supabase, 'drep_votes', nearestUpdates, 'vote_tx_hash', 'Power nearest');
      }
    } catch (err) {
      log.warn('[SlowSync] Power backfill error', {
        drepId: drepId.slice(0, 20),
        error: errMsg(err),
      });
    }
  }

  log.info('[SlowSync] Power backfill complete', { exact: exactCount, nearest: nearestCount });
  return { exact: exactCount, nearest: nearestCount };
}

// ── Operation 5: Rationale hash verification ────────────────────────────────

async function runRationaleHashVerification(supabase: SupabaseClient) {
  const { data: unchecked } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash, meta_url')
    .is('hash_verified', null)
    .not('meta_url', 'is', null)
    .limit(50);

  if (!unchecked?.length) return { verified: 0, failed: 0 };

  const txHashes = unchecked.map((r: { vote_tx_hash: string }) => r.vote_tx_hash);
  const { data: voteHashes } = await supabase
    .from('drep_votes')
    .select('vote_tx_hash, meta_hash')
    .in('vote_tx_hash', txHashes)
    .not('meta_hash', 'is', null);

  const hashMap = new Map<string, string>();
  for (const v of voteHashes || []) hashMap.set(v.vote_tx_hash, v.meta_hash);

  let verified = 0;
  let failed = 0;

  const hashUpdates: { vote_tx_hash: string; hash_verified: boolean }[] = [];
  for (const row of unchecked) {
    const expectedHash = hashMap.get(row.vote_tx_hash);
    if (!expectedHash) continue;
    try {
      let fetchUrl = row.meta_url;
      if (fetchUrl.startsWith('ipfs://')) fetchUrl = `https://ipfs.io/ipfs/${fetchUrl.slice(7)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const rawBytes = new Uint8Array(await res.arrayBuffer());
      const computedHash = blake2bHex(rawBytes, undefined, 32);
      const matches = computedHash === expectedHash;
      hashUpdates.push({ vote_tx_hash: row.vote_tx_hash, hash_verified: matches });
      if (matches) verified++;
      else failed++;
    } catch {
      /* skip */
    }
  }
  if (hashUpdates.length > 0) {
    await batchUpsert(supabase, 'vote_rationales', hashUpdates, 'vote_tx_hash', 'Rationale hash');
  }

  log.info('[SlowSync] Rationale hash verification', { verified, mismatch: failed });
  return { verified, failed };
}

// ── Operation 6: DRep metadata hash verification ────────────────────────────

async function runDRepMetadataHashVerification(supabase: SupabaseClient) {
  const { data: unchecked } = await supabase
    .from('dreps')
    .select('id')
    .is('metadata_hash_verified', null)
    .limit(50);

  if (!unchecked?.length) return { verified: 0, failed: 0, noAnchor: 0 };

  const drepIds = unchecked.map((r: { id: string }) => r.id);
  const infoList = await fetchDRepInfo(drepIds);
  const anchorMap = new Map<string, { url: string; hash: string }>();
  for (const info of infoList) {
    if (info.anchor_url && info.anchor_hash) {
      anchorMap.set(info.drep_id, { url: info.anchor_url, hash: info.anchor_hash });
    }
  }

  let verified = 0;
  let failed = 0;

  const metaHashUpdates: { id: string; metadata_hash_verified: boolean | null }[] = [];

  // DReps without anchor data get null (not checked) rather than false (failed)
  for (const id of drepIds) {
    const anchor = anchorMap.get(id);
    if (!anchor) {
      metaHashUpdates.push({ id, metadata_hash_verified: null });
      continue;
    }
    try {
      let fetchUrl = anchor.url;
      if (fetchUrl.startsWith('ipfs://')) fetchUrl = `https://ipfs.io/ipfs/${fetchUrl.slice(7)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        metaHashUpdates.push({ id, metadata_hash_verified: false });
        failed++;
        continue;
      }
      const rawBytes = new Uint8Array(await res.arrayBuffer());
      const computedHash = blake2bHex(rawBytes, undefined, 32);
      const matches = computedHash === anchor.hash;
      metaHashUpdates.push({ id, metadata_hash_verified: matches });
      if (matches) verified++;
      else failed++;
    } catch {
      metaHashUpdates.push({ id, metadata_hash_verified: false });
      failed++;
    }
  }
  if (metaHashUpdates.length > 0) {
    await batchUpsert(supabase, 'dreps', metaHashUpdates, 'id', 'DRep metadata hash');
  }

  const noAnchor = metaHashUpdates.length - verified - failed;
  if (verified + failed + noAnchor > 0) {
    log.info('[SlowSync] DRep metadata hash verification', {
      verified,
      mismatch: failed,
      noAnchor,
    });
  }
  return { verified, failed, noAnchor };
}

// ── Operation 7: Push notifications ─────────────────────────────────────────

async function runCriticalProposalNotifications(supabase: SupabaseClient) {
  const { data: openCritical } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type')
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null);

  const critical = (openCritical || []).filter(
    (p: Record<string, unknown>) => getProposalPriority(p.proposal_type as string) === 'critical',
  );

  if (critical.length === 0) return { sent: 0, skipped: false };

  const newest = critical[0];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://governada.io';

  const event = {
    eventType: 'critical-proposal-open' as const,
    title: 'Critical Proposal Open',
    body: (newest.title as string) || 'A critical governance proposal requires DRep attention.',
    url: `${baseUrl}/proposals/${newest.tx_hash}/${newest.proposal_index}`,
    metadata: { txHash: newest.tx_hash, index: newest.proposal_index },
  };
  await broadcastDiscord(event).catch((e) =>
    log.error('[SlowSync] broadcastDiscord failed', { error: e }),
  );
  const sent = await broadcastEvent(event);

  log.info('[SlowSync] Critical proposal notifications', { sent });
  return { sent, skipped: false };
}

// ── Exported runner ──────────────────────────────────────────────────────────

/**
 * Core slow sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeSlowSync(): Promise<Record<string, unknown>> {
  return Sentry.startSpan({ name: 'sync.slow', op: 'task' }, async () => {
    const supabase = getSupabaseAdmin();
    const syncLog = new SyncLogger(supabase, 'slow');
    await syncLog.start();

    log.info('[SlowSync] Starting slow sync...');
    const syncErrors: string[] = [];

    const [
      rationaleResult,
      aiResult,
      socialResult,
      powerResult,
      rationaleHashResult,
      drepHashResult,
      pushResult,
      similarityResult,
    ] = await Promise.allSettled([
      runRationalePipeline(supabase),
      runAiSummaries(supabase),
      runSocialLinkChecks(supabase),
      runVotePowerBackfill(supabase),
      runRationaleHashVerification(supabase),
      runDRepMetadataHashVerification(supabase),
      runCriticalProposalNotifications(supabase),
      precomputeSimilarityCache(),
    ]);

    const settled = {
      rationales: rationaleResult.status === 'fulfilled' ? rationaleResult.value : null,
      ai: aiResult.status === 'fulfilled' ? aiResult.value : null,
      social: socialResult.status === 'fulfilled' ? socialResult.value : null,
      power: powerResult.status === 'fulfilled' ? powerResult.value : null,
      rationaleHash: rationaleHashResult.status === 'fulfilled' ? rationaleHashResult.value : null,
      drepHash: drepHashResult.status === 'fulfilled' ? drepHashResult.value : null,
      push: pushResult.status === 'fulfilled' ? pushResult.value : null,
      similarity: similarityResult.status === 'fulfilled' ? similarityResult.value : null,
    };

    const allResults = [
      rationaleResult,
      aiResult,
      socialResult,
      powerResult,
      rationaleHashResult,
      drepHashResult,
      pushResult,
      similarityResult,
    ];
    const labels = [
      'Rationales',
      'AI summaries',
      'Social links',
      'Power backfill',
      'Rationale hash',
      'DRep hash',
      'Push',
      'Similarity cache',
    ];

    // Core operations: failures here mean data integrity issues.
    // Optional operations: failures are logged but don't mark the sync as failed.
    const CORE_INDICES = [0, 3]; // Rationales, Power backfill
    const coreErrors: string[] = [];
    const optionalErrors: string[] = [];

    for (let i = 0; i < allResults.length; i++) {
      if (allResults[i].status === 'rejected') {
        const msg = errMsg((allResults[i] as PromiseRejectedResult).reason);
        if (CORE_INDICES.includes(i)) {
          coreErrors.push(`${labels[i]}: ${msg}`);
        } else {
          optionalErrors.push(`${labels[i]}: ${msg}`);
        }
        syncErrors.push(`${labels[i]}: ${msg}`);
        log.error(`[SlowSync] ${labels[i]} failed`, { error: msg });
      }
    }

    // Success if core operations pass. Optional failures are logged as warnings.
    const success = coreErrors.length === 0;
    const metrics = {
      rationales_fetched: settled.rationales?.fetched ?? 0,
      rationales_cached: settled.rationales?.cached ?? 0,
      ai_proposal_summaries: settled.ai?.proposals ?? 0,
      ai_rationale_summaries: settled.ai?.rationales ?? 0,
      social_links_checked: settled.social?.checked ?? 0,
      power_exact: settled.power?.exact ?? 0,
      power_nearest: settled.power?.nearest ?? 0,
      rationale_hash_verified: settled.rationaleHash?.verified ?? 0,
      rationale_hash_failed: settled.rationaleHash?.failed ?? 0,
      drep_hash_verified: settled.drepHash?.verified ?? 0,
      drep_hash_failed: settled.drepHash?.failed ?? 0,
      push_sent: settled.push?.sent ?? 0,
      similarity_cached: settled.similarity ?? 0,
      duration_ms: syncLog.elapsed,
    };

    const duration = (syncLog.elapsed / 1000).toFixed(1);
    log.info('[SlowSync] Sync complete', { durationSeconds: duration, issues: syncErrors.length });

    const errorSummary =
      syncErrors.length > 0
        ? (coreErrors.length > 0 ? 'CORE: ' : 'OPTIONAL: ') + syncErrors.join('; ')
        : null;
    await syncLog.finalize(success, errorSummary, metrics);
    await emitPostHog(success, 'slow', syncLog.elapsed, {
      ...metrics,
      core_errors: coreErrors.length,
      optional_errors: optionalErrors.length,
    });

    return {
      success,
      metrics,
      durationSeconds: duration,
      errors: syncErrors.length > 0 ? syncErrors : undefined,
      timestamp: new Date().toISOString(),
    };
  });
}
