import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { redactSensitiveText } from './lib/github-app-auth.mjs';

const require = createRequire(import.meta.url);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const EXPECTED_REMOTE = 'git@github-governada:governada/app.git';
const DEFAULT_OPERATION = 'github.merge';
const ALLOWED_OPERATIONS = new Set([
  'github.read',
  'github.ship.pr',
  'github.pr.close',
  'github.merge',
]);

export function parseArgs(argv) {
  const options = {
    help: false,
    operation: DEFAULT_OPERATION,
    probeSsh: false,
    requireDirectSsh: false,
    requireFreshLocalMain: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--operation') {
      const operation = argv[index + 1];
      if (!operation) {
        throw new Error('--operation requires a value');
      }
      if (!ALLOWED_OPERATIONS.has(operation)) {
        throw new Error(`unsupported operation: ${operation}`);
      }
      options.operation = operation;
      index += 1;
    } else if (arg === '--probe-ssh') {
      options.probeSsh = true;
    } else if (arg === '--require-direct-ssh') {
      options.requireDirectSsh = true;
      options.probeSsh = true;
    } else if (arg === '--require-fresh-local-main') {
      options.requireFreshLocalMain = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

export function usage() {
  return `Usage:
  npm run ship:doctor
  npm run ship:doctor -- --operation github.merge
  npm run ship:doctor -- --probe-ssh
  npm run ship:doctor -- --require-direct-ssh --require-fresh-local-main

Default probes are read-only and non-mutating. Direct SSH signing is skipped
unless --probe-ssh or --require-direct-ssh is supplied. This doctor separates:
  1. local Git refs and remote configuration
  2. direct Git SSH via github-governada
  3. repo GitHub API/token auth
  4. existing app-local broker/runtime path
  5. stable agent-runtime operation proof path`;
}

export function isExpectedMissingTokenFailClosed(output) {
  return (
    output.includes('OP_SERVICE_ACCOUNT_TOKEN is not present') && output.includes('FAIL_CLOSED')
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs || 15000,
  });

  return {
    error: result.error,
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function outputOf(result) {
  const pieces = [result.stdout, result.stderr, result.error?.message || ''].filter(Boolean);
  return redactSensitiveText(pieces.join('\n')).trim();
}

function firstLine(text) {
  return (
    text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) || ''
  );
}

function git(args) {
  return run('git', args);
}

function gitValue(args) {
  const result = git(args);
  return result.status === 0 ? result.stdout.trim() : '';
}

function getSharedCheckoutRoot() {
  const commonDir = gitValue(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return commonDir ? path.dirname(commonDir) : REPO_ROOT;
}

function getRepoScriptPath(scriptName) {
  const sharedScriptPath = path.join(getSharedCheckoutRoot(), 'scripts', scriptName);
  if (existsSync(sharedScriptPath)) {
    return sharedScriptPath;
  }

  return path.join(SCRIPT_DIR, scriptName);
}

function runRepoGh(args) {
  const runtimePath = path.join(getSharedCheckoutRoot(), 'scripts', 'lib', 'runtime.js');
  const runtime = existsSync(runtimePath) ? require(runtimePath) : require('./lib/runtime');
  return runtime.runGh(args);
}

function printLane(name, state, details) {
  console.log(`[${state}] ${name}`);
  for (const detail of details.filter(Boolean)) {
    console.log(`  - ${detail}`);
  }
  console.log('');
}

function addIssue(collection, message) {
  collection.push(message);
}

function summarizeCommandStatus(result) {
  const detail = firstLine(outputOf(result));
  return detail ? `exit ${result.status}: ${detail}` : `exit ${result.status}`;
}

function resolveIdentityAgent(value) {
  if (!value || value === 'none') {
    return '';
  }

  if (value.startsWith('~/')) {
    return path.join(process.env.HOME || '', value.slice(2));
  }

  return value;
}

function getGithubGovernadaIdentityAgent() {
  const config = run('ssh', ['-G', 'github-governada']);
  if (config.status !== 0) {
    return {
      error: summarizeCommandStatus(config),
      path: '',
    };
  }

  const line = config.stdout
    .split(/\r?\n/u)
    .find((entry) => entry.toLowerCase().startsWith('identityagent '));
  const rawValue = line ? line.slice('identityagent '.length).trim() : '';
  return {
    error: '',
    path: resolveIdentityAgent(rawValue),
  };
}

function inspectLocalGitRefs({ remoteMainSha, blockers, advisories }) {
  const branch = gitValue(['branch', '--show-current']) || '(detached)';
  const status = gitValue(['status', '--short']);
  const head = gitValue(['rev-parse', 'HEAD']);
  const originMain = gitValue(['rev-parse', 'origin/main']);
  const originRemote = gitValue(['remote', 'get-url', 'origin']);
  const divergence = gitValue(['rev-list', '--left-right', '--count', 'HEAD...origin/main']);
  const details = [
    `branch: ${branch}`,
    `status: ${status ? 'dirty' : 'clean'}`,
    `origin: ${originRemote || '(missing)'}`,
    `HEAD: ${head || '(unknown)'}`,
    `local origin/main: ${originMain || '(missing)'}`,
    divergence ? `local HEAD...origin/main: ${divergence.replace(/\s+/gu, ' / ')}` : '',
    'remote comparison source: GitHub API lane, not git fetch',
  ];

  let state = 'PASS';
  if (status) {
    state = 'BLOCKED';
    addIssue(blockers, 'local Git worktree is dirty');
  }
  if (originRemote !== EXPECTED_REMOTE) {
    state = 'BLOCKED';
    addIssue(
      blockers,
      `origin remote is ${originRemote || '(missing)'}, expected ${EXPECTED_REMOTE}`,
    );
  }
  if (remoteMainSha && originMain && remoteMainSha !== originMain) {
    details.push(`GitHub API main: ${remoteMainSha}`);
    const message = `local origin/main is stale relative to GitHub API main (${originMain} != ${remoteMainSha})`;
    if (state !== 'BLOCKED') {
      state = 'ADVISORY';
    }
    addIssue(advisories, message);
  } else if (remoteMainSha) {
    details.push(`GitHub API main: ${remoteMainSha}`);
  }

  printLane('Local Git refs and checkout hygiene', state, details);
}

function inspectDirectSsh({ options, blockers, advisories }) {
  const identityAgent = getGithubGovernadaIdentityAgent();
  const sshEnv = identityAgent.path ? { SSH_AUTH_SOCK: identityAgent.path } : {};
  const keyList = run('ssh-add', ['-l'], { env: sshEnv });
  const keyListed = keyList.status === 0 && outputOf(keyList).includes('github-governada');
  const details = [
    identityAgent.path
      ? `configured IdentityAgent: ${identityAgent.path}`
      : `configured IdentityAgent: ${identityAgent.error || '(not found)'}`,
    keyListed
      ? 'ssh-add lists a github-governada key'
      : `ssh-add key visibility: ${summarizeCommandStatus(keyList)}`,
  ];

  if (!options.probeSsh) {
    details.push('SSH signing probe skipped; pass --probe-ssh to run ssh -T github-governada');
    addIssue(advisories, 'direct Git SSH signing was not probed');
    printLane('Direct Git SSH via github-governada', 'ADVISORY', details);
    return;
  }

  const probe = run('ssh', ['-o', 'BatchMode=yes', '-T', 'github-governada'], {
    timeoutMs: 15000,
  });
  const probeOutput = outputOf(probe);
  const authenticated = probeOutput.includes('successfully authenticated');
  details.push(
    authenticated ? 'ssh -T github-governada authenticated' : summarizeCommandStatus(probe),
  );

  if (authenticated) {
    printLane('Direct Git SSH via github-governada', 'PASS', details);
    return;
  }

  const message = 'direct Git SSH signing/authentication failed';
  if (options.requireDirectSsh) {
    addIssue(blockers, message);
    printLane('Direct Git SSH via github-governada', 'BLOCKED', details);
    return;
  }

  addIssue(advisories, message);
  printLane('Direct Git SSH via github-governada', 'ADVISORY', details);
}

function inspectGithubApi({ blockers }) {
  const authScript = getRepoScriptPath('gh-auth-status.js');
  const auth = run('node', [authScript], {
    cwd: path.dirname(path.dirname(authScript)),
    timeoutMs: 70000,
  });
  const remoteMain = runRepoGh(['api', 'repos/governada/app/commits/main', '--jq', '.sha']);
  const details = [auth.status === 0 ? 'gh:auth-status passed' : summarizeCommandStatus(auth)];
  const sharedRoot = getSharedCheckoutRoot();
  if (sharedRoot !== REPO_ROOT) {
    details.push(`auth context: shared checkout ${sharedRoot}`);
  }

  let remoteMainSha = '';
  if (remoteMain.status === 0) {
    remoteMainSha = remoteMain.stdout.trim();
    details.push(`GitHub API main: ${remoteMainSha}`);
  } else {
    details.push(`GitHub API main lookup: ${summarizeCommandStatus(remoteMain)}`);
  }

  if (auth.status === 0 && remoteMain.status === 0) {
    printLane('Repo GitHub API/token auth', 'PASS', details);
    return { remoteMainSha };
  }

  addIssue(blockers, 'repo GitHub API/token lane failed');
  printLane('Repo GitHub API/token auth', 'BLOCKED', details);
  return { remoteMainSha };
}

function inspectBrokerRuntime({ blockers, advisories }) {
  const runtimeDoctor = getRepoScriptPath('github-runtime-doctor.mjs');
  const result = run('node', [runtimeDoctor], {
    cwd: path.dirname(path.dirname(runtimeDoctor)),
    timeoutMs: 20000,
  });
  const detail = summarizeCommandStatus(result);
  const output = outputOf(result);
  const state = output.includes('PASS_WITH_ADVISORIES') ? 'ADVISORY' : 'PASS';

  if (result.status === 0) {
    if (state === 'ADVISORY') {
      addIssue(advisories, 'existing broker/runtime lane has advisories');
    }
    printLane('Existing app-local broker/runtime path', state, [detail]);
    return;
  }

  addIssue(blockers, 'existing app-local broker/runtime lane failed');
  printLane('Existing app-local broker/runtime path', 'BLOCKED', [detail]);
}

function inspectStableHost({ options, blockers, advisories }) {
  const agentRuntime = '/Users/tim/dev/agent-runtime/bin/agent-runtime';
  const result = run(
    'node',
    [agentRuntime, 'github', 'doctor', '--domain', 'governada', '--operation', options.operation],
    { timeoutMs: 30000 },
  );
  const output = outputOf(result);
  const details = [`operation: ${options.operation}`, summarizeCommandStatus(result)];

  if (result.status === 0) {
    printLane('Stable agent-runtime host path', 'PASS', details);
    return;
  }

  if (isExpectedMissingTokenFailClosed(output)) {
    addIssue(
      advisories,
      'stable agent-runtime host failed closed without OP_SERVICE_ACCOUNT_TOKEN',
    );
    printLane('Stable agent-runtime host path', 'ADVISORY', [
      ...details,
      'fail-closed without OP_SERVICE_ACCOUNT_TOKEN is expected in ordinary Codex processes',
    ]);
    return;
  }

  addIssue(blockers, 'stable agent-runtime host path failed unexpectedly');
  printLane('Stable agent-runtime host path', 'BLOCKED', details);
}

function enforceFreshnessRequirement({ options, remoteMainSha, blockers }) {
  if (!options.requireFreshLocalMain || !remoteMainSha) {
    return;
  }

  const originMain = gitValue(['rev-parse', 'origin/main']);
  if (originMain !== remoteMainSha) {
    addIssue(blockers, 'local origin/main is not fresh relative to GitHub API main');
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const blockers = [];
  const advisories = [];

  console.log('=== Governada Ship Lane Doctor ===');
  console.log('Scope: auth/ship lane separation for Governada app shipping runtime');
  console.log(`Stable-host operation probe: ${options.operation}`);
  console.log('');

  const { remoteMainSha } = inspectGithubApi({ blockers });
  inspectLocalGitRefs({ remoteMainSha, blockers, advisories });
  inspectDirectSsh({ options, blockers, advisories });
  inspectBrokerRuntime({ blockers, advisories });
  inspectStableHost({ options, blockers, advisories });
  enforceFreshnessRequirement({ options, remoteMainSha, blockers });

  if (blockers.length > 0) {
    console.log(`Ship lane doctor result: BLOCKED (${blockers.length})`);
    return 1;
  }

  if (advisories.length > 0) {
    console.log(`Ship lane doctor result: PASS_WITH_ADVISORIES (${advisories.length})`);
    return 0;
  }

  console.log('Ship lane doctor result: PASS');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(
    (status) => {
      process.exitCode = status;
    },
    (error) => {
      console.error(redactSensitiveText(error?.message || String(error)));
      process.exitCode = 1;
    },
  );
}
