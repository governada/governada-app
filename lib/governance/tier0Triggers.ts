import { EPOCH_LENGTH_SECONDS } from '@/lib/constants';
import { blockTimeToEpoch } from '@/lib/koios';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Tier0Trigger, Tier0TriggerType } from '@/types/cinematic';

export const MAJOR_TREASURY_WITHDRAWAL_ADA_FLOOR = 1_000_000;
export const LOVELACE_PER_ADA = 1_000_000;
export const TIER0_DECAY_HOURS = 7 * 24;
export const RATIONALE_PUBLISH_DECAY_HOURS = 24;

export const EVENT_DECAY_HOURS: Record<Tier0TriggerType | 'rationale_published', number> = {
  constitutional_amendment_ratified: TIER0_DECAY_HOURS,
  hard_fork_enacted: TIER0_DECAY_HOURS,
  no_confidence_ratified: TIER0_DECAY_HOURS,
  major_treasury_withdrawal_closed: TIER0_DECAY_HOURS,
  rationale_published: RATIONALE_PUBLISH_DECAY_HOURS,
};

interface ProposalRow {
  tx_hash: string;
  proposal_index: number;
  proposal_type: string;
  title: string | null;
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
  withdrawal_amount: number | null;
}

function minimumFreshEpoch(decayHours: number, now: Date): number {
  const currentEpoch = blockTimeToEpoch(Math.floor(now.getTime() / 1000));
  const decayEpochs = Math.max(1, Math.ceil((decayHours * 60 * 60) / EPOCH_LENGTH_SECONDS));
  return currentEpoch - decayEpochs;
}

function triggerId(row: ProposalRow, type: Tier0TriggerType): string {
  return `${type}:${row.tx_hash}:${row.proposal_index}`;
}

function eventEpochFor(row: ProposalRow, type: Tier0TriggerType): number | null {
  if (type === 'hard_fork_enacted') return row.enacted_epoch ?? row.ratified_epoch;
  if (type === 'major_treasury_withdrawal_closed') {
    return row.enacted_epoch ?? row.ratified_epoch ?? row.expired_epoch ?? row.dropped_epoch;
  }
  return row.ratified_epoch;
}

function triggerTypeFor(row: ProposalRow): Tier0TriggerType | null {
  if (row.proposal_type === 'HardForkInitiation') return 'hard_fork_enacted';
  if (row.proposal_type === 'NoConfidence') return 'no_confidence_ratified';
  if (row.proposal_type === 'NewConstitution' || row.proposal_type === 'UpdateConstitution') {
    return 'constitutional_amendment_ratified';
  }
  if (row.proposal_type === 'TreasuryWithdrawals') {
    const withdrawalAmountAda = (row.withdrawal_amount ?? 0) / LOVELACE_PER_ADA;
    // Tim decision 2026-05-06: Phase 1 ships the 1M ADA floor only. The spec's
    // deferred percentage branch from homepage-mvp lines 127-133 will be added
    // when a future phase has a product reason to fetch live treasury balance.
    return withdrawalAmountAda >= MAJOR_TREASURY_WITHDRAWAL_ADA_FLOOR
      ? 'major_treasury_withdrawal_closed'
      : null;
  }
  return null;
}

export function getEventDecayHours(eventType: Tier0TriggerType | 'rationale_published'): number {
  return EVENT_DECAY_HOURS[eventType] ?? RATIONALE_PUBLISH_DECAY_HOURS;
}

export function proposalToTier0Trigger(row: ProposalRow, now = new Date()): Tier0Trigger | null {
  const type = triggerTypeFor(row);
  if (!type) return null;

  const eventEpoch = eventEpochFor(row, type);
  if (eventEpoch === null) return null;

  const decayHours = getEventDecayHours(type);
  if (eventEpoch < minimumFreshEpoch(decayHours, now)) return null;

  return {
    id: triggerId(row, type),
    type,
    proposalTxHash: row.tx_hash,
    proposalIndex: row.proposal_index,
    proposalType: row.proposal_type,
    title: row.title,
    eventEpoch,
    decayHours,
    withdrawalAmountAda:
      row.proposal_type === 'TreasuryWithdrawals' && row.withdrawal_amount !== null
        ? row.withdrawal_amount / LOVELACE_PER_ADA
        : undefined,
  };
}

export async function getTier0Triggers(now = new Date()): Promise<Tier0Trigger[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('proposals')
    .select(
      'tx_hash, proposal_index, proposal_type, title, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, withdrawal_amount',
    )
    .in('proposal_type', [
      'HardForkInitiation',
      'NoConfidence',
      'NewConstitution',
      'UpdateConstitution',
      'TreasuryWithdrawals',
    ]);

  if (error) {
    throw new Error(`Failed to read Tier 0 governance triggers: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => proposalToTier0Trigger(row as ProposalRow, now))
    .filter((trigger): trigger is Tier0Trigger => trigger !== null);
}
