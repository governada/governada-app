# World-Class Quality Packages

> **Created:** 2026-03-07
> **Purpose:** Close the gap from 84/100 (feature-complete) to 95+/100 (world-class). These are not feature gaps -- they are quality, validation, accessibility, and UX maturity gaps. A platform representing Cardano's governance to the world must meet the highest standard in every dimension.
> **Prerequisite:** All 15 vision parity WPs (work-packages.md) are SHIPPED.
> **Tracking:** Each QP is a focused unit of work. Ship as indicated by PR grouping. Agents should expand on implementation details before executing.

---

## Status Overview

| QP    | Name                                      | Category       | Status  | PR Group | PR  |
| ----- | ----------------------------------------- | -------------- | ------- | -------- | --- |
| QP-1  | Accessibility foundation                  | Accessibility  | PENDING | A        |     |
| QP-2  | Accessibility interactive components      | Accessibility  | PENDING | A        |     |
| QP-3  | Core algorithm test suite                 | Validation     | PENDING | B        |     |
| QP-4  | Error recovery + resilience               | UX Quality     | PENDING | C        |     |
| QP-5  | Scoring calibration validation            | Algorithmic    | PENDING | D        |     |
| QP-6  | PCA / dimension reconciliation            | Algorithmic    | PENDING | D        |     |
| QP-7  | Animation system + micro-interactions     | UX Polish      | PENDING | E        |     |
| QP-8  | Onboarding education layer                | UX Quality     | PENDING | E        |     |
| QP-9  | Civic identity elevation                  | UX + Product   | PENDING | F        |     |
| QP-10 | Engagement feedback loop                  | Product        | PENDING | G        |     |
| QP-11 | Engagement integrity (anti-spam + quorum) | Product        | PENDING | G        |     |
| QP-12 | Citizen endorsements (7th mechanism)      | Product        | PENDING | H        |     |
| QP-13 | Load testing + performance validation     | Infrastructure | PENDING | I        |     |

---

## Sequencing & Dependencies

```
PR Group A (QP-1, QP-2)  ─── no deps, start immediately
PR Group B (QP-3)         ─── no deps, start immediately, parallel with A
PR Group C (QP-4)         ─── no deps, start immediately, parallel with A+B
PR Group D (QP-5, QP-6)  ─── depends on QP-3 (tests must exist before refactoring algorithms)
PR Group E (QP-7, QP-8)  ─── depends on QP-1 (animations must be accessible)
PR Group F (QP-9)         ─── depends on QP-1, QP-7 (accessible + animated components)
PR Group G (QP-10, QP-11) ─── no hard deps, but benefits from QP-4 (error recovery patterns)
PR Group H (QP-12)        ─── depends on QP-11 (endorsements need credibility weighting from day one)
PR Group I (QP-13)        ─── depends on all other QPs (validate final state)
```

**Parallelization opportunities:**

- PR Groups A, B, C can all run simultaneously (3 agents)
- PR Groups D and E can run simultaneously once their deps are met
- PR Group G can start as soon as Group C finishes (or in parallel with D/E)

---

## PR Group A: Accessibility (QP-1 + QP-2)

### QP-1: Accessibility Foundation

**Problem:** ~5 accessibility patterns across 66+ governada components. No systematic aria usage, no keyboard navigation, no focus management, no screen reader optimization. A governance platform that excludes users with disabilities cannot claim to represent an inclusive ecosystem.

**Goal:** Establish accessibility infrastructure and remediate all static/presentational components. Target WCAG 2.1 AA compliance.

**Scope:**

1. **Accessibility audit tooling**
   - Add `eslint-plugin-jsx-a11y` to ESLint config (may already be partial -- verify and ensure all rules are `error` not `warn`)
   - Add `@axe-core/playwright` to E2E test suite for automated a11y checks
   - Create a Playwright a11y smoke test that runs axe-core against key pages: `/`, `/discover`, `/match`, `/engage`, `/my-gov`, `/pulse`, at least one `/drep/[id]` and `/proposal/[tx]/[i]` page
   - Fix all violations surfaced by the new linting rules

2. **Global focus management**
   - Ensure all interactive elements have visible `:focus-visible` styles (check Tailwind config -- may need `focus-visible:ring-2 focus-visible:ring-primary` as a base pattern)
   - Add skip-to-content link in root layout (`app/layout.tsx`)
   - Ensure proper `<main>`, `<nav>`, `<header>`, `<footer>` landmark usage in layout components
   - Verify tab order is logical in the main navigation and sidebar

3. **Color contrast audit**
   - Verify all text/background combinations meet WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text)
   - Pay special attention to: muted-foreground on card backgrounds, badge text, chart labels, score tier colors
   - Check both light and dark themes

4. **Image and icon accessibility**
   - Audit all `<img>` tags for meaningful `alt` text (not empty string on informational images)
   - Decorative icons (lucide-react) in buttons: ensure parent has `aria-label` and icon has `aria-hidden="true"`
   - Chart visualizations: add `role="img"` with `aria-label` describing the data pattern (e.g., "Score trend chart showing improvement from 62 to 78 over 10 epochs")

**Key files to audit:**

- `app/layout.tsx`, `app/(main)/layout.tsx` -- landmarks, skip-to-content
- `components/ui/` -- all shadcn primitives (verify Radix a11y defaults are preserved)
- `components/governada/shared/` -- shared components used everywhere
- All chart components in `components/charts/` or similar -- these are the hardest to make accessible
- Navigation components: sidebar, mobile nav, command palette

**Verification:** Run `npx playwright test --grep a11y` and achieve 0 critical/serious violations on all key pages.

---

### QP-2: Accessibility Interactive Components

**Problem:** Interactive components (tabs, modals, carousels, forms, vote casting) lack proper ARIA roles, states, and keyboard interaction patterns.

**Goal:** All interactive components follow WAI-ARIA Authoring Practices. Every user flow is completable via keyboard alone.

**Scope:**

1. **Tab interfaces**
   - `GovernadaDiscover` tabs (`/discover`): add `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`
   - DRep/SPO profile tabs: same pattern
   - Keyboard: Arrow keys navigate between tabs, Tab moves into panel content

