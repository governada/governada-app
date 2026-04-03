/**
 * Review Queue API — returns open proposals with intelligence for the review workspace.
 *
 * GET /api/workspace/review-queue?voterId=<drepId|poolId>&voterRole=<drep|spo>
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalDisplayTitle } from '@/utils/display';
import { logger } from '@/lib/logger';
import type {
  ReviewQueueItem,
  ReviewQueueResponse,
  InterBodyVotes,
  CitizenSentiment,
} from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

/** Extract a text field from CIP-108 meta_json (handles both nested and flat formats) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMetaField(metaJson: any, field: string): string | null {
  if (!metaJson) return null;
  const body = metaJson.body ?? metaJson;
  const value = body?.[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Extract references array from CIP-108 meta_json */
/* eslint-disable @typescript-eslint/no-explicit-any */
function extractMetaReferences(
  metaJson: any,
): Array<{ type: string; label: string; uri: string }> | null {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (!metaJson) return null;
  const body = metaJson.body ?? metaJson;
  const refs = body?.references;
  if (!Array.isArray(refs) || refs.length === 0) return null;
  return refs
    .filter((r: Record<string, unknown>) => r?.uri || r?.label)
    .map((r: Record<string, unknown>) => ({
      type: String(r['@type'] ?? 'Other'),
      label: String(r.label ?? ''),
      uri: String(r.uri ?? ''),
    }));
}

