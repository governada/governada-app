# Lessons Archive

Promoted-to-rule or resolved lessons moved here from `tasks/lessons.md`. Not read automatically. Available for deep dives.

---

## Promoted to Rules (redundant with .cursor/rules/)

### 2026-02-25: Database-first, always → `architecture.md` + `critical.md` #8
### 2026-02-25: Research APIs before implementing → `workflow.md` build phase
### 2026-02-25: Fast validation, not passive waiting → `workflow.md` + `deploy.md`
### 2026-02-25: No stale documentation artifacts → `workflow.md` anti-patterns
### 2026-02-25: Advocate for the robust path → `workflow.md` build phase
### 2026-02-25: Proactively scan for tooling improvements → `workflow.md`
### 2026-02-25: Always build-check before pushing → `workflow.md` + `deploy.md`
### 2026-02-26: Diagnose problem before prescribing solutions → `workflow.md` first-principles
### 2026-02-26: Cost analysis before building → `workflow.md` first-principles
### 2026-03-01: Server components with Supabase calls must be force-dynamic → `critical.md` #4
### 2026-03-01: `revalidate` vs `force-dynamic` — third recurrence → `critical.md` #4 + `architecture.md`
### 2026-03-01: Deprecation audit — search data consumers → `workflow.md` build phase
### 2026-03-01: Analytics must ship inline with features → `workflow.md` build phase
### 2026-03-01: dreps table uses `id` not `drep_id` → `architecture.md` dreps schema
### 2026-03-01: JSX in API routes requires .tsx → `architecture.md` file extension rule
### 2026-03-01: Never `git add -A` after cross-branch stash/pop → `critical.md` #9
### 2026-03-01: Orphan audit at session start → `workflow.md` session start
### 2026-03-01: Hard-coded counts in rules go stale → `architecture.md` + `deploy.md`
### 2026-03-01: Always monitor CI after push → `critical.md` #11
### 2026-03-01: PowerShell doesn't support `&&` → `critical.md` #5
### 2026-03-02: "Feasible" over "ambitious" causes rework → `architecture.md` UX principles
### 2026-03-02: Squash merges invisible to `git branch --no-merged` → `workflow.md`
### 2026-03-02: Inngest serve() registration is single point of failure → `critical.md` #7
### 2026-03-02: Critical rules need a separate, short file → `critical.md` exists
### 2026-03-02: Always ship after completing all todos → `critical.md` #2
### 2026-03-02: Ship It must execute as part of session → `critical.md` #2
### 2026-03-02: Admin pages need a standard pattern → `architecture.md` admin pages
### 2026-03-02: Platform references must stay current → `workflow.md` + `deploy.md`
### 2026-03-02: "Hotfix" is a trigger word → `workflow.md` hotfix protocol
### 2026-03-02: Hotfix protocol needs structural enforcement → `workflow.md` hotfix
### 2026-03-02: Always commit + PR + deploy as part of implementation → `critical.md` #2
### 2026-03-03: Cascading CI failures — fix ALL stages → `critical.md` #2 + #11

## Resolved / One-Time (no recurrence risk)

### 2026-02-25: Scoring model evolved 3 times (v1 → v2 → v3)
V3 is stable. Historical context only.

### 2026-02-25: Influence metric conflicted with mission
Resolved in V3 — influence/voting power excluded from scoring.

### 2026-02-26: Vitest 4 broken on Node 24
Pinned to Vitest 3.x. Re-evaluate when Vitest 4 stabilizes.

### 2026-02-26: Separate Supabase projects per environment
Infrastructure decision made. Staging project exists.

### 2026-02-26: Staging data parity — seed early, verify always
Seed script exists (`npm run seed:staging`). Operational procedure, not recurring code risk.

### 2026-02-26: PostgREST handles type differences transparently
One-time discovery. Minor type differences don't break Supabase REST copies.

### 2026-02-26: Standalone directories break Next.js builds
Fixed — `analytics` in tsconfig `exclude`. One-time.

### 2026-02-26: CLI tools essential for deployment monitoring
Established — Railway CLI, gh CLI. Already in `tooling.md`.

### 2026-02-26: Dual Cursor instances require mcp-remote for OAuth MCPs
Environment setup complete. Workspace uses stdio MCPs only.

### 2026-02-28: Untracked files break pre-push hooks via .next/types
Hooks removed entirely (S17). Historical only.

### 2026-03-01: Pre-push hook runs full build — budget ~4 min
Hooks removed in `81c2c12`. Historical only.

### 2026-03-02: Pre-existing type errors block commits — maintain clean trunk
General dev hygiene. Trunk is clean.

### 2026-03-02: WebGL (R3F) is the baseline for premium visuals
Resolved. Canvas 2D removed. R3F is the standard.

### 2026-03-02: R3F CameraControls captures all scroll/drag
Resolved. Controls locked, pointer events disabled for backdrop use.

### 2026-03-02: Transparent sticky headers require hero overlap
Resolved. One-time CSS fix with `-mt-16`.

### 2026-03-02: Shell tool calls don't preserve working directory
Cursor behavior. Chain branch-dependent git commands in single Shell call.

### 2026-03-02: Local hooks removed — CI is the sole quality gate
Resolved. Hooks removed. CI is gate.

### 2026-03-02: Branch protection "not up to date" adds ~5 min
Operational timing awareness. Rebase before pushing PR.

### 2026-03-02: Feature flags — Supabase-backed for instant toggles
Architecture decision. Already in `architecture.md`.

### 2026-03-02: Feature flags need categories at scale
Resolved. Categories exist. Convention in `architecture.md`.

### 2026-03-01: Don't raise coverage thresholds without matching tests
General CI practice. Set thresholds to slightly below current coverage.

### 2026-03-01: Viral surfaces need view + share + outcome events
Analytics pattern. Already in `analytics-reference.md` completion checklist.

### 2026-03-02: Strategy doc projections must reflect reality
Process discipline. Not a code pattern.

### 2026-03-02: Intelligence features need visual punch
Quality aspiration. Already in `architecture.md` UX principles.

### 2026-03-02: useMemo/useCallback require inline function expressions
General React knowledge. `useMemo(() => fn(), [])` not `useMemo(fn, [])`.

### 2026-03-02: Early returns in async imperative handles must clean up state
General async pattern. Use try/finally.

### 2026-03-03: Hooks before early returns (react-hooks/rules-of-hooks)
General React knowledge. All hooks before any early return.

### 2026-03-02: React 19 compiler lint — no ref access during render
General React 19 knowledge. Use useState for render-affecting values.

### 2026-03-01: Railway deploy lag — CI green does not mean deployed
Operational timing. Budget 5-8 min after CI for Railway deploy.

### 2026-03-01: Session 5 — Subagent pattern for large feature sessions
Operational wisdom. Already in user rules (subagent strategy).

### 2026-03-01: Treasury balance is null until Inngest sync populates it
Resolved. Null-safe rendering exists across all treasury components.

### 2026-03-01: One-pass features, not fix-after-ship
Quality aspiration. Target zero fix commits after feature commits.

### 2026-02-26: Cron secrets must never live in committed files
Resolved. Auth via headers, secret rotated.

_Archived: 2026-03-03_
