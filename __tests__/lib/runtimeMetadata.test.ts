import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRuntimeRelease } from '@/lib/runtimeMetadata';

describe('getRuntimeRelease', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers Railway commit metadata when available', () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', 'env_123');
    vi.stubEnv('RAILWAY_GIT_COMMIT_SHA', 'ABCDEF123456');

    expect(getRuntimeRelease()).toEqual({
      commit_sha: 'abcdef123456',
      source: 'RAILWAY_GIT_COMMIT_SHA',
      platform: 'railway',
    });
  });

  it('falls back to unknown when no release metadata exists', () => {
    for (const key of [
      'RAILWAY_ENVIRONMENT_ID',
      'RAILWAY_PROJECT_ID',
      'RAILWAY_GIT_COMMIT_SHA',
      'VERCEL',
      'VERCEL_ENV',
      'VERCEL_GIT_COMMIT_SHA',
      'GITHUB_ACTIONS',
      'GITHUB_SHA',
      'SOURCE_VERSION',
      'COMMIT_SHA',
    ]) {
      vi.stubEnv(key, '');
    }

    expect(getRuntimeRelease()).toEqual({
      commit_sha: null,
      source: null,
      platform: 'unknown',
    });
  });
});
