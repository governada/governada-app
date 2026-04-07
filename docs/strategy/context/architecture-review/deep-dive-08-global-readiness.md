# Deep Dive 08 - Global Readiness

**Status:** Completed
**Started:** 2026-04-07
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify that locale handling, timezone behavior, accessibility/mobile resilience, and privacy/legal baselines are explicit enough for real-world international use.

## Scope

This pass focuses on the app surfaces that tend to work in one market by accident and then break globally:

- locale resolution, language chrome, and document `lang` / `dir` ownership
- timezone and number/date formatting consistency
- mobile and accessibility expectations that matter outside a narrow desktop happy path
- privacy, analytics, and legal disclosure baselines for production traffic

## Evidence Collected

- `app/layout.tsx`
- `app/embed/layout.tsx`
- `components/providers/LocaleProvider.tsx`
- `components/governada/GovernadaShell.tsx`
- `components/governada/LegalLinks.tsx`
- `lib/i18n/config.ts`
- `lib/i18n/format.ts`
- `components/Providers.tsx`
- `lib/posthog.ts`
- `components/hub/CitizenHub.tsx`
- `components/hub/WorkspaceRationalesPage.tsx`
- `components/admin/IntegrityDashboard.tsx`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- searches across `app/`, `components/`, and `lib/` for locale/time formatting and privacy/legal surfaces

## Findings

### 1. Locale support existed, but the document shell was still hardcoded to English until hydration

**Severity:** Fixed in this worktree

**Evidence**

- `lib/i18n/config.ts` already defined `SUPPORTED_LOCALES`, `RTL_LOCALES`, and `parseAcceptLanguage()`, but `parseAcceptLanguage()` was not used anywhere in the route shell.
- `app/layout.tsx` and `app/embed/layout.tsx` previously rendered `<html lang="en">` regardless of locale cookie or request headers.
- `components/providers/LocaleProvider.tsx` was the first place that applied locale and direction, which meant the initial server render still shipped with English/LTR defaults.
- This worktree now resolves locale server-side through `resolvePreferredLocale()` and threads it into both root layouts plus `LocaleProvider`.

**Why it matters**

Language and direction are document-level contracts. Pushing them to client hydration creates the wrong first paint for non-English or RTL users and weakens both accessibility and search/share metadata.

### 2. Date and number formatting still rely on scattered ambient locale calls and hardcoded `en-US`

**Severity:** Fixed in this worktree

**Evidence**

- The codebase has many direct `toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` calls with no shared formatting policy.
- Several user-facing surfaces hardcode `en-US`, including:
  - `components/globe/TemporalScrubber.tsx`
  - `components/hub/CitizenHub.tsx`
  - `components/hub/DelegationHealthSummary.tsx`
  - `components/hub/WorkspaceRationalesPage.tsx`
  - `components/notifications/InboxFeed.tsx`
  - `components/treasury/TreasuryPersonalImpact.tsx`
- Other surfaces use ambient browser locale with no timezone labeling, including `components/ui/AsyncContent.tsx` and `components/admin/IntegrityDashboard.tsx`.
- This worktree now introduces `lib/i18n/format.ts` and moves the first shared/public surfaces onto it:
  - `components/ui/AsyncContent.tsx`
  - `components/globe/TemporalScrubber.tsx`
  - `components/hub/DelegationHealthSummary.tsx`
  - `components/notifications/InboxFeed.tsx`
  - `components/treasury/TreasuryPersonalImpact.tsx`
  - `components/hub/CitizenHub.tsx`
  - `components/hub/WorkspaceRationalesPage.tsx`
  - `components/admin/IntegrityDashboard.tsx`

**Why it matters**

The app currently has no single answer for whether dates and numbers should follow selected language, browser locale, Cardano-governance conventions, or an explicit timezone policy. That leads to inconsistent formatting across routes and makes support/debugging harder for global users.

### 3. The privacy/legal baseline is not explicit even though analytics can initialize on page load

**Severity:** Fixed in this worktree

**Evidence**

