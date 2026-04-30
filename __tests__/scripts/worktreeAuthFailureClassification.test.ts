import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('worktree wrapper auth failure classification', () => {
  it('bounds and classifies worktree sync fetch failures', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/sync-worktree.mjs'), 'utf8');

    expect(source).toContain('GIT_NETWORK_TIMEOUT_MS');
    expect(source).toContain('classifyCommandResult');
    expect(source).toContain("git(['fetch', 'origin', 'main', '--quiet'], { timeoutMs:");
    expect(source).toContain('Failure class:');
  });

  it('bounds and classifies worktree creation fetch failures', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/new-worktree.mjs'), 'utf8');

    expect(source).toContain('GIT_FETCH_TIMEOUT_MS');
    expect(source).toContain('classifyAuthFailure');
    expect(source).toContain("git(['fetch', 'origin', 'main'], { timeoutMs:");
    expect(source).toContain('Failure class:');
  });
});
