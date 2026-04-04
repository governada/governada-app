export interface RuntimeRelease {
  commit_sha: string | null;
  source: string | null;
  platform: 'railway' | 'vercel' | 'github' | 'unknown';
}

const COMMIT_SHA_KEYS = [
  'RAILWAY_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'SOURCE_VERSION',
  'COMMIT_SHA',
] as const;

function normalizeCommitSha(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function detectPlatform(): RuntimeRelease['platform'] {
  if (process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID) {
    return 'railway';
  }

  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return 'vercel';
  }

  if (process.env.GITHUB_ACTIONS) {
    return 'github';
  }

  return 'unknown';
}

export function getRuntimeRelease(): RuntimeRelease {
  for (const key of COMMIT_SHA_KEYS) {
    const value = normalizeCommitSha(process.env[key]);
    if (value) {
      return {
        commit_sha: value,
        source: key,
        platform: detectPlatform(),
      };
    }
  }

  return {
    commit_sha: null,
    source: null,
    platform: detectPlatform(),
  };
}
