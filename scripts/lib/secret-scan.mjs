import path from 'node:path';

const RISKY_BASENAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.mcp.json',
  '.npmrc',
  '.pypirc',
  'settings.local.json',
]);

const RISKY_EXTENSIONS = new Set(['.key', '.p12', '.pem', '.pfx']);

const TOKEN_PATTERNS = [
  {
    label: 'GitHub token',
    pattern:
      /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pour]_[A-Za-z0-9_]{20,}|ghs_[A-Za-z0-9_]{20,})\b/gu,
  },
  {
    label: '1Password service-account token',
    pattern: /\bops_[A-Za-z0-9._-]{20,}\b/gu,
  },
  {
    label: 'OpenAI API key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/gu,
  },
  {
    label: 'Anthropic API key',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/gu,
  },
  {
    label: 'AWS access key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/gu,
  },
  {
    label: 'Slack token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/gu,
  },
  {
    label: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gu,
  },
];

const RAW_TOKEN_ENV_RE =
  /(?:^|\n)\s*(?:export\s+)?(?:GH_TOKEN|GITHUB_TOKEN|OP_SERVICE_ACCOUNT_TOKEN)\s*=\s*(['"]?)([^'"\n#]+)\1/gu;

export function scanGitHubShipContentForSecrets({ content, filePath }) {
  const findings = [];
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content || '');

  if (RISKY_BASENAMES.has(basename)) {
    findings.push({ label: `blocked secret/config filename ${basename}`, path: filePath });
  }

  if (RISKY_EXTENSIONS.has(extension)) {
    findings.push({ label: `blocked secret-bearing file extension ${extension}`, path: filePath });
  }

  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(text)) {
    findings.push({ label: 'private key PEM block', path: filePath });
  }

  for (const match of text.matchAll(RAW_TOKEN_ENV_RE)) {
    const value = match[2] || '';
    if (!isPlaceholderSecret(value) && !value.startsWith('op://')) {
      findings.push({ label: 'raw GitHub/1Password token env assignment', path: filePath });
    }
  }

  for (const { label, pattern } of TOKEN_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (!isPlaceholderSecret(match[0])) {
        findings.push({ label, path: filePath });
        break;
      }
    }
  }

  return dedupeFindings(findings);
}

export function formatSecretScanFindings(findings) {
  return findings.map((finding) => `${finding.path}: ${finding.label}`).join('; ');
}

function isPlaceholderSecret(value) {
  return /(?:abc123|dummy|example|fixture|placeholder|redacted|should-not|test)/iu.test(value);
}

function dedupeFindings(findings) {
  const seen = new Set();
  const unique = [];

  for (const finding of findings) {
    const key = `${finding.path}:${finding.label}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(finding);
  }

  return unique;
}
