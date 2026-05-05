#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const { repoRoot, runCommand } = require('./lib/runtime');

const CANONICAL_REMOTE = 'git@github-governada:governada/app.git';
const EXPECTED_USER = 'tim-governada';
const ADDENDUM =
  '[[decisions/lean-agent-harness#addendum-3-2026-05-04--agent-sa-reads-the-github-pat-revises-addenda-1-and-2]]';
const API_REPO = 'governada/app';
const GH_WRAPPER = path.join(repoRoot, 'bin', 'gh.sh');
const ENV_REFS_FILE = '.env.local.refs';
const DEFAULT_AGENT_RUNTIME_FILE = '/Users/tim/dev/agent-runtime/env/governada-agent.env';
const EXPECTED_GH_TOKEN_OP_REF = 'op://Governada-Agent/governada-app-agent/credential';
const DESKTOP_PROMPT_PATTERN = /touch id|passcode|biometric|1password desktop|desktop app|prompt/i;

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
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu,
      '[redacted-github-token]',
    )
    .replace(/\bops_[A-Za-z0-9_=-]{20,}\b/gu, '[redacted-op-token]')
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

function headerValues(output, headerName) {
  const prefix = `${headerName.toLowerCase()}:`;
  return String(output || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
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
    '- If API failed: confirm GH_TOKEN_OP_REF points at the Governada-Agent/governada-app-agent credential.',
  );
  console.error(
    `- If service-account auth failed: confirm ${process.env.OP_AGENT_RUNTIME_FILE || DEFAULT_AGENT_RUNTIME_FILE} has OP_AGENT_SERVICE_ACCOUNT_TOKEN, then run npm run op:agent-doctor.`,
  );
  console.error(`- If PR-create failed: confirm the PAT has pull_requests:write per ${ADDENDUM}.`);
  console.error('- Token rotation is a Tim manual action; no automated repair is attempted.');
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

function checkAgentServiceAccountRuntime(failures) {
  const runtimeFile = process.env.OP_AGENT_RUNTIME_FILE || DEFAULT_AGENT_RUNTIME_FILE;
  if (!fs.existsSync(runtimeFile)) {
    failures.push(
      `${runtimeFile} is missing; configure OP_AGENT_SERVICE_ACCOUNT_TOKEN per ${ADDENDUM}.`,
    );
    return;
  }

  const stat = fs.statSync(runtimeFile);
  if ((stat.mode & 0o077) !== 0) {
    failures.push(`${runtimeFile} is group/world readable; run chmod 600 before using it.`);
    return;
  }

  const token = parseEnvFile(runtimeFile).OP_AGENT_SERVICE_ACCOUNT_TOKEN || '';
  if (!token) {
    failures.push(`${runtimeFile} does not contain OP_AGENT_SERVICE_ACCOUNT_TOKEN.`);
    return;
  }

  if (!token.startsWith('ops_')) {
    failures.push('OP_AGENT_SERVICE_ACCOUNT_TOKEN does not have the expected ops_ shape.');
    return;
  }

  console.log('OK: agent service account env file is present and owner-only');
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

function checkApiLane(failures) {
  const opRef = resolveEnvValue('GH_TOKEN_OP_REF');
  const rotateAfter = resolveEnvValue('GH_TOKEN_ROTATE_AFTER');

  if (!opRef.value) {
    failures.push(`GH_TOKEN_OP_REF is missing. Configure it per ${ADDENDUM}.`);
    return;
  }

  if (!opRef.value.startsWith('op://')) {
    failures.push('GH_TOKEN_OP_REF must be an op:// 1Password reference.');
    return;
  }

  console.log(`OK: GH_TOKEN_OP_REF configured (${opRef.source}; value redacted)`);

  const wrapperEnv = {
    GH_TOKEN_OP_REF: opRef.value,
  };
  if (rotateAfter.value) {
    wrapperEnv.GH_TOKEN_ROTATE_AFTER = rotateAfter.value;
  }

  const userProbe = runGhApi(['api', 'user', '--jq', '.login'], wrapperEnv);
  assertNoDesktopPromptShape(userProbe, failures, 'bin/gh.sh api user');
  if (failures.length > 0) {
    return;
  }
  if (userProbe.status === 0 && userProbe.stdout.trim() === EXPECTED_USER) {
    console.log('OK: bin/gh.sh resolved GH_TOKEN via service-account auth (no Desktop prompt)');
  } else {
    failures.push(`gh API user probe failed: ${resultSummary(userProbe)}`);
    return;
  }

  const repoRead = runGhApi(['api', `repos/${API_REPO}`, '-i'], wrapperEnv);
  assertNoDesktopPromptShape(repoRead, failures, `repos/${API_REPO} read`);
  if (failures.length > 0) {
    return;
  }
  const repoReadStatus = parseHttpStatus(`${repoRead.stdout}\n${repoRead.stderr}`);
  if (repoRead.status === 0 && repoReadStatus === 200) {
    console.log(`OK: gh API can read repos/${API_REPO}`);
  } else {
    failures.push(`gh API read failed: ${resultSummary(repoRead)}`);
    return;
  }

  const prCreateProbe = runGhApi(
    [
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
      '-f',
      `body=Capability probe for ${ADDENDUM}. Expected result is validation failure, not PR creation.`,
    ],
    wrapperEnv,
  );
  const prProbeOutput = `${prCreateProbe.stdout}\n${prCreateProbe.stderr}`;
  assertNoDesktopPromptShape(prCreateProbe, failures, 'PR-create capability probe');
  if (failures.length > 0) {
    return;
  }
  const prProbeStatus = parseHttpStatus(prProbeOutput);

  if (prProbeStatus === 422) {
    const acceptedPermissions = headerValues(prProbeOutput, 'x-accepted-github-permissions').join(
      '; ',
    );
    if (acceptedPermissions && !acceptedPermissions.includes('pull_requests=write')) {
      failures.push(`PAT lacks pull_requests:write - rotate per ${ADDENDUM}.`);
      return;
    }

    // GitHub does not expose a stable granted-permissions header for every token type.
    // A 422 from the PR-create endpoint with a deliberately missing head proves the
    // token reached create-pull-request validation instead of failing authz at 401/403.
    console.log('OK: gh API PR-create capability reached validation (pull_requests:write)');
    checkTokenRotation(rotateAfter, failures);
    return;
  }

  if (prProbeStatus === 401 || prProbeStatus === 403) {
    failures.push(`PAT lacks pull_requests:write - rotate per ${ADDENDUM}.`);
    return;
  }

  failures.push(`gh API PR-create capability probe failed: ${resultSummary(prCreateProbe)}`);
}

function checkTokenRotation(rotateAfter, failures) {
  if (!rotateAfter.value) {
    failures.push('GH_TOKEN_ROTATE_AFTER is missing.');
    return;
  }

  const rotationDate = new Date(`${rotateAfter.value}T00:00:00Z`);
  if (Number.isNaN(rotationDate.getTime())) {
    failures.push(`GH_TOKEN_ROTATE_AFTER is not a valid YYYY-MM-DD date: ${rotateAfter.value}`);
    return;
  }

  const daysUntilRotation = Math.ceil((rotationDate.getTime() - Date.now()) / 86_400_000);
  if (daysUntilRotation < 0) {
    failures.push(
      `GH_TOKEN_ROTATE_AFTER is past due: ${rotateAfter.value}. Rotate per ${ADDENDUM}.`,
    );
    return;
  }

  if (daysUntilRotation <= 14) {
    console.warn(
      `WARN: GH_TOKEN_ROTATE_AFTER is within ${daysUntilRotation} day(s): ${rotateAfter.value}.`,
    );
    return;
  }

  console.log(
    `OK: GH_TOKEN_ROTATE_AFTER ${rotateAfter.value} is outside the 14-day warning window`,
  );
}

function checkExpectedVaultLocation(failures) {
  const opRef = resolveEnvValue('GH_TOKEN_OP_REF');
  if (opRef.value && opRef.value.includes('Governada-Human/governada-app-agent')) {
    failures.push(`GH_TOKEN_OP_REF still points at Governada-Human; update it per ${ADDENDUM}.`);
    return;
  }

  if (opRef.value && opRef.value !== EXPECTED_GH_TOKEN_OP_REF) {
    failures.push(`GH_TOKEN_OP_REF must be ${EXPECTED_GH_TOKEN_OP_REF} per ${ADDENDUM}.`);
  }
}

function main() {
  const failures = [];

  console.log('GitHub auth: SSH + 1Password and GH_TOKEN_OP_REF probes');
  checkSshLane(failures);
  checkAgentServiceAccountRuntime(failures);
  checkWrapperNoDesktopAuth(failures);
  checkExpectedVaultLocation(failures);
  checkApiLane(failures);

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
