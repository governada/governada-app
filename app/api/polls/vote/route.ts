import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

const VALID_VOTES = ['yes', 'no', 'abstain'] as const;
type Vote = (typeof VALID_VOTES)[number];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(walletAddress: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(walletAddress);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(walletAddress, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  return session?.walletAddress ?? null;
}

async function lookupDelegation(
  stakeAddress: string
): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';
    const apiKey = process.env.KOIOS_API_KEY;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    };

    const res = await fetch(`${baseUrl}/account_info`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ _stake_addresses: [stakeAddress] }),
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    const account = Array.isArray(data) ? data[0] : null;
    return account?.vote_delegation || account?.delegated_drep || null;
  } catch {
    return null;
  }
}

function aggregateCounts(rows: { vote: string }[]): { yes: number; no: number; abstain: number; total: number } {
  const counts = { yes: 0, no: 0, abstain: 0, total: rows.length };
  for (const row of rows) {
    if (row.vote === 'yes') counts.yes++;
    else if (row.vote === 'no') counts.no++;
    else if (row.vote === 'abstain') counts.abstain++;
  }
  return counts;
}

export async function POST(request: NextRequest) {
  const walletAddress = await authenticateRequest(request);
  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRateLimit(walletAddress)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: { proposalTxHash?: string; proposalIndex?: number; vote?: string; stakeAddress?: string; delegatedDrepId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { proposalTxHash, proposalIndex, vote, stakeAddress, delegatedDrepId } = body;

  if (!proposalTxHash || typeof proposalTxHash !== 'string') {
    return NextResponse.json({ error: 'proposalTxHash required' }, { status: 400 });
  }
  if (proposalIndex === undefined || typeof proposalIndex !== 'number') {
    return NextResponse.json({ error: 'proposalIndex required' }, { status: 400 });
  }
  if (!vote || !VALID_VOTES.includes(vote as Vote)) {
    return NextResponse.json({ error: 'vote must be yes, no, or abstain' }, { status: 400 });
  }

  const resolvedStakeAddress = stakeAddress || null;
  let resolvedDrepId = delegatedDrepId || null;

  if (!resolvedDrepId && resolvedStakeAddress) {
    resolvedDrepId = await lookupDelegation(resolvedStakeAddress);
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from('poll_responses')
    .select('id, vote_count')
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex)
    .eq('wallet_address', walletAddress)
    .single();

  if (existing) {
    const { error: updateError } = await supabase
      .from('poll_responses')
      .update({
        vote,
        updated_at: new Date().toISOString(),
        vote_count: (existing.vote_count || 1) + 1,
        ...(resolvedStakeAddress && { stake_address: resolvedStakeAddress }),
        ...(resolvedDrepId && { delegated_drep_id: resolvedDrepId }),
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Poll vote update error:', updateError);
      return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase.from('poll_responses').insert({
      proposal_tx_hash: proposalTxHash,
      proposal_index: proposalIndex,
      wallet_address: walletAddress,
      stake_address: resolvedStakeAddress,
      delegated_drep_id: resolvedDrepId,
      vote,
      initial_vote: vote,
    });

    if (insertError) {
      console.error('Poll vote insert error:', insertError);
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
    }
  }

  // Write governance event for timeline (fire-and-forget, don't block the response)
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
  let proposalTitle: string | null = null;
  try {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('title')
      .eq('tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex)
      .single();
    proposalTitle = proposal?.title || null;
  } catch { /* non-critical */ }

  supabase
    .from('governance_events')
    .insert({
      wallet_address: walletAddress,
      event_type: 'poll_vote',
      event_data: { vote, proposalTitle },
      related_proposal_tx_hash: proposalTxHash,
      related_proposal_index: proposalIndex,
      epoch: currentEpoch,
    })
    .then(({ error: evtErr }) => {
      if (evtErr) console.error('[Poll Vote] governance_event write failed:', evtErr);
    });

  const { data: allVotes } = await supabase
    .from('poll_responses')
    .select('vote')
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex);

  const community = aggregateCounts(allVotes || []);

  return NextResponse.json({
    community,
    userVote: vote,
    hasVoted: true,
  });
}
