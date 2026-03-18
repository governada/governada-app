# Admin Testing & Quality Assurance Framework

**Status:** Plan — pending founder approval
**Date:** 2026-03-18
**Context:** The platform has View As persona switching and preview cohorts, but three critical admin use cases are unserved: sandboxed workflow testing, user bug reproduction, and pre-ship feature validation with real data.

---

## Strategic Frame

Governada serves 6 personas across 4 governance roles, each with multiple sub-states (delegation, claim status, engagement level, credibility tier). The combinatorial surface is large. Before launch, the founder needs absolute confidence that every persona x state combination works correctly — and after launch, needs to rapidly reproduce and fix any issue a user reports.

**The core problem:** The current tools were designed for two different audiences (admin quick-switching vs. external tester cohorts) and neither fully serves the admin's own testing needs. The admin can switch personas but can't safely interact with data. The preview system isolates data but requires invite code ceremony. There's no way to see what a specific user sees.

---

## Architecture: Three Admin Modes

The View As system gains three mutually exclusive modes, all accessible from the existing profile nav dropdown:

### Mode 1: Observe (current default)

Switch persona, see real production data, writes go to production. This is what exists today. No changes needed — it's the right tool for quick layout/navigation checks.

### Mode 2: Sandbox

Switch persona, enter a cohort data namespace, writes are isolated. For workflow testing: author a proposal, submit a review, see it in the queue — all without touching production.

**How it works:**

- Admin clicks "Enter Sandbox" in the View As dropdown
- System auto-creates (or lets admin select) a personal sandbox cohort
- `SegmentProvider` gains `sandboxCohortId` state
- All write endpoints check for sandbox context and scope writes to the cohort
- Reads are hybrid: real governance data (proposals, DReps, votes) from production + sandboxed data (drafts, reviews, annotations) from the cohort namespace
- Scenario data can be generated into the sandbox on demand
- Admin can switch personas within the same sandbox, seeing cross-persona interactions
- "Exit Sandbox" clears the cohort scope and returns to Observe mode

**Key constraint:** Sandbox mode must use identical code paths to production. The only difference is the `preview_cohort_id` filter on write operations. No separate "sandbox API routes."

### Mode 3: Impersonate

Load a specific user's real detected state — their segment, delegation, DRep ID, scores, flags — and see the app through their eyes. For bug reproduction.

**How it works:**

- Admin clicks "Impersonate User" in the View As dropdown
- Enters a wallet address, stake address, or searches by DRep/SPO name
- System calls the segment detection API for that address
- All SegmentProvider overrides are set to match that user's actual state
- Data reads are filtered to show what that user would see (their delegation, their DRep, their votes)
- Writes are blocked — impersonation is read-only by default
- Admin can optionally enter sandbox mode while impersonating (see their view + test fixes safely)
- A banner clearly indicates impersonation state with the user's address

---

## P0: Foundation (build first — everything else depends on these)

### P0-A: User State Inspector

**What:** New admin page at `/admin/users` that shows the complete computed state for any wallet address.

**Why:** Prerequisite for impersonation and bug reproduction. When a user reports an issue, the admin's first question is "what's their state?" — today this requires manually querying 5+ tables.

**Components:**

1. **Search bar** — accepts wallet address, stake address, DRep bech32 ID, or pool ID. Fuzzy match against `users`, `drep_profiles`, `spo_profiles` tables.

2. **Identity panel** — wallet address, stake address, first seen date, last active, authentication method

3. **Segment detection** — run the same detection logic used by SegmentProvider:
   - Detected segment (citizen/drep/spo/cc)
   - DRep ID (if any) + claim status
   - Pool ID (if any) + claim status
   - CC membership status
   - Delegation target (DRep + pool)

4. **Computed dimensions:**
   - Engagement level (Registered → Champion) + underlying metrics
   - Credibility tier (standard/enhanced/full) + weight
   - Governance level (observer → champion) + qualifying actions
   - Governance depth preference

5. **Feature flags** — which flags are enabled for this user (including any per-user overrides from P2)

6. **Governance activity summary:**
   - Poll votes cast (count + recent)
   - Proposals authored (drafts + submitted)
   - Reviews submitted
   - DRep votes (if DRep segment)
   - Delegation history

7. **"Impersonate" button** — loads this user's state into View As (see Mode 3 above)

**API:** `GET /api/admin/users/inspect?address=<addr>` — aggregates data from users, drep_profiles, spo_profiles, poll_votes, proposal_drafts, draft_reviews, and the segment detection endpoint. Single call, server-side aggregation.

**Effort:** Medium (1 API route + 1 admin page). Most data already queryable, just needs aggregation.

### P0-B: Admin Sandbox Mode

