import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const classifierPath = path.join(repoRoot, 'scripts/lib/auth-failure-classifier.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classifyAuthFailure, classifyCommandResult } = require(classifierPath);

describe('auth failure classifier', () => {
  it('classifies sandbox or permission denial separately from auth failure', () => {
    expect(classifyAuthFailure('Error connecting to agent: Operation not permitted').code).toBe(
      'sandbox-or-permission-denied',
    );
    expect(classifyAuthFailure('connect EPERM /path/to/socket').code).toBe(
      'sandbox-or-permission-denied',
    );
  });

  it('classifies visible-key-but-signing-failed cases', () => {
    expect(
      classifyAuthFailure(
        'sign_and_send_pubkey: signing failed for ED25519 "/Users/tim/.ssh/github-governada.pub" from agent: communication with agent failed',
      ).code,
    ).toBe('ssh-signing-unavailable');
  });

  it('classifies empty and unreachable SSH agents distinctly', () => {
    expect(classifyAuthFailure('The agent has no identities.').code).toBe('ssh-agent-empty');
    expect(classifyAuthFailure('Error connecting to agent: Connection refused').code).toBe(
      'ssh-agent-unreachable',
    );
  });

  it('classifies network resolution before SSH auth', () => {
    expect(classifyAuthFailure('ssh: Could not resolve hostname github.com: -65563').code).toBe(
      'network-resolution-failure',
    );
  });

  it('classifies network transport failures', () => {
    expect(
      classifyAuthFailure('ssh: connect to host github.com port 22: Operation timed out').code,
    ).toBe('network-transport-failure');
    expect(
      classifyAuthFailure('ssh: connect to host github.com port 22: Network is unreachable').code,
    ).toBe('network-transport-failure');
  });

  it('classifies GitHub public-key denial', () => {
    expect(classifyAuthFailure('git@github.com: Permission denied (publickey).').code).toBe(
      'github-publickey-denied',
    );
  });

  it('classifies git remote access failure separately', () => {
    expect(classifyAuthFailure('fatal: Could not read from remote repository.').code).toBe(
      'git-remote-access-failed',
    );
  });

  it('classifies bounded timeout results', () => {
    const classification = classifyCommandResult({
      status: 1,
      stderr: '',
      timedOut: true,
      timeoutMs: 5000,
    });

    expect(classification.code).toBe('timeout');
    expect(classification.summary).toContain('5000ms');
  });
});