2. **Modal and dialog accessibility**
   - Wallet connect modal: focus trap, `aria-modal="true"`, `role="dialog"`, `aria-labelledby`
   - Vote casting panel: same pattern when expanded
   - Share modal: same pattern
   - Ensure Escape closes all modals, focus returns to trigger element

3. **Form and input accessibility**
   - Quick Match flow: `aria-current="step"` on active step indicator, `aria-live="polite"` on results loading
   - Sentiment voting: `role="radiogroup"` with `role="radio"` for Support/Oppose/Unsure
   - Priority signals: accessible drag-and-drop alternative (up/down arrow buttons already exist -- verify `aria-label` on each)
   - Concern flags: `role="checkbox"` or toggle button pattern with `aria-pressed`
   - Rationale editor: `aria-label`, character count as `aria-live="polite"` region

4. **Live regions for dynamic content**
   - Epoch Briefing: `aria-live="polite"` on swipeable section content when section changes
   - Vote submission timeline: `aria-live="assertive"` on phase changes (building → signing → submitting)
   - Match results: `aria-live="polite"` when results load after questions
   - Toast notifications: ensure they're in an `aria-live` region (check shadcn toast component)
   - Score gauges: `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`

5. **Reduced motion support**
   - Check all Framer Motion animations (EpochBriefing swipe, celebration overlays) respect `prefers-reduced-motion`
   - Add `motion-reduce:` Tailwind variants where CSS transitions are used
   - Framer Motion: wrap animated components with `useReducedMotion()` hook

**Key files to modify:**

- `components/governada/match/QuickMatchFlow.tsx` -- step indicator, results loading
- `components/governada/proposals/VoteCastingPanel.tsx` or `VoteRationaleFlow.tsx` -- form roles
- `components/engagement/ProposalSentiment.tsx` -- radiogroup
- `components/engagement/PrioritySignals.tsx` -- drag alternative
- `components/engagement/ConcernFlags.tsx` -- toggle buttons
- `components/governada/home/EpochBriefing.tsx` -- live regions on carousel
- `components/ui/dialog.tsx`, `components/ui/tabs.tsx` -- verify Radix defaults

**Verification:** Complete every user flow using keyboard only (no mouse). Verify with VoiceOver (Mac) or NVDA (Windows) that all state changes are announced.

---

## PR Group B: Core Algorithm Test Suite (QP-3)

### QP-3: Core Algorithm Test Suite

**Problem:** ~35% coverage on critical scoring/alignment/GHI code paths. Core algorithms that determine DRep scores for 700+ representatives have no edge case tests. One bad merge could silently corrupt scores with no automated detection.

**Goal:** 80%+ line coverage on `lib/scoring/`, `lib/alignment/`, `lib/ghi/`, `lib/matching/`. Every public function tested with happy path + edge cases.

**Scope:**

1. **Scoring engine tests** (`__tests__/scoring/`)
   - Test `computeEngagementQuality()`:
     - Happy path: 10 DReps, 20 proposals, mixed votes/rationales
     - Edge: DRep with 0 votes, DRep with 1 vote, DRep who voted on every proposal
     - Edge: All votes same direction (rubber-stamp detection)
     - Edge: All rationales scored 0 by AI, all scored 100
     - Temporal: Verify decay -- vote from 180 days ago should contribute ~50% weight
   - Test `computeEffectiveParticipation()`:
     - Happy path, edge cases for importance weighting
     - Treasury proposal with 0 ADA vs 100M ADA (log-scale verification)
     - Close-margin proposals (verify 1.5x bonus)
   - Test `computeReliability()`:
     - Streak calculation, gap penalty, responsiveness
     - Edge: DRep registered but never voted
     - Edge: DRep with perfect streak then sudden inactivity
   - Test `computeGovernanceIdentity()`:
     - Profile quality scoring (field completeness)
     - Edge: Empty profile, fully complete profile
   - Test `computeDRepScoreV3()` (integration):
     - Full pipeline with realistic data (50+ DReps, 30+ proposals)
     - Verify percentile normalization produces expected distribution
     - Verify tier assignment matches score ranges
     - Snapshot: Store expected output for regression detection

2. **SPO scoring tests** (`__tests__/scoring/spo-v3/`)
   - Same pattern as DRep but covering SPO-specific metrics:
     - Engagement consistency (CV of votes-per-epoch)
     - Vote timing distribution (StdDev sweet spot at 3 days)
     - Proposal coverage entropy (Shannon)
     - Confidence-weighted percentile normalization

3. **Alignment engine tests** (`__tests__/alignment/`)
   - Test PCA computation (`pca.ts`):
     - Known vote matrix → known principal components (use textbook example)
     - Edge: Single DRep, single proposal, empty matrix
     - Verify explained variance sums correctly
   - Test dimension scoring (`dimensions.ts`):
     - Each dimension independently with controlled inputs
     - Verify scores are 0-100 bounded
   - Test vote matrix construction (`voteMatrix.ts`):
     - Sparse matrix handling
     - Temporal + amount weighting verification
     - Mean imputation correctness

4. **GHI + EDI tests** (`__tests__/ghi/`)
   - Test each EDI metric independently (`ediMetrics.ts`):
     - Nakamoto coefficient: known power distributions → known answers
     - Gini coefficient: perfect equality (0), perfect inequality (1), realistic distribution
     - Shannon entropy: uniform distribution (max entropy), single holder (0)
     - HHI: same patterns
     - Theil index: same patterns
   - Test calibration curves (`calibration.ts`):
     - Verify piecewise linear interpolation at each breakpoint
     - Verify boundary behavior (below floor, above ceiling)
   - Test GHI composite (`components.ts`):
     - Verify weight redistribution when citizen engagement is disabled
     - Edge: All components at 0, all at 100, mixed

5. **Matching engine tests** (`__tests__/matching/`)
   - Test confidence calculation with various source combinations
   - Test dimension agreement thresholds (agree ≥70, differ <40)
   - Test user profile projection into PCA space

