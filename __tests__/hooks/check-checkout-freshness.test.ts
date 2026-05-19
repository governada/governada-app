import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('checkout freshness hook', () => {
  it('warns for stale untracked files and refreshes clean checkouts', () => {
    const output = execFileSync(
      'bash',
      [path.join(repoRoot, '__tests__/hooks/check-checkout-freshness.test.sh')],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );

    expect(output).toContain('checkout freshness tests passed');
  });
});
