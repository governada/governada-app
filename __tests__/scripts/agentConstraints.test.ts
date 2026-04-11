import { describe, expect, it } from 'vitest';
import {
  analyzeRouteRenderContract,
  validateRouteRenderContract,
} from '@/scripts/lib/agentConstraints.mjs';
import { getRouteRenderPolicy } from '@/scripts/lib/routeRenderPolicy.mjs';

describe('route render policy contract', () => {
  it('classifies the main route families explicitly', () => {
    expect(getRouteRenderPolicy('app/page.tsx')?.mode).toBe('public-cache');
    expect(getRouteRenderPolicy('app/drep/[drepId]/page.tsx')?.mode).toBe(
      'public-dynamic-exception',
    );
    expect(getRouteRenderPolicy('app/workspace/page.tsx')?.mode).toBe('app-dynamic');
    // The root shell is now cache-first and should remain classified that way.
    expect(getRouteRenderPolicy('app/layout.tsx')?.mode).toBe('public-cache');
  });

  it('allows public-cache routes to read cached governance data without force-dynamic', () => {
    const content =
      "import { getProposalByKey } from '@/lib/data';\nexport default async function Page() {}";

    expect(validateRouteRenderContract('app/page.tsx', content)).toEqual([]);
  });

  it('rejects request-scoped runtime reads in public-cache routes', () => {
    const content =
      "import { headers } from 'next/headers';\nexport default async function Page() { return (await headers()).get('x-test'); }";

    expect(validateRouteRenderContract('app/page.tsx', content)).toEqual([
      'app/page.tsx: classified as public-cache in scripts/lib/routeRenderPolicy.mjs but touches request-scoped APIs, direct Supabase/Redis clients, or raw env access.',
    ]);
  });

  it('requires force-dynamic for public dynamic exceptions that read cached data', () => {
    const content =
      "import { getProposalByKey } from '@/lib/data';\nexport default async function Page() {}";

    expect(validateRouteRenderContract('app/proposal/[txHash]/[index]/page.tsx', content)).toEqual([
      'app/proposal/[txHash]/[index]/page.tsx: classified as public-dynamic-exception in scripts/lib/routeRenderPolicy.mjs and touches cached/request-scoped runtime data, so it must export "export const dynamic = \'force-dynamic\'".',
    ]);
  });

  it('tracks the route analysis flags used by the top-level validator', () => {
    const content = [
      "import { cookies } from 'next/headers';",
      "import { getVotesByProposal } from '@/lib/data';",
      "export const dynamic = 'force-dynamic';",
      'export default async function Page() {',
      "  return (await cookies()).get('x-test')?.value ?? null;",
      '}',
    ].join('\n');

    expect(
      analyzeRouteRenderContract('app/proposal/[txHash]/[index]/page.tsx', content),
    ).toMatchObject({
      relativePath: 'app/proposal/[txHash]/[index]/page.tsx',
      hasDynamicExport: true,
      usesCachedData: true,
      usesRequestScopedRuntime: true,
    });
  });
});
