#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const { repoRoot, runCommand } = require('./lib/runtime');

const CANONICAL_REMOTE = 'git@github-governada:governada/app.git';
const EXPECTED_USER = 'tim-governada';
const ADDENDUM =
  '[[decisions/lean-agent-harness#addendum-4-2026-05-05--pivot-from-user-pat-to-github-app-for-autonomous-agent-operations]]';
const API_REPO = 'governada/app';
const PUSH_PROBE_BRANCH = 'feat/gh-auth-doctor-probe';
const GH_WRAPPER = path.join(repoRoot, 'bin', 'gh.sh');
const GIT_PUSH_WRAPPER = path.join(repoRoot, 'bin', 'git-push.sh');
const OP_AGENT_DOCTOR = path.join(repoRoot, 'scripts', 'op-agent-doctor.mjs');
const MINT_HELPER = path.join(repoRoot, 'scripts', 'mint-installation-token.mjs');
const ENV_REFS_FILE = '.env.local.refs';
const DEFAULT_AGENT_RUNTIME_FILE = '/Users/tim/dev/agent-runtime/env/governada-agent.env';
const DESKTOP_PROMPT_PATTERN = /touch id|passcode|biometric|1password desktop|desktop app|prompt/i;
const APP_REF_KEYS = [
  'GOVERNADA_GITHUB_CLIENT_ID_OP_REF',
  'GOVERNADA_GITHUB_INSTALLATION_ID_OP_REF',
  'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF',
];

function firstLine(text) {
  return (
    String(text || '')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) || ''
  );
}

function outputOf(result) {
  return [result.stdout, result.stderr, result.error?.message || '']
    .filter(Boolean)
    .join('\n')
    .trim();
}

