import { NextResponse, NextRequest } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

export const dynamic = 'force-dynamic';

async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  return session?.walletAddress ?? null;
}

function deriveGovernanceLevel(
  hasDelegation: boolean,
  pollCount: number,
  userLevel: string | null,
): string {
  if (userLevel) return userLevel;
  if (hasDelegation && pollCount > 0) return 'participant';
  if (hasDelegation) return 'delegator';
  return 'observer';
}

function deriveParticipationTier(pollCount: number, drepVotesCast: number): string {
  if (pollCount > 0 || drepVotesCast > 0) return 'active';
  return 'passive';
}

export async function GET(request: NextRequest) {
  const walletAddress = await authenticateRequest(request);
  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  try {
    const [
      statsRow,
      userRow,
      proposalsCreatedResult,
      drepVotesResult,
      pollCountResult,
      activeDRepsResult,
    ] = await Promise.all([
      supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
      supabase
        .from('users')
        .select('delegated_drep_id, governance_level, poll_count')
        .eq('wallet_address', walletAddress)
        .single(),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('proposed_epoch', currentEpoch),
      supabase.from('drep_votes').select('drep_id').eq('epoch_no', currentEpoch),
      supabase
        .from('poll_responses')
        .select('id', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress),
      supabase.from('drep_votes').select('drep_id').eq('epoch_no', currentEpoch),
    ]);

    const epoch = statsRow.data?.current_epoch ?? currentEpoch;
    const user = userRow.data;
    const delegatedDrepId = user?.delegated_drep_id ?? null;

    let yourDRepName: string | null = null;
    let yourDRepScore: number | null = null;
    let yourDRepScoreTrend: number = 0;
    let drepVotesCast = 0;

    if (delegatedDrepId) {
      const [drepRow, drepVotesThisEpoch, currentScoreRow, prevScoreRow] = await Promise.all([
        supabase.from('dreps').select('id, score, info').eq('id', delegatedDrepId).single(),
        supabase
          .from('drep_votes')
          .select('vote_tx_hash', { count: 'exact', head: true })
          .eq('drep_id', delegatedDrepId)
          .eq('epoch_no', currentEpoch),
        supabase
          .from('drep_score_history')
          .select('score')
          .eq('drep_id', delegatedDrepId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('drep_score_history')
          .select('score')
          .eq('drep_id', delegatedDrepId)
          .lte('epoch_no', currentEpoch - 1)
          .order('epoch_no', { ascending: false })
          .limit(1)
          .single(),
      ]);

      const drep = drepRow.data;
      if (drep) {
        yourDRepName =
          (drep.info as { name?: string })?.name ??
          (drep.info as { ticker?: string })?.ticker ??
          (drep.info as { handle?: string })?.handle ??
          null;
        yourDRepScore = drep.score ?? null;
      }

      drepVotesCast = drepVotesThisEpoch.count ?? 0;

      const currentScore = currentScoreRow.data?.score ?? drepRow.data?.score ?? null;
      const prevScore = prevScoreRow.data?.score ?? null;
      if (currentScore != null && prevScore != null) {
        yourDRepScoreTrend = Math.round(currentScore - prevScore);
      }
    }

    const proposalsCreated = proposalsCreatedResult.count ?? 0;
    const yourPollsTaken = pollCountResult.count ?? 0;

    const activeDRepIds = new Set<string>();
    for (const row of drepVotesResult.data ?? []) {
      if (row.drep_id) activeDRepIds.add(row.drep_id);
    }
    const activeDReps = activeDRepIds.size;

    const governanceLevel = deriveGovernanceLevel(
      !!delegatedDrepId,
      yourPollsTaken,
      user?.governance_level ?? null,
    );
    const participationTier = deriveParticipationTier(yourPollsTaken, drepVotesCast);

    return NextResponse.json({
      epoch,
      stats: {
        proposalsCreated,
        drepVotesCast,
        yourPollsTaken,
        activeDReps,
        yourDRepName,
        yourDRepScore,
        yourDRepScoreTrend,
        governanceLevel,
        participationTier,
      },
    });
  } catch (err) {
    console.error('[epoch-review] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
