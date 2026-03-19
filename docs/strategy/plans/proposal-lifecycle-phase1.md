# Proposal Lifecycle Phase 1: Management Actions + Portfolio View

> **Status:** Complete — shipped to production (PRs #457, #458, #459)
> **Created:** 2026-03-18
> **Depends on:** Workspace Foundation (complete), Explore Feature: Proposal Management Lifecycle
> **Estimated effort:** 2-3 sessions

---

## Why This Exists

The Author dashboard is a flat grid of cards with no grouping, no filtering, no quick actions, and no way to see archived or team proposals. Proposal management actions (duplicate, delete, archive, export, transfer ownership) don't exist. This phase transforms the Author page from a draft list into a **proposal portfolio** — the entry point for the entire authoring lifecycle.

This is Phase 1 of 4 in the proposal lifecycle roadmap. It's the lowest-risk, highest-visibility work because it's the first thing every proposer sees.

---

## Current State

**`AuthorWorkspace.tsx`** — Page heading + "+ New Proposal" button + `DraftsList` grid. No filtering, grouping, or view controls.

**`DraftsList.tsx`** — Flat 3-column card grid. Each card shows: title, type badge, status badge, version, relative time. Has J/K navigation + framer-motion entry from Session 4-5. No quick actions, no grouping by status.

**API (`/api/workspace/drafts`)** — Fetches by `owner_stake_address`, excludes archived (`.neq('status', 'archived')`). No way to see archived. No team proposals query.

**`ProposalDraft` type** — Has `status` (draft | community_review | response_revision | final_comment | submitted | archived), no `supersedes_id` for lineage, no template-related fields.

**Database (`proposal_drafts`)** — All lifecycle columns exist (stage timestamps, tx_hash, anchor URL/hash). No `supersedes_id` column. No `is_template` flag.

---

## What to Build

### 1.1 — Portfolio View (Dashboard Redesign)

Replace the flat grid with a **three-column grouped view** that makes lifecycle position visible at a glance.

**Columns:**

| Column        | Statuses included                                        | Card shows                                                          |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| **Drafts**    | `draft`                                                  | Completeness % (fields filled / 4), team member count, last edited  |
| **In Review** | `community_review`, `response_revision`, `final_comment` | Review count, avg score, unaddressed feedback count, days in review |
| **On-Chain**  | `submitted`                                              | Submitted date, tx_hash link (truncated), voting status placeholder |

**View modes** (stored in Zustand `authorViewMode`):

- **Kanban** (default on desktop) — three columns side by side
- **List** (default on mobile, toggle available) — single column with status group headers

**View controls bar** (between page header and content):

```
┌──────────────────────────────────────────────────────────┐
│ [🔍 Search...          ]  [Kanban | List]  [Show archived] │
└──────────────────────────────────────────────────────────┘
```

- Search: client-side filter by title (uses `authorFilter` from Zustand store)
- View toggle: switches Kanban ↔ List (uses `authorViewMode` from store)
- Archive toggle: shows/hides archived proposals (new local state)

**Card enhancements** (extend existing `DraftsList` cards):

For **Drafts** column cards, add:

- Completeness indicator: count non-empty fields (title, abstract, motivation, rationale) → show as "2/4" or a mini progress bar
- Team indicator: if `proposal_teams` exists for this draft, show member count badge (fetch from API, or include in draft response)

For **In Review** column cards, add:

- Review count badge (requires new field on draft or separate query)
- Days in review: `Math.floor((now - communityReviewStartedAt) / 86400000)` + "d"

For **On-Chain** column cards, add:

- Submitted date: `formatRelativeTime(submittedAt)`
- Tx link: truncated `submittedTxHash` → links to cardanoscan

**Empty states per column:**

- Drafts: "No drafts. Create your first proposal →" (with button)
- In Review: "No proposals in review yet. Open a draft for community feedback."
- On-Chain: "No submitted proposals. Complete the review process to submit on-chain."

**Component structure:**

```
AuthorWorkspace
├── PortfolioHeader (title, description, + New Proposal, view controls)
├── PortfolioSearch (search input, view toggle, archive toggle)
└── PortfolioView
    ├── KanbanView (3 columns, each renders DraftColumn)
    │   ├── DraftColumn (header with count badge, list of DraftCard)
    │   └── DraftCard (existing card enhanced with column-specific info)
    └── ListView (single column with group headers)
        ├── StatusGroup (header, list of DraftCard)
        └── DraftCard (same component, different layout)
```

**File:** `components/workspace/author/PortfolioView.tsx` (new)
**File:** `components/workspace/author/DraftCard.tsx` (extracted from DraftsList, enhanced)
**File:** `components/workspace/author/PortfolioSearch.tsx` (new)

`DraftsList.tsx` becomes the inner list renderer (or is replaced by the new components).

---

### 1.2 — Quick Actions Menu

Each `DraftCard` gets a `⋯` context menu with actions that vary by status.

**Actions by status:**

| Action    | draft | community_review | response_revision | final_comment | submitted | archived |
| --------- | ----- | ---------------- | ----------------- | ------------- | --------- | -------- |
| Edit      | ✓     | ✓                | ✓                 | ✓             | —         | —        |
| Duplicate | ✓     | ✓                | ✓                 | ✓             | ✓         | ✓        |
| Archive   | ✓     | ✓                | ✓                 | ✓             | —         | —        |
| Delete    | ✓     | —                | —                 | —             | —         | —        |
| Unarchive | —     | —                | —                 | —             | —         | ✓        |
| Export    | ✓     | ✓                | ✓                 | ✓             | ✓         | ✓        |
| Transfer  | ✓     | ✓                | ✓                 | ✓             | —         | —        |

**Menu component:** Use shadcn/ui `DropdownMenu` (already exists). Each action calls the corresponding API and uses `useOptimisticMutation` for instant feedback.

**Delete semantics:**

- **Delete** (draft only): Hard delete from database. Requires confirmation (inline "Click again to confirm" pattern, not a modal). Only available for `draft` status — once shared for review, content is preserved.
- **Archive**: Soft delete. Sets `status = 'archived'`. Reversible via Unarchive.

**Keyboard shortcut registration:**
When a draft card has focus (via J/K), register context-dependent commands:

- `d` — Duplicate focused draft
- `a` — Archive focused draft
- `x` — Delete focused draft (only in draft status)
- `e` — Export focused draft

These register via `commandRegistry` with `when` predicates checking the focused draft's status.

---

### 1.3 — Duplicate (Fork) with Lineage

**Database migration:**
Add `supersedes_id` column to `proposal_drafts`:

```sql
ALTER TABLE proposal_drafts
ADD COLUMN supersedes_id UUID REFERENCES proposal_drafts(id) ON DELETE SET NULL;
```

**API endpoint:**
`POST /api/workspace/drafts/[draftId]/duplicate`

- Reads the source draft (any status, including archived and submitted)
- Creates a new draft with:
  - Same content (title prefixed with "Copy of " or "v2: " if superseding)
  - Same proposal_type and type_specific
  - Status: `draft`
  - `supersedes_id` pointing to the source draft
  - Owner: the requesting user's stake address (allows duplicating others' on-chain proposals for iteration)
