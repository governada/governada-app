import { EXPECTED_REPO, GITHUB_OPERATION_CLASSES } from './github-app-auth.mjs';
import { assertPrCloseBody, parseGithubPrCloseApproval } from './github-pr-close.mjs';
import { formatSecretScanFindings, scanGitHubShipContentForSecrets } from './secret-scan.mjs';

const REPO_PREFIX = `/repos/${EXPECTED_REPO}`;
const BRANCH_REF_PREFIX_RE = /^refs\/heads\/(?:codex|feat)\/[A-Za-z0-9._/-]+$/u;
const BRANCH_GET_PATH_RE =
  /^\/repos\/governada\/app\/git\/ref\/heads\/((?:codex|feat)\/[A-Za-z0-9._/-]+)$/u;
const BRANCH_PATH_RE =
  /^\/repos\/governada\/app\/git\/refs\/heads\/((?:codex|feat)\/[A-Za-z0-9._/-]+)$/u;
const COMMIT_SHA_PATH_RE =
  /^\/repos\/governada\/app\/commits\/[a-f0-9]{40}\/(?:check-runs|status)(?:\?.*)?$/iu;
const PULL_PATH_RE = /^\/repos\/governada\/app\/pulls(?:\?.*)?$/u;
const PULL_NUMBER_PATH_RE = /^\/repos\/governada\/app\/pulls\/[1-9]\d*$/u;
const PULL_MERGE_PATH_RE = /^\/repos\/governada\/app\/pulls\/[1-9]\d*\/merge$/u;
const FULL_SHA_RE = /^[a-f0-9]{40}$/iu;
const ALLOWED_MERGE_METHODS = new Set(['merge', 'rebase', 'squash']);

export function assertGithubBrokerRequestAllowed(request) {
  const operationClass = request?.operationClass || '';
  const method = String(request?.method || 'GET').toUpperCase();
  const path = String(request?.path || '');

  if (!Object.values(GITHUB_OPERATION_CLASSES).includes(operationClass)) {
    throw new Error(`unsupported broker operation class: ${operationClass || 'unset'}`);
  }

  if (!path.startsWith(REPO_PREFIX) && path !== '/graphql') {
    throw new Error(`broker request path is outside ${EXPECTED_REPO}`);
  }

  if (method === 'POST' && path === `${REPO_PREFIX}/git/blobs`) {
    assertNoTokenLikeBlobPayload(request);
  } else {
    assertNoTokenLikePayload(request);
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.read) {
    assertReadRequestAllowed(method, path);
    return;
  }

  if (
    operationClass === GITHUB_OPERATION_CLASSES.writePr ||
    operationClass === GITHUB_OPERATION_CLASSES.shipPr
  ) {
    assertShipPrRequestAllowed(method, path, request);
    return;
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.prClose) {
    assertPrCloseRequestAllowed(method, path, request);
    return;
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.merge) {
    assertMergeRequestAllowed(method, path, request);
    return;
  }

  throw new Error(`unsupported broker operation class: ${operationClass}`);
}

function assertReadRequestAllowed(method, path) {
  if (
    method === 'GET' &&
    (path === REPO_PREFIX ||
      PULL_PATH_RE.test(path) ||
      PULL_NUMBER_PATH_RE.test(path) ||
      path.startsWith(`${REPO_PREFIX}/actions/runs`) ||
      path.startsWith(`${REPO_PREFIX}/branches/`) ||
      COMMIT_SHA_PATH_RE.test(path))
  ) {
    return;
  }

  throw new Error(`github.read broker request is not allowed: ${method} ${path}`);
}

