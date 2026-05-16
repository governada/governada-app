import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  KnownKoiosShapesFile,
  SchemaDriftChange,
  SchemaDriftEventData,
} from './schemaObserver';
import { hashShape, KOIOS_SCHEMA_TARGET_FILE } from './schemaObserver';

const execFileAsync = promisify(execFile);
const REPO_FULL_NAME = 'governada/app';
const DEFAULT_BASE_BRANCH = 'main';
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type SchemaDriftPrResult =
  | {
      status: 'opened';
      branch: string;
      url: string | null;
      body: string;
    }
  | {
      status: 'skipped_duplicate';
      branch: string;
      url: string | null;
      body: string;
    };

type CommandResult = {
  stdout: string;
  stderr: string;
};

type RunCommand = (
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number },
) => Promise<CommandResult>;

export type OpenSchemaDriftPullRequestOptions = {
  repoRoot?: string;
  now?: () => Date;
  runCommand?: RunCommand;
};

type PullRequestSummary = {
  number: number;
  state: string;
  headRefName: string;
  createdAt: string;
  url: string;
  title: string;
};

async function defaultRunCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number },
): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: options.cwd,
    timeout: options.timeoutMs ?? 90_000,
    maxBuffer: 1024 * 1024 * 10,
  });
  return { stdout, stderr };
}

function repoRootFromCwd(): string {
  return process.env.SCHEMA_DRIFT_REPO_ROOT || process.cwd();
}

function sanitizeBranchPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48);
}

export function schemaDriftBranchName(data: SchemaDriftEventData): string {
  return `feat/schema-drift-${sanitizeBranchPart(data.endpoint)}-${data.observedShapeHash.slice(0, 12)}`;
}

function titleFor(data: SchemaDriftEventData): string {
  const primary = data.changes[0];
  const change = primary?.path && primary.path !== '$' ? ` ${primary.path}` : '';
  return `fix(koios): track ${data.endpoint}${change} schema drift`;
}

function formatSample(value: unknown): string {
  const text = JSON.stringify(value, null, 2) ?? String(value);
  return text.length > 700 ? `${text.slice(0, 697)}...` : text;
}

function formatChange(change: SchemaDriftChange): string {
  return [
    `- **${change.kind}** at \`${change.path}\``,
    `  - Known types: \`${change.knownTypes.length ? change.knownTypes.join(' | ') : '(none)'}\``,
    `  - Observed types: \`${change.observedTypes.join(' | ')}\``,
    `  - Suggested Zod: \`${change.path === '$' ? change.suggestedZod : `${JSON.stringify(change.path.split('.').at(-1) ?? change.path)}: ${change.suggestedZod}`}\``,
    '  - Observed sample:',
    '```json',
    formatSample(change.observedSample),
    '```',
  ].join('\n');
}

export function buildSchemaDriftPrBody(data: SchemaDriftEventData): string {
  const changeSummary = data.changes.map(formatChange).join('\n\n');
  return `## Summary

- Koios schema drift detected for \`${data.endpoint}\`.
- Updates \`lib/koios/knownShapes.json\` with observed shape hash \`${data.observedShapeHash}\`.
- Proposes matching Zod schema updates in \`${KOIOS_SCHEMA_TARGET_FILE}\`.

## Existing Code Audit

- **Searched for**: Koios fetch and validation path in \`utils/koios.ts\` and \`${KOIOS_SCHEMA_TARGET_FILE}\`.
- **Found**: Koios responses are validated with \`.passthrough()\`, so additive fields do not fail validation or create review work.
- **Decision**: This PR records the observed upstream shape and asks reviewers to update the existing Zod schema file instead of adding a parallel schema path.

## Schema Drift

- **Endpoint**: \`${data.endpoint}\`
- **Raw Koios endpoint**: \`${data.rawEndpoint}\`
- **Detected at**: \`${data.observedAt}\`
- **Known shape hash**: \`${data.knownShapeHash ?? '(missing)'}\`
- **Observed shape hash**: \`${data.observedShapeHash}\`
- **Precedent**: [PR #664](https://github.com/governada/app/pull/664) handled a prior Koios DRep schema field change.

${changeSummary}

## Reviewer Checklist

- [ ] Confirm the novel field is benign/additive rather than a breaking semantic change.
- [ ] Confirm the proposed Zod type matches the observed sample value.
- [ ] If this is semantic drift, update sync handling and alerting, not only \`${KOIOS_SCHEMA_TARGET_FILE}\`.

## Robustness

- [x] Error states handled: schema observation failures are warning-only and do not break sync fetches.
- [x] Loading states meaningful: no UI changed.
- [x] Empty states guide users: empty Koios arrays do not remove known fields.
- [x] Edge cases considered: nested objects, arrays, nullable fields, and repeated events are handled by the observer and 24h PR dedupe.
- [x] Mobile verified if UI changed: no UI changed.

## Impact

- **What changed**: Koios known-shape source of truth is updated and reviewers get an explicit schema delta proposal.
- **User-facing**: No direct UI change.
- **Risk**: Low; the PR is draft and requires human review before schema acceptance.
- **Scope**: Koios schema drift tracking only.

## Verification

- Run \`npm run agent:validate\`.
- Run \`npm test -- schema-drift koios-schema-observer agentConstraints\`.
- Confirm \`${KOIOS_SCHEMA_TARGET_FILE}\` is updated if the field should become part of the runtime contract.

## Brain Freshness

Brain freshness: not needed; orchestrator writes the Phase 6 retro and dashboard updates.

## Review Gate v0

- **Review tier**: L2
- **Status**: Pending independent review.
- **Findings**: Reviewers must confirm benign vs breaking drift and the proposed Zod type before this PR is marked ready.
`;
}

