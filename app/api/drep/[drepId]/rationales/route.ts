/**
 * DRep Rationales API
 * Returns a DRep's published rationales, combining on-chain rationale anchors
 * (vote_rationales) with Governada-submitted CIP-100 documents (rationale_documents).
 * Each entry includes proposal context, vote direction, rationale text, and date.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { getProposalDisplayTitle } from '@/utils/display';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.pathname.split('/api/drep/')[1]?.split('/')[0];
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const supabase = createClient();

  // 1. Get all votes that have a rationale (either from vote_rationales or rationale_documents)
  const [voteRationalesResult, rationaleDocsResult] = await Promise.all([
    supabase
      .from('vote_rationales')
      .select(
        'vote_tx_hash, proposal_tx_hash, proposal_index, rationale_text, ai_summary, hash_verified, fetched_at',
      )
      .eq('drep_id', drepId)
      .not('rationale_text', 'is', null)
      .order('fetched_at', { ascending: false }),
    supabase
      .from('rationale_documents')
      .select('content_hash, proposal_tx_hash, proposal_index, rationale_text, created_at')
      .eq('drep_id', drepId)
      .order('created_at', { ascending: false }),
  ]);

  if (voteRationalesResult.error) {
    logger.error('Failed to fetch vote_rationales', {
      context: 'drep/rationales',
      drepId,
      error: voteRationalesResult.error.message,
      requestId,
    });
  }

  if (rationaleDocsResult.error) {
    logger.error('Failed to fetch rationale_documents', {
      context: 'drep/rationales',
      drepId,
      error: rationaleDocsResult.error.message,
      requestId,
    });
  }

  // Build a map of proposal_key -> rationale data, preferring vote_rationales (on-chain source)
  const rationaleMap = new Map<
    string,
    {
      rationaleText: string;
      aiSummary: string | null;
      hashVerified: boolean | null;
      date: string | null;
      source: 'on-chain' | 'governada';
    }
  >();

  // Add rationale_documents first (lower priority)
  for (const doc of rationaleDocsResult.data ?? []) {
    const key = `${doc.proposal_tx_hash}:${doc.proposal_index}`;
    rationaleMap.set(key, {
      rationaleText: doc.rationale_text,
      aiSummary: null,
      hashVerified: null,
      date: doc.created_at,
      source: 'governada',
    });
  }

  // Override with vote_rationales (on-chain, higher priority)
  for (const vr of voteRationalesResult.data ?? []) {
    const key = `${vr.proposal_tx_hash}:${vr.proposal_index}`;
    rationaleMap.set(key, {
      rationaleText: vr.rationale_text!,
      aiSummary: vr.ai_summary ?? null,
      hashVerified: vr.hash_verified ?? null,
      date: vr.fetched_at,
      source: 'on-chain',
    });
  }

  if (rationaleMap.size === 0) {
    return NextResponse.json({ rationales: [] });
  }

  // 2. Get the matching votes to know vote direction and block_time
  const proposalKeys = [...rationaleMap.keys()];
  const txHashes = [...new Set(proposalKeys.map((k) => k.split(':')[0]))];

  const [votesResult, proposalsResult] = await Promise.all([
    supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index, vote, block_time, epoch_no')
      .eq('drep_id', drepId)
      .in('proposal_tx_hash', txHashes),
    txHashes.length > 0
      ? supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title, proposal_type')
          .in('tx_hash', txHashes)
      : Promise.resolve({ data: [] }),
  ]);

  const voteMap = new Map(
    (votesResult.data ?? []).map((v) => [
      `${v.proposal_tx_hash}:${v.proposal_index}`,
      { vote: v.vote, blockTime: v.block_time, epochNo: v.epoch_no },
    ]),
  );

  const proposalMap = new Map(
    (proposalsResult.data ?? []).map((p) => [
      `${p.tx_hash}:${p.proposal_index}`,
      { title: p.title, proposalType: p.proposal_type },
    ]),
  );

  // 3. Build the response
  const rationales = [...rationaleMap.entries()]
    .map(([key, rationale]) => {
      const [proposalTxHash, proposalIndexStr] = key.split(':');
      const proposalIndex = parseInt(proposalIndexStr, 10);
      const voteInfo = voteMap.get(key);
      const proposal = proposalMap.get(key);

      return {
        proposalTxHash,
        proposalIndex,
        proposalTitle: proposal
          ? getProposalDisplayTitle(proposal.title, proposalTxHash, proposalIndex)
          : `Proposal ${proposalTxHash.slice(0, 8)}...`,
        proposalType: proposal?.proposalType ?? null,
        vote: voteInfo?.vote ?? null,
        epochNo: voteInfo?.epochNo ?? null,
        blockTime: voteInfo?.blockTime ?? null,
        rationaleText: rationale.rationaleText,
        aiSummary: rationale.aiSummary,
        hashVerified: rationale.hashVerified,
        date: rationale.date,
        source: rationale.source,
      };
    })
    .sort((a, b) => {
      // Sort by block_time descending, falling back to date
      const timeA = a.blockTime ?? 0;
      const timeB = b.blockTime ?? 0;
      return timeB - timeA;
    });

  return NextResponse.json({ rationales });
});
