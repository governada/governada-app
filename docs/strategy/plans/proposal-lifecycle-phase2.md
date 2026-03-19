# Proposal Lifecycle Phase 2: Review Intelligence

> **Status:** Complete — shipped to production (PRs #460, #461, #462, #463)
> **Created:** 2026-03-18
> **Depends on:** Phase 1 (complete — PRs #457, #458, #459)
> **Estimated effort:** 3-4 sessions

---

## Why This Exists

The review system collects structured feedback (4-dimension rubric + themes + point-by-point responses) but doesn't USE that data to guide the proposer or gate submission. Reviews are version-agnostic (a review of v1 content still counts after v5 rewrites), there's no readiness signal, and similarity detection doesn't exist.

Equally important: the Review workspace dumps community draft reviews and on-chain votes into a single linear queue. These are fundamentally different activities — advisory feedback vs. binding governance votes — with different urgency, different UI needs, and different mental modes. Reviewers need a portfolio view that separates them.

This phase transforms review from both sides: a **Reviewer Portfolio** for people reviewing, and **Review Intelligence** for proposers receiving feedback.

---

## Current State

**What works well (don't change):**

- Rubric-based review scoring (impact, feasibility, constitutional, value — 1-5 each)
- Point-by-point response flow (accept/decline/modify)
- Feedback theme deduplication banner
- Stage transition validation (timing + response completeness)
- Constitutional AI pre-check (advisory)

**What's missing:**
| Gap | Impact |
|-----|--------|
| Review workspace is a flat queue — no separation of community reviews vs on-chain votes | Reviewers can't prioritize; different activities mixed into one UI |
| Reviews don't track which version they reviewed | A review of v1 still "counts" after a major rewrite in v5 — misleading |
| No community confidence signal | Proposers can't gauge readiness; no composite score from review data |
| No readiness checklist in editor | Checks are scattered across multiple buttons; no unified "are you ready?" view |
| Minimum review count doesn't gate submission | Stage transitions enforce timing but not engagement depth |
| No proposal similarity detection | Duplicate/near-duplicate proposals aren't flagged during authoring |

---

## What to Build

### 2.0 — Reviewer Portfolio View

Replace the flat review queue with a **three-column portfolio** that separates community draft reviews from on-chain voting, making priority and mental mode immediately clear.

**Columns:**

| Column              | Source                                                                                                                                                                        | Card shows                                                                                         | Priority                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Needs Feedback**  | Drafts in `community_review` / `response_revision` / `final_comment` status (fetched via `GET /api/workspace/drafts?status=community_review,response_revision,final_comment`) | Title, type, confidence %, review count, days in review, whether you've already reviewed           | Low urgency — advisory       |
| **Needs Your Vote** | On-chain proposals you haven't voted on (from existing review-queue API, filtered to `existingVote === null`)                                                                 | Title, type, voting progress bars (DRep/SPO/CC), epochs remaining, threshold status, urgency badge | High urgency — binding       |
| **Completed**       | Drafts you reviewed + proposals you voted on                                                                                                                                  | Your score/vote, outcome status (ratified/expired/in progress)                                     | Reference — no action needed |

**View modes** (same pattern as Author portfolio):

- **Kanban** (default on desktop) — three columns
- **List** (default on mobile) — grouped sections with headers

**Card designs differ by column:**

**Needs Feedback cards:**

- Title + type badge
- Confidence % badge (from `computeConfidence` — 2.2)
- Review count: "3 reviews" or "No reviews yet"
- Days open: calculated from `communityReviewStartedAt`
- Your status: "Reviewed ✓" (if you submitted a review) or "Not reviewed" — with stale indicator if your review is stale (from 2.1)
- Click → opens the existing review editor with rubric form

**Needs Your Vote cards:**

- Title + type badge + urgency badge (if ≤ 2 epochs remaining)
- Voting progress: mini DRep yes% bar + threshold line
- Epochs remaining: "4 epochs" or "Final epoch!" (red)
- Treasury amount (if TreasuryWithdrawals): "₳250,000"
- Click → opens the existing review workspace deep-dive (proposal + studio panels)

**Completed cards:**

- Title + type badge
- Your action: "Reviewed — 4.2 avg" or "Voted Yes" with vote badge
- Outcome: "Ratified ✓" / "Expired" / "In Voting" / "Pending reviews"
- Muted styling (lower opacity, no action needed)

**Data sources:**

- Community review drafts: `GET /api/workspace/drafts?status=community_review,response_revision,final_comment` — already exists
- On-chain proposals: existing `/api/workspace/review-queue` endpoint — already exists
- Your reviews: need to cross-reference `draft_reviews` by reviewer stake address — new lightweight query or embed in draft response
- Your votes: `existingVote` field already on `ReviewQueueItem` — EXISTS

**Component structure:**

```
ReviewPortfolio
├── PortfolioSearch (search + kanban/list toggle) — reuse from Author
└── ReviewPortfolioView
    ├── KanbanView
    │   ├── FeedbackColumn (community drafts needing review)
    │   ├── VotingColumn (on-chain proposals needing your vote)
    │   └── CompletedColumn (reviewed + voted)
    └── ListView (same data, grouped sections)
```

**New components:**

- `components/workspace/review/ReviewPortfolio.tsx` — main portfolio page
- `components/workspace/review/ReviewCard.tsx` — card component with column-variant rendering
- Reuse `PortfolioSearch` from Author (or extract to shared `components/workspace/shared/`)

**Navigation flow:**

- `/workspace/review` → shows ReviewPortfolio (the new kanban/list view)
- Click a "Needs Feedback" card → navigates to draft review editor (existing)
- Click a "Needs Your Vote" card → navigates to the existing review workspace deep-dive with proposal + studio panels
- The existing queue-based review workflow remains as the deep-dive experience — the portfolio is the entry point above it

**Relationship to existing ReviewWorkspace:**
The current `ReviewWorkspace.tsx` is a single-proposal deep-dive view (proposal content + studio panels + voting). It stays as-is. The new `ReviewPortfolio` becomes the index page at `/workspace/review`, and the deep-dive becomes what you navigate INTO from a card. This is the same pattern as Author: portfolio view → click card → editor.

**Quick actions per column:**

| Action         | Needs Feedback | Needs Your Vote | Completed     |
| -------------- | -------------- | --------------- | ------------- |
| Open           | ✓              | ✓               | ✓ (read-only) |
| Skip / Snooze  | ✓              | ✓               | —             |
| Mark for Later | ✓              | ✓               | —             |

Keyboard: J/K navigation across all visible cards, Enter to open. Same `useFocusableList` pattern from Author.

---

### 2.1 — Stale Review Tracking

When a proposal's content changes significantly after a review was submitted, that review should be marked as stale — visible but not counted toward readiness.

**Database migration:**

```sql
-- Track which version a review was submitted against
ALTER TABLE draft_reviews
ADD COLUMN reviewed_at_version INTEGER;

-- Backfill existing reviews with NULL (unknown version)
-- New reviews will always have this set
```

**API changes:**

In `POST /api/workspace/drafts/[draftId]/reviews`:

- Include the draft's `current_version` in the review record as `reviewed_at_version`

In `GET /api/workspace/drafts/[draftId]/reviews`:

- Return `reviewedAtVersion` on each review
- Add a computed `isStale` boolean: `review.reviewedAtVersion !== null && review.reviewedAtVersion < draft.currentVersion`
- Stale reviews are still returned (transparency) but flagged

**Type changes:**

Add to `DraftReview`:

```typescript
reviewedAtVersion: number | null;
isStale: boolean;
```

**UI changes in `ReviewsList.tsx`:**

- Stale reviews get a muted visual treatment (reduced opacity, amber "Stale" badge)
- Tooltip: "This review was submitted for version {N}. The proposal has been updated since."
- Stale reviews are separated below current reviews (or grouped under a "Stale Reviews" collapsible)
- Review count in portfolio cards + readiness checks EXCLUDES stale reviews

**Re-review flow:**

- When a reviewer visits a draft they previously reviewed AND their review is stale, show a banner: "You reviewed v{N}. The proposal has been updated. Would you like to re-review?"
- "Re-review" creates a NEW review (doesn't edit the old one — preserves the review history)
- The old stale review remains visible but doesn't count toward confidence

---

### 2.2 — Community Confidence Composite

A single 0-100% readiness signal synthesized from review data, displayed on portfolio cards and the readiness sidebar.

**Computation** (`lib/workspace/confidence.ts`):

```typescript
interface ConfidenceResult {
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'strong';
  factors: ConfidenceFactor[];
}

interface ConfidenceFactor {
  name: string; // e.g. "Review Count", "Average Score", "Theme Coverage"
  value: number; // 0-100 normalized
  weight: number; // 0-1
  detail: string; // e.g. "5 reviews (3 required)"
}
```

**Factors and weights:**

| Factor                    | Weight | 0%             | 50%            | 100%                |
| ------------------------- | ------ | -------------- | -------------- | ------------------- |
| **Review count**          | 0.30   | 0 reviews      | 2 reviews      | 5+ reviews          |
| **Average score**         | 0.30   | Avg < 2.0      | Avg 3.0        | Avg ≥ 4.0           |
| **Response completeness** | 0.20   | No responses   | Some responded | All responded       |
| **Constitutional check**  | 0.10   | Fail / not run | Warning        | Pass                |
| **Content completeness**  | 0.10   | < 2 fields     | 3 fields       | All 4 fields filled |

Stale reviews are EXCLUDED from review count and average score calculations.

**Level mapping:**

- 0-30: `low` (red)
- 31-60: `moderate` (amber)
- 61-80: `high` (green)
- 81-100: `strong` (bright green)

**Computation is client-side** — takes the draft + reviews data already fetched and computes the score. No new API endpoint needed. Create a pure function `computeConfidence(draft, reviews, constitutionalCheck)` that returns `ConfidenceResult`.

**Display locations:**

1. **Portfolio "In Review" cards** — show confidence % and level color on each card
2. **Readiness sidebar** (2.3) — confidence score as the primary metric
3. **Submission gate** (2.4) — shown when confidence is below threshold

---

### 2.3 — Readiness Checks Sidebar

A persistent panel in the editor that shows an always-updated checklist of submission readiness.

**Component:** `components/workspace/author/ReadinessPanel.tsx`

```
┌─ Submission Readiness ──────────────┐
│                                      │
│  Community Confidence: 72% ██████░░  │
│  Level: High                         │
│                                      │
│  ── Checks ─────────────────────     │
│  ✓ Content complete (4/4 fields)     │
│  ✓ Constitutional check: Pass        │
│  ✓ 5 reviews (min 3 required)        │
│  ✗ 2 reviews unaddressed             │
│  ✓ 48h in community review           │
│  ⚠ 1 stale review                    │
│                                      │
│  ── Factors ────────────────────     │
│  Review Count     ██████████ 100%    │
│  Average Score    ████████░░  78%    │
│  Responses        ██████░░░░  60%    │
│  Constitutional   ██████████ 100%    │
│  Completeness     ██████████ 100%    │
│                                      │
│  [Submit On-Chain →]                 │
│  (unlocks at 60% confidence)         │
└──────────────────────────────────────┘
```

**Checks displayed:**

1. Content completeness (title, abstract, motivation, rationale non-empty)
2. Constitutional check result (pass/warning/fail/not run)
3. Review count vs. minimum threshold (configurable, default 3)
4. Unaddressed reviews count
5. Time in community review (must be ≥48h per existing stage validation)
6. Stale review count (informational, not blocking)
7. Wallet balance (sufficient for deposit — only shown in `final_comment` stage)

**Integration:**

- Add as a new tab in the StudioPanel (alongside agent/intel/notes/vote): `readiness`
- Update `PanelId` type in `lib/workspace/store.ts` to include `'readiness'`
- Auto-open the readiness tab when draft is in `community_review` or later stage
- Available in all authoring stages (even `draft` — shows what's needed before publishing for review)

**Data sources** (all already fetched or fetchable):

- Draft fields: from `useDraft()` — EXISTS
- Reviews + responses: from reviews API — EXISTS
- Constitutional check: from `draft.lastConstitutionalCheck` — EXISTS
- Stale detection: requires `reviewedAtVersion` (from 2.1)
- Wallet balance: from `useGovernanceAction()` preflight — EXISTS (for final stages)

---

### 2.4 — Minimum Review Threshold Gate

Add a configurable minimum review count that blocks the "Submit On-Chain" action (and optionally the stage transition to `final_comment`).

**Configuration:**

- Stored as a feature flag or in a config constant: `MIN_REVIEWS_FOR_SUBMISSION = 3`
- Different thresholds per proposal type could be added later (e.g., Treasury Withdrawals need more reviews than Info Actions)
- For now: single global constant in `lib/workspace/constants.ts`

**Enforcement points:**

1. **Stage transition: `final_comment` → submitted**
   In `app/api/workspace/drafts/[draftId]/stage/route.ts`:
   - Count non-stale reviews
   - If count < MIN_REVIEWS_FOR_SUBMISSION, return 400 with message
   - The readiness panel shows this gate visually

2. **SubmissionFlow UI**
   In `components/workspace/author/SubmissionFlow.tsx`:
   - Disable the "Submit On-Chain" button if review count is below threshold
   - Show: "3 reviews required, 2 received. Need 1 more review before submission."

3. **Readiness panel** (2.3)
   - Check shows ✓/✗ with count vs. requirement
   - Stale reviews explicitly excluded from count

**Community confidence interaction:**

- The minimum review threshold is a HARD gate (blocks submission)
- Community confidence is a SOFT signal (shows readiness, doesn't block)
- A proposal with 3 reviews averaging 1.5/5 passes the threshold but has low confidence — the confidence score warns the proposer even though the gate is met

---

### 2.5 — Proposal Similarity Surfacing

Flag similar existing proposals during authoring to prevent duplicates and surface precedent.

**Approach:** Use the existing pgvector semantic embedding infrastructure (shipped 2026-03-18 in the Semantic Embedding Intelligence Layer).

**Implementation:**

1. **Embed draft content on save** — When a draft's content changes (auto-save), compute an embedding of `title + abstract` (lightweight, not full content). Store in a new column or use the existing embedding infrastructure.

2. **Query similar proposals** — On draft load or after embedding updates, query for similar proposals:

   ```sql
   SELECT p.proposal_id, p.title, p.abstract,
          1 - (p.embedding <=> draft_embedding) AS similarity
   FROM proposals p
   WHERE 1 - (p.embedding <=> draft_embedding) > 0.75
   ORDER BY similarity DESC
   LIMIT 5
   ```

3. **Display in editor** — Show a "Similar Proposals" section in the readiness panel or intel sidebar:
   ```
   ⚠ Similar proposals found:
   • "Treasury for SDK Development" (87% similar, submitted 2 epochs ago, In Voting)
   • "Developer Tooling Grant" (79% similar, ratified epoch 520)
   ```
   Each links to the proposal detail page.

**Simplification for Phase 2:** If the embedding pipeline is complex to wire into the draft auto-save flow, use a simpler approach:

- On "Check for Similar" button click (not automatic), send `title + abstract` to the embedding search endpoint
- Display results in a panel
- This avoids the auto-embed pipeline and still surfaces duplicates

**Component:** `components/workspace/author/SimilarProposalsPanel.tsx`

- List of similar proposals with similarity %, title, status, link
- "No similar proposals found" empty state
- Button to manually refresh

---

## Schema Changes

### Migration: Add `reviewed_at_version` to `draft_reviews`

```sql
ALTER TABLE draft_reviews
ADD COLUMN reviewed_at_version INTEGER;

COMMENT ON COLUMN draft_reviews.reviewed_at_version IS
  'The draft version number at the time this review was submitted. Used for stale review detection.';
```

### No other schema changes needed

Community confidence is computed client-side. Readiness checks are derived from existing data. Similarity uses existing embedding infrastructure.

---

## API Changes Summary

| Endpoint                                  | Method | Change    | Purpose                                                                         |
| ----------------------------------------- | ------ | --------- | ------------------------------------------------------------------------------- |
| `GET /api/workspace/drafts?status=...`    | GET    | Modified  | Include `yourReviewStatus` (reviewed/stale/none) per draft for the current user |
| `POST /api/workspace/drafts/[id]/reviews` | POST   | Modified  | Set `reviewed_at_version` from draft's `current_version`                        |
| `GET /api/workspace/drafts/[id]/reviews`  | GET    | Modified  | Return `reviewedAtVersion` + computed `isStale` per review                      |
| `PATCH /api/workspace/drafts/[id]/stage`  | PATCH  | Modified  | Enforce minimum review threshold on `final_comment → submitted`                 |
| `GET /api/workspace/drafts/[id]/similar`  | GET    | New       | Return similar proposals via embedding search                                   |
| `GET /api/workspace/review-queue`         | GET    | Unchanged | Already provides on-chain proposals with `existingVote` field                   |

---

## New Files

| File                                                    | Purpose                                       |
| ------------------------------------------------------- | --------------------------------------------- |
| `components/workspace/review/ReviewPortfolio.tsx`       | Reviewer portfolio view (kanban/list)         |
| `components/workspace/review/ReviewCard.tsx`            | Card component with column-variant rendering  |
| `lib/workspace/confidence.ts`                           | `computeConfidence()` pure function           |
| `lib/workspace/constants.ts`                            | `MIN_REVIEWS_FOR_SUBMISSION` and other config |
| `components/workspace/author/ReadinessPanel.tsx`        | Readiness checks sidebar panel                |
| `components/workspace/author/SimilarProposalsPanel.tsx` | Similar proposals display                     |
| `app/api/workspace/drafts/[draftId]/similar/route.ts`   | Similarity search endpoint                    |

---

## Execution Plan

### Session 1: Reviewer Portfolio View (parallel-safe splits)

**Agent A — Reviewer Portfolio Frontend:**

- `ReviewPortfolio.tsx` — kanban/list view with three columns
- `ReviewCard.tsx` — column-variant card (feedback/voting/completed)
- Extract shared `PortfolioSearch` to `components/workspace/shared/` (or reuse from author)
- Wire into `/workspace/review` page as the new entry point
- Keep existing `ReviewWorkspace.tsx` as the deep-dive (navigated to from card click)
- J/K navigation + Enter to open via `useFocusableList`

**Agent B — Backend (stale reviews + review intelligence APIs):**

- Migration: `reviewed_at_version` column on `draft_reviews`
- Modify review creation endpoint to set `reviewed_at_version`
- Modify review list endpoint to return `reviewedAtVersion` + computed `isStale`
- Modify stage transition to enforce minimum review threshold
- Create `lib/workspace/constants.ts` with `MIN_REVIEWS_FOR_SUBMISSION = 3`
- Add "your review status" to community-reviewable drafts response (whether current user has reviewed, and if stale)

### Session 2: Confidence + Readiness (parallel-safe)

**Agent A — Confidence computation + readiness panel:**

- Create `lib/workspace/confidence.ts` with `computeConfidence()`
- Create `ReadinessPanel.tsx` with checklist + confidence display
- Add `'readiness'` to PanelId type and wire into StudioPanel
- Update `ReviewsList.tsx` with stale review visual treatment + re-review banner
- Update Author portfolio "In Review" cards to show confidence %
- Update Reviewer portfolio "Needs Feedback" cards to show confidence %

**Agent B — Similarity + threshold gate:**

- Create similarity search endpoint
- Create `SimilarProposalsPanel.tsx`
- Wire minimum threshold gate into SubmissionFlow UI

### Session 3: Integration + Polish

- Full flow testing: create draft → get reviews → update content → reviews become stale → re-review → confidence rises → submission unlocks
- Reviewer flow: portfolio → click card → deep-dive review → return to portfolio with "Reviewed ✓" status
- Edge cases: zero reviews, all stale, constitutional check never run
- Mobile layout for reviewer portfolio (list mode default)
- Polish card designs, empty states, loading skeletons

---

## What This Unblocks

| Phase 3 Feature                        | Depends on Phase 2                                                 |
| -------------------------------------- | ------------------------------------------------------------------ |
| **Submission ceremony**                | Readiness panel provides the pre-submission checklist data         |
| **Community confidence in simulation** | Confidence score shown in the launch sequence                      |
| **Team approval gate**                 | Readiness panel shows team sign-off status alongside review status |

---

## What We Are NOT Doing in Phase 2

- **Replacing the deep-dive review experience** — The existing `ReviewWorkspace` (single-proposal view with studio panels) stays as-is. The portfolio is the INDEX above it, not a replacement.
- **Review editing** — Reviews are immutable. Re-review creates a new record. This preserves the review history.
- **Review weighting by reviewer reputation** — All reviews count equally. Weighting by DRep status or track record is a Phase 4+ feature.
- **Automatic embedding on every save** — Similarity is triggered manually (button click) or on stage transition, not on every auto-save.
- **Blocking submission on low confidence** — Confidence is advisory. Only the minimum review count is a hard gate. Proposers can submit with 35% confidence if they meet the review minimum.
- **Community review timeline enforcement** — The 48h minimum already exists. No changes to timing rules.
- **Reviewer notification pipeline** — The portfolio shows current state but doesn't push notifications when new drafts need review. That's a separate feature.

---

## Risks

| Risk                                                 | Likelihood | Mitigation                                                                                                  |
| ---------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| Stale review logic confuses reviewers                | Medium     | Clear UI: "Updated since your review" banner with re-review CTA. Stale reviews still visible, just flagged. |
| Confidence formula feels arbitrary                   | Medium     | Show factor breakdown so users understand WHY their score is X. Make weights adjustable later.              |
| Similarity search returns noise                      | Medium     | Set high threshold (0.75) and cap at 5 results. "No similar proposals" is better than false positives.      |
| Minimum review threshold blocks legitimate proposals | Low        | Start with 3 (very achievable). Info Actions could have a lower threshold (1) if needed later.              |
| Readiness panel adds cognitive load                  | Low        | It's a tab — only visible when the user opens it. Auto-opens only during review stages.                     |
