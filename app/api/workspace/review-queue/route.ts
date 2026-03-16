/**
 * Review Queue API — returns active proposals for DRep review.
 *
 * Includes sealed assessment period logic: proposals within their first epoch
 * (5 days from block_time) have inter-body vote tallies hidden and existing
 * votes anonymized.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import type { ReviewQueueItem } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

const SEAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days (1 epoch)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const drepId = searchParams.get('drepId');

    if (!drepId) {
      return NextResponse.json({ error: 'drepId is required' }, { status: 400 });
    }

    const supabase = createClient();

    // Fetch active proposals (not yet expired/enacted/dropped)
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, title, proposal_type, abstract, block_time, expiration_epoch, assessment_sealed_until',
      )
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('block_time', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch existing votes for this DRep
    const { data: votes } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index, vote')
      .eq('drep_id', drepId);

    const voteMap = new Map<string, string>();
    if (votes) {
      for (const v of votes) {
        voteMap.set(`${v.proposal_tx_hash}_${v.proposal_index}`, v.vote);
      }
    }

    const now = Date.now();

    const items: ReviewQueueItem[] = (proposals || []).map((p) => {
      // Compute sealedUntil: if block_time is within SEAL_DURATION_MS, seal positions
      let sealedUntil: string | null = p.assessment_sealed_until ?? null;
      if (!sealedUntil && p.block_time) {
        const blockTimeMs = p.block_time * 1000;
        const sealExpiry = blockTimeMs + SEAL_DURATION_MS;
        if (sealExpiry > now) {
          sealedUntil = new Date(sealExpiry).toISOString();
        }
      }

      const isSealed = sealedUntil ? new Date(sealedUntil).getTime() > now : false;

      return {
        txHash: p.tx_hash,
        index: p.proposal_index,
        title: p.title,
        proposalType: p.proposal_type,
        abstract: p.abstract,
        blockTime: p.block_time,
        expirationEpoch: p.expiration_epoch,
        // When sealed, hide existing votes from all voters
        existingVote: isSealed ? null : (voteMap.get(`${p.tx_hash}_${p.proposal_index}`) ?? null),
        sealedUntil,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[review-queue] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
