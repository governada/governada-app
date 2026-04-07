import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPoolMetadataUpdate,
  buildPoolStakeUpdate,
  collectRelayIpsByPool,
  fetchKoiosPoolInfoBatches,
  isPrivateIP,
} from '@/lib/scoring/spoPoolInfo';

describe('spoPoolInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches Koios pool info in batches and records failed pool ids', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ pool_id_bech32: 'pool1', ticker: 'AAA' }],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

    vi.stubGlobal('fetch', fetchMock);

    const onBatchError = vi.fn();
    const result = await fetchKoiosPoolInfoBatches(['pool1', 'pool2', 'pool3'], {
      batchSize: 2,
      timeoutMs: 1234,
      onBatchError,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.pools).toEqual([{ pool_id_bech32: 'pool1', ticker: 'AAA' }]);
    expect(result.failedPoolIds).toEqual(['pool3']);
    expect(onBatchError).toHaveBeenCalledWith(
      expect.objectContaining({
        batchIds: ['pool3'],
        status: 503,
      }),
    );
  });

  it('normalizes Koios pool metadata and stake updates', () => {
    const koiosPool = {
      pool_id_bech32: 'pool1',
      ticker: 'AAA',
      meta_json: { name: 'Alpha Pool', homepage: 'https://example.com' },
      pledge: 10,
      margin: 0.05,
      fixed_cost: 340000000,
      live_delegators: 123,
      live_stake: 456000000,
      pool_status: 'registered',
      retiring_epoch: 600,
    };

    expect(buildPoolMetadataUpdate(koiosPool)).toEqual({
      pool_id: 'pool1',
      ticker: 'AAA',
      pool_name: 'Alpha Pool',
      pledge_lovelace: 10,
      margin: 0.05,
      fixed_cost_lovelace: 340000000,
      delegator_count: 123,
      live_stake_lovelace: 456000000,
      homepage_url: 'https://example.com',
      pool_status: 'registered',
      retiring_epoch: 600,
    });

    expect(buildPoolStakeUpdate(koiosPool)).toEqual({
      pool_id: 'pool1',
      delegator_count: 123,
      live_stake_lovelace: 456000000,
    });
  });

  it('filters private relay IPs and tracks dns-only pools', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('8.8.8.8')).toBe(false);

    const { dnsOnlyPools, ipToPoolMap } = collectRelayIpsByPool([
      {
        pool_id_bech32: 'pool1',
        relays: [{ ipv4: '8.8.8.8' }, { ipv4: '10.0.0.5' }],
      },
      {
        pool_id_bech32: 'pool2',
        relays: [{ dns: 'relay.example.com' }],
      },
    ]);

    expect(dnsOnlyPools).toEqual(new Set(['pool2']));
    expect(ipToPoolMap.get('8.8.8.8')).toEqual(['pool1']);
  });
});
