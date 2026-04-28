const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { getContext } = require('../set-gh-context.js');
const { withGhTokenFromOnePassword } = require('./gh-auth');
const { runGhWithCachedToken } = require('./gh-token-cache');

const repoRoot = path.resolve(__dirname, '..', '..');

function resolveCommand(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (path.extname(command)) {
    return command;
  }

  if (command === 'npm' || command === 'npx') {
    return `${command}.cmd`;
  }

  return command;
}

function usesShell(command) {
  return process.platform === 'win32' && (command === 'npm' || command === 'npx');
}

function loadLocalEnv() {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(repoRoot, '.env.local'),
  ].filter(Boolean);

  const seen = new Set();
  for (const envPath of candidates) {
    const resolved = path.resolve(envPath);
    if (seen.has(resolved) || !fs.existsSync(resolved)) {
      continue;
    }

    seen.add(resolved);
    const parsed = parseEnvFile(fs.readFileSync(resolved, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }

    return true;
  }

  return false;
}

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trimStart() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }

    parsed[key] = value;
  }

  return parsed;
}

function withoutDisabledLocalProxyEnv(env) {
  const disabledLocalProxyValues = new Set([
    'http://127.0.0.1:9',
    'https://127.0.0.1:9',
    'http://localhost:9',
    'https://localhost:9',
  ]);
  const proxyKeys = new Set([
    'ALL_PROXY',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'GIT_HTTP_PROXY',
    'GIT_HTTPS_PROXY',
  ]);
  const cleaned = {};

  for (const [key, value] of Object.entries(env)) {
    if (
      proxyKeys.has(key.toUpperCase()) &&
      typeof value === 'string' &&
      disabledLocalProxyValues.has(value.trim().replace(/\/+$/u, ''))
    ) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

function runCommand(command, args, options = {}) {
  let env = {
    ...process.env,
    ...(options.env || {}),
  };

  if (options.stripDisabledLocalProxyEnv) {
    env = withoutDisabledLocalProxyEnv(env);
  }

  const shell = usesShell(command);
  const result = spawnSync(shell ? command : resolveCommand(command), args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    env,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    shell,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function runGh(args) {
  loadLocalEnv();
  const context = getContext();
  const { GH_HOST: _ghHost, ...ghEnvContext } = context;
  const runtimeEnv = {
    ...process.env,
    ...ghEnvContext,
  };
  const cached = runGhWithCachedToken(args, {
    cwd: repoRoot,
    env: runtimeEnv,
  });
  if (cached.usedCache) {
    return cached.result;
  }

  const auth = withGhTokenFromOnePassword(runtimeEnv, repoRoot);

  if (auth.error) {
    return {
      status: 1,
      stdout: '',
      stderr: `${auth.error}\n`,
    };
  }

  return runCommand('gh', args, {
    env: auth.env,
    stripDisabledLocalProxyEnv: true,
  });
}

function runGhJson(args) {
  const result = runGh(args);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(detail || 'gh command failed. Check `gh auth status` and repo access.');
  }

  return JSON.parse(result.stdout);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  loadLocalEnv,
  repoRoot,
  runCommand,
  runGh,
  runGhJson,
  sleep,
};
