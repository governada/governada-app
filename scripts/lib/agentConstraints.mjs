import { getRouteRenderPolicy, normalizeRoutePath } from './routeRenderPolicy.mjs';

const dynamicExport = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/;
const cachedDataUsage =
  /from\s+['"]@\/lib\/(?:data(?:\/[^'"]+)?|dreps\/profileStats)['"]|import\s*\(\s*['"]@\/lib\/(?:data(?:\/[^'"]+)?|dreps\/profileStats)['"]\s*\)/;
const requestScopedUsage =
  /process\.env\.[A-Z0-9_]+|from\s+['"]@\/lib\/(?:redis|supabase(?:[^'"]*)?)['"]|from\s+['"]@\/lib\/(?:redis|supabase(?:[^'"]*)?)\/[^'"]+['"]|from\s+['"]next\/headers['"]|(?:^|\W)(headers|cookies|draftMode|connection)\s*\(/m;
const ownershipSection = /^## Ownership Note$/m;
const ownershipSeamField = /\*\*Seam extended\*\*:/;
const ownershipReasonField = /\*\*Why this seam\*\*:/;
const hotspotTouchField = /\*\*Hotspot touch\*\*:/;
const workflowOwnershipSection = /["']## Ownership Note["']/;

export function analyzeRouteRenderContract(relativePath, content) {
  return {
    relativePath: normalizeRoutePath(relativePath),
    policy: getRouteRenderPolicy(relativePath),
    hasDynamicExport: dynamicExport.test(content),
    usesCachedData: cachedDataUsage.test(content),
    usesRequestScopedRuntime: requestScopedUsage.test(content),
  };
}

export function validateRouteRenderContract(relativePath, content) {
  const analysis = analyzeRouteRenderContract(relativePath, content);
  const errors = [];

  if (!analysis.policy) {
    errors.push(
      `${analysis.relativePath}: no render policy match found in scripts/lib/routeRenderPolicy.mjs.`,
    );
    return errors;
  }

  if (analysis.policy.mode === 'public-cache') {
    if (analysis.usesRequestScopedRuntime) {
      errors.push(
        `${analysis.relativePath}: classified as public-cache in scripts/lib/routeRenderPolicy.mjs but touches request-scoped APIs, direct Supabase/Redis clients, or raw env access.`,
      );
    }
    return errors;
  }

  if (
    (analysis.usesCachedData || analysis.usesRequestScopedRuntime) &&
    !analysis.hasDynamicExport
  ) {
    errors.push(
      `${analysis.relativePath}: classified as ${analysis.policy.mode} in scripts/lib/routeRenderPolicy.mjs and touches cached/request-scoped runtime data, so it must export "export const dynamic = 'force-dynamic'".`,
    );
  }

  return errors;
}

export function analyzePrTemplateContract(templateContent, workflowContent) {
  return {
    hasOwnershipSection: ownershipSection.test(templateContent),
    hasOwnershipSeamField: ownershipSeamField.test(templateContent),
    hasOwnershipReasonField: ownershipReasonField.test(templateContent),
    hasHotspotTouchField: hotspotTouchField.test(templateContent),
    workflowRequiresOwnershipSection: workflowOwnershipSection.test(workflowContent),
  };
}

export function validatePrTemplateContract(
  templatePath,
  templateContent,
  workflowPath,
  workflowContent,
) {
  const analysis = analyzePrTemplateContract(templateContent, workflowContent);
  const errors = [];

  if (!analysis.hasOwnershipSection) {
    errors.push(`${templatePath}: missing required "## Ownership Note" section.`);
  }

  if (!analysis.hasOwnershipSeamField) {
    errors.push(`${templatePath}: missing "**Seam extended**:" field in the ownership note.`);
  }

  if (!analysis.hasOwnershipReasonField) {
    errors.push(`${templatePath}: missing "**Why this seam**:" field in the ownership note.`);
  }

  if (!analysis.hasHotspotTouchField) {
    errors.push(`${templatePath}: missing "**Hotspot touch**:" field in the ownership note.`);
  }

  if (!analysis.workflowRequiresOwnershipSection) {
    errors.push(
      `${workflowPath}: PR template validation must require the "## Ownership Note" section.`,
    );
  }

  return errors;
}
