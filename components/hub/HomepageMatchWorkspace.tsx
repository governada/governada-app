'use client';

import { ArrowLeft, Sparkles } from 'lucide-react';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageViewTracker } from '@/components/PageViewTracker';
import { QuickMatchExperience } from '@/components/matching/QuickMatchExperience';
import { Button } from '@/components/ui/button';
import { encodeEntityParam } from '@/lib/homepage/parseEntityParam';
import type { MatchResult } from '@/hooks/useQuickMatch';

export function HomepageMatchWorkspace() {
  const router = useRouter();

  const handleClose = useCallback(() => {
    router.replace('/', { scroll: false });
  }, [router]);

  const handleInspectMatch = useCallback(
    (match: MatchResult) => {
      const entity = encodeEntityParam('drep', match.drepId);
      router.replace(`/?entity=${encodeURIComponent(entity)}`, { scroll: false });
    },
    [router],
  );

  return (
    <section
      className="relative isolate min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,0.92))]"
      data-testid="homepage-match-workspace"
      aria-label="Quick Match workspace"
      id="quick-match"
    >
      <PageViewTracker event="quick_match_page_viewed" discoveryEvent="quick_match_page_viewed" />

      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_32%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-sky-100">
              <Sparkles className="h-3.5 w-3.5" />
              Quick Match
            </span>
            <p className="text-sm text-slate-300">
              Compare your governance posture, then move directly into deeper discovery.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleClose}
            className="border-slate-700 bg-slate-900/75 text-slate-100 hover:bg-slate-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to discovery
          </Button>
        </div>

        <section className="grid gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/50 p-6 shadow-[0_40px_120px_-60px_rgba(8,47,73,0.95)] backdrop-blur sm:p-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-200/70">
              Homepage workspace
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold text-white sm:text-4xl">
              Find representatives that fit your governance instincts without leaving discovery.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              This is a discovery shortcut, not a final claim about identity. The shortlist stays
              visibly provisional until you add stronger evidence through real voting behavior.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center gap-2 text-slate-100">
              <ArrowLeft className="h-4 w-4 text-sky-300" />
              <p className="text-sm font-medium">What happens next</p>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <p>Answer four posture questions.</p>
              <p>Review the shortlist and inspect the best-fit DRep inside the homepage.</p>
              <p>Use real proposal voting to turn a baseline signal into a stronger profile.</p>
            </div>
          </div>
        </section>

        <QuickMatchExperience
          analyticsSource="homepage_match"
          onInspectMatch={handleInspectMatch}
        />
      </div>
    </section>
  );
}
