/**
 * GET /api/citizen/epoch-consequence
 *
 * Returns consequence-oriented data for the citizen Hub:
 * - Decided proposals this epoch with DRep votes + community sentiment
 * - Active proposals with DRep votes + community sentiment
 * - Voting power fraction (DRep's power / total active voting power)
 * - Total ADA decided this epoch
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsequenceProposal {
  txHash: string;
  index: number;
  title: string | null;
  proposalType: string;
  outcome: 'ratified' | 'dropped' | 'expired' | null;
  outcomeEpoch: number | null;
  withdrawalAda: number | null;
  aiSummary: string | null;
  drepVote: string | null;
  communitySignal: {
    support: number;
    oppose: number;
    unsure: number;
    total: number;
  } | null;
  userSignal: string | null;
}

interface EpochConsequenceResponse {
  epoch: number;

  /** Total ADA in decided proposals this epoch */
  adaDecided: number;

  /** Citizen's DRep voting power as fraction (0-1) of total active voting power */
  votingPowerFraction: number | null;

  /** DRep's voting power in ADA */
  votingPowerAda: number | null;

  /** Proposals decided this epoch (ratified/dropped/expired) with DRep votes */
  decidedProposals: ConsequenceProposal[];

  /** Active proposals with DRep votes + community sentiment */
  activeProposals: ConsequenceProposal[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function proposalOutcome(p: {
  ratified_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
}): { outcome: 'ratified' | 'dropped' | 'expired' | null; epoch: number | null } {
  if (p.ratified_epoch) return { outcome: 'ratified', epoch: p.ratified_epoch };
  if (p.dropped_epoch) return { outcome: 'dropped', epoch: p.dropped_epoch };
  if (p.expired_epoch) return { outcome: 'expired', epoch: p.expired_epoch };
  return { outcome: null, epoch: null };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    const supabase = createClient();

    // 1. Current epoch
    const { data: stats } = await supabase
      .from('governance_stats')
      .select('current_epoch')
      .eq('id', 1)
      .single();

    const currentEpoch = stats?.current_epoch ?? 0;

    // 2. Resolve DRep ID
    let drepId: string | null = null;

    if (ctx.wallet) {
      const { data: walletRow } = await supabase
        .from('user_wallets')
        .select('drep_id')
        .eq('payment_address', ctx.wallet)
        .maybeSingle();

      if (walletRow?.drep_id) {
        drepId = walletRow.drep_id;
      } else if (ctx.userId) {
        const { data: user } = await supabase
          .from('users')
          .select('claimed_drep_id, delegation_history')
          .eq('id', ctx.userId)
          .single();

        if (user?.claimed_drep_id) {
          drepId = user.claimed_drep_id;
        } else if (Array.isArray(user?.delegation_history) && user.delegation_history.length > 0) {
          const last = user.delegation_history[user.delegation_history.length - 1] as {
            drepId?: string;
          };
          drepId = last?.drepId ?? null;
        }
      }
    }

    // 3. Fetch decided + active proposals in parallel
    const lookbackEpoch = Math.max(0, currentEpoch - 1);

    const [decidedResult, activeResult] = await Promise.all([
      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, ai_summary, withdrawal_amount, ratified_epoch, dropped_epoch, expired_epoch, enacted_epoch',
        )
        .or(
          `ratified_epoch.gte.${lookbackEpoch},dropped_epoch.gte.${lookbackEpoch},expired_epoch.gte.${lookbackEpoch}`,
        )
        .order('block_time', { ascending: false })
        .limit(20),

      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, ai_summary, withdrawal_amount, ratified_epoch, dropped_epoch, expired_epoch',
        )
        .is('ratified_epoch', null)
        .is('expired_epoch', null)
        .is('dropped_epoch', null)
        .order('block_time', { ascending: false })
        .limit(10),
    ]);

    const decidedRows = decidedResult.data ?? [];
    const activeRows = activeResult.data ?? [];
    const allRows = [...decidedRows, ...activeRows];

    // 4. Fetch DRep votes for all relevant proposals
    const allTxHashes = [...new Set(allRows.map((p) => p.tx_hash))];
    const drepVotesMap = new Map<string, string>();

    if (drepId && allTxHashes.length > 0) {
      const { data: votes } = await supabase
        .from('drep_votes')
        .select('proposal_tx_hash, proposal_index, vote')
        .eq('drep_id', drepId)
        .in('proposal_tx_hash', allTxHashes);

      if (votes) {
        for (const v of votes) {
          drepVotesMap.set(`${v.proposal_tx_hash}:${v.proposal_index}`, v.vote);
        }
      }
    }

    // 5. Fetch community sentiment for all proposals
    const proposalKeys = allRows.map((p) => `${p.tx_hash}:${p.proposal_index}`);
    const sentimentMap = new Map<
      string,
      { support: number; oppose: number; unsure: number; total: number }
    >();

    if (proposalKeys.length > 0) {
      const { data: aggs } = await supabase
        .from('engagement_signal_aggregations')
        .select('entity_id, data')
        .eq('entity_type', 'proposal')
        .eq('signal_type', 'sentiment')
        .in('entity_id', proposalKeys);

      if (aggs) {
        for (const a of aggs) {
          const d = a.data as {
            support?: number;
            oppose?: number;
            unsure?: number;
            total?: number;
          } | null;
          if (d) {
            sentimentMap.set(a.entity_id, {
              support: d.support ?? 0,
              oppose: d.oppose ?? 0,
              unsure: d.unsure ?? 0,
              total: d.total ?? 0,
            });
          }
        }
      }
    }

    // 6. Fetch user's own sentiment signals
    const userSignalMap = new Map<string, string>();

    if (ctx.userId && allTxHashes.length > 0) {
      const { data: userSentiments } = await supabase
        .from('citizen_sentiment')
        .select('proposal_tx_hash, proposal_index, sentiment')
        .eq('user_id', ctx.userId)
        .in('proposal_tx_hash', allTxHashes);

      if (userSentiments) {
        for (const s of userSentiments) {
          userSignalMap.set(`${s.proposal_tx_hash}:${s.proposal_index}`, s.sentiment);
        }
      }
    }

    // 7. Compute voting power fraction
    let votingPowerFraction: number | null = null;
    let votingPowerAda: number | null = null;

    if (drepId) {
      const { data: powerRow } = await supabase
        .from('drep_power_snapshots')
        .select('amount_lovelace, epoch_no')
        .eq('drep_id', drepId)
        .order('epoch_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (powerRow) {
        const drepPower = powerRow.amount_lovelace ?? 0;
        votingPowerAda = Math.round(drepPower / 1_000_000);

        // Sum total active voting power from the same epoch's snapshot
        const { data: totalRows } = await supabase
          .from('drep_power_snapshots')
          .select('amount_lovelace')
          .eq('epoch_no', powerRow.epoch_no);

        if (totalRows && totalRows.length > 0) {
          const totalPower = totalRows.reduce((sum, r) => sum + (r.amount_lovelace ?? 0), 0);
          if (totalPower > 0 && drepPower > 0) {
            votingPowerFraction = drepPower / totalPower;
          }
        }
      }
    }

    // 8. Build response
    function buildProposal(row: (typeof allRows)[number]): ConsequenceProposal {
      const key = `${row.tx_hash}:${row.proposal_index}`;
      const { outcome, epoch: outcomeEpoch } = proposalOutcome(row);

      return {
        txHash: row.tx_hash,
        index: row.proposal_index,
        title: row.title,
        proposalType: row.proposal_type,
        outcome,
        outcomeEpoch,
        withdrawalAda: row.withdrawal_amount ? Math.round(row.withdrawal_amount / 1_000_000) : null,
        aiSummary: row.ai_summary,
        drepVote: drepVotesMap.get(key) ?? null,
        communitySignal: sentimentMap.get(key) ?? null,
        userSignal: userSignalMap.get(key) ?? null,
      };
    }

    const adaDecided = decidedRows.reduce((sum, p) => {
      if (p.withdrawal_amount && p.ratified_epoch) {
        return sum + Math.round(p.withdrawal_amount / 1_000_000);
      }
      return sum;
    }, 0);

    const response: EpochConsequenceResponse = {
      epoch: currentEpoch,
      adaDecided,
      votingPowerFraction,
      votingPowerAda,
      decidedProposals: decidedRows.map(buildProposal),
      activeProposals: activeRows.map(buildProposal),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  },
  { auth: 'optional' },
);