- Returns the new draft

**UI:**

- Quick action "Duplicate" → calls API → optimistic insert into Drafts column → toast "Draft duplicated" → new draft appears
- On-Chain column gets a special action: "Fork & Revise" → same API but with title prefix "Revision of: "

**Lineage display:**
On the draft editor page, if `supersedes_id` is set, show a small banner:

```
↩ Based on: [Original Proposal Title] (v3, submitted 2d ago)
```

Links to the original. Not a separate component — just a conditional line in the editor header.

---

### 1.4 — Archive & Delete APIs

**Archive:**
`PATCH /api/workspace/drafts/[draftId]/stage` already exists for stage transitions. Extend it to support `archived` as a target status from any pre-submitted state.

**Unarchive:**
Same endpoint — transition from `archived` back to `draft`. Content is preserved.

**Delete:**
`DELETE /api/workspace/drafts/[draftId]` — new endpoint.

- Only allowed when status is `draft`
- Hard deletes the draft AND its versions from the database
- Returns 403 if status is not `draft`
- Returns 404 if not found or not owned by the requester

**Archived drafts query:**
Extend `GET /api/workspace/drafts` with `?includeArchived=true` parameter. Currently it does `.neq('status', 'archived')` — make this conditional.

---

### 1.5 — Export

**API endpoint:**
`GET /api/workspace/drafts/[draftId]/export?format=markdown|cip108|pdf`

