/**
 * Bootstrap Sync — one-time full data population.
 * Run locally: npx tsx scripts/bootstrap-sync.ts
 *
 * Fetches ALL data with maximum parallelism:
 * - All DReps + votes (bulk), proposals
 * - All delegator counts
 * - All vote power history backfill
 * - All rationale URL fetches (no cap)
 * - All AI summaries (no cap)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getEnrichedDReps, blockTimeToEpoch } from '../lib/koios';
import {
  fetchProposals,
  fetchDRepDelegatorCount,
  fetchDRepVotingPowerHistory,
  fetchAllVotesBulk,
} from '../utils/koios';
import { classifyProposals, computeAllCategoryScores } from '../lib/alignment';
import type { DRepVote, ClassifiedProposal } from '../types/koios';
import type { ProposalContext } from '../utils/scoring';
import { getSupabaseAdmin } from '../lib/supabase';

const BATCH_SIZE = 100;
const DELEGATOR_CONCURRENCY = 20;
const RATIONALE_CONCURRENCY = 10;
const RATIONALE_FETCH_TIMEOUT_MS = 8000;
const RATIONALE_MAX_CONTENT_SIZE = 50000;

function truncateToWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
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
      if (text.trim() && !text.includes('<!DOCTYPE') && !text.includes('<html')) return text.trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function batchUpsert(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  label: string,
): Promise<number> {
  let success = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: false });
    if (error) console.error(`  [${label}] batch error:`, error.message);
    else success += batch.length;
  }
  return success;
}

async function main() {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       DRepScore Bootstrap Sync               ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const supabase = getSupabaseAdmin();

  // ═══ STEP 1: Fetch all data from Koios in parallel ═════════════════════════

  console.log('Step 1: Fetching all data from Koios...');
  const step1Start = Date.now();

  let classifiedProposals: ClassifiedProposal[] = [];
  const proposalContextMap = new Map<string, ProposalContext>();
  let bulkVotesMap: Record<string, DRepVote[]> = {};

  const [proposalsResult, votesResult] = await Promise.allSettled([
    fetchProposals().then((raw) => {
      classifiedProposals = classifyProposals(raw);
      for (const p of classifiedProposals) {
        proposalContextMap.set(`${p.txHash}-${p.index}`, {
          proposalType: p.type,
          treasuryTier: p.treasuryTier,
        });
      }
      console.log(`  Proposals: ${classifiedProposals.length}`);
    }),
    fetchAllVotesBulk().then((votes) => {
      bulkVotesMap = votes;
      const total = Object.values(votes).reduce((s, v) => s + v.length, 0);
      console.log(`  Votes: ${total} across ${Object.keys(votes).length} DReps`);
    }),
  ]);

  if (proposalsResult.status === 'rejected')
    console.error('  Proposals FAILED:', proposalsResult.reason);
  if (votesResult.status === 'rejected') console.error('  Votes FAILED:', votesResult.reason);

  console.log(`  Step 1 done in ${((Date.now() - step1Start) / 1000).toFixed(1)}s\n`);

  // ═══ STEP 2: Enrich DReps ══════════════════════════════════════════════════

  console.log('Step 2: Enriching DReps...');
  const step2Start = Date.now();

  const hasBulkVotes = Object.keys(bulkVotesMap).length > 0;
  const result = await getEnrichedDReps(false, {
    includeRawVotes: true,
    proposalContextMap: proposalContextMap.size > 0 ? proposalContextMap : undefined,
    ...(hasBulkVotes ? { prefetchedVotes: bulkVotesMap } : {}),
  });

  if (result.error || !result.allDReps?.length) {
    console.error('FATAL: DRep enrichment failed');
    process.exit(1);
  }

  const allDReps = result.allDReps;
  const rawVotesMap = result.rawVotesMap as Record<string, DRepVote[]> | undefined;
  console.log(`  Enriched ${allDReps.length} DReps`);
  console.log(`  Step 2 done in ${((Date.now() - step2Start) / 1000).toFixed(1)}s\n`);

  // ═══ STEP 3: Parallel upserts ═════════════════════════════════════════════

  console.log('Step 3: Upserting DReps, votes, proposals...');
  const step3Start = Date.now();

  const drepRows = allDReps.map((drep) => ({
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
    votes: [],
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
    profile_completeness: drep.profileCompleteness,
  }));

  // FIX: Upsert ALL votes from bulkVotesMap directly (includes deregistered DRep votes)
  const voteRows: Record<string, unknown>[] = [];
  const allVotesFlat: { drepId: string; vote: DRepVote }[] = [];

  for (const [drepId, votes] of Object.entries(bulkVotesMap)) {
    for (const vote of votes) {
      voteRows.push({
        vote_tx_hash: vote.vote_tx_hash,
        drep_id: drepId,
        proposal_tx_hash: vote.proposal_tx_hash,
        proposal_index: vote.proposal_index,
        vote: vote.vote,
        epoch_no: vote.epoch_no ?? (vote.block_time ? blockTimeToEpoch(vote.block_time) : null),
        block_time: vote.block_time,
        meta_url: vote.meta_url,
        meta_hash: vote.meta_hash,
      });
      allVotesFlat.push({ drepId, vote });
    }
  }

  const dedupedVotes = [...new Map(voteRows.map((r) => [r.vote_tx_hash as string, r])).values()];

  const proposalRows =
    classifiedProposals.length > 0
      ? [
          ...new Map(
            classifiedProposals.map((p) => [
              `${p.txHash}-${p.index}`,
              {
                tx_hash: p.txHash,
                proposal_index: p.index,
                proposal_id: p.proposalId,
                proposal_type: p.type,
                title: p.title,
                abstract: p.abstract,
                withdrawal_amount: p.withdrawalAmountAda,
                treasury_tier: p.treasuryTier,
                param_changes: p.paramChanges,
                relevant_prefs: p.relevantPrefs,
                proposed_epoch: p.proposedEpoch,
                block_time: p.blockTime,
                expired_epoch: p.expiredEpoch,
                ratified_epoch: p.ratifiedEpoch,
                enacted_epoch: p.enactedEpoch,
                dropped_epoch: p.droppedEpoch,
                expiration_epoch: p.expirationEpoch,
              },
            ]),
          ).values(),
        ]
      : [];

  const [drepCount, voteCount, proposalCount] = await Promise.all([
    batchUpsert(supabase, 'dreps', drepRows, 'id', 'DReps'),
    batchUpsert(supabase, 'drep_votes', dedupedVotes, 'vote_tx_hash', 'Votes'),
    batchUpsert(supabase, 'proposals', proposalRows, 'tx_hash,proposal_index', 'Proposals'),
  ]);

  console.log(`  DReps: ${drepCount}, Votes: ${voteCount}, Proposals: ${proposalCount}`);
  console.log(`  Step 3 done in ${((Date.now() - step3Start) / 1000).toFixed(1)}s\n`);

  // ═══ STEP 4: Delegator counts + Power snapshots + Alignment ════════════════

  console.log('Step 4: Delegator counts, power snapshots, alignment scores...');
  const step4Start = Date.now();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  await Promise.allSettled([
    // Delegator counts
    (async () => {
      let updated = 0;
      for (let i = 0; i < allDReps.length; i += DELEGATOR_CONCURRENCY) {
        const batch = allDReps.slice(i, i + DELEGATOR_CONCURRENCY);
        const counts = await Promise.all(batch.map((d) => fetchDRepDelegatorCount(d.drepId)));
        for (let j = 0; j < batch.length; j++) {
          if (counts[j] > 0) {
            const { data: existing } = await supabase
              .from('dreps')
              .select('info')
              .eq('id', batch[j].drepId)
              .single();
            if (existing?.info) {
              await supabase
                .from('dreps')
                .update({
                  info: {
                    ...(existing.info as Record<string, unknown>),
                    delegatorCount: counts[j],
                  },
                })
                .eq('id', batch[j].drepId);
              updated++;
            }
          }
        }
        if ((i / DELEGATOR_CONCURRENCY) % 5 === 0) {
          console.log(`  Delegators: ${i + batch.length}/${allDReps.length} processed...`);
        }
      }
      console.log(`  Delegator counts: ${updated} updated`);
    })(),

    // Power snapshots
    (async () => {
      const rows = allDReps
        .filter((d) => d.votingPowerLovelace && d.votingPowerLovelace !== '0')
        .map((d) => ({
          drep_id: d.drepId,
          epoch_no: currentEpoch,
          amount_lovelace: parseInt(d.votingPowerLovelace, 10) || 0,
        }));
      const count = await batchUpsert(
        supabase,
        'drep_power_snapshots',
        rows,
        'drep_id,epoch_no',
        'Power snapshots',
      );
      console.log(`  Power snapshots: ${count} for epoch ${currentEpoch}`);
    })(),

    // Alignment scores
    (async () => {
      if (!rawVotesMap || classifiedProposals.length === 0) return;
      const updates = allDReps.map((drep) => {
        const votes = rawVotesMap![drep.drepId] || [];
        const scores = computeAllCategoryScores(drep, votes, classifiedProposals);
        return {
          id: drep.drepId,
          alignment_treasury_conservative: scores.alignmentTreasuryConservative,
          alignment_treasury_growth: scores.alignmentTreasuryGrowth,
          alignment_decentralization: scores.alignmentDecentralization,
          alignment_security: scores.alignmentSecurity,
          alignment_innovation: scores.alignmentInnovation,
          alignment_transparency: scores.alignmentTransparency,
          last_vote_time: scores.lastVoteTime,
        };
      });
      const count = await batchUpsert(supabase, 'dreps', updates, 'id', 'Alignment');
      console.log(`  Alignment scores: ${count}`);
    })(),

    // Score history
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const rows = allDReps.map((d) => ({
        drep_id: d.drepId,
        score: d.drepScore,
        effective_participation: d.effectiveParticipation,
        rationale_rate: d.rationaleRate,
        reliability_score: d.reliabilityScore,
        profile_completeness: d.profileCompleteness,
        snapshot_date: today,
      }));
      const count = await batchUpsert(
        supabase,
        'drep_score_history',
        rows,
        'drep_id,snapshot_date',
        'Score history',
      );
      console.log(`  Score history: ${count}`);
    })(),
  ]);

  console.log(`  Step 4 done in ${((Date.now() - step4Start) / 1000).toFixed(1)}s\n`);

  // ═══ STEP 5: Vote power backfill ═══════════════════════════════════════════

  console.log('Step 5: Vote power backfill...');
  const step5Start = Date.now();

  // Paginate to get ALL unique DReps with NULL power
  const nullPowerDrepSet = new Set<string>();
  let bfOffset = 0;
  while (true) {
    const { data } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .is('voting_power_lovelace', null)
      .range(bfOffset, bfOffset + 999);
    if (!data || data.length === 0) break;
    for (const r of data) nullPowerDrepSet.add(r.drep_id);
    if (data.length < 1000) break;
    bfOffset += 1000;
  }

  const uniqueDrepIds = [...nullPowerDrepSet];
  console.log(`  ${uniqueDrepIds.length} DReps need power backfill`);

  let backfillTotal = 0;
  for (let i = 0; i < uniqueDrepIds.length; i++) {
    const drepId = uniqueDrepIds[i];
    try {
      const history = await fetchDRepVotingPowerHistory(drepId);
      if (history.length === 0) continue;

      const snapRows = history.map((h) => ({
        drep_id: drepId,
        epoch_no: h.epoch_no,
        amount_lovelace: parseInt(h.amount, 10) || 0,
      }));
      await supabase
        .from('drep_power_snapshots')
        .upsert(snapRows, { onConflict: 'drep_id,epoch_no', ignoreDuplicates: true });

      for (const snap of snapRows) {
        const { count } = await supabase
          .from('drep_votes')
          .update({ voting_power_lovelace: snap.amount_lovelace }, { count: 'exact' })
          .eq('drep_id', drepId)
          .eq('epoch_no', snap.epoch_no)
          .is('voting_power_lovelace', null);
        backfillTotal += count || 0;
      }
    } catch (err) {
      if (i < 5)
        console.error(
          `  Power error for ${drepId.slice(0, 20)}:`,
          err instanceof Error ? err.message : err,
        );
    }

    if ((i + 1) % 20 === 0)
      console.log(
        `  Power backfill: ${i + 1}/${uniqueDrepIds.length} DReps (${backfillTotal} votes)...`,
      );
  }
  console.log(`  Backfilled ${backfillTotal} vote rows`);
  console.log(`  Step 5 done in ${((Date.now() - step5Start) / 1000).toFixed(1)}s\n`);

  // ═══ STEP 6: ALL rationale URL fetches (no cap) ════════════════════════════

  console.log('Step 6: Fetching ALL rationale URLs...');
  const step6Start = Date.now();

  const votesWithUrl = allVotesFlat.filter(
    (v) =>
      v.vote.meta_url &&
      !v.vote.meta_json?.rationale &&
      !v.vote.meta_json?.body?.comment &&
      !v.vote.meta_json?.body?.rationale,
  );

  // Upsert inline rationales first
  const inlineRationales: Record<string, unknown>[] = [];
  for (const { drepId, vote } of allVotesFlat) {
    const text =
      vote.meta_json?.body?.comment || vote.meta_json?.body?.rationale || vote.meta_json?.rationale;
    if (text && typeof text === 'string') {
      inlineRationales.push({
        vote_tx_hash: vote.vote_tx_hash,
        drep_id: drepId,
        proposal_tx_hash: vote.proposal_tx_hash,
        proposal_index: vote.proposal_index,
        meta_url: vote.meta_url,
        rationale_text: text,
      });
    }
  }
  if (inlineRationales.length > 0) {
    const count = await batchUpsert(
      supabase,
      'vote_rationales',
      inlineRationales,
      'vote_tx_hash',
      'Inline rationales',
    );
    console.log(`  Inline rationales: ${count}`);
  }

  // Fetch from URL for the rest
  const txHashes = votesWithUrl.map((v) => v.vote.vote_tx_hash);
  const batchedExisting: Set<string> = new Set();
  for (let i = 0; i < txHashes.length; i += 1000) {
    const { data } = await supabase
      .from('vote_rationales')
      .select('vote_tx_hash')
      .in('vote_tx_hash', txHashes.slice(i, i + 1000))
      .not('rationale_text', 'is', null);
    for (const r of data || []) batchedExisting.add(r.vote_tx_hash);
  }

  const uncached = votesWithUrl.filter((v) => !batchedExisting.has(v.vote.vote_tx_hash));
  console.log(
    `  ${uncached.length} uncached rationale URLs to fetch (${batchedExisting.size} already cached)`,
  );

  let fetched = 0,
    failed = 0;
  for (let i = 0; i < uncached.length; i += RATIONALE_CONCURRENCY) {
    const chunk = uncached.slice(i, i + RATIONALE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async ({ drepId, vote }) => {
        const text = await fetchRationaleFromUrl(vote.meta_url!);
        return {
          vote_tx_hash: vote.vote_tx_hash,
          drep_id: drepId,
          proposal_tx_hash: vote.proposal_tx_hash,
          proposal_index: vote.proposal_index,
          meta_url: vote.meta_url,
          rationale_text: text,
        };
      }),
    );

    const successes = results.filter((r) => r.rationale_text !== null);
    if (successes.length > 0) {
      await supabase.from('vote_rationales').upsert(successes, { onConflict: 'vote_tx_hash' });
    }

    fetched += successes.length;
    failed += results.length - successes.length;

    if ((i / RATIONALE_CONCURRENCY) % 10 === 0 && i > 0) {
      console.log(
        `  Rationale fetch: ${i + chunk.length}/${uncached.length} (${fetched} ok, ${failed} failed)`,
      );
    }
  }
  console.log(`  Rationale fetch complete: ${fetched} succeeded, ${failed} failed`);
  console.log(`  Step 6 done in ${((Date.now() - step6Start) / 1000).toFixed(1)}s\n`);

  // ═══ STEP 7: ALL AI summaries (no cap) ═════════════════════════════════════

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('Step 7: Skipped (no ANTHROPIC_API_KEY)\n');
  } else {
    console.log('Step 7: Generating ALL AI summaries...');
    const step7Start = Date.now();

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Proposal summaries (all missing)
    const { data: unsummarized } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount')
      .is('ai_summary', null)
      .not('abstract', 'is', null)
      .neq('abstract', '');

    let proposalSummaries = 0;
    if (unsummarized?.length) {
      console.log(`  Generating summaries for ${unsummarized.length} proposals...`);
      for (const row of unsummarized) {
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
          const summary = raw
            ? truncateToWordBoundary(
                raw
                  .replace(/https?:\/\/\S+/g, '')
                  .replace(/ipfs:\/\/\S+/g, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim(),
                160,
              )
            : null;
          if (summary) {
            await supabase
              .from('proposals')
              .update({ ai_summary: summary })
              .eq('tx_hash', row.tx_hash)
              .eq('proposal_index', row.proposal_index);
            proposalSummaries++;
          }
        } catch (e) {
          console.error(`  Proposal AI error:`, e);
        }
      }
    }
    console.log(`  Proposal AI summaries: ${proposalSummaries}`);

    // Rationale summaries (all missing)
    const { data: unsumRationales } = await supabase
      .from('vote_rationales')
      .select('vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, rationale_text')
      .is('ai_summary', null)
      .not('rationale_text', 'is', null)
      .neq('rationale_text', '');

    let rationaleSummaries = 0;
    if (unsumRationales?.length) {
      console.log(`  Generating summaries for ${unsumRationales.length} rationales...`);

      const txHashesForTitles = [...new Set(unsumRationales.map((r) => r.proposal_tx_hash))];
      const titles = new Map<string, string>();
      for (let i = 0; i < txHashesForTitles.length; i += 100) {
        const { data } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title')
          .in('tx_hash', txHashesForTitles.slice(i, i + 100));
        for (const p of data || [])
          titles.set(`${p.tx_hash}-${p.proposal_index}`, p.title || 'Untitled');
      }

      const voteTxs = unsumRationales.map((r) => r.vote_tx_hash);
      const dirs = new Map<string, string>();
      for (let i = 0; i < voteTxs.length; i += 1000) {
        const { data } = await supabase
          .from('drep_votes')
          .select('vote_tx_hash, vote')
          .in('vote_tx_hash', voteTxs.slice(i, i + 1000));
        for (const v of data || []) dirs.set(v.vote_tx_hash, v.vote);
      }

      for (let idx = 0; idx < unsumRationales.length; idx++) {
        const row = unsumRationales[idx];
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
          const summary = raw
            ? truncateToWordBoundary(
                raw
                  .replace(/https?:\/\/\S+/g, '')
                  .replace(/ipfs:\/\/\S+/g, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim(),
                160,
              )
            : null;
          if (summary) {
            await supabase
              .from('vote_rationales')
              .update({ ai_summary: summary })
              .eq('vote_tx_hash', row.vote_tx_hash);
            rationaleSummaries++;
          }
        } catch (e) {
          console.error(`  Rationale AI error:`, e);
        }

        if ((idx + 1) % 50 === 0)
          console.log(`  Rationale summaries: ${idx + 1}/${unsumRationales.length}...`);
      }
    }
    console.log(`  Rationale AI summaries: ${rationaleSummaries}`);
    console.log(`  Step 7 done in ${((Date.now() - step7Start) / 1000).toFixed(1)}s\n`);
  }

  // ═══ Done ══════════════════════════════════════════════════════════════════

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  Bootstrap complete in ${totalDuration}s`);
  console.log('╚══════════════════════════════════════════════╝');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
