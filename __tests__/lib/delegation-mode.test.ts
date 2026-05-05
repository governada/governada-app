import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDelegationMode, isSandboxMode, resolveDelegationMode } from '@/lib/delegation/mode';

const originalEnv = process.env;

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('delegation mode', () => {
  it('defaults to mainnet', () => {
    delete process.env.GOVERNADA_DELEGATION_MODE;
    delete process.env.NEXT_PUBLIC_GOVERNADA_DELEGATION_MODE;

    expect(getDelegationMode()).toBe('mainnet');
    expect(isSandboxMode()).toBe(false);
  });

  it('uses the server sandbox mode when configured', () => {
    process.env.GOVERNADA_DELEGATION_MODE = 'sandbox';

    expect(getDelegationMode()).toBe('sandbox');
    expect(isSandboxMode()).toBe(true);
  });

  it('can resolve sandbox mode from the server endpoint on the client', async () => {
    delete process.env.GOVERNADA_DELEGATION_MODE;
    delete process.env.NEXT_PUBLIC_GOVERNADA_DELEGATION_MODE;
    vi.stubGlobal('window', {});

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'sandbox' }),
    } as Response);

    await expect(resolveDelegationMode(fetchImpl)).resolves.toBe('sandbox');
  });

  it('skips the client mode endpoint when public mainnet mode is explicit', async () => {
    delete process.env.GOVERNADA_DELEGATION_MODE;
    process.env.NEXT_PUBLIC_GOVERNADA_DELEGATION_MODE = 'mainnet';
    vi.stubGlobal('window', {});

    const fetchImpl = vi.fn();

    await expect(resolveDelegationMode(fetchImpl)).resolves.toBe('mainnet');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