function redactSensitiveText(text) {
  return String(text || '')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{12,}\b/gu, '[redacted-github-token]')
    .replace(/\bops_[A-Za-z0-9_=-]{20,}\b/gu, '[redacted-op-token]')
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gu, '[redacted-pem]')
    .replace(/op:\/\/[^\s'"]+/gu, 'op://[redacted]')
    .replace(/\bitem [^:\s]+/gu, 'item [redacted]')
    .replace(/\bvault [a-z0-9]{20,}/gu, 'vault [redacted]');
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

function sharedCheckoutRoot() {
  const marker = `${path.sep}.claude${path.sep}worktrees${path.sep}`;
  const markerIndex = repoRoot.indexOf(marker);
  if (markerIndex === -1) {
    return '';
  }

  return repoRoot.slice(0, markerIndex);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
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

function envRefsCandidates() {
  if (process.env.GOVERNADA_GH_ENV_REFS_FILE) {
    return [process.env.GOVERNADA_GH_ENV_REFS_FILE];
  }

  if (process.env.GOVERNADA_GH_AUTH_DISABLE_ENV_REFS === '1') {
    return [];
  }

  const candidates = [path.join(process.cwd(), ENV_REFS_FILE), path.join(repoRoot, ENV_REFS_FILE)];
  const sharedRoot = sharedCheckoutRoot();
  if (sharedRoot) {
    candidates.push(path.join(sharedRoot, ENV_REFS_FILE));
  }

  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

function resolveEnvValue(key) {
  if (process.env[key]) {
    return { source: 'process environment', value: process.env[key] };
  }

  for (const candidate of envRefsCandidates()) {
    const value = parseEnvFile(candidate)[key];
    if (value) {
      return { source: candidate, value };
    }
  }

  return { source: '', value: '' };
}

function parseHttpStatus(output) {
  const matches = [...String(output || '').matchAll(/^HTTP\/[\d.]+\s+(\d+)/gimu)];
  const lastMatch = matches[matches.length - 1];
  return lastMatch ? Number.parseInt(lastMatch[1], 10) : 0;
}

function resultSummary(result) {
  return firstLine(redactSensitiveText(outputOf(result))) || `exit ${result.status}`;
}

function runGhApi(args, env = {}) {
  return runCommand(GH_WRAPPER, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stripDisabledLocalProxyEnv: true,
    timeoutMs: 90000,
  });
}

function runGitPush(args, env = {}) {
  return runCommand(GIT_PUSH_WRAPPER, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stripDisabledLocalProxyEnv: true,
    timeoutMs: 90000,
  });
}

function runOpRead(opRef, agentToken) {
  const env = {
    ...process.env,
    OP_SERVICE_ACCOUNT_TOKEN: agentToken,
  };
  delete env.OP_AGENT_SERVICE_ACCOUNT_TOKEN;
  delete env.OP_ACCOUNT;
  delete env.OP_CONNECT_HOST;
  delete env.OP_CONNECT_TOKEN;

  return runCommand('op', ['read', opRef], {
    cwd: repoRoot,
    env,
    timeoutMs: 30000,
  });
}

function assertNoDesktopPromptShape(result, failures, label) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (DESKTOP_PROMPT_PATTERN.test(output)) {
    failures.push(`${label} showed a Desktop-auth prompt-shaped message; review ${ADDENDUM}.`);
  }
}

function printRemediation() {
  console.error('');
  console.error('Remediation:');
  console.error(
    '- If SSH failed: enable/unlock 1Password SSH agent and verify ssh -T git@github-governada.',
  );
  console.error(
    '- If App auth failed: confirm the three GitHub App op-refs, App installation permissions, and governada-agent-app item per Addendum #4.',
  );
  console.error(
    `- If service-account auth failed: confirm ${process.env.OP_AGENT_RUNTIME_FILE || DEFAULT_AGENT_RUNTIME_FILE} has OP_AGENT_SERVICE_ACCOUNT_TOKEN, then run npm run op:agent-doctor.`,
  );
  console.error('- App private-key rotation is a Tim manual action; no automated repair is attempted.');
}

function checkSshLane(failures) {
  const sshFailures = [];

  const remote = runCommand('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot });
  const remoteUrl = remote.stdout.trim();
  if (remote.status === 0 && remoteUrl === CANONICAL_REMOTE) {
    console.log(`OK: origin remote is ${CANONICAL_REMOTE}`);
  } else {
    sshFailures.push(`origin remote is ${remoteUrl || '(missing)'}, expected ${CANONICAL_REMOTE}`);
  }

  const config = runCommand('ssh', ['-G', 'github-governada'], { cwd: repoRoot, timeoutMs: 5000 });
  if (config.status === 0) {
    const lines = config.stdout.split(/\r?\n/u);
    const identityAgentLine = lines.find((line) => line.toLowerCase().startsWith('identityagent '));
    const identityAgent = resolveSshPath(
      identityAgentLine ? identityAgentLine.slice('identityagent '.length).trim() : '',
    );
    if (identityAgent) {
      console.log(
        `OK: github-governada IdentityAgent ${fs.existsSync(identityAgent) ? 'exists' : 'configured'}`,
      );
    } else {
      sshFailures.push('github-governada IdentityAgent is not configured');
    }
  } else {
    sshFailures.push(
      `ssh config probe failed: ${firstLine(outputOf(config)) || `exit ${config.status}`}`,
    );
  }

  const ssh = runCommand(
    'ssh',
    ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'git@github-governada'],
    { cwd: repoRoot, timeoutMs: 15000 },
  );
  const sshOutput = outputOf(ssh);
  if (
    sshOutput.includes('successfully authenticated') &&
    (!sshOutput.includes('Hi ') || sshOutput.includes(`Hi ${EXPECTED_USER}`))
  ) {
    console.log(`OK: SSH authenticates as ${EXPECTED_USER}`);
  } else {
    sshFailures.push(`SSH auth probe failed: ${firstLine(sshOutput) || `exit ${ssh.status}`}`);
  }

  const remoteRead = runCommand('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'], {
    cwd: repoRoot,
    timeoutMs: 15000,
  });
  if (remoteRead.status === 0) {
    console.log('OK: git can read origin/main over SSH');
  } else {
    sshFailures.push(
      `git remote read failed: ${firstLine(outputOf(remoteRead)) || `exit ${remoteRead.status}`}`,
    );
  }

  if (sshFailures.length > 0) {
    failures.push(...sshFailures);
    return;
  }

  console.log('OK: SSH + 1Password git lane passed');
}

