import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SentimentAgg {
  support: number;
  oppose: number;
  unsure: number;
  total: number;
}

/**
 * GET /api/drep/[drepId]/engagement
 *
 * Returns citizen engagement signals for a DRep:
 * - How many citizens expressed sentiment on proposals this DRep voted on
 * - Whether the DRep tends to vote with or against citizen sentiment
 * - Per-proposal breakdown of alignment
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const drepId = request.nextUrl.pathname.split('/api/drep/')[1]?.split('/')[0];
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }
  const decodedId = decodeURIComponent(drepId);
  const supabase = createClient();

  // 1. Get this DRep's votes
  const { data: votes } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('drep_id', decodedId);

  if (!votes || votes.length === 0) {
    return NextResponse.json({
      proposalsWithSentiment: 0,
      totalCitizenVotes: 0,
      sentimentAlignment: null,
      alignedCount: 0,
      divergedCount: 0,
      noSentimentCount: 0,
    });
  }

  // 2. Fetch sentiment aggregations for proposals this DRep voted on
  const proposalKeys = votes.map((v) => `${v.proposal_tx_hash}:${v.proposal_index}`);
  const { data: sentimentRows } = await supabase
    .from('engagement_signal_aggregations')
    .select('entity_id, data')
    .eq('entity_type', 'proposal')
    .eq('signal_type', 'sentiment')
    .in('entity_id', proposalKeys);

  if (!sentimentRows || sentimentRows.length === 0) {
    return NextResponse.json({
      proposalsWithSentiment: 0,
      totalCitizenVotes: 0,
      sentimentAlignment: null,
      alignedCount: 0,
      divergedCount: 0,
      noSentimentCount: votes.length,
    });
  }

  // Build lookup: proposalKey -> sentiment data
  const sentimentMap = new Map<string, SentimentAgg>();
  for (const row of sentimentRows) {
    const data = row.data as SentimentAgg;
    if (data && data.total > 0) {
      sentimentMap.set(row.entity_id, data);
    }
  }

  // 3. Fetch proposal titles for divergence examples
  const uniqueTxHashes = [...new Set(votes.map((v) => v.proposal_tx_hash))];
  const { data: proposalRows } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title')
    .in('tx_hash', uniqueTxHashes);

  const titleMap = new Map<string, string>();
  for (const p of proposalRows || []) {
    titleMap.set(`${p.tx_hash}:${p.proposal_index}`, p.title ?? 'Untitled');
  }

  // 4. Compare DRep vote with citizen majority for each proposal
  let aligned = 0;
  let diverged = 0;
  let totalCitizenVotes = 0;

  interface DivergenceExample {
    txHash: string;
    index: number;
    title: string;
    drepVote: string;
    citizenMajority: string;
    citizenMajorityPct: number;
  }
  const divergenceExamples: DivergenceExample[] = [];

  for (const v of votes) {
    const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
    const sentiment = sentimentMap.get(key);
    if (!sentiment || sentiment.total === 0) continue;

    totalCitizenVotes += sentiment.total;

    // Map DRep vote to sentiment direction
    // Yes -> support, No -> oppose, Abstain -> unsure
    const drepDirection = v.vote === 'Yes' ? 'support' : v.vote === 'No' ? 'oppose' : 'unsure';

    // Citizen majority
    const maxCount = Math.max(sentiment.support, sentiment.oppose, sentiment.unsure);
    const citizenMajority =
      sentiment.support === maxCount
        ? 'support'
        : sentiment.oppose === maxCount
          ? 'oppose'
          : 'unsure';

    const majorityPct = Math.round((maxCount / sentiment.total) * 100);

    if (drepDirection === citizenMajority) {
      aligned++;
    } else {
      diverged++;
      divergenceExamples.push({
        txHash: v.proposal_tx_hash,
        index: v.proposal_index,
        title: titleMap.get(key) ?? 'Untitled',
        drepVote: v.vote,
        citizenMajority,
        citizenMajorityPct: majorityPct,
      });
    }
  }

  const proposalsWithSentiment = sentimentMap.size;
  const compared = aligned + diverged;
  const sentimentAlignment = compared > 0 ? Math.round((aligned / compared) * 100) : null;

  return NextResponse.json(
    {
      proposalsWithSentiment,
      totalCitizenVotes,
      sentimentAlignment,
      alignedCount: aligned,
      divergedCount: diverged,
      noSentimentCount: votes.length - compared,
      divergenceExamples: divergenceExamples.slice(0, 5),
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    },
  );
});
