import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { redactSensitiveText } from './lib/github-app-auth.mjs';

const require = createRequire(import.meta.url);
const { classifyCommandResult, formatClassification } = require('./lib/auth-failure-classifier.js');

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const EXPECTED_REMOTE = 'git@github-governada:governada/app.git';
const SSH_KEY_VISIBILITY_TIMEOUT_MS = 5000;
const SSH_SIGNING_PROOF_TIMEOUT_MS = 10000;
const SSH_AUTH_PROBE_TIMEOUT_MS = 15000;
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
    probeGitRemote: false,
    probeSsh: false,
    requireDirectGit: false,
    requireDirectSsh: false,
    requireFreshLocalMain: false,
    sshTimeoutMs: 15000,
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
    } else if (arg === '--probe-git-remote') {
      options.probeGitRemote = true;
    } else if (arg === '--require-direct-git') {
      options.requireDirectGit = true;
      options.probeGitRemote = true;
    } else if (arg === '--require-direct-ssh') {
      options.requireDirectSsh = true;
      options.probeSsh = true;
    } else if (arg === '--require-fresh-local-main') {
      options.requireFreshLocalMain = true;
    } else if (arg === '--ssh-timeout-ms') {
      const timeout = Number(argv[index + 1]);
      if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000) {
        throw new Error('--ssh-timeout-ms requires an integer from 1000 to 120000');
      }
      options.sshTimeoutMs = timeout;
      index += 1;
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
  npm run ship:doctor -- --probe-git-remote
  npm run ship:doctor -- --require-direct-ssh --require-direct-git --require-fresh-local-main