**Formats:**

- **Markdown**: Standard GFM with title as H1, sections as H2s, type-specific fields included
- **CIP-108 JSON**: The existing `buildCip108Document()` output (already implemented in the publish endpoint — reuse the logic)
- **PDF**: Defer to Phase 2 or later. Markdown + CIP-108 cover the immediate need.

**UI:** Export dropdown in the quick action menu with format options. Downloads the file directly (browser download via blob URL, not server redirect).

---

### 1.6 — Ownership Transfer

**API endpoint:**
`PATCH /api/workspace/drafts/[draftId]/transfer`

- Body: `{ newOwnerStakeAddress: string }`
- Only the current owner (lead) can transfer
- Updates `owner_stake_address` on the draft
- If a team exists, the old owner becomes an `editor`, the new owner becomes the `lead`
- Returns the updated draft

**UI:** Quick action "Transfer Ownership" → dialog with stake address input → confirmation → optimistic update. Available only to the lead/owner.

---

### 1.7 — Team Proposals Section

**API query:**
`GET /api/workspace/drafts?memberOf=<stakeAddress>`

- Joins `proposal_drafts` → `proposal_teams` → `proposal_team_members`
- Returns drafts where the user is a team member but NOT the owner
- Includes the user's role (editor/viewer) in the response

**UI:**
Below the main portfolio view, a collapsible section:

```
▾ Team Proposals (3)
  [Card: Treasury Withdrawal — Editor] [Card: Info Action — Viewer] [...]
```

- Shows the owner's name (or truncated stake address) and the user's role badge
- Cards link to the editor (if editor role) or read-only view (if viewer)
- Collapsed by default if empty

---

## Schema Changes

### Migration: Add `supersedes_id` to `proposal_drafts`

```sql
-- Add lineage tracking for proposal forks/revisions
ALTER TABLE proposal_drafts
ADD COLUMN supersedes_id UUID REFERENCES proposal_drafts(id) ON DELETE SET NULL;

-- Index for efficient lineage queries
CREATE INDEX idx_proposal_drafts_supersedes ON proposal_drafts(supersedes_id)
WHERE supersedes_id IS NOT NULL;

COMMENT ON COLUMN proposal_drafts.supersedes_id IS
  'References the draft this proposal is a revision/fork of. Used for lineage tracking.';
```

No other schema changes needed. Team tables, versions, reviews all exist.

---

## API Changes Summary

| Endpoint                                    | Method | New/Modified | Purpose                                                   |
| ------------------------------------------- | ------ | ------------ | --------------------------------------------------------- |
| `GET /api/workspace/drafts`                 | GET    | Modified     | Add `?includeArchived=true` and `?memberOf=<addr>` params |
| `POST /api/workspace/drafts/[id]/duplicate` | POST   | New          | Duplicate/fork a draft with lineage                       |
| `DELETE /api/workspace/drafts/[id]`         | DELETE | New          | Hard delete (draft status only)                           |
| `GET /api/workspace/drafts/[id]/export`     | GET    | New          | Export as markdown or CIP-108 JSON                        |
| `PATCH /api/workspace/drafts/[id]/transfer` | PATCH  | New          | Transfer ownership                                        |
| `PATCH /api/workspace/drafts/[id]/stage`    | PATCH  | Modified     | Support archive/unarchive transitions                     |

