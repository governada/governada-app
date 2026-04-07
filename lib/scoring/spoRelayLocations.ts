export interface RelayGeoLocation {
  lat: number;
  lon: number;
  country: string;
  city: string;
}

export interface RelayLocationEntry extends RelayGeoLocation {
  ip: string;
}

export interface RelayLocationUpdate {
  pool_id: string;
  relay_lat: number;
  relay_lon: number;
  relay_locations: RelayLocationEntry[];
}

interface IpApiBatchResult {
  query: string;
  status: string;
  lat?: number;
  lon?: number;
  country?: string;
  city?: string;
}

const IP_API_BATCH_URL = 'http://ip-api.com/batch?fields=query,status,lat,lon,country,city';

export async function geocodeRelayIps(
  ips: string[],
  options: {
    maxIps?: number;
    timeoutMs?: number;
  } = {},
): Promise<Map<string, RelayGeoLocation>> {
  const { maxIps = 100, timeoutMs = 10_000 } = options;
  const batchIps = ips.slice(0, maxIps);

  if (batchIps.length === 0) {
    return new Map();
  }

  const response = await fetch(IP_API_BATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchIps.map((ip) => ({ query: ip }))),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`ip-api ${response.status}`);
  }

  const results = (await response.json()) as IpApiBatchResult[];
  const ipGeo = new Map<string, RelayGeoLocation>();

  for (const result of results) {
    if (result.status === 'success' && result.lat != null && result.lon != null) {
      ipGeo.set(result.query, {
        lat: result.lat,
        lon: result.lon,
        country: result.country ?? '',
        city: result.city ?? '',
      });
    }
  }

  return ipGeo;
}

export function buildRelayLocationUpdates(
  ipToPoolMap: Map<string, string[]>,
  ipGeo: Map<string, RelayGeoLocation>,
): RelayLocationUpdate[] {
  const poolGeo = new Map<
    string,
    {
      lats: number[];
      lons: number[];
      locations: RelayLocationEntry[];
    }
  >();

  for (const [ip, pools] of ipToPoolMap) {
    const geo = ipGeo.get(ip);
    if (!geo) continue;

    for (const poolId of pools) {
      const entry = poolGeo.get(poolId) ?? { lats: [], lons: [], locations: [] };
      entry.lats.push(geo.lat);
      entry.lons.push(geo.lon);
      entry.locations.push({ ...geo, ip });
      poolGeo.set(poolId, entry);
    }
  }

  return [...poolGeo.entries()].map(([pool_id, data]) => ({
    pool_id,
    relay_lat: data.lats.reduce((sum, value) => sum + value, 0) / data.lats.length,
    relay_lon: data.lons.reduce((sum, value) => sum + value, 0) / data.lons.length,
    relay_locations: data.locations,
  }));
}
