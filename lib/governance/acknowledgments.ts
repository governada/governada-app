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

async function readLifecycleRecord(
  supabase: SupabaseAdminClient,
  userIdOrStakeAddress: string,
  itemId: string,
): Promise<ItemLifecycleRecord | null> {
  const { data, error } = await supabase
    .from('prioritization_acknowledgments')
    .select('user_id_or_stake_address, item_id, acknowledged_at, dismissed_at')
    .eq('user_id_or_stake_address', userIdOrStakeAddress)
    .eq('item_id', itemId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read prioritization item lifecycle: ${error.message}`);
  }

  return (data as ItemLifecycleRecord | null) ?? null;
}

async function upsertLifecycleRecord(
  supabase: SupabaseAdminClient,
  row: ItemLifecycleRecord,
  action: 'acknowledge' | 'dismiss',
): Promise<void> {
  const { error } = await supabase
    .from('prioritization_acknowledgments')
    .upsert(row, { onConflict: 'user_id_or_stake_address,item_id' });

  if (error) {
    throw new Error(`Failed to ${action} prioritization item: ${error.message}`);
  }
}

export async function acknowledgeItem(input: ItemLifecycleInput): Promise<ItemLifecycleRecord> {
  const userIdOrStakeAddress = normalizeIdentifier(
    input.userIdOrStakeAddress,
    'userIdOrStakeAddress',
  );
  const itemId = normalizeIdentifier(input.itemId, 'itemId');
  const supabase = getSupabaseAdmin();
  const existing = await readLifecycleRecord(supabase, userIdOrStakeAddress, itemId);
  const row: ItemLifecycleRecord = {
    user_id_or_stake_address: userIdOrStakeAddress,
    item_id: itemId,
    acknowledged_at: toIso(input.at),
    dismissed_at: existing?.dismissed_at ?? null,
  };

  await upsertLifecycleRecord(supabase, row, 'acknowledge');

  return row;
}

export async function dismissItem(input: ItemLifecycleInput): Promise<ItemLifecycleRecord> {
  const userIdOrStakeAddress = normalizeIdentifier(
    input.userIdOrStakeAddress,
    'userIdOrStakeAddress',
  );
  const itemId = normalizeIdentifier(input.itemId, 'itemId');
  const supabase = getSupabaseAdmin();
  const existing = await readLifecycleRecord(supabase, userIdOrStakeAddress, itemId);
  const row: ItemLifecycleRecord = {
    user_id_or_stake_address: userIdOrStakeAddress,
    item_id: itemId,
    acknowledged_at: existing?.acknowledged_at ?? null,
    dismissed_at: toIso(input.at),
  };

  await upsertLifecycleRecord(supabase, row, 'dismiss');

  return row;
}
