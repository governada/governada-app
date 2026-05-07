import { getSupabaseAdmin } from '@/lib/supabase';

export const VISIT_GAP_MINUTES = 30;
const VISIT_GAP_MS = VISIT_GAP_MINUTES * 60 * 1000;

interface VisitStateRow {
  id?: string;
  stake_address: string | null;
  last_visit_at: string;
  prior_visit_at: string | null;
  last_epoch_visited: number | null;
}

export interface RecordHomepageVisitInput {
  stakeAddress?: string | null;
  now?: Date | string;
  currentEpoch?: number | null;
}

export interface RecordHomepageVisitResult {
  tracked: boolean;
  visitStarted: boolean;
  state: VisitStateRow | null;
  priorEpochVisited: number | null;
}

function toDate(value?: Date | string): Date {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
}

export async function recordHomepageVisit(
  input: RecordHomepageVisitInput,
): Promise<RecordHomepageVisitResult> {
  const stakeAddress = input.stakeAddress?.trim();

  if (!stakeAddress) {
    return { tracked: false, visitStarted: false, state: null, priorEpochVisited: null };
  }

  const now = toDate(input.now);
  const nowIso = now.toISOString();
  const currentEpoch = typeof input.currentEpoch === 'number' ? input.currentEpoch : null;
  const supabase = getSupabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from('user_visit_state')
    .select('id, stake_address, last_visit_at, prior_visit_at, last_epoch_visited')
    .eq('stake_address', stakeAddress)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read homepage visit state: ${readError.message}`);
  }

  if (existing?.last_visit_at) {
    const lastVisitMs = new Date(existing.last_visit_at).getTime();
    if (Number.isFinite(lastVisitMs) && now.getTime() - lastVisitMs < VISIT_GAP_MS) {
      return {
        tracked: true,
        visitStarted: false,
        state: existing as VisitStateRow,
        priorEpochVisited: (existing as VisitStateRow).last_epoch_visited ?? null,
      };
    }
  }

  const priorEpochVisited = (existing as VisitStateRow | null)?.last_epoch_visited ?? null;
  const nextState: VisitStateRow = {
    stake_address: stakeAddress,
    last_visit_at: nowIso,
    prior_visit_at: existing?.last_visit_at ?? null,
    last_epoch_visited: currentEpoch,
  };

  const { error: writeError } = await supabase
    .from('user_visit_state')
    .upsert(nextState, { onConflict: 'stake_address' });

  if (writeError) {
    throw new Error(`Failed to write homepage visit state: ${writeError.message}`);
  }

  return {
    tracked: true,
    visitStarted: true,
    state: nextState,
    priorEpochVisited,
  };
}
