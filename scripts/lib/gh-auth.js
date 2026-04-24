const { spawnSync } = require('node:child_process');

const OP_READ_TIMEOUT_MS = 15000;

function redactSensitiveText(value) {
  return value
    .replace(/op:\/\/[^\r\n'"]+/g, 'op://[redacted]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, 'github_pat_[redacted]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]+\b/g, '[redacted-gh-token]');
}

function hasDesktopIpcFailure(detail) {
  return /couldn'?t connect to the 1Password desktop app|connect to the 1Password desktop app|desktop app|authorization timeout/i.test(
    detail,
  );
}

function readOnePasswordToken(tokenRef, env, cwd) {
  const result = spawnSync('op', ['read', tokenRef], {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: OP_READ_TIMEOUT_MS,
  });

  if (result.error?.code === 'ENOENT') {
    return {
      error: 'GitHub auth: GH_TOKEN_OP_REF is set, but the 1Password CLI (`op`) is not installed.',
    };
  }

  if (result.error?.code === 'ETIMEDOUT' || result.signal) {
    return {
      error:
        'GitHub auth: 1Password CLI timed out while reading GH_TOKEN_OP_REF. If `op read` works outside Codex, Codex sandbox may be blocking desktop IPC; rerun the repo wrapper with approved sandbox escalation rather than changing auth models.',
    };
  }

  if (result.status !== 0) {
    const detail = redactSensitiveText(result.stderr || result.stdout || '').trim();
    if (hasDesktopIpcFailure(detail)) {
      return {
        error:
          'GitHub auth: 1Password desktop IPC is unavailable from this process. If `op read` works outside Codex, rerun the repo wrapper with approved sandbox escalation rather than changing auth models.',
      };
    }

    return {
      error:
        `GitHub auth: could not read GH_TOKEN_OP_REF with 1Password CLI.` +
        (detail ? `\n${detail}` : ''),
    };
  }

  const token = result.stdout.trim();
  if (!token) {
    return { error: 'GitHub auth: GH_TOKEN_OP_REF resolved to an empty value.' };
  }

  return { token };
}

function withGhTokenFromOnePassword(env, cwd) {
  const mergedEnv = { ...env };
  const tokenRef = mergedEnv.GH_TOKEN_OP_REF || mergedEnv.GITHUB_TOKEN_OP_REF;

  if (!tokenRef) {
    return { env: mergedEnv };
  }

  const result = readOnePasswordToken(tokenRef, mergedEnv, cwd);
  if (result.error) {
    return { env: mergedEnv, error: result.error };
  }

  delete mergedEnv.GITHUB_TOKEN;
  mergedEnv.GH_TOKEN = result.token;
  return { env: mergedEnv };
}

module.exports = {
  redactSensitiveText,
  withGhTokenFromOnePassword,
};
