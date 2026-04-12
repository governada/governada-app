export const ROUTE_RENDER_MODES = Object.freeze([
  'public-cache',
  'public-dynamic-exception',
  'app-dynamic',
]);

export const ROUTE_RENDER_POLICIES = Object.freeze([
  {
    match: 'app/layout.tsx',
    mode: 'public-dynamic-exception',
    reason:
      'Root document shell stays request-bound so CSP nonces apply consistently to the public runtime.',
  },
  {
    match: 'app/page.tsx',
    mode: 'public-dynamic-exception',
    reason:
      'The homepage now owns canonical discovery and quick-match entry, so it remains request-bound.',
  },
  {
    match: 'app/match/page.tsx',
    mode: 'public-dynamic-exception',
    reason:
      'The legacy /match alias is a request-bound redirect into the canonical homepage workspace.',
  },
  {
    prefix: 'app/api/',
    mode: 'app-dynamic',
    reason: 'API routes remain request-scoped and infrastructure-owned.',
  },
  {
    prefix: 'app/admin/',
    mode: 'app-dynamic',
    reason: 'Admin routes are private and request-scoped by design.',
  },
  {
    prefix: 'app/workspace/',
    mode: 'app-dynamic',
    reason: 'Workspace routes are authenticated and request-scoped by design.',
  },
  {
    prefix: 'app/you/',
    mode: 'app-dynamic',
    reason: 'Personal routes are authenticated and request-scoped by design.',
  },
  {
    prefix: 'app/my-gov/',
    mode: 'app-dynamic',
    reason: 'Legacy personal routes stay request-scoped until fully removed.',
  },
  {
    prefix: 'app/claim/',
    mode: 'app-dynamic',
    reason: 'Claim flows are identity-bound and request-scoped.',
  },
  {
    prefix: 'app/preview/',
    mode: 'app-dynamic',
    reason: 'Preview routes are operator-facing and request-scoped.',
  },
  {
    prefix: 'app/dev/',
    mode: 'app-dynamic',
    reason: 'Developer test routes are non-cacheable diagnostics.',
  },
  {
    prefix: 'app/embed/',
    mode: 'public-dynamic-exception',
    reason: 'Embed surfaces still negotiate runtime theme and request-scoped presentation.',
  },
  {
    prefix: 'app/drep/',
    mode: 'public-dynamic-exception',
    reason:
      'Public DRep detail still assembles runtime server data and direct Supabase reads outside the cache-first contract.',
  },
  {
    prefix: 'app/proposal/',
    mode: 'public-dynamic-exception',
    reason:
      'Public proposal detail still performs runtime server-side data assembly outside the cache-first contract.',
  },
  {
    prefix: 'app/pool/',
    mode: 'public-dynamic-exception',
    reason:
      'Public pool detail still uses direct Supabase reads and remains outside the cache-first contract.',
  },
  {
    prefix: 'app/pulse/',
    mode: 'public-dynamic-exception',
    reason: 'Pulse routes still assemble live public runtime surfaces.',
  },
  {
    prefix: 'app/compare/',
    mode: 'public-dynamic-exception',
    reason: 'Comparison flows remain public but request-scoped.',
  },
  {
    prefix: 'app/developers/',
    mode: 'public-dynamic-exception',
    reason: 'Developer embed/docs surface still has runtime-only contracts.',
  },
  {
    prefix: 'app/engage/',
    mode: 'public-dynamic-exception',
    reason: 'Engagement route remains a public runtime experience.',
  },
  {
    prefix: 'app/share/',
    mode: 'public-dynamic-exception',
    reason: 'Share routes are public but still render request-bound experiences.',
  },
  {
    prefix: 'app/wrapped/',
    mode: 'public-dynamic-exception',
    reason: 'Wrapped share pages are public but remain request-scoped.',
  },
  {
    prefix: 'app/match/result/',
    mode: 'public-dynamic-exception',
    reason: 'Match result flow is public but request-specific.',
  },
  {
    prefix: 'app/match/vote/',
    mode: 'public-dynamic-exception',
    reason: 'Match vote flow is public but request-specific.',
  },
  {
    prefix: 'app/governance/briefing/',
    mode: 'public-dynamic-exception',
    reason: 'Governance briefing remains a public runtime surface.',
  },
  {
    prefix: 'app/governance/committee/',
    mode: 'public-dynamic-exception',
    reason: 'Committee detail/data routes still render public runtime surfaces.',
  },
  {
    prefix: 'app/governance/health/',
    mode: 'public-dynamic-exception',
    reason: 'Governance health detail routes still render public runtime surfaces.',
  },
  {
    prefix: 'app/governance/observatory/',
    mode: 'public-dynamic-exception',
    reason: 'Observatory remains a public runtime surface.',
  },
  {
    prefix: 'app/governance/report/',
    mode: 'public-dynamic-exception',
    reason: 'Epoch report routes are public but remain request-scoped.',
  },
  {
    prefix: 'app/',
    mode: 'public-cache',
    reason: 'Remaining public routes should move toward cache-first DB-backed reads.',
  },
]);

export function normalizeRoutePath(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

export function getRouteRenderPolicy(relativePath) {
  const normalized = normalizeRoutePath(relativePath);

  for (const rule of ROUTE_RENDER_POLICIES) {
    if ('match' in rule && normalized === rule.match) {
      return rule;
    }
    if ('prefix' in rule && normalized.startsWith(rule.prefix)) {
      return rule;
    }
  }

  return null;
}
