/**
 * Proposer Track Record API
 *
 * GET /api/workspace/proposer-track-record?txHash=<hash>&index=<num>
 *
 * Looks up the proposal's meta_json to find author info, then queries
 * the proposals table for other proposals by the same author. Also
 * queries proposal_outcomes for delivery data.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ProposerTrackRecord } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const txHash = request.nextUrl.searchParams.get('txHash');
  const indexStr = request.nextUrl.searchParams.get('index');

  if (!txHash || indexStr == null) {
    return NextResponse.json({ error: 'Missing txHash or index' }, { status: 400 });
  }

  const proposalIndex = parseInt(indexStr, 10);
  if (isNaN(proposalIndex)) {
    return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
  }

  const supabase = createClient();

  // 1. Look up the proposal to get author info from meta_json
  const { data: proposal, error: pErr } = await supabase
    .from('proposals')
    .select('meta_json, tx_hash, proposal_index')
    .eq('tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .single();

  if (pErr || !proposal) {
    // Return empty track record if proposal not found
    return NextResponse.json({
      totalProposals: 0,
      ratifiedCount: 0,
      expiredCount: 0,
      droppedCount: 0,
      deliveredCount: 0,
      partialCount: 0,
      notDeliveredCount: 0,
      avgCommunityScore: null,
    } satisfies ProposerTrackRecord);
  }

  // Extract author identifier from meta_json
  // CIP-108 authors array or body.authors
  let authorIdentifier: string | null = null;
  try {
    const meta = proposal.meta_json as Record<string, unknown> | null;
    if (meta) {
      // Try CIP-108 structure: { authors: [{ name: "..." }] }
      const authors = meta.authors as Array<{ name?: string }> | undefined;
      if (authors && authors.length > 0 && authors[0].name) {
        authorIdentifier = authors[0].name;
      }
      // Try body.authors
      if (!authorIdentifier && meta.body) {
        const body = meta.body as Record<string, unknown>;
        const bodyAuthors = body.authors as Array<{ name?: string }> | undefined;
        if (bodyAuthors && bodyAuthors.length > 0 && bodyAuthors[0].name) {
          authorIdentifier = bodyAuthors[0].name;
        }
      }
    }
  } catch {
    // meta_json parse failure -- not critical
  }

  // If we can't identify the author, return the current proposal only
  if (!authorIdentifier) {
    logger.info('[ProposerTrackRecord] No author identifier found', { txHash, proposalIndex });
    return NextResponse.json({
      totalProposals: 1,
      ratifiedCount: 0,
      expiredCount: 0,
      droppedCount: 0,
      deliveredCount: 0,
      partialCount: 0,
      notDeliveredCount: 0,
      avgCommunityScore: null,
    } satisfies ProposerTrackRecord);
  }

  // 2. Query all proposals by this author (using meta_json text search)
  // We use a text-based contains approach since meta_json is a JSONB column
  const { data: authorProposals, error: apErr } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, ratified_epoch, expired_epoch, dropped_epoch, enacted_epoch')
    .textSearch('meta_json', authorIdentifier, { type: 'plain' });

  if (apErr) {
    logger.warn('[ProposerTrackRecord] Failed to query author proposals', { error: apErr });
  }

  const allProposals = authorProposals ?? [];
  const totalProposals = allProposals.length || 1;
  const ratifiedCount = allProposals.filter((p) => p.ratified_epoch != null).length;
  const expiredCount = allProposals.filter((p) => p.expired_epoch != null).length;
  const droppedCount = allProposals.filter((p) => p.dropped_epoch != null).length;

  // 3. Query proposal_outcomes for delivery data
  const enactedTxHashes = allProposals.filter((p) => p.enacted_epoch != null).map((p) => p.tx_hash);

  let deliveredCount = 0;
  let partialCount = 0;
  let notDeliveredCount = 0;

  if (enactedTxHashes.length > 0) {
    const { data: outcomes } = await supabase
      .from('proposal_outcomes')
      .select('delivery_status')
      .in('proposal_tx_hash', enactedTxHashes);

    if (outcomes) {
      for (const o of outcomes) {
        if (o.delivery_status === 'delivered') deliveredCount++;
        else if (o.delivery_status === 'partial') partialCount++;
        else if (o.delivery_status === 'not_delivered') notDeliveredCount++;
      }
    }
  }

  // 4. Average community review score (from draft_reviews if applicable)
  // This is for proposals that went through the authoring pipeline
  let avgCommunityScore: number | null = null;
  const { data: reviews } = await supabase
    .from('draft_reviews')
    .select('impact_score, feasibility_score, constitutional_score, value_score')
    .limit(100);

  if (reviews && reviews.length > 0) {
    let total = 0;
    let count = 0;
    for (const r of reviews) {
      const scores = [r.impact_score, r.feasibility_score, r.constitutional_score, r.value_score];
      const validScores = scores.filter((s): s is number => s != null);
      if (validScores.length > 0) {
        total += validScores.reduce((a, b) => a + b, 0) / validScores.length;
        count++;
      }
    }
    if (count > 0) avgCommunityScore = Math.round((total / count) * 10) / 10;
  }

  logger.info('[ProposerTrackRecord] Built track record', {
    author: authorIdentifier,
    totalProposals,
    ratifiedCount,
    deliveredCount,
  });

  return NextResponse.json({
    totalProposals,
    ratifiedCount,
    expiredCount,
    droppedCount,
    deliveredCount,
    partialCount,
    notDeliveredCount,
    avgCommunityScore,
  } satisfies ProposerTrackRecord);
});
