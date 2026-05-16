import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSchemaDriftPrBody,
  openSchemaDriftPullRequest,
  schemaDriftBranchName,
} from '@/lib/koios/schemaDriftPr';
import { hashShape, inferKoiosShape, type SchemaDriftEventData } from '@/lib/koios/schemaObserver';

function makeEvent(): SchemaDriftEventData {
  const observedShape = inferKoiosShape([{ drep_id: 'drep1', new_koios_field: 'surprise' }]).shape;
  return {
    endpoint: 'drep_info',
    rawEndpoint: '/drep_info',
    observedAt: '2026-05-16T04:05:00.000Z',
    knownShapeHash: 'known-shape-hash',
    observedShapeHash: hashShape(observedShape),
    observedShape,
    targetFile: 'utils/koios-schemas.ts',
    precedentPr: 'https://github.com/governada/app/pull/664',
    changes: [
      {
        kind: 'novel_field',
        path: '[].new_koios_field',
        knownTypes: [],
        observedTypes: ['string'],
        observedSample: 'surprise',
        suggestedZod: 'z.string().optional()',
      },
    ],
  };
}

describe('schema drift PR automation', () => {
  it('builds a PR body with schema delta, precedent, and required review sections', () => {
    const body = buildSchemaDriftPrBody(makeEvent());

    expect(body).toContain('## Existing Code Audit');
    expect(body).toContain('## Robustness');
    expect(body).toContain('## Impact');
    expect(body).toContain('## Brain Freshness');
    expect(body).toContain('## Review Gate v0');
    expect(body).toContain('`drep_info`');
    expect(body).toContain('`[].new_koios_field`');
    expect(body).toContain('`"new_koios_field": z.string().optional()`');
    expect(body).toContain('`utils/koios-schemas.ts`');
    expect(body).toContain('[PR #664](https://github.com/governada/app/pull/664)');
    expect(body).toContain('Confirm the novel field is benign/additive');
    expect(body).toContain('Confirm the proposed Zod type matches the observed sample value');
  });

  it('deduplicates the same novel shape inside the 24-hour window', async () => {
    const data = makeEvent();
    const branch = schemaDriftBranchName(data);
    const runCommand = vi.fn(async (command: string, args: string[]) => {
      expect(command).toMatch(/bin\/gh\.sh$/u);
      expect(args).toContain('pr');
      expect(args).toContain('list');
      return {
        stdout: JSON.stringify([
          {
            number: 6640,
            state: 'OPEN',
            headRefName: branch,
            createdAt: '2026-05-16T04:00:00.000Z',
            url: 'https://github.com/governada/app/pull/6640',
            title: 'fix(koios): track drep_info schema drift',
          },
        ]),
        stderr: '',
      };
    });

    const result = await openSchemaDriftPullRequest(data, {
      repoRoot: '/tmp/governada-app',
      now: () => new Date('2026-05-16T04:30:00.000Z'),
      runCommand,
    });

    expect(result).toMatchObject({
      status: 'skipped_duplicate',
      branch,
      url: 'https://github.com/governada/app/pull/6640',
    });
    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  it('opens draft PRs through governed repo wrappers instead of raw gh', async () => {
    const data = makeEvent();
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'schema-drift-pr-test-'));
    const branch = schemaDriftBranchName(data);
    const commands: Array<{ command: string; args: string[] }> = [];

    const runCommand = vi.fn(async (command: string, args: string[]) => {
      commands.push({ command, args });

      if (command.endsWith('/bin/gh.sh') && args.includes('list')) {
        return { stdout: '[]', stderr: '' };
      }

      if (command === 'git' && args.includes('worktree') && args.includes('add')) {
        const worktreeRoot = args[4];
        if (!worktreeRoot) throw new Error('missing worktree root');
        await mkdir(path.join(worktreeRoot, 'lib', 'koios'), { recursive: true });
        await mkdir(path.join(worktreeRoot, 'bin'), { recursive: true });
        await writeFile(
          path.join(worktreeRoot, 'lib', 'koios', 'knownShapes.json'),
          `${JSON.stringify({ version: 1, generatedAt: data.observedAt, source: 'test', endpoints: {} })}\n`,
        );
        await writeFile(path.join(worktreeRoot, 'bin', 'gh.sh'), '#!/bin/sh\n');
        return { stdout: '', stderr: '' };
      }

      if (command.endsWith('/bin/gh.sh') && args.includes('create')) {
        return { stdout: 'https://github.com/governada/app/pull/6641\n', stderr: '' };
      }

      return { stdout: '', stderr: '' };
    });

    const result = await openSchemaDriftPullRequest(data, {
      repoRoot,
      now: () => new Date('2026-05-16T04:30:00.000Z'),
      runCommand,
    });

    expect(result).toMatchObject({
      status: 'opened',
      branch,
      url: 'https://github.com/governada/app/pull/6641',
    });
    expect(commands).toContainEqual({
      command: 'npm',
      args: ['run', 'git:push', '--', 'origin', branch],
    });
    expect(commands.some(({ command }) => command === 'gh')).toBe(false);
    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: expect.stringMatching(/bin\/gh\.sh$/u),
          args: expect.arrayContaining(['pr', 'create', '--draft']),
        }),
      ]),
    );

    await rm(repoRoot, { recursive: true, force: true });
  });
});
