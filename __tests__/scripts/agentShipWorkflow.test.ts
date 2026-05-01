import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('agent ship workflow guardrails', () => {
  it('tracks the provider-agnostic ship skill while keeping runtime artifacts ignored', () => {
    const gitignore = read('.gitignore');
    const skill = read('.agents/skills/ship/SKILL.md');

    expect(gitignore).toContain('!.agents/skills/ship/SKILL.md');
    expect(gitignore).not.toMatch(/^\.agents\/$/mu);
    expect(skill).toContain('git push -u origin <current-branch>');
    expect(skill).toContain('npm run gh:auth-status');
    expect(skill).not.toContain('npm run github:ship');
    expect(skill).not.toContain('npm run github:merge');
  });

  it('keeps active ship docs on the SSH and GitHub PR lane', () => {
    const checkedFiles = ['.agents/skills/ship/SKILL.md', '.claude/commands/ship.md', 'AGENTS.md'];

    for (const relativePath of checkedFiles) {
      const content = read(relativePath);
      expect(content, relativePath).toContain('SSH');
      expect(content, relativePath).not.toContain('github:merge');
      expect(content, relativePath).not.toContain('github:ship');
      expect(content, relativePath).not.toContain('npm run pr:merge --');
      expect(content, relativePath).not.toContain('npm run pr:ready --');
      expect(content, relativePath).not.toContain('--register-inngest');
    }
  });

  it('archives legacy merge and ready scripts instead of leaving active wrappers', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const mergeScript = read('docs/archive/auth-runtime/scripts/pr-merge.js');
    const readyScript = read('docs/archive/auth-runtime/scripts/pr-ready.js');

    expect(packageJson.scripts['pr:merge']).toBeUndefined();
    expect(packageJson.scripts['pr:ready']).toBeUndefined();
    expect(mergeScript).toContain('npm run pr:merge is retired');
    expect(mergeScript).toContain('npm run github:merge');
    expect(mergeScript).not.toContain('runGh');
    expect(readyScript).toContain('npm run pr:ready is retired');
    expect(readyScript).toContain('npm run github:pr-write');
    expect(readyScript).not.toContain('runGh');
  });

  it('routes rollback and legacy deploy verify through safe current entrypoints', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const rollbackJs = read('scripts/rollback.js');
    const rollbackMjs = read('scripts/rollback.mjs');
    const deployVerifyJs = read('scripts/health-verify.js');

    expect(packageJson.scripts.rollback).toBe('node scripts/rollback.mjs');
    expect(rollbackJs).toContain('rollback.mjs');
    expect(rollbackMjs).toContain("['fetch', 'origin', 'main']");
    expect(rollbackMjs).toContain('Completed emergency revert generation review');
    expect(deployVerifyJs).toContain('npm');
    expect(deployVerifyJs).toContain('health:verify');
    expect(deployVerifyJs).toContain('no longer supports --register-inngest');
  });
});
