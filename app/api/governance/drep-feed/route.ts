import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'drepId is required' }, { status: 400 });
  }

  const supabase = createClient();
    const [explanationsRes, positionsRes, philosophyRes, drepRes] = await Promise.all([
      supabase
        .from('vote_explanations')
        .select('drep_id, proposal_tx_hash, proposal_index, explanation_text, created_at')
        .eq('drep_id', drepId)
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('position_statements')
        .select('drep_id, proposal_tx_hash, proposal_index, statement_text, created_at')
        .eq('drep_id', drepId)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase
        .from('governance_philosophy')
        .select('philosophy_text, updated_at')
        .eq('drep_id', drepId)
        .maybeSingle(),

      supabase.from('dreps').select('info').eq('id', drepId).single(),
    ]);

    const explanations = explanationsRes.data || [];
    const positions = positionsRes.data || [];

    const txHashes = [
      ...new Set([
        ...explanations.map((e) => e.proposal_tx_hash),
        ...positions.map((p) => p.proposal_tx_hash),
      ]),
    ];

    let proposalMap: Record<string, string> = {};
    let voteMap: Record<string, string> = {};

    if (txHashes.length > 0) {
      const [proposalsRes, votesRes] = await Promise.all([
        supabase.from('proposals').select('tx_hash, proposal_index, title').in('tx_hash', txHashes),

        supabase
          .from('drep_votes')
          .select('proposal_tx_hash, proposal_index, vote, block_time')
          .eq('drep_id', drepId)
          .in('proposal_tx_hash', txHashes)
          .order('block_time', { ascending: false }),
      ]);

      if (proposalsRes.data) {
        for (const p of proposalsRes.data) {
          proposalMap[`${p.tx_hash}:${p.proposal_index}`] = p.title || 'Untitled Proposal';
        }
      }

      if (votesRes.data) {
        for (const v of votesRes.data) {
          const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
          if (!voteMap[key]) voteMap[key] = v.vote;
        }
      }
    }

    const drepName =
      ((drepRes.data?.info as Record<string, unknown>)?.name as string | null) ?? null;

    return NextResponse.json({
      explanations: explanations.map((e) => {
        const key = `${e.proposal_tx_hash}:${e.proposal_index}`;
        return {
          proposalTxHash: e.proposal_tx_hash,
          proposalIndex: e.proposal_index,
          proposalTitle: proposalMap[key] || null,
          explanationText: e.explanation_text,
          vote: voteMap[key] || null,
          createdAt: e.created_at,
        };
      }),
      positions: positions.map((p) => {
        const key = `${p.proposal_tx_hash}:${p.proposal_index}`;
        return {
          proposalTxHash: p.proposal_tx_hash,
          proposalIndex: p.proposal_index,
          proposalTitle: proposalMap[key] || null,
          statementText: p.statement_text,
          createdAt: p.created_at,
        };
      }),
      philosophy: philosophyRes.data?.philosophy_text || null,
      drepName,
    });
});