- There were no dedicated `/privacy`, `/terms`, or similar legal-policy routes under `app/`.
- `components/Providers.tsx` calls `initPostHog()` on mount.
- `lib/posthog.ts` initializes analytics when `NEXT_PUBLIC_POSTHOG_KEY` is present and enables `capture_pageview` plus `capture_pageleave`.
- The shared shell footer did not expose any privacy or terms links.
- This worktree now adds public `app/privacy/page.tsx` and `app/terms/page.tsx` routes, footer discoverability via `components/governada/LegalLinks.tsx`, and browser Do Not Track handling in `lib/posthog.ts`.

**Why it matters**

Global readiness is not only translation and mobile. If analytics is active in production, the app needs an explicit, discoverable privacy/legal baseline that matches that behavior.

## Risk Ranking

No open DD08 findings remain. Follow-up localization or legal work should now be treated as explicit product expansion rather than as an unresolved architecture-review gap.

## Handoff

**Current status:** Completed

**What changed this session**

- Added `resolvePreferredLocale()` in `lib/i18n/config.ts`.
- Updated `app/layout.tsx` and `app/embed/layout.tsx` to resolve locale from cookie plus `Accept-Language` before render and to set document `lang` / `dir` server-side.
- Updated `components/providers/LocaleProvider.tsx` to accept `initialLocale` so hydration preserves the server-selected locale instead of resetting to English.
- Added focused regression coverage in `__tests__/lib/i18n-config.test.ts`.
- Added `lib/i18n/format.ts` and moved the first public/global surfaces off hardcoded `en-US` or ambient time formatting in `AsyncContent`, `TemporalScrubber`, `DelegationHealthSummary`, `InboxFeed`, and `TreasuryPersonalImpact`.
- Finished the highest-traffic formatter rollout by moving `CitizenHub`, `WorkspaceRationalesPage`, and `IntegrityDashboard` onto the shared locale-aware formatter seam.
- Added focused regression coverage in `__tests__/lib/i18n-format.test.ts`.
- Added public `app/privacy/page.tsx` and `app/terms/page.tsx` routes.
- Added `components/governada/LegalLinks.tsx` and surfaced privacy/terms links plus analytics disclosure from the shared shell footer in `components/governada/GovernadaShell.tsx`.
- Updated `lib/posthog.ts` to respect browser Do Not Track before initializing analytics.
- Added focused verification coverage in `__tests__/components/LegalLinks.test.tsx` and `__tests__/lib/posthog.test.ts`.

**Verification**

- `npm run test:unit -- __tests__/lib/i18n-config.test.ts`
- `npm run test:unit -- __tests__/lib/i18n-config.test.ts __tests__/lib/i18n-format.test.ts`
- `npm run test:unit -- __tests__/lib/i18n-config.test.ts __tests__/lib/i18n-format.test.ts __tests__/lib/posthog.test.ts`
- `npm run test:component -- __tests__/components/LegalLinks.test.tsx`
- `npm run lint -- app/layout.tsx app/embed/layout.tsx components/providers/LocaleProvider.tsx lib/i18n/config.ts lib/i18n/format.ts components/ui/AsyncContent.tsx components/globe/TemporalScrubber.tsx components/hub/DelegationHealthSummary.tsx components/notifications/InboxFeed.tsx components/treasury/TreasuryPersonalImpact.tsx`
- `npm run lint -- components/hub/CitizenHub.tsx components/hub/WorkspaceRationalesPage.tsx components/admin/IntegrityDashboard.tsx lib/i18n/format.ts components/providers/LocaleProvider.tsx`
- `npm run lint -- components/governada/LegalLinks.tsx components/governada/GovernadaShell.tsx lib/posthog.ts app/privacy/page.tsx app/terms/page.tsx`
- `npm run type-check`
- `npm run agent:validate`

**Validated findings**

- Server-owned locale resolution was missing and is now fixed in this worktree.
- Shared formatting policy is now explicit enough for the highest-traffic public, workspace, and admin surfaces in scope for DD08.
- Privacy/legal disclosure is now discoverable from the shared shell, and analytics respects browser Do Not Track.

**Next agent starts here**

DD08 is closed. The architecture-review series is complete; the next work should move from review mode into backlog execution or PR packaging.
