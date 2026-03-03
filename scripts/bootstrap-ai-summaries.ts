/**
 * Bootstrap: AI Summaries + Two-Tier Power Backfill + Proposal Voting Summaries
 * Run: npx tsx scripts/bootstrap-ai-summaries.ts
 *
 * 1. Backfills voting power (exact epoch match + nearest epoch interpolation)
 * 2. Fetches canonical proposal voting summaries from Koios
 * 3. Generates ALL missing AI summaries (proposals + rationales)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { fetchDRepVotingPowerHistory, fetchProposalVotingSummary } from '../utils/koios';
import { getSupabaseAdmin } from '../lib/supabase';

function truncateToWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BATCH_SIZE = 100;

async function main() {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Data Integrity Bootstrap                        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const supabase = getSupabaseAdmin();

  // ═══ PART 1: Two-Tier Vote Power Backfill ═════════════════════════════════

  console.log('Part 1: Two-tier vote power backfill...');
  const p1Start = Date.now();

  // Ensure all votes have epoch_no
  const { blockTimeToEpoch: bte } = await import('../lib/koios');
  const { data: nullEpochVotes } = await supabase
    .from('drep_votes')
    .select('vote_tx_hash, block_time')
    .is('epoch_no', null)
    .not('block_time', 'is', null)
    .limit(5000);

  if (nullEpochVotes && nullEpochVotes.length > 0) {
    console.log(`  Fixing ${nullEpochVotes.length} votes with NULL epoch_no...`);
    for (const row of nullEpochVotes) {
      await supabase
        .from('drep_votes')
        .update({ epoch_no: bte(row.block_time) })
        .eq('vote_tx_hash', row.vote_tx_hash);
    }
  }

  // Get all unique DRep IDs with NULL power (paginated)
  const allDrepIds = new Set<string>();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .is('voting_power_lovelace', null)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    for (const row of data) allDrepIds.add(row.drep_id);
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Prioritize top DReps by score
  const { data: rankedDreps } = await supabase
    .from('dreps')
    .select('id, info')
    .order('score', { ascending: false })
    .limit(500);
  const drepPower = new Map<string, number>();
  for (const d of rankedDreps || []) {
    const info = d.info as Record<string, unknown> | null;
    drepPower.set(d.id, parseInt((info?.votingPowerLovelace as string) || '0', 10));
  }

  const uniqueIds = [...allDrepIds].sort(
    (a, b) => (drepPower.get(b) || 0) - (drepPower.get(a) || 0),
  );
  console.log(`  ${uniqueIds.length} DReps need power backfill (top DReps first)\n`);

  let exactTotal = 0,
    nearestTotal = 0,
    koiosErrors = 0;
  const PARALLEL = 10;

  for (let i = 0; i < uniqueIds.length; i++) {
    const drepId = uniqueIds[i];
    const drepStart = Date.now();
    try {
      const history = await fetchDRepVotingPowerHistory(drepId);
      if (history.length > 0) {
        const snapRows = history.map((h) => ({
          drep_id: drepId,
          epoch_no: h.epoch_no,
          amount_lovelace: parseInt(h.amount, 10) || 0,
        }));
        await supabase
          .from('drep_power_snapshots')
          .upsert(snapRows, { onConflict: 'drep_id,epoch_no', ignoreDuplicates: true });

        const historyEpochs = new Set(history.map((h) => h.epoch_no));

        // Tier 1: exact epoch match — parallel batches of PARALLEL
        for (let b = 0; b < snapRows.length; b += PARALLEL) {
          const batch = snapRows.slice(b, b + PARALLEL);
          const results = await Promise.allSettled(
            batch.map((snap) =>
              supabase
                .from('drep_votes')
                .update(
                  { voting_power_lovelace: snap.amount_lovelace, power_source: 'exact' },
                  { count: 'exact' },
                )
                .eq('drep_id', drepId)
                .eq('epoch_no', snap.epoch_no)
                .is('voting_power_lovelace', null),
            ),
          );
          for (const r of results) {
            if (r.status === 'fulfilled') exactTotal += r.value.count || 0;
          }
        }

        // Tier 2: nearest epoch for remaining NULL votes — parallel batches
        const { data: remaining } = await supabase
          .from('drep_votes')
          .select('vote_tx_hash, epoch_no')
          .eq('drep_id', drepId)
          .is('voting_power_lovelace', null)
          .not('epoch_no', 'is', null);

        const tier2Updates = (remaining || [])
          .filter((v) => !historyEpochs.has(v.epoch_no))
          .map((vote) => {
            const nearest = history.reduce((best, h) =>
              Math.abs(h.epoch_no - vote.epoch_no) < Math.abs(best.epoch_no - vote.epoch_no)
                ? h
                : best,
            );
            return { voteTxHash: vote.vote_tx_hash, power: parseInt(nearest.amount, 10) };
          });

        for (let b = 0; b < tier2Updates.length; b += PARALLEL) {
          const batch = tier2Updates.slice(b, b + PARALLEL);
          await Promise.allSettled(
            batch.map((u) =>
              supabase
                .from('drep_votes')
                .update({ voting_power_lovelace: u.power, power_source: 'nearest' })
                .eq('vote_tx_hash', u.voteTxHash),
            ),
          );
          nearestTotal += batch.length;
        }
      }
    } catch (err) {
      koiosErrors++;
      if (koiosErrors <= 5)
        console.error(
          `  Koios error for ${drepId.slice(0, 20)}...: ${err instanceof Error ? err.message : err}`,
        );
    }

    await sleep(300);
    if ((i + 1) % 10 === 0 || i === uniqueIds.length - 1) {
      const elapsed = ((Date.now() - p1Start) / 1000).toFixed(0);
      console.log(
        `  [${elapsed}s] ${i + 1}/${uniqueIds.length} DReps | exact=${exactTotal} nearest=${nearestTotal} errs=${koiosErrors} (${Date.now() - drepStart}ms last)`,
      );
    }
  }

  // Validation: top 5 DReps
  console.log('\n  ── Validation: Top DReps ──');
  for (const d of (rankedDreps || []).slice(0, 5)) {
    const info = d.info as Record<string, unknown> | null;
    const name = info?.name || d.id.slice(0, 20) + '...';
    const { count: total } = await supabase
      .from('drep_votes')
      .select('*', { count: 'exact', head: true })
      .eq('drep_id', d.id);
    const { count: withPower } = await supabase
      .from('drep_votes')
      .select('*', { count: 'exact', head: true })
      .eq('drep_id', d.id)
      .not('voting_power_lovelace', 'is', null);
    console.log(
      `  ${name}: ${withPower}/${total} votes have power (${total ? Math.round(((withPower || 0) / total) * 100) : 0}%)`,
    );
  }

  const { count: remainingNull } = await supabase
    .from('drep_votes')
    .select('*', { count: 'exact', head: true })
    .is('voting_power_lovelace', null);
  console.log(
    `\n  Total: ${exactTotal} exact + ${nearestTotal} nearest | Remaining NULL: ${remainingNull}`,
  );
  console.log(`  Part 1 done in ${((Date.now() - p1Start) / 1000).toFixed(1)}s\n`);

  // ═══ PART 2: Proposal Voting Summaries ════════════════════════════════════

  console.log('Part 2: Fetching canonical proposal voting summaries...');
  const p2Start = Date.now();

  const { data: allProposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, proposal_id')
    .not('proposal_id', 'is', null);

  let summariesFetched = 0;
  for (const p of allProposals || []) {
    try {
      const summary = await fetchProposalVotingSummary(p.proposal_id);
      if (!summary) continue;
      await supabase.from('proposal_voting_summary').upsert(
        {
          proposal_tx_hash: p.tx_hash,
          proposal_index: p.proposal_index,
          epoch_no: summary.epoch_no,
          drep_yes_votes_cast: summary.drep_yes_votes_cast,
          drep_yes_vote_power: parseInt(summary.drep_active_yes_vote_power || '0', 10),
          drep_no_votes_cast: summary.drep_no_votes_cast,
          drep_no_vote_power: parseInt(summary.drep_active_no_vote_power || '0', 10),
          drep_abstain_votes_cast: summary.drep_abstain_votes_cast,
          drep_abstain_vote_power: parseInt(summary.drep_active_abstain_vote_power || '0', 10),
          drep_always_abstain_power: parseInt(summary.drep_always_abstain_vote_power || '0', 10),
          drep_always_no_confidence_power: parseInt(
            summary.drep_always_no_confidence_vote_power || '0',
            10,
          ),
          pool_yes_votes_cast: summary.pool_yes_votes_cast,
          pool_yes_vote_power: parseInt(summary.pool_active_yes_vote_power || '0', 10),
          pool_no_votes_cast: summary.pool_no_votes_cast,
          pool_no_vote_power: parseInt(summary.pool_active_no_vote_power || '0', 10),
          pool_abstain_votes_cast: summary.pool_abstain_votes_cast,
          pool_abstain_vote_power: parseInt(summary.pool_active_abstain_vote_power || '0', 10),
          committee_yes_votes_cast: summary.committee_yes_votes_cast,
          committee_no_votes_cast: summary.committee_no_votes_cast,
          committee_abstain_votes_cast: summary.committee_abstain_votes_cast,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'proposal_tx_hash,proposal_index' },
      );
      summariesFetched++;
    } catch (err) {
      console.error(
        `  Summary error for ${p.tx_hash.slice(0, 16)}:`,
        err instanceof Error ? err.message : err,
      );
    }
    await sleep(300);
    if (summariesFetched % 10 === 0 && summariesFetched > 0) {
      console.log(`  ${summariesFetched}/${allProposals?.length || 0} summaries fetched...`);
    }
  }
  console.log(`  Proposal voting summaries: ${summariesFetched}/${allProposals?.length || 0}`);
  console.log(`  Part 2 done in ${((Date.now() - p2Start) / 1000).toFixed(1)}s\n`);

  // ═══ PART 3: AI Summaries ═════════════════════════════════════════════════

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('Part 3: SKIPPED (no ANTHROPIC_API_KEY)\n');
    const dur = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nTotal time: ${dur}s`);
    process.exit(0);
  }

  console.log('Part 3: Generating ALL AI summaries...');
  const p3Start = Date.now();

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Clear bad summaries
  const { data: badSummaries } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index')
    .not('ai_summary', 'is', null)
    .or('ai_summary.ilike.%ipfs.io%,ai_summary.ilike.%ipfs://%,ai_summary.ilike.%bafkrei%');
  if (badSummaries?.length) {
    for (const row of badSummaries) {
      await supabase
        .from('proposals')
        .update({ ai_summary: null })
        .eq('tx_hash', row.tx_hash)
        .eq('proposal_index', row.proposal_index);
    }
    console.log(`  Cleared ${badSummaries.length} bad summaries`);
  }

  // Proposal summaries
  const { data: unsummarized } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount')
    .is('ai_summary', null)
    .not('abstract', 'is', null)
    .neq('abstract', '');

  let proposalSummaries = 0;
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
    if (proposalSummaries % 10 === 0 && proposalSummaries > 0) {
      console.log(`  Proposals: ${proposalSummaries}/${unsummarized?.length}...`);
    }
  }
  console.log(`  Proposal summaries: ${proposalSummaries}`);

  // Rationale summaries
  const { data: unsumRationales } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, rationale_text')
    .is('ai_summary', null)
    .not('rationale_text', 'is', null)
    .neq('rationale_text', '');

  let rationaleSummaries = 0;
  if (unsumRationales?.length) {
    console.log(`  Generating summaries for ${unsumRationales.length} rationales...`);

    const txHashes = [...new Set(unsumRationales.map((r) => r.proposal_tx_hash))];
    const titles = new Map<string, string>();
    for (let i = 0; i < txHashes.length; i += BATCH_SIZE) {
      const { data } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title')
        .in('tx_hash', txHashes.slice(i, i + BATCH_SIZE));
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
      if (rationaleSummaries % 50 === 0 && rationaleSummaries > 0) {
        console.log(`  Rationales: ${rationaleSummaries}/${unsumRationales.length}...`);
      }
    }
  }
  console.log(`  Rationale summaries: ${rationaleSummaries}`);
  console.log(`  Part 3 done in ${((Date.now() - p3Start) / 1000).toFixed(1)}s\n`);

  const dur = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║  Complete in ${dur}s`);
  console.log(`║  Power: ${exactTotal} exact + ${nearestTotal} nearest`);
  console.log(`║  Summaries: ${summariesFetched} proposals (canonical)`);
  console.log(`║  AI: ${proposalSummaries} proposals + ${rationaleSummaries} rationales`);
  console.log('╚══════════════════════════════════════════════════╝');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
