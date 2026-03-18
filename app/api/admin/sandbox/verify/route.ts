/**
 * Admin Sandbox Verify API — run parity checks between sandbox and production.
 *
 * POST /api/admin/sandbox/verify
 *
 * Creates temporary test data in a sandbox cohort, verifies scoping rules
 * (visibility, isolation, production read access), then cleans up.
 * Returns pass/fail for each check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { SANDBOX_DESCRIPTION_PREFIX } from '@/lib/admin/sandbox';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

export const POST = withRouteHandler(
  async (_request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const startMs = Date.now();
    const supabase = getSupabaseAdmin();
    const checks: CheckResult[] = [];
    let testDraftId: string | null = null;
    let testReviewId: string | null = null;
    let testCohortId: string | null = null;
    let createdCohort = false;

    try {
      // ── Step 0: Get or create a temporary sandbox cohort ──────────────
      const { data: existing } = await supabase
        .from('preview_cohorts')
        .select('id')
        .eq('created_by', context.wallet)
        .like('description', `${SANDBOX_DESCRIPTION_PREFIX}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        testCohortId = existing.id;
      } else {
        const { data: newCohort, error: cohortErr } = await supabase
          .from('preview_cohorts')
          .insert({
            name: `Verify Parity — ${new Date().toISOString()}`,
            description: `${SANDBOX_DESCRIPTION_PREFIX} Temporary cohort for parity verification.`,
            created_by: context.wallet,
          })
          .select('id')
          .single();

        if (cohortErr || !newCohort) {
          return NextResponse.json(
            {
              passed: false,
              checks: [
                {
                  name: 'Cohort setup',
                  passed: false,
                  error: cohortErr?.message ?? 'Failed to create test cohort',
                },
              ],
              duration_ms: Date.now() - startMs,
            },
            { status: 500 },
          );
        }
        testCohortId = newCohort.id;
        createdCohort = true;
      }

      // ── Check 1: Draft creation scoped ────────────────────────────────
      try {
        const { data: draft, error: draftErr } = await supabase
          .from('proposal_drafts')
          .insert({
            title: '__parity_check_draft__',
            abstract: 'Automated parity verification — will be deleted.',
            motivation: 'Parity check',
            rationale: 'Parity check',
            owner_stake_address: context.wallet,
            preview_cohort_id: testCohortId,
            status: 'draft',
            proposal_type: 'Info',
          })
          .select('id')
          .single();

        if (draftErr || !draft) {
          checks.push({
            name: 'Draft creation scoped',
            passed: false,
            error: draftErr?.message ?? 'Insert returned no data',
          });
        } else {
          testDraftId = draft.id;
          checks.push({ name: 'Draft creation scoped', passed: true });
        }
      } catch (e) {
        checks.push({
          name: 'Draft creation scoped',
          passed: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // ── Check 2: Draft visible in cohort ──────────────────────────────
      if (testDraftId) {
        try {
          const { data: visible, error: visErr } = await supabase
            .from('proposal_drafts')
            .select('id')
            .eq('id', testDraftId)
            .eq('preview_cohort_id', testCohortId!)
            .maybeSingle();

          if (visErr) {
            checks.push({
              name: 'Draft visible in cohort',
              passed: false,
              error: visErr.message,
            });
          } else {
            checks.push({
              name: 'Draft visible in cohort',
              passed: !!visible,
              error: visible ? undefined : 'Draft not found when filtering by cohort',
            });
          }
        } catch (e) {
          checks.push({
            name: 'Draft visible in cohort',
            passed: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        checks.push({
          name: 'Draft visible in cohort',
          passed: false,
          error: 'Skipped — draft creation failed',
        });
      }

      // ── Check 3: Draft hidden outside cohort ──────────────────────────
      if (testDraftId) {
        try {
          // Query for the draft WITHOUT the cohort filter, but requiring
          // a different cohort ID. A properly scoped draft should only
          // appear when querying with its own cohort.
          const { data: leaked, error: leakErr } = await supabase
            .from('proposal_drafts')
            .select('id')
            .eq('id', testDraftId)
            .is('preview_cohort_id', null)
            .maybeSingle();

          if (leakErr) {
            checks.push({
              name: 'Draft hidden outside cohort',
              passed: false,
              error: leakErr.message,
            });
          } else {
            // If the draft shows up with preview_cohort_id IS NULL, scoping is broken
            checks.push({
              name: 'Draft hidden outside cohort',
              passed: !leaked,
              error: leaked
                ? 'Draft visible when querying with NULL cohort — scoping leak'
                : undefined,
            });
          }
        } catch (e) {
          checks.push({
            name: 'Draft hidden outside cohort',
            passed: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        checks.push({
          name: 'Draft hidden outside cohort',
          passed: false,
          error: 'Skipped — draft creation failed',
        });
      }

      // ── Check 4: Review on sandbox draft ──────────────────────────────
      if (testDraftId) {
        try {
          const { data: review, error: revErr } = await supabase
            .from('draft_reviews')
            .insert({
              draft_id: testDraftId,
              reviewer_stake_address: context.wallet,
              feedback_text: '__parity_check_review__',
              feedback_themes: [],
            })
            .select('id')
            .single();

          if (revErr || !review) {
            checks.push({
              name: 'Review on sandbox draft',
              passed: false,
              error: revErr?.message ?? 'Insert returned no data',
            });
          } else {
            testReviewId = review.id;
            checks.push({ name: 'Review on sandbox draft', passed: true });
          }
        } catch (e) {
          checks.push({
            name: 'Review on sandbox draft',
            passed: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        checks.push({
          name: 'Review on sandbox draft',
          passed: false,
          error: 'Skipped — draft creation failed',
        });
      }

      // ── Check 5: Production data readable ─────────────────────────────
      try {
        const { data: prodData, error: prodErr } = await supabase
          .from('proposals')
          .select('proposal_index')
          .limit(1)
          .maybeSingle();

        if (prodErr) {
          checks.push({
            name: 'Production data readable',
            passed: false,
            error: prodErr.message,
          });
        } else {
          checks.push({
            name: 'Production data readable',
            passed: !!prodData,
            error: prodData ? undefined : 'No production proposals found',
          });
        }
      } catch (e) {
        checks.push({
          name: 'Production data readable',
          passed: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      // ── Cleanup: delete test data in FK order ─────────────────────────
      if (testReviewId) {
        await supabase.from('draft_reviews').delete().eq('id', testReviewId);
      }
      if (testDraftId) {
        // Also delete any versions that may have been auto-created
        await supabase.from('proposal_draft_versions').delete().eq('draft_id', testDraftId);
        await supabase.from('proposal_drafts').delete().eq('id', testDraftId);
      }
      if (createdCohort && testCohortId) {
        await supabase.from('preview_cohorts').delete().eq('id', testCohortId);
      }
    }

    const passed = checks.every((c) => c.passed);
    const durationMs = Date.now() - startMs;

    logger.info('[admin/sandbox/verify] Parity check complete', {
      passed,
      checks: checks.map((c) => `${c.name}: ${c.passed ? 'PASS' : 'FAIL'}`),
      durationMs,
      wallet: context.wallet.slice(0, 20) + '...',
    });

    return NextResponse.json({ passed, checks, duration_ms: durationMs });
  },
  { auth: 'required' },
);