**Key test infrastructure:**

- Use Vitest fixtures for realistic test data (DRep voting records, proposal sets)
- Create `__tests__/fixtures/` with reusable mock data generators
- Add `npm run test:scoring` script for targeted test runs
- Consider snapshot tests for regression detection on score outputs

**Verification:** `npm run test -- --coverage` shows 80%+ on `lib/scoring/`, `lib/alignment/`, `lib/ghi/`, `lib/matching/`.

---

## PR Group C: Error Recovery + Resilience (QP-4)

### QP-4: Error Recovery + Resilience

**Problem:** Async failures surface as gray text with no retry mechanism. No graceful degradation. No offline detection. A citizen who opens Governada during a Koios outage sees a broken page with no explanation.

**Goal:** Every async surface has a complete loading → content → error lifecycle with retry and graceful degradation.

**Scope:**

1. **Error boundary system**
   - Create `components/ui/ErrorBoundary.tsx` if not already robust:
     - Catches render errors, shows friendly message + retry button
     - Reports to Sentry with component tree context
     - "Try again" resets error state and re-renders children
   - Add `error.tsx` files in key route groups:
     - `app/(main)/error.tsx` -- main layout error boundary
     - `app/(main)/discover/error.tsx`
     - `app/(main)/my-gov/error.tsx`
     - `app/(main)/engage/error.tsx`
     - Each should show context-appropriate message + "Go home" + "Try again"

2. **Async component resilience pattern**
   - Create a reusable `AsyncContent` wrapper (or enhance existing patterns):
     ```
     <AsyncContent query={briefingQuery} skeleton={<BriefingSkeleton />}
       errorFallback={<BriefingError onRetry={refetch} lastUpdated={dataUpdatedAt} />}>
       {(data) => <BriefingContent data={data} />}
     </AsyncContent>
     ```
   - Apply to all TanStack Query consumer components, prioritizing:
     - `EpochBriefing` -- the primary citizen surface
     - `QuickMatchFlow` -- the conversion funnel
     - `VoteRationaleFlow` -- active governance operations
     - `SPOCommandCenter` / `DRepCommandCenter` -- workspace dashboards
     - `ProposalSentiment` and other engagement components

3. **Retry with context**
   - Error states should show:
     - What failed ("Couldn't load your briefing")
     - When it last worked ("Last updated: Epoch 499, 3 hours ago") using TanStack Query `dataUpdatedAt`
     - Action ("Try again" button calling `refetch()`)
     - Stale data option: if `staleData` exists in query cache, show it with a "Data may be outdated" banner rather than empty screen
   - Configure TanStack Query defaults in `Providers.tsx`:
     - `retry: 2` with exponential backoff
     - `staleTime` appropriate per query type (briefing: 5min, scores: 15min, engagement: 2min)
     - `gcTime` long enough that stale data persists during outages

4. **Network status awareness**
   - Create `hooks/useNetworkStatus.ts`:
     - Monitor `navigator.onLine` + periodic health check to `/api/health`
     - When offline: show persistent banner "You're offline. Showing cached data."
     - When back online: auto-refetch stale queries
   - Integrate into `Providers.tsx` or root layout

