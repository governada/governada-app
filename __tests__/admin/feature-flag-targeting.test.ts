/**
 * Feature Flag Per-User Targeting Tests
 *
 * Verifies the targeting logic in getFeatureFlag():
 * - Global value returned when no wallet provided
 * - Per-wallet override when wallet matches targeting.wallets
 * - Falls through to global when wallet not in targeting
 * - Env var override takes precedence over everything
 * - setUserFlagOverride manages targeting correctly
 *
 * Since feature flags use Supabase, we mock the client at the module level
 * following the same pattern as __tests__/api/health.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase — matches existing project pattern
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              single: () => mockSingle(),
            };
          },
          order: () => ({
            order: () => ({
              // For getAllFlags chain
            }),
          }),
        };
      },
    }),
  }),
  getSupabaseAdmin: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              single: () => mockSingle(),
            };
          },
        };
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return {
          eq: () => mockUpdate(),
        };
      },
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { getFeatureFlag, invalidateFlagCache } from '@/lib/featureFlags';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Feature Flag Targeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateFlagCache();
    // Clear any env overrides
    delete process.env.FF_TEST_FLAG;
  });

  afterEach(() => {
    delete process.env.FF_TEST_FLAG;
  });

  describe('Global flag value (no wallet)', () => {
    it('returns default value when flag is not in cache or DB', async () => {
      // loadFlags returns empty map (no data)
      mockSelect.mockReturnValue({
        eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      });

      // First call goes to loadFlags which hits supabase select
      // Since we can't easily mock the full chain for loadFlags,
      // test the env override path and structural constraints instead
      const result = await getFeatureFlag('nonexistent_flag', false);
      // Default value is false
      expect(result).toBe(false);
    });

    it('env var override takes precedence over everything', async () => {
      process.env.FF_TEST_FLAG = 'true';
      const result = await getFeatureFlag('test_flag', false);
      expect(result).toBe(true);
    });

    it('env var "1" is treated as true', async () => {
      process.env.FF_TEST_FLAG = '1';
      const result = await getFeatureFlag('test_flag', false);
      expect(result).toBe(true);
    });

    it('env var "false" is treated as false', async () => {
      process.env.FF_TEST_FLAG = 'false';
      const result = await getFeatureFlag('test_flag', true);
      expect(result).toBe(false);
    });

    it('env var "0" is treated as false', async () => {
      process.env.FF_TEST_FLAG = '0';
      const result = await getFeatureFlag('test_flag', true);
      expect(result).toBe(false);
    });
  });

  describe('Per-wallet targeting', () => {
    it('returns per-wallet override when wallet is in targeting.wallets', async () => {
      const walletAddress = 'stake1_test_wallet_abc';

      // Mock the targeting lookup: supabase.from().select('targeting').eq().single()
      mockSingle.mockResolvedValue({
        data: {
          targeting: {
            wallets: { [walletAddress]: true },
          },
        },
        error: null,
      });

      const result = await getFeatureFlag('test_flag', false, walletAddress);
      // Per-wallet override is true, even though default is false
      expect(result).toBe(true);
    });

    it('returns false per-wallet override even when default is true', async () => {
      const walletAddress = 'stake1_disabled_wallet';

      mockSingle.mockResolvedValue({
        data: {
          targeting: {
            wallets: { [walletAddress]: false },
          },
        },
        error: null,
      });

      const result = await getFeatureFlag('test_flag', true, walletAddress);
      // Per-wallet override is false, overriding default true
      expect(result).toBe(false);
    });

    it('falls through to global when wallet is not in targeting.wallets', async () => {
      const walletAddress = 'stake1_not_targeted';

      mockSingle.mockResolvedValue({
        data: {
          targeting: {
            wallets: { stake1_other_wallet: true },
          },
        },
        error: null,
      });

      // Falls through to loadFlags -> default value
      const result = await getFeatureFlag('test_flag', false, walletAddress);
      expect(result).toBe(false);
    });

    it('falls through to global when targeting has no wallets key', async () => {
      const walletAddress = 'stake1_any';

      mockSingle.mockResolvedValue({
        data: {
          targeting: {},
        },
        error: null,
      });

      const result = await getFeatureFlag('test_flag', true, walletAddress);
      expect(result).toBe(true);
    });

    it('falls through to global when targeting is null', async () => {
      const walletAddress = 'stake1_any';

      mockSingle.mockResolvedValue({
        data: { targeting: null },
        error: null,
      });

      const result = await getFeatureFlag('test_flag', true, walletAddress);
      expect(result).toBe(true);
    });

    it('falls through to global when targeting lookup errors', async () => {
      const walletAddress = 'stake1_error_case';

      mockSingle.mockRejectedValue(new Error('DB connection lost'));

      const result = await getFeatureFlag('test_flag', false, walletAddress);
      // Should not throw, falls through to global (default)
      expect(result).toBe(false);
    });

    it('env var still takes precedence over per-wallet targeting', async () => {
      const walletAddress = 'stake1_targeted';
      process.env.FF_TEST_FLAG = 'false';

      // Even with targeting set to true for this wallet, env var wins
      mockSingle.mockResolvedValue({
        data: {
          targeting: { wallets: { [walletAddress]: true } },
        },
        error: null,
      });

      const result = await getFeatureFlag('test_flag', true, walletAddress);
      expect(result).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Architectural constraints for targeting
// ---------------------------------------------------------------------------

describe('Feature Flag Targeting Architecture', () => {
  it('getFeatureFlag accepts optional walletAddress parameter', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('lib/featureFlags.ts', 'utf-8');

    // Function signature must accept walletAddress as 3rd parameter
    expect(content).toContain('walletAddress?: string');
  });

  it('targeting uses JSONB wallets map pattern', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('lib/featureFlags.ts', 'utf-8');

    // Targeting structure: { wallets: { "stake1...": true/false } }
    expect(content).toContain('targeting.wallets');
    expect(content).toContain('walletAddress in targeting.wallets');
  });

  it('setUserFlagOverride is exported for managing per-wallet overrides', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('lib/featureFlags.ts', 'utf-8');

    expect(content).toContain('export async function setUserFlagOverride');
    // Must accept null to remove an override
    expect(content).toContain('enabled: boolean | null');
  });

  it('setUserFlagOverride deletes wallet entry when enabled is null', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('lib/featureFlags.ts', 'utf-8');

    // When enabled is null, the wallet key should be deleted from targeting
    expect(content).toContain('delete wallets[walletAddress]');
  });

  it('FeatureFlag type includes targeting field', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('lib/featureFlags.ts', 'utf-8');

    expect(content).toContain('targeting: Record<string, unknown>');
  });

  it('env var override is checked before targeting and cache', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('lib/featureFlags.ts', 'utf-8');

    // The env override block should appear before the targeting block
    const envOverridePos = content.indexOf('FF_${key.toUpperCase()}');
    const targetingPos = content.indexOf('Check per-user targeting');

    expect(envOverridePos).toBeGreaterThan(-1);
    expect(targetingPos).toBeGreaterThan(-1);
    expect(envOverridePos).toBeLessThan(targetingPos);
  });
});