---

## Execution Plan

### Session 1: Portfolio View + Quick Actions (parallel-safe splits)

**Agent A — Frontend (portfolio view):**

- `PortfolioView.tsx` — Kanban/List views with three columns
- `DraftCard.tsx` — Enhanced card with completeness indicator, review count, status-specific info
- `PortfolioSearch.tsx` — Search, view toggle, archive toggle
- Update `AuthorWorkspace.tsx` to use new components
- Register keyboard shortcuts for quick actions (d/a/x/e)

**Agent B — Backend (APIs):**

- Migration: `supersedes_id` column
- `POST /api/workspace/drafts/[id]/duplicate` endpoint
- `DELETE /api/workspace/drafts/[id]` endpoint
- `GET /api/workspace/drafts/[id]/export` endpoint (markdown + CIP-108)
- `PATCH /api/workspace/drafts/[id]/transfer` endpoint
- Modify `GET /api/workspace/drafts` for `includeArchived` and `memberOf`
- Modify `PATCH /api/workspace/drafts/[id]/stage` for archive/unarchive

### Session 2: Integration + Team Proposals + Polish

- Wire quick action menu to APIs with `useOptimisticMutation`
- Team proposals section (API query + UI)
- Lineage display in editor header
- Inline delete confirmation pattern
- Hook up archive toggle to API
- Review count fetching (either embed in draft response or separate lightweight query)
- Test: all quick actions work, cards move between columns, keyboard shortcuts

### Session 3 (if needed): Edge cases + testing

- Export download UX (blob URL pattern)
- Transfer ownership dialog
- Empty states per column
- Mobile layout (list mode default, responsive)
- Edge cases: duplicate a submitted proposal, archive during community review, transfer with active team

---

## What This Unblocks

| Phase 2 Feature                | Depends on Phase 1                                |
| ------------------------------ | ------------------------------------------------- |
| Stale review tracking          | Portfolio view shows review count per card (1.1)  |
| Community confidence composite | Portfolio "In Review" cards show confidence score |
| Automated readiness checks     | Portfolio "Drafts" cards show readiness %         |
| Minimum review threshold       | Quick action "Submit" gated by review count       |

---

## What We Are NOT Doing in Phase 1

- **Templates** — Deferred. The "New Proposal" type selector works. Templates (save-as-template, create-from-template) are a nice-to-have but not blocking.
- **Review count in card** — If this requires a join or separate query that impacts page load, defer to Session 2. Phase 1 cards can show the data that's already on the `ProposalDraft` object.
- **PDF export** — Markdown + CIP-108 JSON are sufficient. PDF adds a rendering dependency.
- **Real-time team presence** — Version-based collaboration is the model. No CRDT/multiplayer.
- **Submission ceremony redesign** — That's Phase 3.

---

## Risks

| Risk                                                            | Likelihood | Mitigation                                                                                           |
| --------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| Kanban view feels cluttered with 3 columns on narrow screens    | Medium     | Default to List view on < lg breakpoint. Kanban only on desktop.                                     |
| Archive/unarchive changes confuse the stage transition API      | Low        | Archive is a separate status, not a stage. The stage endpoint validates allowed transitions.         |
| `memberOf` query is slow (joins 3 tables)                       | Low        | Small data volume. Add index on `proposal_team_members.stake_address` if needed.                     |
| Quick action keyboard shortcuts conflict with existing commands | Low        | Use `when` predicates to scope to Author dashboard only.                                             |
| Duplicate creates orphan versions                               | Low        | Duplicate copies content only, not version history. The new draft starts at v1 with its own history. |