5. **Partial failure handling**
   - For pages that fetch multiple queries (e.g., DRep profile: score + votes + alignment + engagement):
     - Render available sections, show individual error states for failed sections
     - Don't let one failed query blank the entire page
   - For engagement actions (sentiment vote, concern flag):
     - Optimistic update: show the action immediately
     - If server rejects: revert with explanation toast
     - Queue failed actions for retry (or at minimum, clear feedback that it didn't save)

**Key files to modify:**

- `components/Providers.tsx` -- TanStack Query defaults
- `components/governada/home/EpochBriefing.tsx` -- primary error handling target
- `components/governada/match/QuickMatchFlow.tsx` -- conversion funnel resilience
- `components/governada/proposals/VoteRationaleFlow.tsx` -- vote operation resilience
- `app/(main)/error.tsx` and route-group error files -- new
- `hooks/useNetworkStatus.ts` -- new

**Verification:** Simulate offline/error conditions (browser DevTools network throttling, mock server errors) and verify every key page degrades gracefully with retry options.

---

## PR Group D: Algorithmic Validation (QP-5 + QP-6)

> **Depends on:** QP-3 (tests must exist before refactoring algorithms)

### QP-5: Scoring Calibration Validation

**Problem:** All scoring thresholds (floor, targetLow, targetHigh, ceiling) and weights (35/25/25/15) are hand-tuned with no documented validation against real Cardano data. If real distributions don't match assumptions, scores are systematically biased.

**Goal:** Validate all calibration parameters against production data. Document the rationale for every threshold. Adjust where data shows misalignment.

**Scope:**

1. **Data extraction script**
   - Create `scripts/calibration-analysis.ts` (run locally against production Supabase read-only):
     - Extract current DRep score distributions (all pillars, raw + normalized)
     - Extract SPO score distributions
     - Extract GHI component raw values vs calibrated scores
     - Extract EDI metric distributions
     - Output as JSON for analysis

2. **Distribution analysis**
   - For each scoring pillar, compute and document:
     - Mean, median, P10, P25, P75, P90 of raw scores
     - Current calibration curve mapping
     - Whether the calibration produces a reasonable score distribution (not all bunched at top or bottom)
     - Recommended threshold adjustments if distribution is skewed
   - For GHI calibration curves specifically:
     - DRep Participation: What IS the actual participation rate? Does floor=20, targetLow=40, targetHigh=70, ceiling=90 make sense?
     - Deliberation Quality: What IS the actual rationale provision rate?
     - Decision Velocity: What IS the actual epoch-to-ratification time?
     - Document all findings

3. **Weight sensitivity analysis**
   - For DRep scoring (35/25/25/15 weights):
     - Compute score rankings under 5 alternative weight schemes
     - Identify DReps whose rank changes significantly (>20 positions) under different weights
     - Document which weight scheme best separates "clearly good" from "clearly bad" DReps (using known examples if available)
   - Same analysis for SPO scoring and GHI components

4. **Calibration documentation**
   - Create `docs/methodology/calibration.md`:
     - Current thresholds with data-backed justification for each
     - Distribution plots (or data tables) showing how scores map
     - Sensitivity analysis results
     - Recommended review cadence (every 50 epochs or 3 months)

5. **Threshold configuration extraction**
   - Move all hardcoded magic numbers into a calibration config:
     - `lib/scoring/calibration.ts` -- single source of truth for all thresholds
     - Makes future recalibration a config change, not a code change
     - Existing tests (QP-3) should validate config values produce expected results

**Key files to modify:**

- `lib/scoring/drepScoreV3.ts` -- extract thresholds to config
- `lib/scoring/spoScoreV3.ts` -- extract thresholds to config
- `lib/ghi/calibration.ts` -- validate and document thresholds
- `lib/ghi/components.ts` -- extract weights to config
- New: `scripts/calibration-analysis.ts`
- New: `docs/methodology/calibration.md`

**Verification:** Every threshold has a documented rationale referencing actual data distributions. No magic numbers remain in scoring functions.

---

### QP-6: PCA / Dimension Reconciliation

**Problem:** Two alignment systems exist independently:

1. PCA coordinates from SVD on the vote matrix (used for matching)
2. Six manual dimension scores computed per DRep (used for radar display)

These are not reconciled. A DRep's PCA position may contradict their manual dimension scores. This undermines trust in both systems.

**Goal:** Single source of truth for alignment dimensions. PCA and display dimensions must derive from the same computation.

**Scope:**

1. **Audit current state**
   - Document exactly how PCA coordinates are computed (`lib/alignment/pca.ts`)
   - Document exactly how manual dimensions are computed (`lib/alignment/dimensions.ts`)
   - For 10 sample DReps, compare: PCA component 1 value vs Treasury Conservative score. Are they correlated? Contradictory?
   - Document findings

2. **Reconciliation strategy** (choose one, document rationale):
   - **Option A: PCA-first** -- Use PCA components as the authoritative dimensions. Label them based on loading analysis. Remove manual dimension computation. Display PCA-derived scores on radars.
     - Pro: Mathematically principled, data-driven
     - Con: Labels may not be intuitive, components may not map cleanly to governance concepts
   - **Option B: Domain-first** -- Keep the 6 named dimensions as authoritative. Replace PCA matching with cosine similarity on manual dimension vectors.
     - Pro: Clear, intuitive labels. Governance experts can reason about scores.
     - Con: Dimensions may be correlated (redundant), not empirically validated
   - **Option C: Hybrid** -- Use PCA for matching (it captures real voting patterns) but project PCA results back into named dimensions using loadings. Display the projections.
     - Pro: Best of both worlds
     - Con: More complex, projection may introduce noise

3. **Implement chosen strategy**
   - Refactor `lib/alignment/` to produce one set of dimension scores per DRep
   - Update matching to use the reconciled dimensions
   - Update radar display components to use the same data
   - Ensure user profile projection is consistent

4. **Explained variance enforcement**
   - Add a minimum explained variance threshold (e.g., 60%) for PCA results
   - If 6 components explain less than threshold, log a warning and fall back to manual dimensions
   - Display explained variance in admin dashboard for monitoring

**Key files to modify:**

- `lib/alignment/pca.ts` -- core computation
- `lib/alignment/dimensions.ts` -- manual computation
- `lib/alignment/normalize.ts` -- dimension normalization
- `lib/matching/dimensionAgreement.ts` -- matching integration
- `lib/matching/userProfile.ts` -- user projection
- Radar display components (GovernanceRadar, etc.)

**Verification:** For 20 sample DReps, the dimension scores displayed on their profile radar match the scores used to compute their match rank for any given user. No contradictions.

---

## PR Group E: UX Polish (QP-7 + QP-8)

> **Depends on:** QP-1 (animations must be accessible -- `prefers-reduced-motion` support)

### QP-7: Animation System + Micro-Interactions

**Problem:** Transitions are utilitarian Tailwind defaults (200ms fade). No entrance animations, no celebration feedback, no stagger on list items, no optimistic updates. The product is functional but not delightful. Users don't feel rewarded for participation.

**Goal:** Establish an animation system and apply it to the 10 highest-impact surfaces. Every user action gets sub-200ms visual feedback. Key moments (first delegation, milestone, vote cast) feel celebratory.

**Scope:**

1. **Animation system setup**
   - Create `lib/animations.ts` (or `lib/motion.ts`):
     - Standard timing tokens: `DURATION_FAST = 150`, `DURATION_NORMAL = 250`, `DURATION_SLOW = 400`
     - Standard easing: `EASE_OUT = [0.16, 1, 0.3, 1]` (spring-like), `EASE_IN_OUT = [0.42, 0, 0.58, 1]`
     - Reusable Framer Motion variants: `fadeIn`, `slideUp`, `staggerChildren`, `scaleIn`
     - All variants must include `prefers-reduced-motion` fallback (instant transition)
   - Create `components/ui/AnimatedList.tsx`:
     - Wraps children with stagger animation (each child enters 50-80ms after previous)
     - Used for: briefing headlines, match results, proposal lists, engagement options

2. **Briefing entrance sequence**
   - When `EpochBriefing` data loads:
     - Status banner fades in (0ms)
     - Narrative slides up (100ms delay)
     - Headline cards stagger in (200ms, 50ms apart)
     - Stats strip slides up from bottom (400ms)
     - Civic identity fades in last (500ms)
   - On mobile carousel: section transitions use Framer `AnimatePresence` with directional slide (already partially implemented in WP-14 -- verify and polish)

3. **Celebration moments**
   - Create `components/ui/CelebrationOverlay.tsx` (may already exist -- verify and enhance):
     - Confetti burst + congratulatory message
     - Auto-dismisses after 3 seconds, click to dismiss early
     - Accessible: `aria-live="polite"` announcement of the achievement
   - Trigger on:
     - First delegation completed (DelegationCeremony flow)
     - Milestone achieved (citizen-level-up notification)
     - First vote cast through Governada
     - First rationale submitted
     - Match confidence reaching 100%

4. **Optimistic updates on engagement actions**
   - Sentiment vote: button state changes immediately, count increments optimistically
   - Concern flag: toggle state immediate, count updates optimistically
   - Priority signal: selection confirmed immediately
   - If server rejects: revert with subtle shake animation + toast explaining the issue
   - Use TanStack Query's `onMutate` / `onError` / `onSettled` pattern

5. **Interactive feedback**
   - Score gauges: animate from 0 to final value when entering viewport (IntersectionObserver)
   - Radar charts: animate vertices expanding from center on load
   - Confidence bar: animate fill width on data change
   - Button press: subtle scale (0.97x) + release (1x) on all primary action buttons
   - Card hover: gentle lift (translateY -2px + shadow increase) on all clickable cards

**Key files to modify:**

- New: `lib/motion.ts` -- animation system tokens and variants
- New: `components/ui/AnimatedList.tsx` -- stagger wrapper
- `components/governada/home/EpochBriefing.tsx` -- entrance sequence
- `components/governada/match/QuickMatchFlow.tsx` -- results animation
- `components/engagement/ProposalSentiment.tsx` -- optimistic update
- `components/engagement/ConcernFlags.tsx` -- optimistic update
- `components/engagement/PrioritySignals.tsx` -- optimistic update
- Chart components -- viewport-triggered animation

**Verification:** Record a screen capture of the citizen flow (arrive → match → delegate → briefing → engage). The experience should feel fluid, responsive, and celebratory at key moments. Compare to pre-change recording.

---

### QP-8: Onboarding Education Layer

**Problem:** The product assumes governance literacy. Treasury section uses "runway months" and "proportional share" without explanation. Quick Match assumes delegation is understood. New citizens from other crypto ecosystems (or non-crypto) get lost.

**Goal:** Progressive disclosure of governance concepts. First-time users get contextual education. Returning users see clean UI. Nobody needs to leave Governada to understand what they're looking at.

**Scope:**

1. **Governance glossary system**
   - Create `lib/glossary.ts`:
     - 20-30 governance terms with plain-English definitions (2 sentences max each)
     - Terms: DRep, delegation, epoch, treasury, ADA, governance action, proposal, rationale, stake pool, SPO, Constitutional Committee, CIP, voting power, governance health, alignment, score, etc.
     - Each entry: `{ term, definition, learnMoreUrl? }`
   - Create `components/ui/GovTerm.tsx` (may partially exist -- verify):
     - Inline component that wraps a governance term
     - On hover/focus: shows tooltip with plain-English definition
     - Subtle dotted underline to indicate it's a term (not distracting)
     - Accessible: tooltip content available to screen readers
     - Respects user preference: after N interactions, can be dismissed permanently (localStorage)

2. **Contextual education on key surfaces**
   - `EpochBriefing.tsx` treasury section:
     - "Runway" → GovTerm tooltip: "How long the treasury can sustain current spending before running out"
     - "Proportional share" → GovTerm tooltip: "Your portion of the treasury based on your delegation's voting power"
     - "Governance action" → GovTerm tooltip
   - `HomeAnonymous.tsx`:
     - Before Quick Match: one-sentence explainer of what delegation means
     - "Your ADA gives you a voice" → expandable: "When you delegate to a DRep, they vote on governance proposals on your behalf. Your funds stay in your wallet."
   - `QuickMatchFlow.tsx`:
     - Before first question: "These questions help match you with a representative (DRep) who shares your governance values."
     - On results: "Match score shows how aligned this DRep's voting record is with your preferences."
   - `VoteRationaleFlow.tsx`:
     - "Rationale" → GovTerm: "A public explanation of why you voted this way. Published on-chain for transparency."
     - "CIP-100" → GovTerm: "The standard format for governance rationales on Cardano"

3. **First-visit progressive disclosure**
   - Create `hooks/useFirstVisit.ts`:
     - Tracks which pages the user has visited (localStorage)
     - Returns `isFirstVisit(pageKey): boolean`
   - On first visit to key pages, show a subtle educational banner (dismissable):
     - `/discover`: "Browse and compare governance participants. Scores reflect actual voting behavior, not popularity."
     - `/engage`: "Your input here directly influences the intelligence engine. Every signal matters."
     - `/my-gov`: "Your governance command center. Track your delegation health, milestones, and activity."
     - `/pulse`: "The big picture. How healthy is Cardano governance right now?"

4. **"Why this score?" explainers**
   - On DRep/SPO score displays, add a small "?" icon that expands to show:
     - Which pillars contribute to the score (with weights)
     - One-sentence explanation of what a high/low score means
     - Link to full methodology page
   - Similarly for GHI on Pulse page
   - Similarly for CC Transparency Index

**Key files to modify:**

- New: `lib/glossary.ts`
- New or enhanced: `components/ui/GovTerm.tsx`
- New: `hooks/useFirstVisit.ts`
- `components/governada/home/EpochBriefing.tsx` -- treasury term tooltips
- `components/governada/home/HomeAnonymous.tsx` -- delegation explainer
- `components/governada/match/QuickMatchFlow.tsx` -- match context
- `components/governada/proposals/VoteRationaleFlow.tsx` -- rationale context
- DRep/SPO score display components -- "why this score" popover

**Verification:** Have someone unfamiliar with Cardano governance navigate from homepage → match → delegate → briefing → engage. They should understand every concept encountered without external research.

---

## PR Group F: Civic Identity Elevation (QP-9)

> **Depends on:** QP-1 (accessible), QP-7 (animated)

### QP-9: Civic Identity Elevation

**Problem:** The vision calls Civic Identity a "pillar" -- a persistent, growing profile representing the citizen's relationship with Cardano. In production, it's a compact footer strip on the briefing page. Milestones are awarded silently with no UI celebration or profile display.

**Goal:** Civic identity becomes a proper profile surface that citizens are proud to view and share. Milestones are visible, celebrated, and shareable.

**Scope:**

1. **Civic Identity page** (`/my-gov/identity` or similar)
   - Full-page civic identity profile, accessible from My Gov navigation
   - Sections:
     - **Citizen Since**: Epoch number + calendar date, with "X epochs as a citizen" count
     - **Delegation Health**: Current DRep, delegation streak (with streak flame visual), health status (green/yellow/red)
     - **Governance Footprint**: Total proposals influenced, ADA governed, votes cast through DRep
     - **Milestone Gallery**: Grid of earned milestones with icons, dates earned, and descriptions
       - Unearned milestones shown as locked/silhouette (progress toward next milestone)
     - **Alignment Profile**: Governance radar from Quick Match (if completed), with "Retake" option
     - **Engagement Stats**: Sentiment votes cast, priority signals, concern flags raised, assemblies participated in
   - Share button: generates OG image of civic identity card (reuse Wrapped OG infrastructure)

2. **Milestone celebration UI**
   - When `check-notifications` awards a milestone (citizen-level-up):
     - Next time citizen visits, show `CelebrationOverlay` (from QP-7) with milestone details
     - "You earned: 100 Epoch Delegation Streak!" + milestone icon + share button
     - Store "seen" state so it only shows once
   - Milestone gallery on identity page shows sparkle animation on newly earned milestones

3. **Civic identity in briefing (enhanced)**
   - Current compact strip stays as a summary, but:
     - Make it clickable → navigates to full identity page
     - Show most recent milestone earned (if within last 2 epochs) as a highlight card
     - Streak flame should animate (subtle pulse) if streak is active

4. **Shareable civic identity card**
   - OG image route: `/api/og/civic-identity/[userId]`
   - Card design: citizen-since, delegation streak, proposals influenced, milestones earned count
   - Share buttons on identity page + in briefing civic strip
   - Social preview that looks good on Twitter/X, Discord, Telegram

**Key files to modify:**

- New: `app/(main)/my-gov/identity/page.tsx` -- identity page
- New: `components/governada/identity/CivicIdentityProfile.tsx` -- full profile component
- New: `components/governada/identity/MilestoneGallery.tsx` -- milestone display
- `components/governada/home/EpochBriefing.tsx` -- enhanced civic strip
- `components/governada/shared/CivicIdentityCard.tsx` -- make clickable, add recent milestone
- New or enhanced: `app/api/og/civic-identity/[userId]/route.tsx` -- OG image
- `lib/citizenMilestones.ts` -- add milestone metadata (icons, descriptions, share text)

**Verification:** A citizen with 50+ epochs of delegation history visits their identity page and sees a rich, detailed profile with earned milestones, governance footprint, and a share button that generates an attractive social card.

---

## PR Group G: Engagement Maturity (QP-10 + QP-11)

### QP-10: Engagement Feedback Loop

**Problem:** Citizens signal sentiment, flag concerns, vote priorities -- but never see whether their input moved anything. This breaks the engagement flywheel. Why participate if you can't see impact?

**Goal:** Citizens see concrete evidence that their engagement signals influence governance surfaces and outcomes.

**Scope:**

1. **"Your voice this epoch" section in briefing**
   - Add a new section to `EpochBriefing` (below treasury, above civic identity):
     - "You voted on 3 proposals this epoch. Here's what happened:"
     - For each proposal the citizen engaged with:
       - Their sentiment vote (Support/Oppose/Unsure)
       - Community consensus (e.g., "73% of citizens agreed with you")
       - DRep's vote (aligned or diverged)
       - Outcome if resolved (ratified/dropped)
     - Example: "Proposal: Developer Toolkit Grant → You: Support → 73% agreed → Your DRep voted Yes → Ratified ✓"
   - Data source: Join `citizen_sentiment` (user's votes) with `engagement_signal_aggregations` (community totals) and proposal status

2. **DRep accountability signal**
   - On DRep profiles, enhance `DRepCitizenSignals` component:
     - Current: "X% votes with citizen sentiment"
     - Enhanced: Show specific divergence examples
     - "Your DRep diverged from citizen sentiment on 2 of 8 proposals this epoch"
     - Clickable → shows which proposals and the sentiment split
   - In citizen briefing "Your DRep this epoch" section:
     - Include sentiment alignment: "Voted with community sentiment on 6 of 8 proposals"

3. **Priority signal outcomes**
   - On `/engage` page, show a "Last Epoch Recap" section:
     - "Citizens prioritized: Infrastructure (1st), Security (2nd), Education (3rd)"
     - "X proposals aligned with citizen priorities were submitted this epoch"
     - Compare with prior epoch: "Infrastructure moved from 3rd to 1st priority"
   - In briefing: One line summarizing community priority direction

4. **Concern flag impact visibility**
   - On proposal detail pages, when concern flags exceed a threshold (e.g., 10+ flags of same type):
     - Show a highlighted banner: "48 citizens flagged this as 'too expensive'"
     - If proposal was dropped: connect the dots: "This proposal received 48 'too expensive' flags and was not ratified"
   - DReps see concern flag summary in their voting workspace context

5. **Engagement impact notifications**
   - Add to `check-notifications` Inngest function:
     - When a proposal a citizen signaled on reaches a conclusion: notify them
     - "Proposal X that you supported has been ratified"
     - "Proposal Y that you flagged as 'team unproven' was dropped"
   - Low frequency: only on proposal resolution, not on every vote

**Key files to modify:**

- `components/governada/home/EpochBriefing.tsx` -- "your voice" section
- `app/api/briefing/citizen/route.ts` -- fetch citizen engagement + outcomes
- `components/DRepCitizenSignals.tsx` -- divergence detail
- `app/(main)/engage/page.tsx` -- priority recap section
- Proposal detail components -- concern flag banner
- `inngest/functions/check-notifications.ts` -- engagement outcome notifications

**Verification:** A citizen who voted sentiment on 3 proposals last epoch opens their briefing and sees: which proposals they engaged with, how the community voted, whether their DRep aligned, and the outcome. The loop is closed.

---

### QP-11: Engagement Integrity (Anti-Spam + Quorum)

**Problem:** A bot's concern flag = a 100-epoch citizen's concern flag. An assembly can finalize with 1 vote. No credibility weighting means engagement signals can be gamed, undermining the entire civic engagement thesis.

**Goal:** Engagement signals are weighted by citizen credibility. Assemblies require minimum participation. Spam is detectable and deprioritized.

**Scope:**

1. **Citizen credibility score**
   - Create `lib/citizenCredibility.ts`:
     - Compute a credibility weight (0.1 to 1.0) per user based on:
       - Wallet connected (0.3 base) vs anonymous (0.1 base)
       - Delegation active (+ 0.2)
       - Delegation duration in epochs (+ 0.01 per epoch, max + 0.2)
       - Prior engagement history (+ 0.1 if 5+ prior actions, + 0.2 if 20+)
       - Wallet balance tier (+ 0.1 if >1K ADA) -- very light, avoid plutocracy
     - Cap at 1.0. Minimum 0.1 (everyone gets a voice, just weighted)
   - Store credibility in `user_wallets` or compute on-the-fly (lightweight enough)

2. **Weighted engagement aggregation**
   - Modify `precompute-engagement-signals` Inngest function:
     - When aggregating sentiment, concern flags, impact tags:
       - Weight each signal by citizen credibility score
       - Raw counts still tracked (for transparency)
       - Weighted score used for: DRep sentiment alignment, concern flag thresholds, priority rankings
     - Example: 10 anonymous accounts flagging "too expensive" (weight 0.1 each = 1.0) vs 2 long-term citizens (weight 0.8 each = 1.6) -- the 2 citizens outweigh the 10 bots

3. **Assembly quorum mechanics**
   - Add `quorum_threshold` column to `citizen_assemblies` table (default: 10 or configurable)
   - Assembly results only published if `total_votes >= quorum_threshold`
   - If quorum not met by `closes_at`: status = `quorum_not_met` (distinct from `closed`)
   - Display on assembly UI: "12 of 25 votes needed" progress bar
   - Extend closure window by 48h if quorum is 50%+ reached at deadline (optional -- decide during implementation)

4. **Duplicate / spam detection**
   - Rate limit engagement actions per user:
     - Max 50 sentiment votes per epoch (prevents bot sweeping all proposals)
     - Max 20 concern flags per epoch
     - Max 5 priority signal submissions per epoch (should be 1, but allow corrections)
   - Detect suspicious patterns:
     - All votes same direction across all proposals → flag for review
     - Concern flags on all proposals from same IP → log and deprioritize
   - Store anomaly flags in `engagement_signal_aggregations` for admin visibility

5. **Transparency of weighting**
   - On `/engage` page or in methodology docs:
     - Explain that signals are credibility-weighted
     - Show users their own credibility tier (not exact score): "Your signals carry standard / enhanced / full weight"
     - Explain how to increase weight: "Connect your wallet, maintain delegation, participate regularly"

**Key files to modify:**

- New: `lib/citizenCredibility.ts`
- `inngest/functions/precompute-engagement-signals.ts` -- weighted aggregation
- `app/api/engagement/*/route.ts` -- rate limiting per user per epoch
- `components/engagement/CitizenAssembly.tsx` -- quorum display
- Database migration: add `quorum_threshold` to `citizen_assemblies`
- Admin dashboard: anomaly visibility

**Verification:** Create 10 anonymous test signals and 2 authenticated long-term citizen signals. Verify weighted aggregation gives the 2 citizens more influence. Verify assembly won't finalize with fewer than quorum votes.

---

## PR Group H: Citizen Endorsements (QP-12)

> **Depends on:** QP-11 (endorsements need credibility weighting from launch)

### QP-12: Citizen Endorsements (7th Engagement Mechanism)

**Problem:** 6 of 7 engagement mechanisms are live. Endorsements -- the social proof mechanism connecting citizen trust to DRep/SPO profiles -- are still deferred. The vision says endorsements complement algorithmic scores with human trust signals.

**Goal:** Citizens can endorse DReps and SPOs with optional domain-specific trust signals. Endorsements display on profiles alongside algorithmic scores.

**Scope:**

1. **Endorsement data model**
   - `citizen_endorsements` table (may already exist from Step 6 migration -- verify schema):
     - `user_id`, `entity_type` (drep/spo), `entity_id` (bech32 drep_id or pool_id)
     - `endorsement_type`: general | treasury_oversight | technical_expertise | communication | community_leadership
     - `created_at`, `stake_address` (for attribution)
     - Unique constraint: one endorsement per user per entity per type
   - Allow multiple endorsement types per entity (citizen can endorse a DRep for both treasury oversight AND communication)

2. **Endorsement UI on DRep/SPO profiles**
   - Add endorsement section below score on profile pages:
     - Total endorsement count (with breakdown by type)
     - "Endorse this DRep" button (requires wallet connection)
     - Endorsement type selector (5 options as chips/pills)
     - Citizen can add/remove endorsements (toggle behavior)
   - Display: "Endorsed by 47 citizens: 23 for treasury oversight, 15 for communication, 9 for technical expertise"
   - Visual: small badge icons per endorsement type

3. **Endorsement aggregation**
   - Add to `precompute-engagement-signals` Inngest function:
     - Per-entity endorsement counts by type
     - Credibility-weighted endorsement scores (using QP-11 citizen credibility)
     - Store in `engagement_signal_aggregations`
   - Surface in DRep/SPO profile API responses

4. **Endorsement in discovery and matching**
   - On `/discover` DRep/SPO browse pages:
     - Show endorsement count as a column/badge
     - Allow sorting by endorsement count (alongside score sort)
   - In matching results:
     - Show endorsement count as social proof signal
     - "47 citizens endorse this DRep"

5. **Endorsement in briefing context**
   - In "Your DRep this epoch" briefing section:
     - "Your DRep has 47 citizen endorsements (up 3 this epoch)"
   - In engagement feedback loop (QP-10):
     - "You endorsed 2 DReps this epoch"

**Key files to modify:**

- Verify or create migration for `citizen_endorsements` table
- New: `components/engagement/CitizenEndorsements.tsx`
- New: `app/api/engagement/endorsements/route.ts`
- DRep profile components: add endorsement section
- SPO profile components: add endorsement section
- `inngest/functions/precompute-engagement-signals.ts` -- endorsement aggregation
- `/discover` page components -- endorsement column
- `components/governada/home/EpochBriefing.tsx` -- endorsement mention

**Verification:** Connect wallet, navigate to a DRep profile, endorse them for "treasury oversight" and "communication." See endorsement reflected on their profile. Verify it appears in the discover page sort and in the citizen's next briefing.

---

## PR Group I: Performance Validation (QP-13)

> **Depends on:** All other QPs (validate final state)

### QP-13: Load Testing + Performance Validation

**Problem:** No verification that rate limiting, caching, and database queries perform under realistic traffic. The infrastructure is well-designed but untested at scale. A Catalyst proposal or viral Wrapped moment could drive sudden traffic.

**Goal:** Validate that the platform handles 100 concurrent users (realistic near-term ceiling) without degradation. Identify and fix bottlenecks.

**Scope:**

1. **Load testing setup**
   - Choose tool: k6 (Grafana) or Artillery. k6 preferred for scriptability and CI integration.
   - Create `tests/load/` directory:
     - `scenarios/citizen-journey.js` -- anonymous → match → delegate → briefing → engage
     - `scenarios/drep-workspace.js` -- login → command center → proposal → vote
     - `scenarios/api-v1.js` -- public API endpoints at tier rate limits
     - `scenarios/engagement-burst.js` -- 50 concurrent sentiment votes on same proposal

2. **Performance baselines**
   - Run against staging (or production with read-only scenarios):
     - P50, P95, P99 response times for:
       - `/api/briefing/citizen` (most complex citizen query)
       - `/api/governance/matches` (matching computation)
       - `/api/drep/[id]` (profile with score + alignment + engagement)
       - `/api/engagement/sentiment` POST (write path)
       - `/api/v1/dreps` (public API)
     - Concurrent user ramp: 1 → 10 → 50 → 100 users over 5 minutes
     - Record: response times, error rates, Supabase connection pool utilization, Redis hit rates

3. **Rate limiting validation**
   - Verify Upstash sliding-window rate limits fire correctly under load:
     - Free tier: 100/day → confirm 101st request gets 429
     - Pro tier: 10K/day → confirm limits hold
     - Verify `X-RateLimit-Remaining` header accuracy under concurrent requests
   - Verify per-IP rate limiting prevents abuse without blocking legitimate users

4. **Database query optimization**
   - Profile slow queries during load test (Supabase dashboard → Query Performance):
     - Identify queries >100ms
     - Check for missing indexes on frequently queried columns
     - Check JSONB column query patterns (`.info->>field` should have indexes if queried in WHERE)
   - Document findings and apply index migrations if needed

5. **Cache effectiveness**
   - During load test, monitor Redis:
     - Cache hit rate (target >80% for repeated queries)
     - Cache miss patterns (identify uncached hot paths)
     - Memory usage trend
   - Verify stale-while-revalidate pattern works under load

6. **Performance documentation**
   - Create `docs/operations/performance-baseline.md`:
     - Baseline numbers for all key endpoints
     - Known bottlenecks and mitigations
     - Scaling plan: what to do at 1K, 10K, 100K users
     - Redis memory projections
     - Supabase connection pool limits

**Key files:**

- New: `tests/load/scenarios/*.js` -- k6 load test scripts
- New: `tests/load/config.js` -- shared configuration
- New: `docs/operations/performance-baseline.md`
- Potential migration: index optimizations identified during testing

**Verification:** Load test runs cleanly at 100 concurrent users. P95 response times under 500ms for all key endpoints. Zero errors under normal load. Rate limiting correctly enforces limits under concurrent access.

---

## Summary: Path from 84 to 95+

| PR Group | QPs          | Theme                  | Score Impact | Effort              | Parallel?                              |
| -------- | ------------ | ---------------------- | ------------ | ------------------- | -------------------------------------- |
| A        | QP-1, QP-2   | Accessibility          | +4 pts       | Large (2-3 sprints) | Yes (start immediately)                |
| B        | QP-3         | Algorithm tests        | +2 pts       | Medium (1 sprint)   | Yes (start immediately)                |
| C        | QP-4         | Error resilience       | +2 pts       | Medium (1 sprint)   | Yes (start immediately)                |
| D        | QP-5, QP-6   | Algorithm validation   | +2 pts       | Medium (1 sprint)   | After B                                |
| E        | QP-7, QP-8   | UX polish + education  | +2 pts       | Medium (1 sprint)   | After A                                |
| F        | QP-9         | Civic identity         | +1 pt        | Small-Medium        | After A, E                             |
| G        | QP-10, QP-11 | Engagement maturity    | +2 pts       | Medium (1 sprint)   | After C (benefits from error patterns) |
| H        | QP-12        | Endorsements           | +1 pt        | Small-Medium        | After G                                |
| I        | QP-13        | Performance validation | +1 pt        | Small               | After all others                       |

**Optimal execution with 3 parallel agents:**

```
Week 1-2:  Agent 1: PR Group A (accessibility)
           Agent 2: PR Group B (tests)
           Agent 3: PR Group C (error recovery)

Week 3:    Agent 1: PR Group A continued (large)
           Agent 2: PR Group D (calibration + PCA, needs B done)
           Agent 3: PR Group G (engagement maturity)

Week 4:    Agent 1: PR Group E (UX polish, needs A done)
           Agent 2: PR Group F (civic identity, needs A + E patterns)
           Agent 3: PR Group H (endorsements, needs G done)

Week 5:    Agent 1: PR Group I (load testing, final validation)
           Agent 2-3: Bug fixes, polish from prior groups
```

**Target end state:** 95+/100. Every surface accessible. Every algorithm validated. Every user action celebrated. Every error recoverable. Every engagement signal weighted fairly. The platform that Cardano deserves.