Default probes are read-only and non-mutating. Direct SSH signing is skipped
unless --probe-ssh or --require-direct-ssh is supplied. Direct Git transport is
probed with time-bounded git ls-remote only when --probe-git-remote or
--require-direct-git is supplied; it never fetches or writes FETCH_HEAD. This
doctor separates:
  1. local Git refs and remote configuration
  2. direct Git SSH via github-governada
  3. direct Git remote transport via git ls-remote
  4. repo GitHub API/token auth
  5. existing app-local broker/runtime path
  6. stable agent-runtime operation proof path`;
}

export function isExpectedMissingTokenFailClosed(output) {
  return (
    output.includes('OP_SERVICE_ACCOUNT_TOKEN is not present') && output.includes('FAIL_CLOSED')
  );
}

function run(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || 15000;
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });

  return {
    error: result.error,
    signal: result.signal || '',
    status: result.status ?? (result.error ? 124 : 1),
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    timeoutMs,
    timedOut: result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM',
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
  const classification = classifyCommandResult(result, { timeoutMs: result.timeoutMs });
  const prefix = result.timedOut
    ? `timed out after ${result.timeoutMs}ms`
    : result.signal
      ? `signal ${result.signal}`
      : `exit ${result.status}`;
  if (
    (result.status !== 0 || result.timedOut || result.signal) &&
    classification.code !== 'unknown'
  ) {
    return detail
      ? `${prefix}: ${classification.code}: ${detail}`
      : `${prefix}: ${classification.code}`;
  }

  return detail ? `${prefix}: ${detail}` : prefix;
}

function resolveSshPath(value) {
  if (!value || value === 'none') {
    return '';
  }

  if (value.startsWith('~/')) {
    return path.join(process.env.HOME || '', value.slice(2));
  }

  return value;
}

function getGithubGovernadaSshConfig() {
  const config = run('ssh', ['-G', 'github-governada']);
  if (config.status !== 0) {
    return {
      error: summarizeCommandStatus(config),
      identityAgent: '',
      identityFile: '',
    };
  }

  const lines = config.stdout.split(/\r?\n/u);
  const identityAgentLine = lines.find((entry) => entry.toLowerCase().startsWith('identityagent '));
  const identityFileLines = lines.filter((entry) =>
    entry.toLowerCase().startsWith('identityfile '),
  );
  const preferredIdentityFile =
    identityFileLines.find((entry) => entry.includes('github-governada')) ||
    identityFileLines[0] ||
    '';
  const rawIdentityAgent = identityAgentLine
    ? identityAgentLine.slice('identityagent '.length).trim()
    : '';
  const rawIdentityFile = preferredIdentityFile
    ? preferredIdentityFile.slice('identityfile '.length).trim()
    : '';
  return {
    error: '',
    identityAgent: resolveSshPath(rawIdentityAgent),
    identityFile: resolveSshPath(rawIdentityFile),
  };
}

function getDirectSshContext() {
  const sshConfig = getGithubGovernadaSshConfig();
  return {
    details: [
      sshConfig.identityAgent
        ? `configured IdentityAgent: ${sshConfig.identityAgent}`
        : `configured IdentityAgent: ${sshConfig.error || '(not found)'}`,
      sshConfig.identityAgent
        ? `configured IdentityAgent socket: ${existsSync(sshConfig.identityAgent) ? 'exists' : 'missing'}`
        : '',
      sshConfig.identityFile
        ? `configured identity file: ${sshConfig.identityFile}`
        : 'configured identity file: (not found)',
    ],
    env: sshConfig.identityAgent ? { SSH_AUTH_SOCK: sshConfig.identityAgent } : {},
    sshConfig,
  };
}

function addFailureClassification(details, result) {
  const classification = classifyCommandResult(result, { timeoutMs: result.timeoutMs });
  if (classification.code !== 'unknown') {
    details.push(`failure class: ${formatClassification(classification)}`);
  }
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
  const sshContext = getDirectSshContext();
  const sshConfig = sshContext.sshConfig;
  const sshEnv = sshContext.env;
  const details = [...sshContext.details];

  if (!options.probeSsh) {
    details.push(
      'active SSH key/signing/auth probes skipped; pass --probe-ssh to run ssh-add -l, ssh-add -T, and ssh -T github-governada',
    );
    addIssue(advisories, 'direct Git SSH signing was not probed');
    printLane('Direct Git SSH via github-governada', 'ADVISORY', details);
    return;
  }

  const keyList = run('ssh-add', ['-l'], {
    env: sshEnv,
    timeoutMs: SSH_KEY_VISIBILITY_TIMEOUT_MS,
  });
  const keyListed = keyList.status === 0 && outputOf(keyList).includes('github-governada');
  details.push(
    keyListed
      ? 'ssh-add lists a github-governada key'
      : `ssh-add key visibility: ${summarizeCommandStatus(keyList)}`,
  );
  if (!keyListed) {
    addFailureClassification(details, keyList);
  }

  let signingProofPassed = false;
  if (!sshConfig.identityFile) {
    details.push('ssh-add -T signing proof skipped: configured identity file not found');
  } else {
    const signingProof = run('ssh-add', ['-T', sshConfig.identityFile], {
      env: sshEnv,
      timeoutMs: SSH_SIGNING_PROOF_TIMEOUT_MS,
    });
    signingProofPassed = signingProof.status === 0;
    details.push(
      signingProofPassed
        ? 'ssh-add -T signing proof succeeded'
        : `ssh-add -T signing proof: ${summarizeCommandStatus(signingProof)}`,
    );
    if (!signingProofPassed) {
      addFailureClassification(details, signingProof);
    }
  }

  const probe = run('ssh', ['-o', 'BatchMode=yes', '-T', 'github-governada'], {
    timeoutMs: SSH_AUTH_PROBE_TIMEOUT_MS,
  });
  const probeOutput = outputOf(probe);
  const authenticated = probeOutput.includes('successfully authenticated');
  details.push(
    authenticated ? 'ssh -T github-governada authenticated' : summarizeCommandStatus(probe),
  );
  if (!authenticated) {
    addFailureClassification(details, probe);
  }

  if (signingProofPassed && authenticated) {
    printLane('Direct Git SSH via github-governada', 'PASS', details);
    return;
  }

  const message = 'direct Git SSH signing/authentication failed or was inconclusive';
  if (options.requireDirectSsh) {
    addIssue(blockers, message);
    printLane('Direct Git SSH via github-governada', 'BLOCKED', details);
    return;
  }

  addIssue(advisories, message);
  printLane('Direct Git SSH via github-governada', 'ADVISORY', details);
}

function inspectDirectGitRemote({ options, blockers, advisories }) {
  const sshContext = getDirectSshContext();
  const details = [
    ...sshContext.details,
    'probe command: git ls-remote --heads origin main',
    'probe is read-only and does not write FETCH_HEAD',
    `timeout: ${options.sshTimeoutMs}ms`,
  ];

  if (!options.probeGitRemote) {
    details.push(
      'direct Git remote probe skipped; pass --probe-git-remote to run time-bounded git ls-remote',
    );
    addIssue(advisories, 'direct Git remote transport was not probed');
    printLane('Direct Git remote transport', 'ADVISORY', details);
    return;
  }

  const probe = run('git', ['ls-remote', '--heads', 'origin', 'main'], {
    env: sshContext.env,
    timeoutMs: options.sshTimeoutMs,
  });
  const output = outputOf(probe);
  const foundMain = probe.status === 0 && output.includes('refs/heads/main');
  details.push(
    foundMain ? 'origin/main is reachable through direct Git SSH' : summarizeCommandStatus(probe),
  );

  if (foundMain) {
    printLane('Direct Git remote transport', 'PASS', details);
    return;
  }

  const message = 'direct Git remote transport failed or timed out';
  if (options.requireDirectGit) {
    addIssue(blockers, message);
    printLane('Direct Git remote transport', 'BLOCKED', details);
    return;
  }

  addIssue(advisories, message);
  printLane('Direct Git remote transport', 'ADVISORY', details);
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
  inspectDirectGitRemote({ options, blockers, advisories });
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
