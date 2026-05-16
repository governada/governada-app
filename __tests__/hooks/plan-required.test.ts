import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('plan-required hook', () => {
  it('enforces plan references from linked worktrees while exempting cross-repo commands', () => {
    const output = execFileSync(
      'bash',
      [path.join(repoRoot, '__tests__/hooks/plan-required.test.sh')],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );

    expect(output).toContain('plan-required hook tests passed');
  });
});