function agentServiceAccountToken(failures) {
  const runtimeFile = process.env.OP_AGENT_RUNTIME_FILE || DEFAULT_AGENT_RUNTIME_FILE;
  if (!fs.existsSync(runtimeFile)) {
    failures.push(
      `${runtimeFile} is missing; configure OP_AGENT_SERVICE_ACCOUNT_TOKEN per ${ADDENDUM}.`,
    );
    return '';
  }

  const stat = fs.statSync(runtimeFile);
  if ((stat.mode & 0o077) !== 0) {
    failures.push(`${runtimeFile} is group/world readable; run chmod 600 before using it.`);
    return '';
  }

  const token = parseEnvFile(runtimeFile).OP_AGENT_SERVICE_ACCOUNT_TOKEN || '';
  if (!token) {
    failures.push(`${runtimeFile} does not contain OP_AGENT_SERVICE_ACCOUNT_TOKEN.`);
    return '';
  }

  if (!token.startsWith('ops_')) {
    failures.push('OP_AGENT_SERVICE_ACCOUNT_TOKEN does not have the expected ops_ shape.');
    return '';
  }

  console.log('OK: agent service account env file is present and owner-only');
  return token;
}

function checkWrapperNoDesktopAuth(failures) {
  const wrapper = fs.existsSync(GH_WRAPPER) ? fs.readFileSync(GH_WRAPPER, 'utf8') : '';
  if (!wrapper) {
    failures.push('bin/gh.sh is missing.');
    return;
  }

  const forbiddenPatterns = [
    /OP_ACCOUNT\s*=\s*["']?my\.1password\.com/u,
    /my\.1password\.com/u,
    /\bop\s+--account\b/u,
  ];
  if (forbiddenPatterns.some((pattern) => pattern.test(wrapper))) {
    failures.push(`bin/gh.sh invokes Desktop-auth account selection; revise per ${ADDENDUM}.`);
    return;
  }

  console.log('OK: bin/gh.sh does not invoke Desktop auth');
}

function checkOpAgentDoctorNoDesktopAuth(failures) {
  const doctor = fs.existsSync(OP_AGENT_DOCTOR) ? fs.readFileSync(OP_AGENT_DOCTOR, 'utf8') : '';
  if (!doctor) {
    failures.push('scripts/op-agent-doctor.mjs is missing.');
    return;
  }

  const unsafeReferences = doctor
    .split(/\r?\n/u)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.includes('OP_ACCOUNT'))
    .filter(({ line }) => !/^\s*delete\s+\w+\.OP_ACCOUNT\s*;\s*$/.test(line));

  if (unsafeReferences.length > 0) {
    const lines = unsafeReferences.map(({ lineNumber }) => lineNumber).join(', ');
    failures.push(
      `scripts/op-agent-doctor.mjs references OP_ACCOUNT outside env deletion on line(s): ${lines}.`,
    );
    return;
  }

  console.log('OK: scripts/op-agent-doctor.mjs only deletes OP_ACCOUNT before op subprocesses');
}

function checkWrapperCapabilityPolicy(failures) {
  const policyBlockPrefix = 'BLOCKED: bin/gh.sh allows only governed Governada GitHub operations';
  const preSecretProbeEnv = {
    OP_AGENT_RUNTIME_FILE: '/private/tmp/governada-gh-policy-probe-no-secret-env',
  };
  const blockedProbes = [
    {
      args: ['auth', 'token'],
      label: 'token-printing auth command',
      expectedStderr: 'BLOCKED: bin/gh.sh does not run token-printing gh auth commands.',
    },
    {
      args: ['api', '-X', 'DELETE', `repos/${API_REPO}`],
      label: 'destructive API method',
      expectedStderr: policyBlockPrefix,
    },
    {
      args: ['api', '-X', 'POST', `repos/${API_REPO}/pulls`, '-f', 'title=probe'],
      label: 'direct non-draft PR creation',
      expectedStderr: policyBlockPrefix,
    },
    {
      args: ['pr', 'merge', '1', '--repo', API_REPO],
      label: 'PR merge command',
      expectedStderr: policyBlockPrefix,
    },
    {
      args: ['api', '-X', 'PUT', `repos/${API_REPO}/pulls/1/merge`],
      label: 'API-layer merge bypass',
      expectedStderr: policyBlockPrefix,
      okMessage: 'OK: API-merge bypass blocked',
    },
    {
      args: ['api', '-X', 'PATCH', `repos/${API_REPO}/git/refs/heads/main`],
      label: 'ref-overwrite via API',
      expectedStderr: policyBlockPrefix,
      okMessage: 'OK: ref-overwrite via API blocked',
    },
    {
      args: ['api', 'graphql', '-f', 'query=mutation{addComment(input:{}){clientMutationId}}'],
      label: 'GraphQL endpoint bypass',
      expectedStderr: policyBlockPrefix,
      okMessage: 'OK: GraphQL endpoint blocked',
    },
  ];

  for (const probe of blockedProbes) {
    const result = runGhApi(probe.args, preSecretProbeEnv);
    if (result.status === 0 || !firstLine(result.stderr).startsWith(probe.expectedStderr)) {
      failures.push(`bin/gh.sh did not block ${probe.label}: ${resultSummary(result)}`);
      return;
    }

    if (probe.okMessage) {
      console.log(probe.okMessage);
    }
  }

  console.log('OK: bin/gh.sh capability allowlist blocks token, merge, and unsafe API commands');
}

