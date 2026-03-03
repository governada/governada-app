import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Select proposals where DReps are most split (30-70% Yes/No ratio).
 * These are maximally discriminating for the Governance DNA quiz.
 */
export async function GET() {
  const supabase = createClient();

  const { data: votes, error: votesError } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index, vote');

  if (votesError) {
    console.error('[quiz-proposals] Failed to fetch votes:', votesError.message);
    return NextResponse.json({ error: 'Failed to fetch vote data' }, { status: 500 });
  }

  // Aggregate votes per proposal
  const proposalVotes = new Map<
    string,
    { yes: number; no: number; abstain: number; total: number }
  >();
  for (const v of votes || []) {
    const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
    const entry = proposalVotes.get(key) || { yes: 0, no: 0, abstain: 0, total: 0 };
    if (v.vote === 'Yes') entry.yes++;
    else if (v.vote === 'No') entry.no++;
    else entry.abstain++;
    entry.total++;
    proposalVotes.set(key, entry);
  }

  // Score by how close to 50/50 the Yes/No split is (ignoring abstains for discrimination)
  const scored: { key: string; txHash: string; index: number; score: number; total: number }[] = [];
  for (const [key, counts] of proposalVotes) {
    const decisive = counts.yes + counts.no;
    if (decisive < 3) continue; // need minimum participation
    const yesPct = counts.yes / decisive;
    const discriminationScore = 1 - Math.abs(yesPct - 0.5) * 2; // 1.0 = perfect 50/50, 0.0 = unanimous
    if (discriminationScore < 0.4) continue; // at least 30-70 split
    const [txHash, indexStr] = key.split(':');
    scored.push({
      key,
      txHash,
      index: parseInt(indexStr, 10),
      score: discriminationScore,
      total: counts.total,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.total - a.total);
  const topKeys = scored.slice(0, 10);

  if (topKeys.length === 0) {
    return NextResponse.json({ proposals: [] });
  }

  // Fetch proposal metadata
  const { data: proposals, error: proposalError } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, proposal_type, title, abstract, withdrawal_amount, treasury_tier, ai_summary',
    );

  if (proposalError) {
    console.error('[quiz-proposals] Failed to fetch proposals:', proposalError.message);
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }

  const proposalMap = new Map<string, (typeof proposals)[number]>();
  for (const p of proposals || []) {
    proposalMap.set(`${p.tx_hash}:${p.proposal_index}`, p);
  }

  const result = topKeys.slice(0, 7).map(({ txHash, index, score }) => {
    const p = proposalMap.get(`${txHash}:${index}`);
    return {
      txHash,
      index,
      proposalType: p?.proposal_type || 'Unknown',
      title: p?.title || `Proposal ${txHash.slice(0, 8)}...`,
      summary: p?.ai_summary || p?.abstract || null,
      withdrawalAmount: p?.withdrawal_amount ? Number(p.withdrawal_amount) / 1_000_000 : null,
      treasuryTier: p?.treasury_tier || null,
      discriminationScore: Math.round(score * 100),
    };
  });

  return NextResponse.json({ proposals: result });
}
