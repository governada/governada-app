import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRelayLocationUpdates, geocodeRelayIps } from '@/lib/scoring/spoRelayLocations';

describe('spoRelayLocations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps successful ip-api results into an IP geo lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { query: '8.8.8.8', status: 'success', lat: 10, lon: 20, country: 'US', city: 'A' },
        { query: '1.1.1.1', status: 'fail' },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeRelayIps(['8.8.8.8', '1.1.1.1'])).resolves.toEqual(
      new Map([
        [
          '8.8.8.8',
          {
            lat: 10,
            lon: 20,
            country: 'US',
            city: 'A',
          },
        ],
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('builds centroid updates per pool from relay geo lookups', () => {
    const updates = buildRelayLocationUpdates(
      new Map([
        ['8.8.8.8', ['pool1', 'pool2']],
        ['1.1.1.1', ['pool1']],
      ]),
      new Map([
        ['8.8.8.8', { lat: 10, lon: 20, country: 'US', city: 'A' }],
        ['1.1.1.1', { lat: 14, lon: 30, country: 'CA', city: 'B' }],
      ]),
    );

    expect(updates).toEqual([
      {
        pool_id: 'pool1',
        relay_lat: 12,
        relay_lon: 25,
        relay_locations: [
          { ip: '8.8.8.8', lat: 10, lon: 20, country: 'US', city: 'A' },
          { ip: '1.1.1.1', lat: 14, lon: 30, country: 'CA', city: 'B' },
        ],
      },
      {
        pool_id: 'pool2',
        relay_lat: 10,
        relay_lon: 20,
        relay_locations: [{ ip: '8.8.8.8', lat: 10, lon: 20, country: 'US', city: 'A' }],
      },
    ]);
  });
});