**What:** "Enter Sandbox" toggle in the View As dropdown that scopes the admin into a cohort namespace for isolated write operations.

**Why:** The admin's three use cases all need write isolation. Without this, testing workflows means either polluting production or going through the invite code ceremony.

**Components:**

1. **Sandbox activation UI** — button in View As dropdown:
   - "Enter Sandbox" → creates or selects a sandbox cohort
   - Shows active sandbox name + "Exit" button when in sandbox
   - Persona switching works normally within sandbox

2. **SegmentProvider extension:**
   - New state: `sandboxCohortId: string | null`
   - New method: `enterSandbox(cohortId?: string)` / `exitSandbox()`
   - Exposed via `useSegment()` hook
   - Persisted in sessionStorage (survives page navigation, cleared on tab close)

3. **Write endpoint instrumentation:**
   - All workspace write endpoints (`/api/workspace/drafts`, `/api/workspace/reviews`, etc.) check for `X-Sandbox-Cohort` header
   - If present, insert with `preview_cohort_id = cohortId`
   - Read queries for sandboxed tables include `OR preview_cohort_id = cohortId` filter
   - Non-workspace writes (real governance actions) are blocked in sandbox mode

4. **Sandbox management:**
   - Auto-create personal sandbox: `Admin Sandbox — <date>`
   - "Reset Sandbox" button — clears all data in the cohort (reuses existing cleanup logic from scenario generator)
   - "Generate Scenarios" — populates sandbox with scenario data (reuses existing generator)
   - Sandbox cohorts are hidden from the preview management page (tagged `is_admin_sandbox: true`)

**Effort:** Medium-Large. SegmentProvider changes are small. The main work is instrumenting write endpoints to respect sandbox context — but there are only ~8 write endpoints in the workspace system.

**Critical design decision:** Sandbox mode passes `sandboxCohortId` via request header, not URL parameter. This keeps URLs shareable and avoids polluting the routing layer.

---

## P1: Bug Reproduction & Cross-Persona Testing

### P1-A: User Impersonation

**What:** Load a real user's detected state into the View As system and see the app exactly as they see it.

**Why:** When a user reports "I can't see my delegation" or "my score looks wrong," the admin needs to see their exact view — not a generic persona approximation.

**Depends on:** P0-A (User State Inspector provides the data, impersonation applies it)

**Components:**

1. **Impersonation activation:**
   - "Impersonate" button on User State Inspector page
   - Also accessible from View As dropdown → "Impersonate User..." → address input
   - Loads the user's full detected state into SegmentProvider overrides

2. **Data scoping:**
   - Override `stakeAddress` in the context so data queries return this user's records
   - Their poll votes, their delegation, their DRep profile, their drafts
   - Read-only mode: all write endpoints return 403 when impersonating (unless sandbox is also active)

3. **Visual indicator:**
   - Amber banner (like current View As) but with user's truncated address
   - "Exit Impersonation" button
   - Clear distinction from persona switching (impersonation = real user, View As = synthetic persona)

4. **Impersonate + Sandbox combo:**
   - Admin can impersonate a user AND enter sandbox simultaneously
   - Use case: "I see the bug as this user. Let me enter sandbox and test a fix from their perspective."
   - Reads: user's real data. Writes: sandboxed.

**Effort:** Medium. Most infrastructure exists from P0. The new piece is overriding `stakeAddress` for data scoping, which affects how hooks like `useDelegation`, `useVoteHistory`, etc. fetch data.

### P1-B: Cross-Persona Data Sharing in Sandbox

**What:** Within a single sandbox cohort, the admin can switch personas and see data created by other personas in the same sandbox.

**Why:** Governance is inherently multi-party. A proposal goes through: author creates draft → reviewers submit feedback → DRep reads reviews → DRep votes. Testing this flow requires seeing the same data from multiple perspectives.

**Depends on:** P0-B (Sandbox mode provides the cohort namespace)

**How it works:**

- Sandbox data is scoped by `preview_cohort_id`, NOT by the admin's current persona
- When admin creates a draft as "Citizen", then switches to "DRep", the draft appears in the review queue
- Each persona switch within sandbox shows the same cohort data through a different lens
- The admin essentially plays all roles in the governance workflow

**This is almost free** if P0-B is implemented correctly. The scenario generator already creates data this way — synthetic proposers + synthetic reviewers all share the same cohort. The admin just needs to be another participant in the same namespace.

**Effort:** Small. The sandbox scoping from P0-B handles this automatically. The only additional work is ensuring that switching personas within sandbox doesn't reset the cohort context.

---

## P2: Enhanced Observability & Testing Depth

### P2-A: Activity Trail (Per-User Event History)

