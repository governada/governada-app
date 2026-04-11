import { describe, expect, it } from 'vitest';
import { buildNonceCsp, buildPublicCsp, pathnameNeedsNonceCsp } from '@/lib/security/csp';

describe('security csp helpers', () => {
  it('classifies app/private paths for nonce CSP', () => {
    expect(pathnameNeedsNonceCsp('/')).toBe(false);
    expect(pathnameNeedsNonceCsp('/match')).toBe(false);
    expect(pathnameNeedsNonceCsp('/drep/drep1')).toBe(false);
    expect(pathnameNeedsNonceCsp('/workspace')).toBe(true);
    expect(pathnameNeedsNonceCsp('/workspace/review')).toBe(true);
    expect(pathnameNeedsNonceCsp('/dev/vote-test')).toBe(true);
  });

  it('builds static public CSP without nonce semantics', () => {
    const csp = buildPublicCsp({ isDev: false });
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'strict-dynamic'");
    expect(csp).not.toContain("'nonce-");
  });

  it('builds nonce CSP with strict-dynamic semantics', () => {
    const csp = buildNonceCsp('abc123', { isDev: false });
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("'nonce-abc123'");
  });
});
