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

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

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

async function mergeLifecycleRecord(
  supabase: SupabaseAdminClient,
  row: ItemLifecycleRecord,
  action: 'acknowledge' | 'dismiss',
): Promise<ItemLifecycleRecord> {
  const { data, error } = await supabase.rpc('ack_dismiss_merge', {
    p_user_id_or_stake_address: row.user_id_or_stake_address,
    p_item_id: row.item_id,
    p_ack_at: row.acknowledged_at ?? null,
    p_dismiss_at: row.dismissed_at ?? null,
  });

  if (error) {
    throw new Error(`Failed to ${action} prioritization item: ${error.message}`);
  }

  const record = Array.isArray(data) ? data[0] : data;
  return isLifecycleRecord(record) ? record : row;
}

export async function acknowledgeItem(input: ItemLifecycleInput): Promise<ItemLifecycleRecord> {
  const userIdOrStakeAddress = normalizeIdentifier(
    input.userIdOrStakeAddress,
    'userIdOrStakeAddress',
  );
  const itemId = normalizeIdentifier(input.itemId, 'itemId');
  const supabase = getSupabaseAdmin();
  const row: ItemLifecycleRecord = {
    user_id_or_stake_address: userIdOrStakeAddress,
    item_id: itemId,
    acknowledged_at: toIso(input.at),
    dismissed_at: null,
  };

  return mergeLifecycleRecord(supabase, row, 'acknowledge');
}

export async function dismissItem(input: ItemLifecycleInput): Promise<ItemLifecycleRecord> {
  const userIdOrStakeAddress = normalizeIdentifier(
    input.userIdOrStakeAddress,
    'userIdOrStakeAddress',
  );
  const itemId = normalizeIdentifier(input.itemId, 'itemId');
  const supabase = getSupabaseAdmin();
  const row: ItemLifecycleRecord = {
    user_id_or_stake_address: userIdOrStakeAddress,
    item_id: itemId,
    acknowledged_at: null,
    dismissed_at: toIso(input.at),
  };

  return mergeLifecycleRecord(supabase, row, 'dismiss');
}

function isLifecycleRecord(value: unknown): value is ItemLifecycleRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<Record<keyof ItemLifecycleRecord, unknown>>;
  return typeof record.user_id_or_stake_address === 'string' && typeof record.item_id === 'string';
}