function assertShipPrRequestAllowed(method, path, request) {
  if (method === 'GET' && (BRANCH_GET_PATH_RE.test(path) || BRANCH_PATH_RE.test(path))) {
    return;
  }

  if (method === 'GET' && /^\/repos\/governada\/app\/git\/commits\/[a-f0-9]{40}$/iu.test(path)) {
    return;
  }

  if (method === 'GET') {
    assertReadRequestAllowed(method, path);
    return;
  }

  if (method === 'POST' && path === `${REPO_PREFIX}/pulls`) {
    assertPullRequestCreateBody(request.body || {});
    return;
  }

  if (method === 'PATCH' && PULL_NUMBER_PATH_RE.test(path)) {
    assertPullRequestUpdateBody(request.body || {});
    return;
  }

  if (method === 'POST' && path === '/graphql') {
    if (request.graphQlMutation === 'markPullRequestReadyForReview') {
      return;
    }
    throw new Error('only markPullRequestReadyForReview GraphQL is allowed in github.ship.pr');
  }

  if (method === 'POST' && path === `${REPO_PREFIX}/git/refs`) {
    assertAllowedBranchRef(request.body?.ref);
    return;
  }

  if (method === 'PATCH' && BRANCH_PATH_RE.test(path)) {
    if (request.body?.force === true) {
      throw new Error('github.ship.pr branch updates must not force push');
    }
    return;
  }

  if (method === 'POST' && path === `${REPO_PREFIX}/git/blobs`) {
    return;
  }

  if (method === 'POST' && path === `${REPO_PREFIX}/git/trees`) {
    assertGitTreeBody(request.body || {});
    return;
  }

  if (method === 'POST' && path === `${REPO_PREFIX}/git/commits`) {
    return;
  }

  throw new Error(`github.ship.pr broker request is not allowed: ${method} ${path}`);
}

function assertPrCloseRequestAllowed(method, path, request) {
  if (
    method === 'GET' &&
    (path === REPO_PREFIX || PULL_PATH_RE.test(path) || PULL_NUMBER_PATH_RE.test(path))
  ) {
    return;
  }

  if (method === 'PATCH' && PULL_NUMBER_PATH_RE.test(path)) {
    assertPrCloseBody(request.body || {});
    assertPrCloseProof(request, path);
    return;
  }

  throw new Error(`github.pr.close broker request is not allowed: ${method} ${path}`);
}

function assertMergeRequestAllowed(method, path, request) {
  if (
    method === 'GET' &&
    (path === REPO_PREFIX || PULL_PATH_RE.test(path) || PULL_NUMBER_PATH_RE.test(path))
  ) {
    return;
  }

  if (method === 'GET' && COMMIT_SHA_PATH_RE.test(path)) {
    return;
  }

  if (method === 'PUT' && PULL_MERGE_PATH_RE.test(path)) {
    assertMergeRequestProof(request, path);
    return;
  }

  throw new Error(`github.merge broker request is not allowed: ${method} ${path}`);
}

function assertPullRequestCreateBody(body) {
  if (body.base !== 'main') {
    throw new Error('github.ship.pr PR creation must target main');
  }

  assertAllowedBranchName(body.head, 'PR head');

  if (body.draft !== true) {
    throw new Error('github.ship.pr PR creation must create draft PRs');
  }

  if (body.maintainer_can_modify !== false) {
    throw new Error('github.ship.pr PR creation must set maintainer_can_modify=false');
  }
}

function assertPullRequestUpdateBody(body) {
  const allowedKeys = new Set(['body', 'title']);
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`github.ship.pr PR update may not set ${key}`);
    }
  }
}

function assertAllowedBranchRef(ref) {
  if (!BRANCH_REF_PREFIX_RE.test(String(ref || ''))) {
    throw new Error('github.ship.pr branch ref must be refs/heads/codex/* or refs/heads/feat/*');
  }

  assertAllowedBranchName(String(ref).slice('refs/heads/'.length), 'branch ref');
}

function assertAllowedBranchName(branch, label) {
  if (
    !/^(?:codex|feat)\/[A-Za-z0-9._/-]+$/u.test(String(branch || '')) ||
    branch === 'main' ||
    branch.includes(':') ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.startsWith('-')
  ) {
    throw new Error(`github.ship.pr ${label} must be same-repository codex/* or feat/*`);
  }
}

