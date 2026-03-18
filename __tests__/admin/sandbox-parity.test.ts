/**
 * Sandbox Write-Path Parity Tests
 *
 * Verifies that sandbox mode (X-Sandbox-Cohort header) uses identical code
 * paths to production — only the cohort filter differs. Tests cover:
 *
 * 1. Sandbox utility functions (getSandboxHeaders, constants)
 * 2. Architectural constraints (sandbox support wired in all write endpoints)
 * 3. SegmentProvider sandbox state management
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getSandboxHeaders,
  SANDBOX_DESCRIPTION_PREFIX,
  SANDBOX_STORAGE_KEY,
} from '@/lib/admin/sandbox';

// ---------------------------------------------------------------------------
// 1. Sandbox utility functions
// ---------------------------------------------------------------------------

describe('Sandbox Utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getSandboxHeaders', () => {
    it('returns empty object when running server-side (no window)', () => {
      // In Node test environment, window is undefined by default
      const headers = getSandboxHeaders();
      expect(headers).toEqual({});
    });

    it('returns empty object when no sandbox is active', () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('sessionStorage', {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      });

      const headers = getSandboxHeaders();
      expect(headers).toEqual({});
    });

    it('returns X-Sandbox-Cohort header when sandbox is active', () => {
      const cohortId = 'test-cohort-abc-123';
      vi.stubGlobal('window', {});
      vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => (key === SANDBOX_STORAGE_KEY ? cohortId : null),
        setItem: () => {},
        removeItem: () => {},
      });

      const headers = getSandboxHeaders();
      expect(headers).toEqual({ 'X-Sandbox-Cohort': cohortId });
    });

    it('returns empty object when sessionStorage throws', () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('sessionStorage', {
        getItem: () => {
          throw new Error('SecurityError: access denied');
        },
        setItem: () => {},
        removeItem: () => {},
      });

      const headers = getSandboxHeaders();
      expect(headers).toEqual({});
    });
  });

  describe('Constants', () => {
    it('SANDBOX_DESCRIPTION_PREFIX is the expected marker', () => {
      expect(SANDBOX_DESCRIPTION_PREFIX).toBe('[ADMIN_SANDBOX]');
    });

    it('SANDBOX_STORAGE_KEY is the expected key', () => {
      expect(SANDBOX_STORAGE_KEY).toBe('governada_sandbox');
    });

    it('SANDBOX_STORAGE_KEY matches the key used in getSandboxHeaders', () => {
      // Ensures the storage key constant is the same one getSandboxHeaders reads from
      const cohortId = 'verify-key-match';
      vi.stubGlobal('window', {});
      vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => (key === 'governada_sandbox' ? cohortId : null),
        setItem: () => {},
        removeItem: () => {},
      });

      const headers = getSandboxHeaders();
      expect(headers['X-Sandbox-Cohort']).toBe(cohortId);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Architectural constraints — verify sandbox wiring in endpoints
// ---------------------------------------------------------------------------

describe('Sandbox Architectural Constraints', () => {
  /**
   * These tests read source files to verify that sandbox support remains
   * wired into every write-path endpoint. If someone removes the sandbox
   * header check from an endpoint, these tests catch the regression.
   */

  it('drafts route reads x-sandbox-cohort header', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('app/api/workspace/drafts/route.ts', 'utf-8');

    // Both GET (read scoping) and POST (write scoping) must support sandbox
    expect(content).toContain('x-sandbox-cohort');
    expect(content).toContain('SANDBOX_DESCRIPTION_PREFIX');
  });

  it('drafts POST scopes writes to preview_cohort_id', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('app/api/workspace/drafts/route.ts', 'utf-8');

    // The write path must set preview_cohort_id when sandbox is active
    expect(content).toContain('preview_cohort_id');
    // Must verify sandbox cohort is a valid admin sandbox before writing
    expect(content).toContain('SANDBOX_DESCRIPTION_PREFIX');
  });

  it('reviews route has sandbox support for both read and write', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile(
      'app/api/workspace/drafts/[draftId]/reviews/route.ts',
      'utf-8',
    );

    // GET: sandbox scoping for reads
    expect(content).toContain('x-sandbox-cohort');
    // POST: sandbox validation for writes
    expect(content).toContain('SANDBOX_DESCRIPTION_PREFIX');
  });

  it('reviews POST validates sandbox cohort before allowing writes', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile(
      'app/api/workspace/drafts/[draftId]/reviews/route.ts',
      'utf-8',
    );

    // Must verify cohort description starts with SANDBOX_DESCRIPTION_PREFIX
    // Returns 403 if cohort is invalid — prevents arbitrary cohort header injection
    expect(content).toContain('Invalid sandbox cohort');
    expect(content).toContain('403');
  });

  it('sandbox utility module exports all required symbols', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('lib/admin/sandbox.ts', 'utf-8');

    // Must export the header builder function
    expect(content).toContain('export function getSandboxHeaders');
    // Must export the storage key constant
    expect(content).toContain('export const SANDBOX_STORAGE_KEY');
    // Must export the description prefix constant
    expect(content).toContain('export const SANDBOX_DESCRIPTION_PREFIX');
  });
});

