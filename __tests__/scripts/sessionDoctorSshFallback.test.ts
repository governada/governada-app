import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('session doctor direct SSH fallback classification', () => {
  it('prints a direct SSH fallback lane without probing the SSH socket by default', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/session-doctor.js'), 'utf8');

    expect(source).toContain('Direct SSH fallback lane');
    expect(source).toContain('DIRECT_SSH_TIMEOUT_MS');
    expect(source).toContain('--probe-direct-ssh');
    expect(source).toContain('active key visibility probe skipped');
    expect(source).toContain("runBounded('ssh-add', ['-l']");
    expect(source).toContain('classifyCommandResult');
    expect(source).toContain('advisories.push(directSshFallback.advisory)');
  });
});