function assertPrCloseProof(request, requestPath) {
  const prNumber = Number(requestPath.match(/\/pulls\/([1-9]\d*)$/u)?.[1] || 0);
  const proof = request?.prCloseApproval || {};
  const expectedHead = String(proof.expectedHead || '');

  if (!FULL_SHA_RE.test(expectedHead)) {
    throw new Error('github.pr.close broker request must pin a 40-character expected head SHA');
  }

  if (Number(proof.prNumber) !== prNumber) {
    throw new Error('github.pr.close broker request must include matching PR approval proof');
  }

  const approval = parseGithubPrCloseApproval({
    expectedHead,
    prNumber,
    text: proof.approvalText || '',
  });
  if (!approval.ok) {
    throw new Error('github.pr.close broker request must include prompt approval text');
  }
}

function assertNoTokenLikePayload(request) {
  const text = JSON.stringify(request || {});
  if (
    /(?:github_pat_|ghs_|gh[pour]_|ops_|-----BEGIN [^-]+-----|op:\/\/)/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u.test(text)
  ) {
    throw new Error(
      'broker request payload must not include token-like or secret reference values',
    );
  }
}

function assertNoTokenLikeBlobPayload(request) {
  const body = request?.body || {};
  const requestWithoutBlobContent = {
    ...request,
    body: {
      ...body,
      content: body.content ? '[blob content omitted]' : body.content,
    },
  };
  assertNoTokenLikePayload(requestWithoutBlobContent);

  const content = typeof body.content === 'string' ? body.content : '';
  const decoded =
    body.encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
  const findings = scanGitHubShipContentForSecrets({
    content: decoded,
    filePath: 'github blob payload',
  });

  if (findings.length > 0) {
    throw new Error(
      `broker blob payload must not include likely secret material: ${formatSecretScanFindings(findings)}`,
    );
  }
}

function assertGitTreeBody(body) {
  const entries = Array.isArray(body.tree) ? body.tree : [];
  if (!Array.isArray(body.tree)) {
    throw new Error('github.ship.pr tree create body must include a tree array');
  }

  for (const entry of entries) {
    const entryPath = String(entry?.path || '');
    if (
      !entryPath ||
      entryPath.startsWith('/') ||
      entryPath.includes('..') ||
      entryPath.includes('\0')
    ) {
      throw new Error('github.ship.pr tree entry path must be a safe repository-relative path');
    }

    const findings = scanGitHubShipContentForSecrets({
      content: '',
      filePath: entryPath,
    });
    if (findings.length > 0) {
      throw new Error(
        `github.ship.pr tree entry path is blocked: ${formatSecretScanFindings(findings)}`,
      );
    }

    if (entry.sha !== null && !/^(100644|100755|120000)$/u.test(String(entry.mode || ''))) {
      throw new Error(`github.ship.pr tree entry has unsupported file mode for ${entryPath}`);
    }

    if (entry.sha !== null && entry.type !== 'blob') {
      throw new Error(`github.ship.pr tree entry must be a blob for ${entryPath}`);
    }
  }
}

function assertMergeRequestProof(request, requestPath) {
  const prNumber = Number(requestPath.match(/\/pulls\/([1-9]\d*)\/merge$/u)?.[1] || 0);
  const expectedHead = String(request?.body?.sha || '');
  const mergeMethod = String(request?.body?.merge_method || '');
  const proof = request?.mergeApproval || {};

  if (!FULL_SHA_RE.test(expectedHead)) {
    throw new Error('github.merge broker request must pin a 40-character expected head SHA');
  }

  if (!ALLOWED_MERGE_METHODS.has(mergeMethod)) {
    throw new Error('github.merge broker request must use an allowed merge method');
  }

  if (Number(proof.prNumber) !== prNumber) {
    throw new Error('github.merge broker request must include matching PR approval proof');
  }

  if (String(proof.expectedHead || '').toLowerCase() !== expectedHead.toLowerCase()) {
    throw new Error('github.merge broker request approval proof must match expected head SHA');
  }

  if (!String(proof.approvalText || '').trim()) {
    throw new Error('github.merge broker request must include prompt approval text');
  }
}
