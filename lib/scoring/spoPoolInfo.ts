export interface KoiosPoolInfo {
  pool_id_bech32?: string;
  ticker?: string;
  meta_json?: { name?: string; description?: string; homepage?: string };
  pledge?: number;
  margin?: number;
  fixed_cost?: number;
  live_delegators?: number;
  live_stake?: number;
  pool_status?: string;
  retiring_epoch?: number | null;
  relays?: Array<{ dns?: string; srv?: string; ipv4?: string; ipv6?: string; port?: number }>;
}

interface FetchKoiosPoolInfoBatchError {
  batchIds: string[];
  error: unknown;
  status?: number;
}

interface FetchKoiosPoolInfoBatchesOptions {
  batchSize?: number;
  timeoutMs?: number;
  onBatchError?: (details: FetchKoiosPoolInfoBatchError) => void;
}

export interface FetchKoiosPoolInfoBatchesResult {
  failedPoolIds: string[];
  pools: KoiosPoolInfo[];
}

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

/** Check if an IPv4 address is private/reserved (RFC 1918, RFC 6598, link-local). */
export function isPrivateIP(ip: string): boolean {
  if (
    ip === '0.0.0.0' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.')
  ) {
    return true;
  }

  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  if (ip.startsWith('100.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 64 && second <= 127) return true;
  }

  return false;
}

export async function fetchKoiosPoolInfoBatches(
  poolIds: string[],
  options: FetchKoiosPoolInfoBatchesOptions = {},
): Promise<FetchKoiosPoolInfoBatchesResult> {
  const { batchSize = 50, timeoutMs = 20_000, onBatchError } = options;
  const pools: KoiosPoolInfo[] = [];
  const failedPoolIds: string[] = [];

  for (let i = 0; i < poolIds.length; i += batchSize) {
    const batchIds = poolIds.slice(i, i + batchSize);

    try {
      const response = await fetch(`${KOIOS_BASE}/pool_info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _pool_bech32_ids: batchIds }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        failedPoolIds.push(...batchIds);
        onBatchError?.({
          batchIds,
          error: new Error(`Koios ${response.status}`),
          status: response.status,
        });
        continue;
      }

      const batchPools = (await response.json()) as KoiosPoolInfo[];
      pools.push(...batchPools);
    } catch (error) {
      failedPoolIds.push(...batchIds);
      onBatchError?.({ batchIds, error });
    }
  }

  return { failedPoolIds, pools };
}

export function buildPoolMetadataUpdate(pool: KoiosPoolInfo): Record<string, unknown> | null {
  if (!pool.pool_id_bech32) {
    return null;
  }

  return {
    pool_id: pool.pool_id_bech32,
    ticker: pool.ticker ?? null,
    pool_name: pool.meta_json?.name ?? pool.ticker ?? null,
    pledge_lovelace: pool.pledge ?? 0,
    margin: pool.margin ?? 0,
    fixed_cost_lovelace: pool.fixed_cost ?? 0,
    delegator_count: pool.live_delegators ?? 0,
    live_stake_lovelace: pool.live_stake ?? 0,
    homepage_url: pool.meta_json?.homepage ?? null,
    pool_status: pool.pool_status ?? 'registered',
    retiring_epoch: pool.retiring_epoch ?? null,
  };
}

export function buildPoolStakeUpdate(pool: KoiosPoolInfo): {
  delegator_count: number;
  live_stake_lovelace: number;
  pool_id: string;
} | null {
  if (!pool.pool_id_bech32) {
    return null;
  }

  return {
    pool_id: pool.pool_id_bech32,
    delegator_count: pool.live_delegators ?? 0,
    live_stake_lovelace: pool.live_stake ?? 0,
  };
}

export function collectRelayIpsByPool(koiosPools: KoiosPoolInfo[]): {
  dnsOnlyPools: Set<string>;
  ipToPoolMap: Map<string, string[]>;
} {
  const ipToPoolMap = new Map<string, string[]>();
  const dnsOnlyPools = new Set<string>();

  for (const pool of koiosPools) {
    if (!pool.pool_id_bech32) continue;

    const relays = pool.relays ?? [];
    let hasPublicIp = false;

    for (const relay of relays) {
      const ip = relay.ipv4;
      if (!ip || isPrivateIP(ip)) continue;
      hasPublicIp = true;
      const pools = ipToPoolMap.get(ip) ?? [];
      pools.push(pool.pool_id_bech32);
      ipToPoolMap.set(ip, pools);
    }

    if (!hasPublicIp) {
      dnsOnlyPools.add(pool.pool_id_bech32);
    }
  }

  return { dnsOnlyPools, ipToPoolMap };
}
