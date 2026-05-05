#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const { repoRoot, runCommand } = require('./lib/runtime');

const CANONICAL_REMOTE = 'git@github-governada:governada/app.git';
const EXPECTED_USER = 'tim-governada';
const ADDENDUM =
  '[[decisions/lean-agent-harness#addendum-2-2026-05-04--github-api-write-lane-via-gh_token_op_ref]]';
const API_REPO = 'governada/app';
const GH_WRAPPER = path.join(repoRoot, 'bin', 'gh.sh');
const ENV_REFS_FILE = '.env.local.refs';

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

function printRemediation() {
  console.error('');
  console.error('Remediation:');
  console.error(
    '- If SSH failed: enable/unlock 1Password SSH agent and verify ssh -T git@github-governada.',
  );
  console.error(
    '- If API failed: confirm GH_TOKEN_OP_REF points at the Governada-Human/governada-app-agent credential.',
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

  if (rotateAfter.value) {
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
    }
  }

  const wrapperEnv = {
    GH_TOKEN_OP_REF: opRef.value,
  };
  if (rotateAfter.value) {
    wrapperEnv.GH_TOKEN_ROTATE_AFTER = rotateAfter.value;
  }

  const repoRead = runGhApi(['api', `repos/${API_REPO}`, '-i'], wrapperEnv);
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
    return;
  }

  if (prProbeStatus === 401 || prProbeStatus === 403) {
    failures.push(`PAT lacks pull_requests:write - rotate per ${ADDENDUM}.`);
    return;
  }

  failures.push(`gh API PR-create capability probe failed: ${resultSummary(prCreateProbe)}`);
}

function main() {
  const failures = [];

  console.log('GitHub auth: SSH + 1Password and GH_TOKEN_OP_REF probes');
  checkSshLane(failures);
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