export const GET = withRouteHandler(async (request) => {
  const voterId = request.nextUrl.searchParams.get('voterId');
  const voterRole = request.nextUrl.searchParams.get('voterRole') || 'drep';

  if (!voterId) {
    return NextResponse.json({ error: 'Missing voterId' }, { status: 400 });
  }

  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // ── Fetch open proposals ──────────────────────────────────────────────
  const { data: proposals, error: pError } = await supabase
    .from('proposals')
    .select('*')
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null)
    .order('block_time', { ascending: false });

  if (pError || !proposals || proposals.length === 0) {
    return NextResponse.json({
      items: [],
      currentEpoch,
      totalOpen: 0,
    } satisfies ReviewQueueResponse);
  }

  // Filter to proposals that haven't expired by epoch
  const openProposals = proposals.filter((p) => {
    if (!p.expiration_epoch) return true;
    return p.expiration_epoch >= currentEpoch;
  });

  const openTxHashes = openProposals.map((p) => p.tx_hash);

  // ── Parallel data fetches ─────────────────────────────────────────────
  const [voterVotesResult, votingSummaryResult, sentimentResult] = await Promise.all([
    // 1. Voter's existing votes
    voterRole === 'drep'
      ? supabase
          .from('drep_votes')
          .select('proposal_tx_hash, proposal_index, vote')
          .eq('drep_id', voterId)
          .in('proposal_tx_hash', openTxHashes.length > 0 ? openTxHashes : ['__none__'])
      : supabase
          .from('spo_votes')
          .select('proposal_tx_hash, proposal_index, vote')
          .eq('pool_id', voterId)
          .in('proposal_tx_hash', openTxHashes.length > 0 ? openTxHashes : ['__none__']),

    // 2. Proposal voting summaries (inter-body tallies)
    supabase
      .from('proposal_voting_summary')
      .select('*')
      .in('proposal_tx_hash', openTxHashes.length > 0 ? openTxHashes : ['__none__']),

    // 3. Citizen sentiment
    supabase
      .from('citizen_sentiment')
      .select('proposal_tx_hash, proposal_index, sentiment')
      .in('proposal_tx_hash', openTxHashes.length > 0 ? openTxHashes : ['__none__']),
  ]);

  // ── Build voter vote map ──────────────────────────────────────────────
  const voterVoteMap = new Map<string, string>();
  if (voterVotesResult.data) {
    for (const v of voterVotesResult.data) {
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      voterVoteMap.set(key, v.vote);
    }
  }

  // ── Build voting summary map ──────────────────────────────────────────
  const summaryMap = new Map<string, InterBodyVotes>();
  if (votingSummaryResult.data) {
    for (const s of votingSummaryResult.data) {
      const key = `${s.proposal_tx_hash}-${s.proposal_index}`;
      summaryMap.set(key, {
        drep: {
          yes: s.drep_yes_votes_cast ?? 0,
          no: s.drep_no_votes_cast ?? 0,
          abstain: s.drep_abstain_votes_cast ?? 0,
        },
        spo: {
          yes: s.pool_yes_votes_cast ?? 0,
          no: s.pool_no_votes_cast ?? 0,
          abstain: s.pool_abstain_votes_cast ?? 0,
        },
        cc: {
          yes: s.committee_yes_votes_cast ?? 0,
          no: s.committee_no_votes_cast ?? 0,
          abstain: s.committee_abstain_votes_cast ?? 0,
        },
      });
    }
  }

  // ── Build sentiment map ───────────────────────────────────────────────
  const sentimentMap = new Map<string, CitizenSentiment>();
  if (sentimentResult.data) {
    for (const s of sentimentResult.data) {
      const key = `${s.proposal_tx_hash}-${s.proposal_index}`;
      const entry = sentimentMap.get(key) ?? { support: 0, oppose: 0, abstain: 0, total: 0 };
      const val = (s.sentiment ?? '').toLowerCase();
      if (val === 'support' || val === 'yes') entry.support++;
      else if (val === 'oppose' || val === 'no') entry.oppose++;
      else entry.abstain++;
      entry.total++;
      sentimentMap.set(key, entry);
    }
  }

  // ── Assemble review queue items ───────────────────────────────────────
  const items: ReviewQueueItem[] = openProposals.map((p) => {
    const key = `${p.tx_hash}-${p.proposal_index}`;
    const expiryEpoch = p.expiration_epoch ?? 0;
    const epochsRemaining = expiryEpoch > 0 ? Math.max(0, expiryEpoch - currentEpoch) : null;

    const defaultTally = { yes: 0, no: 0, abstain: 0 };

    return {
      txHash: p.tx_hash,
      proposalIndex: p.proposal_index,
      title: getProposalDisplayTitle(p.title, p.tx_hash, p.proposal_index),
      abstract: p.abstract ?? null,
      aiSummary: p.ai_summary ?? null,
      proposalType: p.proposal_type || 'Proposal',
      paramChanges: (p.param_changes as Record<string, unknown> | null) ?? null,
      withdrawalAmount: p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null,
      treasuryTier: p.treasury_tier ?? null,
      epochsRemaining,
      isUrgent: epochsRemaining !== null && epochsRemaining <= 2,
      interBodyVotes: summaryMap.get(key) ?? {
        drep: { ...defaultTally },
        spo: { ...defaultTally },
        cc: { ...defaultTally },
      },
      citizenSentiment: sentimentMap.get(key) ?? null,
      existingVote: voterVoteMap.get(key) ?? null,
      sealedUntil: p.block_time
        ? new Date(p.block_time * 1000 + 5 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      // Full proposal metadata from CIP-108 meta_json
      motivation: extractMetaField(p.meta_json, 'motivation'),
      rationale: extractMetaField(p.meta_json, 'rationale'),
      references: extractMetaReferences(p.meta_json),
    };
  });

  // Sort: unvoted proposals first, then by urgency (fewer epochs remaining first)
  items.sort((a, b) => {
    const aVoted = a.existingVote ? 1 : 0;
    const bVoted = b.existingVote ? 1 : 0;
    if (aVoted !== bVoted) return aVoted - bVoted;
    const aRemaining = a.epochsRemaining ?? 999;
    const bRemaining = b.epochsRemaining ?? 999;
    if (aRemaining !== bRemaining) return aRemaining - bRemaining;
    return 0;
  });

  logger.info('[ReviewQueue] Fetched review queue', {
    voterId,
    voterRole,
    totalOpen: openProposals.length,
    itemCount: items.length,
  });

  return NextResponse.json({
    items,
    currentEpoch,
    totalOpen: openProposals.length,
  } satisfies ReviewQueueResponse);
});
