import { getRouteRenderPolicy, normalizeRoutePath } from './routeRenderPolicy.mjs';

const dynamicExport = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/;
const cachedDataUsage =
  /from\s+['"]@\/lib\/data['"]|from\s+['"]@\/lib\/data\/[^'"]+['"]|import\s*\(\s*['"]@\/lib\/data(?:\/[^'"]+)?['"]\s*\)/;
const requestScopedUsage =
  /process\.env\.[A-Z0-9_]+|from\s+['"]@\/lib\/(?:redis|supabase(?:[^'"]*)?)['"]|from\s+['"]@\/lib\/(?:redis|supabase(?:[^'"]*)?)\/[^'"]+['"]|from\s+['"]next\/headers['"]|(?:^|\W)(headers|cookies|draftMode|connection)\s*\(/m;

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
