# Proposal Lifecycle Phase 4: Post-Submission & Lifecycle Completion

> **Status:** Complete — shipped to production (PRs #466, #467)
> **Created:** 2026-03-19
> **Depends on:** Phase 3 (complete — PRs #464, #465)
> **Estimated effort:** 2-3 sessions

---

## Why This Exists

After a proposer clicks "Sign & Submit," they go blind. There's no voting progress dashboard, no deposit tracking, no way to understand why a proposal failed, and no path to iterate. This phase closes the lifecycle loop: proposers can monitor their submitted proposals, track voting progress against thresholds, understand outcomes when proposals expire or get ratified, and relaunch improved versions from the debrief.

This completes the original 4-phase proposal lifecycle roadmap from the explore-feature session.

---

## What to Build

### 4.1 — Proposer Voting Dashboard

After submission, the "On-Chain" column in the Author portfolio currently shows basic info (submitted date, tx hash). Replace this with a rich monitoring card, and add a dedicated dashboard view when clicking into a submitted proposal.

**Portfolio card enhancements (On-Chain column):**

- Voting progress bars per body (DRep, SPO, CC — varies by proposal type)
- Threshold line on each bar (e.g., 67% mark)
- Epochs remaining countdown
- Status badge: "In Voting" / "Ratified" / "Expired" / "Dropped"

**Dashboard route:** `/workspace/author/[draftId]/monitor`

When a user clicks an On-Chain card, navigate to a monitoring dashboard:

```
┌─ Monitoring: [Proposal Title] ──────────────────────────────┐
│ ← Back to portfolio                                          │
│                                                               │
│  Status: In Voting  ·  4 epochs remaining                    │
│                                                               │
│  ── Voting Progress ────────────────────────────────────     │
│  DRep:  ████████████████░░░░░░░░░  62% of 67% required      │
│  CC:    ██████████░░░░░░░░░░░░░░░  40% of 51% required      │
│                                                               │
│  ── Vote Activity ──────────────────────────────────────     │
│  • DRep xyz...abc voted Yes (2h ago)                         │
│  • DRep def...ghi voted No with rationale (5h ago)           │
│  • CC member jkl...mno voted Yes (1d ago)                    │
│                                                               │
│  ── Deposit ────────────────────────────────────────────     │
│  Status: Locked                                              │
│  Amount: 100,000 ADA                                         │
│  Return: On ratification or epoch 530 (expiry)               │
│                                                               │
│  ── Actions ────────────────────────────────────────────     │
│  [Share Proposal →]                                          │
└──────────────────────────────────────────────────────────────┘
```

**Data sources:**

- Voting tallies: `proposal_voting_summary` table (EXISTS — synced from Koios)
- Vote snapshots per epoch: `proposal_vote_snapshots` table (EXISTS)
- Individual votes: `drep_votes` table (EXISTS)
- Proposal lifecycle: `proposals` table — `ratified_epoch`, `enacted_epoch`, `dropped_epoch`, `expired_epoch` (EXISTS)
- Threshold requirements: derive from proposal type + epoch params (EXISTS in constitution.ts)
- Deposit: from `proposals.deposit` field (EXISTS) + `return_address` (EXISTS)

**Key insight:** All this data already exists in the database from the sync pipeline. The monitoring dashboard is purely a frontend view over existing tables. No new backend work needed beyond a lightweight API endpoint to fetch the data.

### 4.2 — Deposit Status Tracking

Track whether the proposer's deposit has been returned.

**Logic:**

- Deposit is **locked** while proposal is active (no ratified/expired/dropped epoch)
- Deposit is **returned** when proposal is ratified OR expires naturally
- Deposit is **at risk** if the proposal is dropped (unconstitutional)
- Infer status from the proposal's lifecycle columns

**Display:** In the monitoring dashboard deposit section. Also surface on the portfolio On-Chain card as a small badge.

No new database work — derive from existing `proposals` table lifecycle columns.

### 4.3 — Outcome Debrief

When a proposal reaches a terminal state (ratified, expired, dropped), show a debrief view that helps the proposer understand what happened and improve.

**Route:** `/workspace/author/[draftId]/debrief` (or a tab within the monitor page)

**Content:**

- **Final voting breakdown** per body (DRep yes/no/abstain counts + percentages)
- **Where it fell short** (if expired/dropped): which body didn't reach threshold
- **Top opposition themes** — if DRep rationales are available, summarize the key reasons for No votes
- **Improvement suggestions** — based on review feedback that was declined or unaddressed

**Relaunch CTA:** "Fork & Revise" button that duplicates the draft (using the existing duplicate API with `supersedes_id` lineage) and pre-navigates to the editor. The new draft starts with the original content + debrief context.

### 4.4 — Team Approval Gate (Blocking)

Upgrade the informational team sign-off from Phase 3 to a blocking gate.

**Schema:**

```sql
CREATE TABLE proposal_team_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES proposal_drafts(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES proposal_team_members(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, team_member_id)
);
```

**API endpoints:**

- `POST /api/workspace/drafts/[draftId]/approve` — team member records approval
- `GET /api/workspace/drafts/[draftId]/approvals` — list approvals

**Submission gate:** In the submission ceremony Step 3, the "Continue" button is disabled until all editors have approved. The lead can always proceed (they're the submitter). Viewer role members don't need to approve.

**Notification:** When the lead enters the submission ceremony, team editors receive a notification (if notification pipeline exists) to review and approve.

---

## Execution Plan

### Session 1: Monitoring Dashboard + Deposit Tracking (parallel-safe)

**Agent A — Frontend (monitoring dashboard):**

- Create `/workspace/author/[draftId]/monitor/page.tsx`
- Create voting progress component (per-body bars with threshold lines)
- Create vote activity feed (recent votes list)
- Create deposit status display
- Enhance On-Chain portfolio cards with voting progress + status
- Navigation: click On-Chain card → monitor page

**Agent B — Backend (monitoring API + team approvals):**

- Create `GET /api/workspace/proposals/[txHash]/[index]/monitor` — returns voting tallies, vote activity, deposit status, threshold requirements
- Create team approval table migration
- Create approval endpoints (POST approve, GET approvals)

### Session 2: Debrief + Team Gate + Integration

- Create debrief view for terminal proposals
- Wire blocking team approval gate into submission ceremony Step 3
- "Fork & Revise" button on debrief → duplicate with lineage
- Polish: monitoring card variants, empty states, mobile layout
- Full lifecycle test: draft → review → submit → monitor → outcome → debrief → relaunch

---

## What This Completes

This phase closes the full proposal lifecycle loop from the original explore-feature session:

| Phase       | Feature                                  | Status     |
| ----------- | ---------------------------------------- | ---------- |
| **Phase 1** | Portfolio view + management actions      | Complete   |
| **Phase 2** | Review intelligence + reviewer portfolio | Complete   |
| **Phase 3** | Submission ceremony                      | Complete   |
| **Phase 4** | Post-submission monitoring + lifecycle   | This phase |

After Phase 4, the proposal lifecycle is feature-complete. Future improvements (review weighting, vote simulation, advanced analytics, templates) are enhancements, not gaps.

---

## Risks

| Risk                                                           | Likelihood | Mitigation                                                                                             |
| -------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Voting data isn't synced frequently enough for real-time feel  | Medium     | Display "Last synced: X minutes ago" + manual refresh button. Sync pipeline runs hourly.               |
| DRep rationale data is sparse (few publish CIP-100 rationales) | High       | Debrief works without rationales — focus on voting numbers. Rationale themes are a bonus.              |
| Team approval notification requires notification pipeline      | Medium     | Phase 4 can show the approval status without push notifications. Notifications are a separate feature. |
| Monitoring page for non-submitted proposals                    | Low        | Redirect guard: only accessible for `submitted` status proposals with a `submittedTxHash`.             |