function checkAppOpRefs(failures) {
  const refs = {};
  for (const key of APP_REF_KEYS) {
    const resolved = resolveEnvValue(key);
    if (!resolved.value) {
      failures.push(`${key} is missing. Configure it per ${ADDENDUM}.`);
      return null;
    }
    if (!resolved.value.startsWith('op://')) {
      failures.push(`${key} must be an op:// 1Password reference.`);
      return null;
    }
    refs[key] = resolved.value;
  }

  console.log('OK: GitHub App op-refs configured (values redacted)');
  return refs;
}

function readAppSecrets(refs, agentToken, failures) {
  const secrets = {};
  const mapping = {
    GOVERNADA_GITHUB_CLIENT_ID_OP_REF: 'GOVERNADA_GITHUB_CLIENT_ID',
    GOVERNADA_GITHUB_INSTALLATION_ID_OP_REF: 'GOVERNADA_GITHUB_INSTALLATION_ID',
    GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF: 'GOVERNADA_GITHUB_APP_PRIVATE_KEY',
  };

  for (const [refKey, envKey] of Object.entries(mapping)) {
    const result = runOpRead(refs[refKey], agentToken);
    assertNoDesktopPromptShape(result, failures, `op read ${refKey}`);
    if (result.status !== 0) {
      failures.push(`agent SA could not read ${refKey}: ${resultSummary(result)}`);
      return null;
    }
    secrets[envKey] = result.stdout.trim();
  }

  if (!/^-----BEGIN (RSA )?PRIVATE KEY-----/u.test(secrets.GOVERNADA_GITHUB_APP_PRIVATE_KEY)) {
    failures.push('agent SA read private_key, but it does not have a PEM private-key shape.');
    return null;
  }

  console.log('OK: agent SA reads GitHub App private key (value not printed)');
  return secrets;
}

function checkMintHelper(secrets, failures) {
  const result = runCommand(process.execPath, [MINT_HELPER], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...secrets,
    },
    stripDisabledLocalProxyEnv: true,
    timeoutMs: 90000,
  });

  assertNoDesktopPromptShape(result, failures, 'installation-token mint');
  const token = result.stdout.trim();
  if (result.status !== 0) {
    failures.push(`installation-token mint failed: ${resultSummary(result)}`);
    return;
  }
  if (!/^ghs_[A-Za-z0-9_]+$/u.test(token)) {
    failures.push('installation-token mint did not return the expected ghs_ token shape.');
    return;
  }

  console.log('OK: JWT mint and installation-token mint succeeded (ghs_ token shape)');
}

