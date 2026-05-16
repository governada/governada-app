import { createSign } from 'node:crypto';
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
import { KOIOS_SCHEMA_TARGET_FILE } from './schemaObserver';

const execFileAsync = promisify(execFile);
const REPO_FULL_NAME = 'governada/app';
const DEFAULT_BASE_BRANCH = 'main';
const KNOWN_SHAPES_PATH = 'lib/koios/knownShapes.json';
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const GITHUB_API_VERSION = '2022-11-28';

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
  mode?: 'auto' | 'github-api' | 'local-wrappers';
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  githubToken?: string;
  githubCredentials?: {
    clientId: string;
    installationId: string;
    privateKey: string;
  };
};

type PullRequestSummary = {
  number: number;
  state: string;
  headRefName: string;
  createdAt: string;
  url: string;
  title: string;
};

type GitHubApiPullRequest = {
  number: number;
  state: string;
  html_url: string;
  created_at: string;
  title: string;
  head: { ref: string };
};

type GitHubRef = {
  object: { sha: string };
};

type GitHubContentFile = {
  content: string;
  encoding: string;
  sha: string;
};

type GitHubCreatedPullRequest = {
  html_url: string;
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
  return `feat/schema-drift-${sanitizeBranchPart(data.endpoint)}-${data.driftFingerprint.slice(0, 12)}`;
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
- **Drift fingerprint**: \`${data.driftFingerprint}\`
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
- [x] Runtime portability: production uses the GitHub REST API path; local agent lanes can still use governed wrappers.
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
      data.driftFingerprint,
      '--json',
      'number,state,headRefName,createdAt,url,title',
    ],
    { cwd: repoRoot, timeoutMs: 90_000 },
  );

  for (const pr of parsePullRequests(result.stdout)) {
    const createdAt = Date.parse(pr.createdAt);
    const recent = Number.isFinite(createdAt) && now.getTime() - createdAt < DUPLICATE_WINDOW_MS;
    const sameShape =
      pr.headRefName === branch || pr.title.includes(data.driftFingerprint.slice(0, 12));
    const stillOpen = pr.state.toLowerCase() === 'open';
    if (sameShape && (stillOpen || recent)) return pr;
  }

  return null;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

function normalizePrivateKey(privateKey: string): string {
  const normalized = privateKey.replace(/\\n/gu, '\n').replace(/\\r/gu, '\r').trim();
  if (normalized.includes('\n')) {
    return normalized;
  }

  const match = normalized.match(/^(-----BEGIN [^-]+-----)(.+)(-----END [^-]+-----)$/u);
  if (!match) {
    return normalized;
  }

  const [, begin, body, end] = match;
  const wrappedBody = body
    .replace(/\s/gu, '')
    .match(/.{1,64}/gu)
    ?.join('\n');

  return `${begin}\n${wrappedBody || body}\n${end}`;
}

function mintAppJwt(clientId: string, privateKey: string, now = Math.floor(Date.now() / 1000)) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientId,
    iat: now - 60,
    exp: now + 540,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64Url(signer.sign(normalizePrivateKey(privateKey)))}`;
}

function githubCredentialsFromEnv(env: NodeJS.ProcessEnv) {
  const clientId = env.GOVERNADA_GITHUB_CLIENT_ID;
  const installationId = env.GOVERNADA_GITHUB_INSTALLATION_ID;
  const privateKey = env.GOVERNADA_GITHUB_APP_PRIVATE_KEY;
  if (!clientId || !installationId || !privateKey) {
    return null;
  }
  return { clientId, installationId, privateKey };
}

function redactGithubError(text: string): string {
  return text
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{12,}\b/gu, '[redacted-github-token]')
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gu, '[redacted-pem]')
    .replace(/"token"\s*:\s*"[^"]+"/gu, '"token":"[redacted-github-token]"');
}

async function githubRequest<T>(
  token: string,
  method: string,
  endpoint: string,
  fetchImpl: typeof fetch,
  body?: unknown,
): Promise<T> {
  const response = await fetchImpl(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': 'governada-schema-drift-pr',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new Error(
      `GitHub API ${method} ${endpoint} failed with HTTP ${response.status}: ${redactGithubError(text)}`,
    );
  }
  return parsed as T;
}

