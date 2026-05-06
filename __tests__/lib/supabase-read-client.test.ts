import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMock.createSupabaseClient,
}));

import { getSupabaseReadEnvStatus, probeSupabaseReadClient } from '@/lib/supabase';

describe('Supabase read-client diagnostics', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    supabaseMock.createSupabaseClient.mockReturnValue({ from: supabaseMock.from });
    supabaseMock.from.mockReturnValue({ select: supabaseMock.select });
    supabaseMock.select.mockReturnValue({ limit: supabaseMock.limit });
    supabaseMock.limit.mockReturnValue({ abortSignal: supabaseMock.abortSignal });
    supabaseMock.abortSignal.mockResolvedValue({ error: null, status: 200 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('prefers the publishable key when both read keys exist', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-key');

    expect(getSupabaseReadEnvStatus()).toMatchObject({
      activeKey: 'publishable',
      publishableKey: 'present',
      legacyAnonKey: 'present',
    });
  });

  it('accepts the legacy anon key when publishable key is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-key');

    expect(getSupabaseReadEnvStatus()).toMatchObject({
      activeKey: 'legacy_anon',
      publishableKey: 'missing',
      legacyAnonKey: 'present',
    });
  });

  it('fails closed before client creation when the read key is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    const result = await probeSupabaseReadClient();

    expect(result.status).toBe('unhealthy');
    expect(result.reason).toBe('missing_read_key');
    expect(supabaseMock.createSupabaseClient).not.toHaveBeenCalled();
  });

  it('fails closed before client creation when the URL is invalid', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not a url');

    const result = await probeSupabaseReadClient();

    expect(result.status).toBe('unhealthy');
    expect(result.reason).toBe('invalid_url');
    expect(supabaseMock.createSupabaseClient).not.toHaveBeenCalled();
  });

  it('surfaces query errors without exposing key values', async () => {
    supabaseMock.abortSignal.mockResolvedValue({
      error: { message: 'Invalid API key', code: 'PGRST301', status: 401 },
      status: 401,
    });

    const result = await probeSupabaseReadClient();

    expect(result.status).toBe('unhealthy');
    expect(result.reason).toBe('query_error');
    expect(result.errorCode).toBe('PGRST301');
    expect(result.httpStatus).toBe(401);
    expect(JSON.stringify(result)).not.toContain('publishable-key');
  });

  it('classifies aborts as read-client timeouts', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    supabaseMock.abortSignal.mockRejectedValue(abortError);

    const result = await probeSupabaseReadClient();

    expect(result.status).toBe('unhealthy');
    expect(result.reason).toBe('timeout');
  });
});
