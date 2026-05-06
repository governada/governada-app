import { getSupabaseAdmin } from '@/lib/supabase';

export interface ItemLifecycleInput {
  userIdOrStakeAddress: string;
  itemId: string;
  at?: Date | string;
}

export interface ItemLifecycleRecord {
  user_id_or_stake_address: string;
  item_id: string;
  acknowledged_at?: string | null;
  dismissed_at?: string | null;
}

function normalizeIdentifier(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function toIso(value?: Date | string): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function acknowledgeItem(input: ItemLifecycleInput): Promise<ItemLifecycleRecord> {
  const row: ItemLifecycleRecord = {
    user_id_or_stake_address: normalizeIdentifier(
      input.userIdOrStakeAddress,
      'userIdOrStakeAddress',
    ),
    item_id: normalizeIdentifier(input.itemId, 'itemId'),
    acknowledged_at: toIso(input.at),
    dismissed_at: null,
  };

  const { error } = await getSupabaseAdmin()
    .from('prioritization_acknowledgments')
    .upsert(row, { onConflict: 'user_id_or_stake_address,item_id' });

  if (error) {
    throw new Error(`Failed to acknowledge prioritization item: ${error.message}`);
  }

  return row;
}

export async function dismissItem(input: ItemLifecycleInput): Promise<ItemLifecycleRecord> {
  const row: ItemLifecycleRecord = {
    user_id_or_stake_address: normalizeIdentifier(
      input.userIdOrStakeAddress,
      'userIdOrStakeAddress',
    ),
    item_id: normalizeIdentifier(input.itemId, 'itemId'),
    dismissed_at: toIso(input.at),
  };

  const { error } = await getSupabaseAdmin()
    .from('prioritization_acknowledgments')
    .upsert(row, { onConflict: 'user_id_or_stake_address,item_id' });

  if (error) {
    throw new Error(`Failed to dismiss prioritization item: ${error.message}`);
  }

  return row;
}
