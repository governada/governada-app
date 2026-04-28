const { spawnSync } = require('node:child_process');

const { redactSensitiveText } = require('./lib/gh-auth');
const {
  HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION,
  getHumanGithubTokenCacheStatus,
  resolveHumanGithubTokenRefFallback,
  runGhWithCachedToken,
} = require('./lib/gh-token-cache');
const { loadLocalEnv, repoRoot, runGh } = require('./lib/runtime');
const { getContext } = require('./set-gh-context');

const EXPECTED_REPO = 'governada/app';
const EXPECTED_OP_ACCOUNT = 'my.1password.com';
const EXPECTED_GH_USER = 'tim-governada';
const OP_READ_TIMEOUT_MS = 15000;

function detailFrom(result) {
  return redactSensitiveText(result.stderr || result.stdout || '').trim();
}

function pass(message) {
  console.log(`OK: ${message}`);
}

function warn(message) {
  console.log(`WARN: ${message}`);
}

function fail(failures, message) {
  failures.push(message);
  console.log(`BLOCKED: ${message}`);
}

function hasDesktopIpcFailure(detail) {
  return /couldn'?t connect to the 1Password desktop app|connect to the 1Password desktop app|desktop app|authorization timeout/i.test(
    detail,
  );
}

function runExpectedGh(args, { env, useCachedLane }) {
  if (!useCachedLane) {
    return runGh(args);
  }

  const cached = runGhWithCachedToken(args, { env });
  if (!cached.usedCache) {
    return {
      status: 1,
      stdout: '',
      stderr: `${cached.reason || 'human GitHub token runtime cache is not usable'}\n`,
    };
  }

  return cached.result;
}

function main() {
  const failures = [];
  loadLocalEnv();

  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  resolveHumanGithubTokenRefFallback(env, { repoRoot });

  console.log('Auth doctor: Governada GitHub lane');

  if (context.GH_REPO === EXPECTED_REPO) {
    pass(`repo context is pinned to ${EXPECTED_REPO}`);
  } else {
    fail(failures, `repo context is ${context.GH_REPO || 'unset'}, expected ${EXPECTED_REPO}`);
  }

  if (context.OP_ACCOUNT === EXPECTED_OP_ACCOUNT) {
    pass(`1Password account is pinned to ${EXPECTED_OP_ACCOUNT}`);
  } else {
    fail(
      failures,
      `1Password account is ${context.OP_ACCOUNT || 'unset'}, expected ${EXPECTED_OP_ACCOUNT}`,
    );
  }

  const tokenRefVar = env.GH_TOKEN_OP_REF
    ? 'GH_TOKEN_OP_REF'
    : env.GITHUB_TOKEN_OP_REF
      ? 'GITHUB_TOKEN_OP_REF'
      : '';
  const tokenRef = env.GH_TOKEN_OP_REF || env.GITHUB_TOKEN_OP_REF || '';

  if (tokenRefVar) {
    pass(`${tokenRefVar} is present`);
  } else {
    fail(failures, 'no 1Password GitHub token reference is configured');
  }

  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
    fail(
      failures,
      'raw GitHub token env is present; remove GH_TOKEN/GITHUB_TOKEN so this diagnostic proves the repo-scoped 1Password lane',
    );
  } else {
    pass('raw GitHub token env is not present');
  }

  const opVersion = spawnSync('op', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: OP_READ_TIMEOUT_MS,
  });

  if (opVersion.error?.code === 'ENOENT') {
    fail(failures, '1Password CLI (`op`) is not installed or not on PATH');
  } else if (opVersion.status !== 0) {
    const detail = detailFrom(opVersion);
    fail(failures, `1Password CLI is not runnable${detail ? `: ${detail}` : ''}`);
  } else {
    pass(`1Password CLI is available (${opVersion.stdout.trim() || 'version unknown'})`);
  }

  let ghLaneReady = false;
  let useCachedLane = false;
  const tokenCache = getHumanGithubTokenCacheStatus(env);
  if (tokenCache.present) {
    useCachedLane = true;
    ghLaneReady = true;
    pass('human GitHub token runtime cache is present in macOS Keychain');
  } else if (tokenCache.error) {
    fail(failures, `human GitHub token runtime cache could not be inspected: ${tokenCache.error}`);
  } else {
    warn(
      `human GitHub token runtime cache is missing; run npm run gh:token-cache -- cache-token --confirm ${HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION} once with human approval`,
    );
  }

  if (!useCachedLane && tokenRef) {
    const opRead = spawnSync('op', ['read', tokenRef, '--no-newline', '--force'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: OP_READ_TIMEOUT_MS,
    });

    const detail = detailFrom(opRead);
    if (opRead.error?.code === 'ETIMEDOUT' || opRead.signal) {
      fail(
        failures,
        '1Password desktop IPC timed out from this process; if `op read` works outside Codex, rerun the repo wrapper with approved sandbox escalation rather than changing auth models',
      );
    } else if (opRead.status === 0 && opRead.stdout.trim()) {
      ghLaneReady = true;
      pass('1Password desktop lane can resolve the GitHub token reference');
    } else if (hasDesktopIpcFailure(detail)) {
      fail(
        failures,
        '1Password desktop IPC is unavailable from this process; if `op read` works outside Codex, rerun the repo wrapper with approved sandbox escalation rather than changing auth models',
      );
    } else if (opRead.status === 0) {
      fail(failures, '1Password token reference resolved to an empty value');
    } else {
      fail(
        failures,
        `1Password token reference could not be resolved${detail ? `: ${detail}` : ''}`,
      );
    }
  }

  if (ghLaneReady) {
    const user = runExpectedGh(['api', 'user', '--jq', '.login'], { env, useCachedLane });
    if (user.status !== 0) {
      const detail = detailFrom(user);
      fail(failures, `child gh API auth failed${detail ? `: ${detail}` : ''}`);
    } else {
      const login = user.stdout.trim();
      if (login === EXPECTED_GH_USER) {
        pass(`child gh API auth works as ${EXPECTED_GH_USER}`);
      } else {
        fail(
          failures,
          `child gh API auth returned ${login || 'unknown'}, expected ${EXPECTED_GH_USER}`,
        );
      }
    }

    const repo = runExpectedGh(['api', `repos/${EXPECTED_REPO}`, '--jq', '.full_name'], {
      env,
      useCachedLane,
    });
    if (repo.status !== 0) {
      const detail = detailFrom(repo);
      fail(failures, `repo access failed for ${EXPECTED_REPO}${detail ? `: ${detail}` : ''}`);
    } else {
      pass(`repo access works for ${repo.stdout.trim() || EXPECTED_REPO}`);
    }
  } else {
    warn('skipping child gh and repo access checks because no GitHub token lane is ready');
  }

  if (failures.length > 0) {
    console.log('');
    console.log(`Auth doctor result: BLOCKED (${failures.length})`);
    process.exit(1);
  }

  console.log('');
  console.log('Auth doctor result: OK');
}

main();