// ---------------------------------------------------------------------------
// 3. SegmentProvider sandbox state
// ---------------------------------------------------------------------------

describe('SegmentProvider Sandbox Integration', () => {
  it('exports sandbox state fields', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('components/providers/SegmentProvider.tsx', 'utf-8');

    // State fields
    expect(content).toContain('sandboxCohortId');
    // Actions
    expect(content).toContain('enterSandbox');
    expect(content).toContain('exitSandbox');
  });

  it('SegmentProvider imports SANDBOX_STORAGE_KEY from sandbox module', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('components/providers/SegmentProvider.tsx', 'utf-8');

    // Must import the constant, not hardcode the string
    expect(content).toContain("from '@/lib/admin/sandbox'");
    expect(content).toContain('SANDBOX_STORAGE_KEY');
  });

  it('SegmentProvider persists sandbox state to sessionStorage', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('components/providers/SegmentProvider.tsx', 'utf-8');

    // enterSandbox must write to sessionStorage
    expect(content).toContain('sessionStorage.setItem(SANDBOX_STORAGE_KEY');
    // exitSandbox must clear sessionStorage
    expect(content).toContain('sessionStorage.removeItem(SANDBOX_STORAGE_KEY');
  });

  it('SegmentProvider restores sandbox state on mount', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('components/providers/SegmentProvider.tsx', 'utf-8');

    // Must read sessionStorage on mount to restore sandbox state across navigation
    expect(content).toContain('sessionStorage.getItem(SANDBOX_STORAGE_KEY');
  });

  it('SegmentState type includes sandbox fields', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('components/providers/SegmentProvider.tsx', 'utf-8');

    // Type definition must include sandbox fields
    expect(content).toContain('sandboxCohortId: string | null');
    expect(content).toContain('enterSandbox: (cohortId: string) => void');
    expect(content).toContain('exitSandbox: () => void');
  });
});

// ---------------------------------------------------------------------------
// 4. Write-path parity invariant
// ---------------------------------------------------------------------------

describe('Write-Path Parity Invariant', () => {
  /**
   * The key invariant: sandbox mode uses identical code paths to production.
   * Only the cohort filter differs. These tests verify this by checking that
   * sandbox endpoints do NOT have separate code branches for sandbox-specific
   * business logic — they only add a filter/tag.
   */

  it('drafts route uses same insert for sandbox and production (only adds preview_cohort_id)', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('app/api/workspace/drafts/route.ts', 'utf-8');

    // There should be exactly ONE insert call for proposal_drafts
    // (not a separate sandbox insert and production insert)
    const insertMatches = content.match(/\.insert\(/g);
    // One for drafts, one for versions = 2 total inserts
    expect(insertMatches).not.toBeNull();
    expect(insertMatches!.length).toBeLessThanOrEqual(2);

    // The insert should conditionally spread preview_cohort_id, not have a separate path
    expect(content).toContain('preview_cohort_id');
  });

  it('reviews route uses same insert for sandbox and production', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile(
      'app/api/workspace/drafts/[draftId]/reviews/route.ts',
      'utf-8',
    );

    // Should be exactly ONE insert for draft_reviews
    const insertMatches = content.match(/\.insert\(/g);
    expect(insertMatches).not.toBeNull();
    expect(insertMatches!.length).toBe(1);
  });

  it('drafts GET uses .or() filter for sandbox — not a separate query', async () => {
    const fs = await import('fs/promises');
    const content = await fs.readFile('app/api/workspace/drafts/route.ts', 'utf-8');

    // Sandbox read scoping uses .or() to combine sandbox + real data
    // rather than a completely different query
    expect(content).toContain('.or(');
    expect(content).toContain('preview_cohort_id.is.null');
  });
});
