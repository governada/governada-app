import { EXPECTED_REPO } from './github-app-auth.mjs';

export const GITHUB_MERGE_CONFIRMATION = 'github.merge';

export function buildGithubMergeApprovalPrompt({
  expectedHead,
  operationClass = GITHUB_MERGE_CONFIRMATION,
  prNumber,
  repo = EXPECTED_REPO,
}) {
  return `I approve ${operationClass} for ${repo} PR #${prNumber} if CI checks are green and the head SHA remains unchanged at ${expectedHead}.`;
}

export function parseGithubMergeApproval({
  expectedHead,
  operationClass = GITHUB_MERGE_CONFIRMATION,
  prNumber,
  repo = EXPECTED_REPO,
  text,
}) {
  const reasons = [];
  const approvalText = String(text || '').trim();
  const normalizedText = approvalText.replace(/\s+/gu, ' ');
  const lowerText = normalizedText.toLowerCase();

  if (!approvalText) {
    reasons.push('approval text is missing');
    return { ok: false, reasons };
  }

  if (!/\bapprov(?:e|ed|ing)\b/u.test(lowerText)) {
    reasons.push('approval must explicitly approve the operation');
  }

  if (!lowerText.includes(operationClass) && !/\bmerge\b/u.test(lowerText)) {
    reasons.push(`approval must name ${operationClass} or merge`);
  }

  if (!lowerText.includes(repo.toLowerCase())) {
    reasons.push(`approval must name repo ${repo}`);
  }

  if (!approvalNamesPr(normalizedText, prNumber)) {
    reasons.push(`approval must name PR #${prNumber}`);
  }

  if (!expectedHead || !lowerText.includes(expectedHead.toLowerCase())) {
    reasons.push('approval must include the expected head SHA');
  }

  if (!approvalNamesGreenChecks(lowerText)) {
    reasons.push('approval must condition merge on green/passing checks');
  }

  if (!approvalNamesUnchangedHead(lowerText)) {
    reasons.push('approval must condition merge on the head SHA staying unchanged');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

function approvalNamesPr(text, prNumber) {
  if (!Number.isInteger(Number(prNumber)) || Number(prNumber) <= 0) {
    return false;
  }

  return new RegExp(`\\bpr\\s*#?\\s*${prNumber}\\b`, 'iu').test(text);
}

function approvalNamesGreenChecks(lowerText) {
  return (
    /\b(checks?|ci)\b.*\b(green|pass(?:ing|ed)?|success(?:ful)?)\b/u.test(lowerText) ||
    /\b(green|pass(?:ing|ed)?|success(?:ful)?)\b.*\b(checks?|ci)\b/u.test(lowerText)
  );
}

function approvalNamesUnchangedHead(lowerText) {
  return (
    /\b(head|sha|expected head)\b.*\b(unchanged|same|matches?)\b/u.test(lowerText) ||
    /\b(unchanged|same|matches?)\b.*\b(head|sha|expected head)\b/u.test(lowerText)
  );
}
