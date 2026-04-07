import { getSupabaseAdmin } from '@/lib/supabase';
import { errMsg } from '@/lib/sync-utils';

export async function getSyncCursorBlockTime(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  syncType: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('sync_cursors')
    .select('cursor_block_time')
    .eq('sync_type', syncType)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read ${syncType} cursor: ${errMsg(error)}`);
  }

  return data?.cursor_block_time ?? null;
}

export async function getSyncCursorTimestamp(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  syncType: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sync_cursors')
    .select('cursor_timestamp')
    .eq('sync_type', syncType)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read ${syncType} timestamp cursor: ${errMsg(error)}`);
  }

  return data?.cursor_timestamp ?? null;
}

export async function setSyncCursorBlockTime(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  syncType: string,
  cursorBlockTime: number,
): Promise<void> {
  const { error } = await supabase.from('sync_cursors').upsert(
    {
      sync_type: syncType,
      cursor_block_time: cursorBlockTime,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'sync_type', ignoreDuplicates: false },
  );

  if (error) {
    throw new Error(`Failed to store ${syncType} cursor: ${errMsg(error)}`);
  }
}

export async function setSyncCursorTimestamp(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  syncType: string,
  cursorTimestamp: string,
): Promise<void> {
  const { error } = await supabase.from('sync_cursors').upsert(
    {
      sync_type: syncType,
      cursor_timestamp: cursorTimestamp,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'sync_type', ignoreDuplicates: false },
  );

  if (error) {
    throw new Error(`Failed to store ${syncType} timestamp cursor: ${errMsg(error)}`);
  }
}
