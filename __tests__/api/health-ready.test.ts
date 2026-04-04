import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseJson } from '../helpers';
import { GET } from '@/app/api/health/ready/route';

describe('GET /api/health/ready', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns release metadata with the readiness response', async () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', 'env_123');
    vi.stubEnv('RAILWAY_GIT_COMMIT_SHA', 'ABCDEF123456');

    const response = GET();
    const body = (await parseJson(response)) as {
      status: string;
      release: { commit_sha: string; source: string; platform: string };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.release).toEqual({
      commit_sha: 'abcdef123456',
      source: 'RAILWAY_GIT_COMMIT_SHA',
      platform: 'railway',
    });
  });
});
