import { getSupabaseAdmin } from '@/lib/supabase';

export type Persona = 'drep' | 'spo' | 'cc' | 'citizen' | 'anonymous';

export interface SessionPersonaInputs {
  walletAddress?: string | null;
  userId?: string | null;
  stakeAddress?: string | null;
}

export interface ResolvedSessionPersona {
  persona: Persona;
  drepId?: string | null;
  poolId?: string | null;
  ccHotId?: string | null;
  delegatedDrepId?: string | null;
}

interface UserRow {
  id: string;
  wallet_address: string | null;
  claimed_drep_id: string | null;
  delegation_history: unknown;
}

interface UserWalletRow {
  stake_address: string | null;
  payment_address: string | null;
  drep_id: string | null;
  pool_id: string | null;
}

interface PoolClaimRow {
  pool_id: string | null;
}

interface CcMemberRow {
  cc_hot_id: string | null;
}

function normalizeId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(normalizeId).filter((value): value is string => !!value))];
}

function latestDelegatedDrepId(history: unknown): string | null {
  if (!Array.isArray(history)) return null;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const candidate =
      normalizeId(record.drepId) ??
      normalizeId(record.drep_id) ??
      normalizeId(record.delegatedDrepId) ??
      normalizeId(record.delegated_drep_id);
    if (candidate) return candidate;
  }

  return null;
}

async function readUser(session: SessionPersonaInputs): Promise<UserRow | null> {
  const supabase = getSupabaseAdmin();
  const userId = normalizeId(session.userId);
  const walletAddress = normalizeId(session.walletAddress);

  if (userId) {
    const { data, error } = await supabase
      .from('users')
      .select('id, wallet_address, claimed_drep_id, delegation_history')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to read user persona row: ${error.message}`);
    if (data) return data as UserRow;
  }

  if (!walletAddress) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, wallet_address, claimed_drep_id, delegation_history')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) throw new Error(`Failed to read user persona row by wallet: ${error.message}`);
  return (data as UserRow | null) ?? null;
}

async function readWalletRow(
  session: SessionPersonaInputs,
  user: UserRow | null,
): Promise<UserWalletRow | null> {
  const supabase = getSupabaseAdmin();
  const walletAddress = normalizeId(session.walletAddress);
  const stakeAddress = normalizeId(session.stakeAddress);
  const candidateAddress = stakeAddress ?? walletAddress;

  if (candidateAddress) {
    const { data: stakeMatch, error: stakeError } = await supabase
      .from('user_wallets')
      .select('stake_address, payment_address, drep_id, pool_id')
      .eq('stake_address', candidateAddress)
      .maybeSingle();

    if (stakeError)
      throw new Error(`Failed to read user wallet by stake address: ${stakeError.message}`);
    if (stakeMatch) return stakeMatch as UserWalletRow;

    const { data: paymentMatch, error: paymentError } = await supabase
      .from('user_wallets')
      .select('stake_address, payment_address, drep_id, pool_id')
      .eq('payment_address', candidateAddress)
      .maybeSingle();

    if (paymentError) {
      throw new Error(`Failed to read user wallet by payment address: ${paymentError.message}`);
    }
    if (paymentMatch) return paymentMatch as UserWalletRow;
  }

  const userId = normalizeId(user?.id) ?? normalizeId(session.userId);
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_wallets')
    .select('stake_address, payment_address, drep_id, pool_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to read user wallet by user id: ${error.message}`);
  return (data as UserWalletRow | null) ?? null;
}

async function readClaimedPoolId(addresses: string[], walletRow: UserWalletRow | null) {
  const walletPoolId = normalizeId(walletRow?.pool_id);
  if (walletPoolId) return walletPoolId;
  if (addresses.length === 0) return null;

  const { data, error } = await getSupabaseAdmin()
    .from('pools')
    .select('pool_id')
    .in('claimed_by', addresses)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to read claimed pool: ${error.message}`);
  return normalizeId((data as PoolClaimRow | null)?.pool_id);
}

async function readCcHotId(addresses: string[]) {
  const supabase = getSupabaseAdmin();

  for (const address of addresses) {
    const { data: hotMatch, error: hotError } = await supabase
      .from('cc_members')
      .select('cc_hot_id')
      .eq('cc_hot_id', address)
      .maybeSingle();

    if (hotError) throw new Error(`Failed to read CC hot membership: ${hotError.message}`);
    const ccHotId = normalizeId((hotMatch as CcMemberRow | null)?.cc_hot_id);
    if (ccHotId) return ccHotId;

    const { data: coldMatch, error: coldError } = await supabase
      .from('cc_members')
      .select('cc_hot_id')
      .eq('cc_cold_id', address)
      .limit(1)
      .maybeSingle();

    if (coldError) throw new Error(`Failed to read CC cold membership: ${coldError.message}`);
    const coldCcHotId = normalizeId((coldMatch as CcMemberRow | null)?.cc_hot_id);
    if (coldCcHotId) return coldCcHotId;
  }

  return null;
}

export async function derivePersonaFromSession(
  session: SessionPersonaInputs | null,
): Promise<ResolvedSessionPersona> {
  const sessionWalletAddress = normalizeId(session?.walletAddress);
  const sessionStakeAddress = normalizeId(session?.stakeAddress);

  if (!sessionWalletAddress && !sessionStakeAddress && !normalizeId(session?.userId)) {
    return { persona: 'anonymous' };
  }

  const user = await readUser(session ?? {});
  const walletRow = await readWalletRow(session ?? {}, user);
  const addresses = uniqueIds([
    sessionStakeAddress,
    sessionWalletAddress,
    user?.wallet_address,
    walletRow?.stake_address,
    walletRow?.payment_address,
  ]);

  const claimedDrepId = normalizeId(user?.claimed_drep_id);
  if (claimedDrepId) {
    return { persona: 'drep', drepId: claimedDrepId };
  }

  const poolId = await readClaimedPoolId(addresses, walletRow);
  if (poolId) {
    return { persona: 'spo', poolId };
  }

  const ccHotId = await readCcHotId(addresses);
  if (ccHotId) {
    return { persona: 'cc', ccHotId };
  }

  const delegatedDrepId =
    normalizeId(walletRow?.drep_id) ?? latestDelegatedDrepId(user?.delegation_history);

  return {
    persona: addresses.length > 0 ? 'citizen' : 'anonymous',
    delegatedDrepId,
  };
}
