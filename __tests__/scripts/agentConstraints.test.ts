import { describe, expect, it } from 'vitest';
import {
  analyzePrTemplateContract,
  validatePrTemplateContract,
  analyzeRouteRenderContract,
  validateRouteRenderContract,
} from '@/scripts/lib/agentConstraints.mjs';
import { getRouteRenderPolicy } from '@/scripts/lib/routeRenderPolicy.mjs';

describe('route render policy contract', () => {
  it('classifies the main route families explicitly', () => {
    expect(getRouteRenderPolicy('app/page.tsx')?.mode).toBe('public-dynamic-exception');
    expect(getRouteRenderPolicy('app/match/page.tsx')?.mode).toBe('public-dynamic-exception');
    expect(getRouteRenderPolicy('app/drep/[drepId]/page.tsx')?.mode).toBe(
      'public-dynamic-exception',
    );
    expect(getRouteRenderPolicy('app/workspace/page.tsx')?.mode).toBe('app-dynamic');
    expect(getRouteRenderPolicy('app/layout.tsx')?.mode).toBe('public-dynamic-exception');
  });

  it('allows public-cache routes to read cached governance data without force-dynamic', () => {
    const content =
      "import { getProposalByKey } from '@/lib/data';\nexport default async function Page() {}";

    expect(validateRouteRenderContract('app/governance/page.tsx', content)).toEqual([]);
  });

  it('treats extracted domain read seams as cached data for route policy checks', () => {
    const content =
      "import { getScoreHistory } from '@/lib/dreps/profileStats';\nexport default async function Page() {}";

    expect(validateRouteRenderContract('app/page.tsx', content)).toEqual([
      'app/page.tsx: classified as public-dynamic-exception in scripts/lib/routeRenderPolicy.mjs and touches cached/request-scoped runtime data, so it must export "export const dynamic = \'force-dynamic\'".',
    ]);
  });

  it('rejects request-scoped runtime reads in public-cache routes', () => {
    const content =
      "import { headers } from 'next/headers';\nexport default async function Page() { return (await headers()).get('x-test'); }";

    expect(validateRouteRenderContract('app/governance/page.tsx', content)).toEqual([
      'app/governance/page.tsx: classified as public-cache in scripts/lib/routeRenderPolicy.mjs but touches request-scoped APIs, direct Supabase/Redis clients, or raw env access.',
    ]);
  });

  it('requires force-dynamic for public dynamic exceptions that read cached data', () => {
    const content =
      "import { getProposalByKey } from '@/lib/data';\nexport default async function Page() {}";

    expect(validateRouteRenderContract('app/page.tsx', content)).toEqual([
      'app/page.tsx: classified as public-dynamic-exception in scripts/lib/routeRenderPolicy.mjs and touches cached/request-scoped runtime data, so it must export "export const dynamic = \'force-dynamic\'".',
    ]);
  });

  it('tracks the route analysis flags used by the top-level validator', () => {
    const content = [
      "import { cookies } from 'next/headers';",
      "import { getScoreHistory } from '@/lib/dreps/profileStats';",
      "export const dynamic = 'force-dynamic';",
      'export default async function Page() {',
      "  return (await cookies()).get('x-test')?.value ?? null;",
      '}',
    ].join('\n');

    expect(analyzeRouteRenderContract('app/page.tsx', content)).toMatchObject({
      relativePath: 'app/page.tsx',
      hasDynamicExport: true,
      usesCachedData: true,
      usesRequestScopedRuntime: true,
    });
  });
});

describe('PR template contract', () => {
  it('accepts the required ownership note fields and workflow gate', () => {
    const template = [
      '## Summary',
      '',
      '## Existing Code Audit',
      '',
      '## Ownership Note',
      '',
      '- **Seam extended**:',
      '- **Why this seam**:',
      '- **Hotspot touch**:',
    ].join('\n');
    const workflow = 'const requiredSections = ["## Summary", "## Ownership Note"];';

    expect(analyzePrTemplateContract(template, workflow)).toMatchObject({
      hasOwnershipSection: true,
      hasOwnershipSeamField: true,
      hasOwnershipReasonField: true,
      hasHotspotTouchField: true,
      workflowRequiresOwnershipSection: true,
    });
    expect(
      validatePrTemplateContract(
        '.github/PULL_REQUEST_TEMPLATE.md',
        template,
        '.github/workflows/pr-template.yml',
        workflow,
      ),
    ).toEqual([]);
  });

  it('rejects missing ownership-note requirements', () => {
    const template = ['## Summary', '', '## Existing Code Audit'].join('\n');
    const workflow = 'const requiredSections = ["## Summary"];';

    expect(
      validatePrTemplateContract(
        '.github/PULL_REQUEST_TEMPLATE.md',
        template,
        '.github/workflows/pr-template.yml',
        workflow,
      ),
    ).toEqual([
      '.github/PULL_REQUEST_TEMPLATE.md: missing required "## Ownership Note" section.',
      '.github/PULL_REQUEST_TEMPLATE.md: missing "**Seam extended**:" field in the ownership note.',
      '.github/PULL_REQUEST_TEMPLATE.md: missing "**Why this seam**:" field in the ownership note.',
      '.github/PULL_REQUEST_TEMPLATE.md: missing "**Hotspot touch**:" field in the ownership note.',
      '.github/workflows/pr-template.yml: PR template validation must require the "## Ownership Note" section.',
    ]);
  });
});