async function resolveGitHubToken(options: OpenSchemaDriftPullRequestOptions): Promise<string> {
  if (options.githubToken) {
    return options.githubToken;
  }

  const credentials =
    options.githubCredentials ?? githubCredentialsFromEnv(options.env ?? process.env);
  if (!credentials) {
    throw new Error(
      'GitHub App runtime credentials are missing. Set GOVERNADA_GITHUB_CLIENT_ID, GOVERNADA_GITHUB_INSTALLATION_ID, and GOVERNADA_GITHUB_APP_PRIVATE_KEY, or run in local-wrapper mode.',
    );
  }

  const jwt = mintAppJwt(credentials.clientId, credentials.privateKey);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('global fetch is not available for GitHub App token minting.');
  }

  const response = await fetchImpl(
    `https://api.github.com/app/installations/${encodeURIComponent(credentials.installationId)}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': 'governada-schema-drift-pr',
      },
    },
  );
  const text = await response.text();
  const body = text ? (JSON.parse(text) as { token?: string }) : {};
  if (response.status !== 201 || !body.token) {
    throw new Error(
      `GitHub installation-token mint failed with HTTP ${response.status}: ${redactGithubError(text)}`,
    );
  }
  return body.token;
}

function decodeGitHubContent(file: GitHubContentFile): string {
  if (file.encoding !== 'base64') {
    throw new Error(`Unsupported GitHub content encoding: ${file.encoding}`);
  }
  return Buffer.from(file.content.replace(/\n/gu, ''), 'base64').toString('utf8');
}

function githubContentPath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

async function recentDuplicatePrViaApi(
  token: string,
  branch: string,
  now: Date,
  fetchImpl: typeof fetch,
): Promise<PullRequestSummary | null> {
  const pulls = await githubRequest<GitHubApiPullRequest[]>(
    token,
    'GET',
    `/repos/${REPO_FULL_NAME}/pulls?state=all&head=governada:${encodeURIComponent(branch)}&per_page=10`,
    fetchImpl,
  );

  for (const pr of pulls) {
    const createdAt = Date.parse(pr.created_at);
    const recent = Number.isFinite(createdAt) && now.getTime() - createdAt < DUPLICATE_WINDOW_MS;
    const stillOpen = pr.state.toLowerCase() === 'open';
    if (!stillOpen && !recent) continue;
    return {
      number: pr.number,
      state: pr.state,
      headRefName: pr.head.ref,
      createdAt: pr.created_at,
      url: pr.html_url,
      title: pr.title,
    };
  }

  return null;
}

async function updateKnownShapesFile(worktreeRoot: string, data: SchemaDriftEventData) {
  const knownShapesPath = path.join(worktreeRoot, KNOWN_SHAPES_PATH);
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
        shapeHash: data.observedShapeHash,
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

async function openSchemaDriftPullRequestWithLocalWrappers(
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

    await runCommand('git', ['-C', worktreeRoot, 'add', KNOWN_SHAPES_PATH], {
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

async function openSchemaDriftPullRequestWithGitHubApi(
  data: SchemaDriftEventData,
  options: OpenSchemaDriftPullRequestOptions,
): Promise<SchemaDriftPrResult> {
  const now = (options.now ?? (() => new Date()))();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('global fetch is not available for GitHub API PR creation.');
  }

  const token = await resolveGitHubToken(options);
  const branch = schemaDriftBranchName(data);
  const body = buildSchemaDriftPrBody(data);
  const duplicate = await recentDuplicatePrViaApi(token, branch, now, fetchImpl);
  if (duplicate) {
    return { status: 'skipped_duplicate', branch, url: duplicate.url, body };
  }

  const baseRef = await githubRequest<GitHubRef>(
    token,
    'GET',
    `/repos/${REPO_FULL_NAME}/git/ref/heads/${DEFAULT_BASE_BRANCH}`,
    fetchImpl,
  );

  await githubRequest<GitHubRef>(token, 'POST', `/repos/${REPO_FULL_NAME}/git/refs`, fetchImpl, {
    ref: `refs/heads/${branch}`,
    sha: baseRef.object.sha,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('HTTP 422')) {
      throw error;
    }
  });

  const currentFile = await githubRequest<GitHubContentFile>(
    token,
    'GET',
    `/repos/${REPO_FULL_NAME}/contents/${githubContentPath(KNOWN_SHAPES_PATH)}?ref=${encodeURIComponent(branch)}`,
    fetchImpl,
  );
  const current = JSON.parse(decodeGitHubContent(currentFile)) as KnownKoiosShapesFile;
  const next: KnownKoiosShapesFile = {
    ...current,
    generatedAt: data.observedAt,
    source: `Auto-updated from Koios schema drift event for ${data.endpoint}`,
    endpoints: {
      ...current.endpoints,
      [data.endpoint]: {
        endpoint: data.endpoint,
        observedAt: data.observedAt,
        shapeHash: data.observedShapeHash,
        shape: data.observedShape,
      },
    },
  };

  await githubRequest(
    token,
    'PUT',
    `/repos/${REPO_FULL_NAME}/contents/${githubContentPath(KNOWN_SHAPES_PATH)}`,
    fetchImpl,
    {
      message: titleFor(data),
      content: Buffer.from(`${JSON.stringify(next, null, 2)}\n`, 'utf8').toString('base64'),
      sha: currentFile.sha,
      branch,
    },
  );

  const pr = await githubRequest<GitHubCreatedPullRequest>(
    token,
    'POST',
    `/repos/${REPO_FULL_NAME}/pulls`,
    fetchImpl,
    {
      title: titleFor(data),
      head: branch,
      base: DEFAULT_BASE_BRANCH,
      body,
      draft: true,
    },
  );

  return {
    status: 'opened',
    branch,
    url: pr.html_url,
    body,
  };
}

export async function openSchemaDriftPullRequest(
  data: SchemaDriftEventData,
  options: OpenSchemaDriftPullRequestOptions = {},
): Promise<SchemaDriftPrResult> {
  const mode = options.mode ?? 'auto';
  const hasRuntimeCredentials =
    Boolean(options.githubToken) ||
    Boolean(options.githubCredentials) ||
    Boolean(githubCredentialsFromEnv(options.env ?? process.env));

  if (mode === 'github-api' || (mode === 'auto' && hasRuntimeCredentials && !options.runCommand)) {
    return openSchemaDriftPullRequestWithGitHubApi(data, options);
  }

  return openSchemaDriftPullRequestWithLocalWrappers(data, options);
}