function parsePullRequests(stdout: string): PullRequestSummary[] {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    return Array.isArray(parsed) ? (parsed as PullRequestSummary[]) : [];
  } catch {
    return [];
  }
}

async function recentDuplicatePr(
  data: SchemaDriftEventData,
  branch: string,
  repoRoot: string,
  now: Date,
  runCommand: RunCommand,
): Promise<PullRequestSummary | null> {
  const result = await runCommand(
    path.join(repoRoot, 'bin', 'gh.sh'),
    [
      'pr',
      'list',
      '--repo',
      REPO_FULL_NAME,
      '--state',
      'all',
      '--search',
      data.observedShapeHash,
      '--json',
      'number,state,headRefName,createdAt,url,title',
    ],
    { cwd: repoRoot, timeoutMs: 90_000 },
  );

  for (const pr of parsePullRequests(result.stdout)) {
    const createdAt = Date.parse(pr.createdAt);
    const recent = Number.isFinite(createdAt) && now.getTime() - createdAt < DUPLICATE_WINDOW_MS;
    const sameShape =
      pr.headRefName === branch || pr.title.includes(data.observedShapeHash.slice(0, 12));
    if (recent && sameShape) return pr;
  }

  return null;
}

async function updateKnownShapesFile(worktreeRoot: string, data: SchemaDriftEventData) {
  const knownShapesPath = path.join(worktreeRoot, 'lib', 'koios', 'knownShapes.json');
  const current = JSON.parse(await readFile(knownShapesPath, 'utf8')) as KnownKoiosShapesFile;
  const next: KnownKoiosShapesFile = {
    ...current,
    generatedAt: data.observedAt,
    source: `Auto-updated from Koios schema drift event for ${data.endpoint}`,
    endpoints: {
      ...current.endpoints,
      [data.endpoint]: {
        endpoint: data.endpoint,
        observedAt: data.observedAt,
        shapeHash: hashShape(data.observedShape),
        shape: data.observedShape,
      },
    },
  };

  await writeFile(knownShapesPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function cleanLocalWorktree(
  repoRoot: string,
  worktreeRoot: string,
  branch: string,
  runCommand: RunCommand,
) {
  await runCommand('git', ['-C', repoRoot, 'worktree', 'remove', worktreeRoot, '--force'], {
    cwd: repoRoot,
    timeoutMs: 30_000,
  }).catch(() => null);
  await runCommand('git', ['-C', repoRoot, 'branch', '-D', branch], {
    cwd: repoRoot,
    timeoutMs: 30_000,
  }).catch(() => null);
}

export async function openSchemaDriftPullRequest(
  data: SchemaDriftEventData,
  options: OpenSchemaDriftPullRequestOptions = {},
): Promise<SchemaDriftPrResult> {
  const repoRoot = options.repoRoot ?? repoRootFromCwd();
  const now = (options.now ?? (() => new Date()))();
  const runCommand = options.runCommand ?? defaultRunCommand;
  const branch = schemaDriftBranchName(data);
  const body = buildSchemaDriftPrBody(data);

  const duplicate = await recentDuplicatePr(data, branch, repoRoot, now, runCommand);
  if (duplicate) {
    return { status: 'skipped_duplicate', branch, url: duplicate.url, body };
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'governada-schema-drift-'));
  const worktreeRoot = path.join(tempRoot, 'worktree');

  try {
    await runCommand(
      'git',
      [
        '-C',
        repoRoot,
        'worktree',
        'add',
        worktreeRoot,
        '-b',
        branch,
        `origin/${DEFAULT_BASE_BRANCH}`,
      ],
      { cwd: repoRoot, timeoutMs: 90_000 },
    );
    await updateKnownShapesFile(worktreeRoot, data);

    const bodyPath = path.join(worktreeRoot, '.schema-drift-pr-body.md');
    await writeFile(bodyPath, body);

    await runCommand('git', ['-C', worktreeRoot, 'add', 'lib/koios/knownShapes.json'], {
      cwd: worktreeRoot,
      timeoutMs: 30_000,
    });
    await runCommand('git', ['-C', worktreeRoot, 'commit', '-m', titleFor(data)], {
      cwd: worktreeRoot,
      timeoutMs: 60_000,
    });
    await runCommand('npm', ['run', 'git:push', '--', 'origin', branch], {
      cwd: worktreeRoot,
      timeoutMs: 180_000,
    });

    const pr = await runCommand(
      path.join(worktreeRoot, 'bin', 'gh.sh'),
      [
        'pr',
        'create',
        '--repo',
        REPO_FULL_NAME,
        '--base',
        DEFAULT_BASE_BRANCH,
        '--head',
        branch,
        '--title',
        titleFor(data),
        '--body-file',
        bodyPath,
        '--draft',
      ],
      { cwd: worktreeRoot, timeoutMs: 90_000 },
    );

    return {
      status: 'opened',
      branch,
      url: pr.stdout.trim() || null,
      body,
    };
  } finally {
    await cleanLocalWorktree(repoRoot, worktreeRoot, branch, runCommand);
    await rm(tempRoot, { recursive: true, force: true }).catch(() => null);
  }
}