function checkApiLane(failures) {
  const apiFailuresAtStart = failures.length;
  const userProbe = runGhApi(['api', 'user', '--jq', '.login']);
  assertNoDesktopPromptShape(userProbe, failures, 'bin/gh.sh api user');
  if (failures.length > apiFailuresAtStart) {
    return;
  }
  if (userProbe.status === 0 && firstLine(userProbe.stdout)) {
    console.log(`OK: bin/gh.sh authenticates as ${firstLine(userProbe.stdout)} via App token`);
  } else if (
    userProbe.status !== 0 &&
    outputOf(userProbe).includes('Resource not accessible by integration')
  ) {
    console.log('OK: App installation token minted; GitHub rejects user-only /user endpoint');
  } else {
    failures.push(`gh API user probe failed: ${resultSummary(userProbe)}`);
    return;
  }

  const repoRead = runGhApi(['api', `repos/${API_REPO}`, '--jq', '.full_name']);
  assertNoDesktopPromptShape(repoRead, failures, `repos/${API_REPO} read`);
  if (failures.length > apiFailuresAtStart) {
    return;
  }
  if (repoRead.status === 0 && repoRead.stdout.trim() === API_REPO) {
    console.log(`OK: gh API can read repos/${API_REPO}`);
  } else {
    failures.push(`gh API read failed: ${resultSummary(repoRead)}`);
    return;
  }

  const prCreateProbe = runGhApi([
    'api',
    '-i',
    '-X',
    'POST',
    `repos/${API_REPO}/pulls`,
    '-f',
    'title=Governada auth capability probe',
    '-f',
    'head=governada:__governada_auth_probe_missing_head__',
    '-f',
    'base=main',
    '-F',
    'draft=true',
    '-f',
    `body=Capability probe for ${ADDENDUM}. Expected result is validation failure, not PR creation.`,
  ]);
  const prProbeOutput = `${prCreateProbe.stdout}\n${prCreateProbe.stderr}`;
  assertNoDesktopPromptShape(prCreateProbe, failures, 'PR-create capability probe');
  if (failures.length > apiFailuresAtStart) {
    return;
  }
  const prProbeStatus = parseHttpStatus(prProbeOutput);

  if (prProbeStatus === 422) {
    console.log('OK: gh API PR-create capability reached validation (pull_requests:write)');
    return;
  }

  if (prProbeStatus === 401 || prProbeStatus === 403) {
    failures.push(`App installation lacks pull_requests:write - review ${ADDENDUM}.`);
    return;
  }

  failures.push(`gh API PR-create capability probe failed: ${resultSummary(prCreateProbe)}`);
}

function checkPushLane(failures) {
  const dryRun = runGitPush(['--dry-run', 'origin', PUSH_PROBE_BRANCH]);
  assertNoDesktopPromptShape(dryRun, failures, 'git push dry-run');
  if (dryRun.status === 0) {
    console.log(`OK: bin/git-push.sh dry-run push capability passed for ${PUSH_PROBE_BRANCH}`);
  } else {
    failures.push(`git push dry-run failed: ${resultSummary(dryRun)}`);
    return;
  }

  const preSecretProbeEnv = {
    OP_AGENT_RUNTIME_FILE: '/private/tmp/governada-git-push-policy-probe-no-secret-env',
  };
  const pushPolicyPrefix =
    'BLOCKED: bin/git-push.sh allows only governed Governada branch publication';
  const mainBlocked = runGitPush(['origin', 'main'], preSecretProbeEnv);
  if (mainBlocked.status === 0 || !firstLine(mainBlocked.stderr).startsWith(pushPolicyPrefix)) {
    failures.push(`bin/git-push.sh did not block push to main: ${resultSummary(mainBlocked)}`);
    return;
  }
  console.log('OK: bin/git-push.sh blocks push to main before secret resolution');

  const forceBlocked = runGitPush(['--force', 'origin', 'feat/something'], preSecretProbeEnv);
  if (forceBlocked.status === 0 || !firstLine(forceBlocked.stderr).startsWith(pushPolicyPrefix)) {
    failures.push(`bin/git-push.sh did not block force-push: ${resultSummary(forceBlocked)}`);
    return;
  }
  console.log('OK: bin/git-push.sh blocks force-push before secret resolution');
}

function main() {
  const failures = [];

  console.log('GitHub auth: SSH + 1Password and GitHub App installation-token probes');
  checkSshLane(failures);
  const agentToken = agentServiceAccountToken(failures);
  checkWrapperNoDesktopAuth(failures);
  checkOpAgentDoctorNoDesktopAuth(failures);
  checkWrapperCapabilityPolicy(failures);
  const refs = checkAppOpRefs(failures);
  const secrets = refs && agentToken ? readAppSecrets(refs, agentToken, failures) : null;
  if (secrets) {
    checkMintHelper(secrets, failures);
  }
  checkApiLane(failures);
  checkPushLane(failures);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`BLOCKED: ${redactSensitiveText(failure)}`);
    }
    printRemediation();
    process.exit(1);
  }

  console.log('GitHub auth result: OK');
}

main();