**What:** Within the User State Inspector (P0-A), show the user's recent activity: pages visited, actions taken, errors encountered.

**Why:** When a user says "I clicked the button and nothing happened," the admin needs their event sequence — not just their current state.

**Depends on:** P0-A (inspector page hosts this), PostHog event instrumentation

**Components:**

1. **PostHog API integration:**
   - Query PostHog Events API: `GET /api/admin/users/activity?address=<addr>&days=7`
   - Server-side proxy to PostHog API (keeps API key server-side)
   - Filter by `distinct_id` = wallet address
   - Return: event name, timestamp, properties, page URL

2. **Activity timeline UI:**
   - Chronological list of events within the User State Inspector
   - Filter by event type (page views, actions, errors)
   - Expandable event details (properties, page context)
   - "Jump to Sentry" link for error events (if Sentry event ID captured)

3. **Event instrumentation gaps to fill:**
   - Current PostHog usage is minimal. Before this feature is useful, key user actions need instrumentation:
   - Page views (via PostHog autocapture or manual `$pageview`)
   - Delegation actions, poll votes, draft creation, review submission
   - Error boundaries should capture to both Sentry and PostHog
   - Use `noun_verb` event naming convention per CLAUDE.md

**Effort:** Medium. PostHog API integration is straightforward. The larger effort is instrumenting events across the app — but this has independent value for analytics regardless.

**Phasing note:** Ship the API integration and timeline UI first, even with sparse events. Instrumentation can be added incrementally — each new event immediately appears in the trail.

### P2-B: Edge Case Scenario Data

**What:** Extend the scenario generator to produce pathological data alongside happy-path scenarios.

**Why:** Production bugs come from edge cases: empty fields, maximum-length content, boundary conditions, Unicode. The current generator only creates representative, well-formed data.

**Depends on:** P0-B (sandbox provides the destination for edge case data)

**Edge case templates to add:**

1. **Empty/minimal content:**
   - Proposal with empty abstract
   - Proposal with title only (no motivation/rationale)
   - Review with empty feedback text
   - Draft with no type-specific data

2. **Maximum-length content:**
   - Title at 500 characters
   - Abstract at 5,000 characters
   - Motivation with 50+ paragraphs
   - Review with extremely long feedback

3. **Unicode and special characters:**
   - Titles with emojis, RTL text, CJK characters
   - Content with markdown injection attempts
   - Names with diacritics and special symbols

4. **Boundary conditions:**
   - Proposal with 0 votes
   - DRep with 0 delegators
   - Proposal at exactly the voting threshold
   - Draft at status transition boundaries (just entered community review, FCP about to expire)

5. **Temporal edge cases:**
   - Draft created 1 second ago
   - Draft in community review for 90 days (stale)
   - Review submitted after FCP ended
   - Version created in the future (clock skew)

**Implementation:** Add an `edgeCases: boolean` parameter to `generateScenario()`. When true, append edge case templates after the standard distribution. Each edge case is clearly labeled in the data (`_scenarioSource.edgeCase: true`).

**Effort:** Small-Medium. Template additions to the existing generator. No new infrastructure.

### P2-C: Per-User Feature Flag Overrides

**What:** Enable/disable specific feature flags for individual wallet addresses.

**Why:** Two use cases: (a) beta-test a feature with one specific user before broader rollout, (b) disable a broken feature for an affected user while debugging.

**Depends on:** Nothing — the `targeting` JSONB column already exists in `feature_flags` table.

**Components:**

1. **Flag evaluation update:**
   - `getFeatureFlag(key, defaultValue)` gains an optional `walletAddress` parameter
   - Check `targeting` column for per-wallet overrides before returning global value
   - Targeting format: `{ "wallets": { "<address>": true/false } }`
   - Wallet-level override takes precedence over global flag

2. **Client-side flag evaluation:**
   - `useFeatureFlag(key)` passes current wallet address
   - `fetchClientFlags()` sends wallet address, server evaluates per-user

3. **Admin UI update:**
   - Expand the existing Flags admin page
   - Per-flag: "User Overrides" section showing wallet addresses with explicit on/off
   - Add/remove wallet overrides
   - Also accessible from User State Inspector: "Override flag X for this user"

4. **Audit logging:**
   - All per-user flag changes logged to `admin_audit_log`
   - Include: flag key, wallet address, old value, new value, admin who changed it

**Effort:** Small-Medium. The database column exists. Main work is updating `getFeatureFlag()` to check targeting and adding the UI to the flags page.

---

## P3: Production Confidence

### P3-A: Write-Path Parity Verification

**What:** A verification mechanism that confirms sandbox mode behavior matches production behavior.

**Why:** If sandbox mode uses different code paths or RLS policies behave differently, the admin is testing a different system than what users experience. This undermines all sandbox testing.

