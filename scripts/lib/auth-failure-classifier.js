function toText(value) {
  if (!value) {
    return '';
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return String(value);
}

function resultText(result = {}) {
  return [result.stdout, result.stderr, result.error?.message || result.message || '']
    .map(toText)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function isTimedOut(result = {}, options = {}) {
  return Boolean(
    options.timedOut ||
    result.timedOut ||
    result.signal === 'SIGTERM' ||
    result.error?.code === 'ETIMEDOUT' ||
    result.code === 'ETIMEDOUT',
  );
}

function classifyAuthFailure(text, options = {}) {
  const normalized = toText(text).toLowerCase();
  const command = options.command || 'command';
  const timeoutMs = options.timeoutMs;

  if (options.timedOut) {
    return {
      code: 'timeout',
      summary: timeoutMs ? `${command} timed out after ${timeoutMs}ms` : `${command} timed out`,
      nextStep:
        'Treat this as a bounded failure; retry from a human Terminal or stable host before changing auth state.',
    };
  }

  if (/\b(operation not permitted|connect eperm|eperm)\b/i.test(normalized)) {
    return {
      code: 'sandbox-or-permission-denied',
      summary:
        'the process was denied local IPC, filesystem, or network access before auth health could be proven',
      nextStep:
        'Rerun the same approved wrapper outside the sandbox or with a narrow persisted approval; do not change credentials.',
    };
  }

  if (
    /could not resolve hostname/i.test(normalized) ||
    /temporary failure in name resolution/i.test(normalized) ||
    /nodename nor servname provided/i.test(normalized)
  ) {
    return {
      code: 'network-resolution-failure',
      summary: 'GitHub hostname resolution failed before SSH auth could complete',
      nextStep:
        'Compare with a host-level probe; classify sandbox DNS/network failure separately from SSH signing.',
    };
  }

  if (
    /sign_and_send_pubkey/i.test(normalized) ||
    /signing failed/i.test(normalized) ||
    /communication with agent failed/i.test(normalized) ||
    /agent refused operation/i.test(normalized)
  ) {
    return {
      code: 'ssh-signing-unavailable',
      summary: 'the SSH key may be visible, but the agent could not complete signing',
      nextStep:
        'Use the broker/stable-host lane for agent automation; for human fallback, unlock or repair 1Password SSH and retry the same alias.',
    };
  }

  if (/the agent has no identities/i.test(normalized) || /no identities/i.test(normalized)) {
    return {
      code: 'ssh-agent-empty',
      summary: 'the selected SSH agent is reachable but did not expose the Governada identity',
      nextStep:
        'Check the configured IdentityAgent socket and account context before adding or replacing keys.',
    };
  }

  if (
    /error connecting to agent/i.test(normalized) ||
    /could not open a connection to your authentication agent/i.test(normalized) ||
    /connection refused/i.test(normalized) ||
    /no such file or directory/i.test(normalized)
  ) {
    return {
      code: 'ssh-agent-unreachable',
      summary: 'the configured SSH agent socket was missing, stale, or unreachable',
      nextStep:
        'Verify the 1Password SSH agent socket from the host and restart 1Password only as a human-present repair step.',
    };
  }

  if (/permission denied \(publickey\)/i.test(normalized)) {
    return {
      code: 'github-publickey-denied',
      summary: 'GitHub rejected the SSH authentication attempt',
      nextStep:
        'Confirm the github-governada SSH alias, GitHub account, and registered public key; do not switch remotes or token lanes.',
    };
  }

  if (
    /network is unreachable/i.test(normalized) ||
    /connection timed out/i.test(normalized) ||
    /operation timed out/i.test(normalized) ||
    /connection reset/i.test(normalized)
  ) {
    return {
      code: 'network-transport-failure',
      summary: 'network transport failed before a reliable auth verdict',
      nextStep:
        'Compare sandbox and host-level probes before treating this as SSH or broker failure.',
    };
  }

  if (/could not read from remote repository/i.test(normalized)) {
    return {
      code: 'git-remote-access-failed',
      summary: 'Git could not read the remote after the SSH attempt failed',
      nextStep:
        'Use the preceding SSH failure class to choose the next action; do not replace the remote.',
    };
  }

  return {
    code: 'unknown',
    summary: 'failure did not match a known Governada auth/runtime class',
    nextStep:
      'Capture the command, environment, exit status, and redacted first error line before changing auth state.',
  };
}

function classifyCommandResult(result = {}, options = {}) {
  return classifyAuthFailure(resultText(result), {
    ...options,
    timeoutMs: options.timeoutMs || result.timeoutMs,
    timedOut: isTimedOut(result, options),
  });
}

function formatClassification(classification) {
  return `${classification.code}: ${classification.summary}; next: ${classification.nextStep}`;
}

module.exports = {
  classifyAuthFailure,
  classifyCommandResult,
  formatClassification,
  resultText,
};
