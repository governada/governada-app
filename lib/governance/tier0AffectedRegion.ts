import { createClient } from '@/lib/supabase';
import type { Tier0Trigger } from '@/types/cinematic';

export interface Tier0AffectedRegion {
  affectedNodeIds: Set<string>;
  nonVoterDim: number;
  spectatorDim: number;
}

export interface SerializedTier0AffectedRegion {
  affectedNodeIds: string[];
  nonVoterDim: number;
  spectatorDim: number;
}

type VoteTable = 'drep_votes' | 'spo_votes' | 'cc_votes';

interface SupabaseQueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface SupabaseQueryLike<T> extends PromiseLike<SupabaseQueryResult<T>> {
  eq: (column: string, value: string | number) => SupabaseQueryLike<T>;
  in?: (column: string, values: string[]) => SupabaseQueryLike<T>;
}

interface SupabaseTableLike<T> {
  select: (columns: string) => SupabaseQueryLike<T>;
}

interface SupabaseLike {
  from: <T = Record<string, unknown>>(table: string) => SupabaseTableLike<T>;
}

interface DRepVoteRow {
  drep_id: string;
}

interface SpoVoteRow {
  pool_id: string;
}

interface CcVoteRow {
  cc_hot_id: string;
}

interface CcMemberRow {
  cc_hot_id: string;
}

export async function resolveTier0AffectedRegion(
  trigger: Tier0Trigger & { removedCcHotIds?: string[] },
  supabase?: SupabaseLike,
): Promise<Tier0AffectedRegion> {
  const client = supabase ?? (createClient() as unknown as SupabaseLike);
  const [drepVotes, spoVotes, ccVotes] = await Promise.all([
    readVotes<DRepVoteRow>(client, 'drep_votes', 'drep_id', trigger),
    readVotes<SpoVoteRow>(client, 'spo_votes', 'pool_id', trigger),
    readVotes<CcVoteRow>(client, 'cc_votes', 'cc_hot_id', trigger),
  ]);

  const affectedNodeIds = new Set<string>([
    proposalNodeId(trigger.proposalTxHash, trigger.proposalIndex),
    ...drepVotes.map((row) => governanceNodeId(row.drep_id)),
    ...spoVotes.map((row) => governanceNodeId(row.pool_id)),
    ...ccVotes.map((row) => governanceNodeId(row.cc_hot_id)),
  ]);

  if (trigger.type === 'no_confidence_ratified') {
    const removed = trigger.removedCcHotIds?.length
      ? trigger.removedCcHotIds
      : await readRemovedCcMembers(client);
    for (const ccHotId of removed) {
      affectedNodeIds.add(governanceNodeId(ccHotId));
    }
  }

  return {
    affectedNodeIds,
    nonVoterDim: 0.3,
    spectatorDim: 0.5,
  };
}

export function serializeTier0AffectedRegion(
  region: Tier0AffectedRegion,
): SerializedTier0AffectedRegion {
  return {
    affectedNodeIds: [...region.affectedNodeIds],
    nonVoterDim: region.nonVoterDim,
    spectatorDim: region.spectatorDim,
  };
}

export function readTier0TriggersFromPayload(payload: unknown): Tier0Trigger[] {
  if (!payload || typeof payload !== 'object') return [];
  const triggers = (payload as Record<string, unknown>).triggers;
  if (!Array.isArray(triggers)) return [];

  return triggers.filter(isTier0Trigger);
}

export function proposalNodeId(txHash: string, proposalIndex: number): string {
  return `proposal-${txHash.slice(0, 12)}-${proposalIndex}`;
}

export function governanceNodeId(id: string): string {
  return id.slice(0, 16);
}

async function readVotes<T>(
  supabase: SupabaseLike,
  table: VoteTable,
  columns: string,
  trigger: Tier0Trigger,
): Promise<T[]> {
  const { data, error } = await supabase
    .from<T>(table)
    .select(columns)
    .eq('proposal_tx_hash', trigger.proposalTxHash)
    .eq('proposal_index', trigger.proposalIndex);

  if (error) {
    throw new Error(`Failed to read ${table} for Tier 0 affected region: ${error.message}`);
  }

  return data ?? [];
}

async function readRemovedCcMembers(supabase: SupabaseLike): Promise<string[]> {
  const query = supabase.from<CcMemberRow>('cc_members').select('cc_hot_id');
  const filtered = query.in ? query.in('status', ['removed', 'expired', 'resigned']) : query;
  const { data, error } = await filtered;

  if (error) {
    throw new Error(
      `Failed to read removed CC members for Tier 0 affected region: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => row.cc_hot_id);
}

function isTier0Trigger(value: unknown): value is Tier0Trigger {
  if (!value || typeof value !== 'object') return false;
  const trigger = value as Record<string, unknown>;
  return (
    typeof trigger.id === 'string' &&
    typeof trigger.type === 'string' &&
    typeof trigger.proposalTxHash === 'string' &&
    typeof trigger.proposalIndex === 'number' &&
    typeof trigger.proposalType === 'string' &&
    typeof trigger.eventEpoch === 'number' &&
    typeof trigger.decayHours === 'number'
  );
}