**Approach — not a feature, but a discipline:**

1. **Same code paths (architectural constraint):**
   - Sandbox mode MUST NOT have separate API routes or handlers
   - The only difference is a `preview_cohort_id` filter on writes
   - Code review rule: any PR that adds a workspace write endpoint must handle sandbox context

2. **RLS parity test suite:**
   - Vitest integration tests that run the same queries with and without sandbox context
   - Verify: same rows returned for production reads, sandbox writes don't leak
   - Run as part of `npm run preflight`

3. **Sandbox health check:**
   - Admin button: "Verify Sandbox Parity"
   - Runs a sequence of operations in sandbox and verifies:
     - Draft creation succeeds and is cohort-scoped
     - Draft is visible within the same cohort
     - Draft is NOT visible outside the cohort
     - Review on a cohort draft succeeds
     - Production data is still readable
   - Reports pass/fail for each check

4. **Drift detection (ongoing):**
   - If a new write endpoint is added without sandbox support, the parity tests fail
   - This catches regressions before they reach production

**Effort:** Medium. The test suite is the main investment. The health check is a nice-to-have built on top of it.

---

## Implementation Sequence

```
P0-A: User State Inspector          ████████░░  ~4 hours
P0-B: Admin Sandbox Mode            ████████████░░  ~6 hours
  ↓
P1-B: Cross-Persona Sharing         ██░░  ~1 hour (nearly free from P0-B)
P1-A: User Impersonation            ██████░░  ~4 hours
  ↓
P2-C: Per-User Feature Flags        ████░░  ~2 hours
P2-B: Edge Case Scenarios           ████░░  ~2 hours
P2-A: Activity Trail                ██████░░  ~4 hours (+ ongoing instrumentation)
  ↓
P3-A: Write-Path Parity             ██████░░  ~3 hours (test suite + health check)
```

**Total estimated scope:** ~26 hours of implementation across 8 work packages.

**Recommended chunking:**

- **Build 1 (P0):** State Inspector + Sandbox Mode → 2 PRs, 1 build session
- **Build 2 (P1):** Impersonation + Cross-Persona → 1-2 PRs, 1 build session
- **Build 3 (P2):** Feature flags + Edge cases + Activity trail → 3 PRs, 1 build session
- **Build 4 (P3):** Parity tests → 1 PR, 1 build session

---

## What NOT to Build

- **Separate staging environment.** Sandbox mode against production data is better than a stale staging copy. The data is real, the behavior is identical, only writes are isolated.

- **Full session replay.** PostHog has session replay but it's heavyweight for our scale. The activity trail (event sequence) is sufficient for bug reproduction. If we need visual replay later, PostHog's native feature can be enabled without custom code.

- **Admin-to-user messaging.** Not an admin testing concern. If we need to communicate with users about known issues, that's a separate feature (status banners, not DMs).

- **A/B test management.** Feature flags + per-user overrides cover controlled rollout. Full A/B testing with statistical significance is premature for our user base.

- **Custom analytics dashboard.** PostHog's native dashboards cover analytics needs. Building our own would duplicate effort. The admin panel should link to PostHog, not recreate it.

---

## Database Changes

### New columns (existing tables)

```sql
-- preview_cohorts: distinguish admin sandboxes from tester cohorts
ALTER TABLE preview_cohorts ADD COLUMN is_admin_sandbox boolean DEFAULT false;
```

### No new tables needed

The existing `preview_cohorts`, `preview_sessions`, `admin_audit_log`, and `feature_flags` tables cover all storage needs. The User State Inspector is purely a read aggregation — no new persistence.

---

## Feature Flags for Rollout

| Flag                   | Controls                               | Default |
| ---------------------- | -------------------------------------- | ------- |
| `admin_sandbox_mode`   | Sandbox toggle in View As dropdown     | off     |
| `admin_user_inspector` | /admin/users page                      | off     |
| `admin_impersonation`  | Impersonate button + mode              | off     |
| `admin_edge_scenarios` | Edge case toggle in scenario generator | off     |

All gated behind admin auth — these flags only matter for admin wallets.

---

## Success Criteria

After full implementation, the admin can:

1. **In under 60 seconds:** look up any user, see their full state, and impersonate them to reproduce a reported bug
2. **In under 30 seconds:** enter sandbox mode, switch to any persona, and start testing a workflow with isolated data
3. **In one sandbox session:** author a proposal as Citizen, switch to DRep, review it, switch back — verifying the full governance loop
4. **Before any release:** generate edge case data, test as every persona, and have confidence that writes in sandbox match production behavior
5. **For any user:** enable or disable a specific feature flag without affecting anyone else
