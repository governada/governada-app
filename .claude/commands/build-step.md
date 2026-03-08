Build a vision step end-to-end: research, plan, get user approval at decision points, execute in parallel, and deploy autonomously.

## Input

Argument: `$ARGUMENTS`

- Required: step number (e.g., "7", "8", "4 SmartAlertManager")
- Optional scope qualifier to focus on a subset of the step's features

---

## Phase 1: Vision Intelligence (3 Parallel Subagents)

Launch all three simultaneously using the Agent tool. These are READ-ONLY research agents.

### 1A. Vision Analyst

```
You are analyzing a Civica vision step to produce a comprehensive build specification. READ-ONLY — do not modify files.

Instructions:
1. Read `docs/strategy/ultimate-vision.md` — find the Step [N] section. Extract EVERY requirement, feature, success criteria, and cross-step dependency.
2. Read `docs/strategy/context/build-manifest.md` — identify which items in this step are [x] (done) vs [ ] (not done). The unchecked items are your primary focus.
3. Read the relevant persona doc(s) from `docs/strategy/personas/` — extract the specific UX expectations for features in this step.
4. Read `docs/strategy/context/persona-quick-ref.md` for persona mental models.
5. Check if any of this step's features are referenced in `docs/strategy/world-class-packages.md` as quality targets.

Return a structured specification:

STEP: [N] — [Name]
STATUS: [X] of [Y] items complete

REMAINING_FEATURES:
For each unchecked item:
- Feature: [name]
- Vision spec: [what the vision doc says it should do — be specific]
- Persona impact: [which personas benefit and how]
- Dependencies: [what must exist for this to work — other steps, tables, APIs]
- Success criteria: [how to know it's done and done well]

CROSS_STEP_DEPENDENCIES:
- [Step N depends on Step X's Y because...]

INTEGRATION_POINTS:
- [Where this step's output feeds into other steps or surfaces]

VISION_AMBIGUITY:
- [Any areas where the vision is vague or could be interpreted multiple ways — flag these as decision points]
```

### 1B. Codebase Scout

```
You are exploring the Civica codebase to map the technical landscape for building Step [N]. READ-ONLY — do not modify files.

Instructions:
1. Read `docs/strategy/context/build-manifest.md` to understand what Step [N] requires.
2. For each unchecked feature in Step [N], search the codebase for:
   - Partial implementations (files, stubs, TODO comments referencing this feature)
   - Existing patterns to follow (how similar features in completed steps were built)
   - Infrastructure that can be reused (components, hooks, utils, API patterns)
   - Integration points (where new code needs to connect to existing code)
3. Check `lib/` for relevant utilities, `components/` for reusable UI, `app/api/` for API patterns.
4. Check `supabase/migrations/` for existing tables that relate to this step.
5. Look for any existing tests that cover related functionality.

Return a structured technical landscape:

EXISTING_WORK:
- [file/component]: [what exists, how complete, any TODOs]

PATTERNS_TO_FOLLOW:
- [pattern name]: [example file] — [why this pattern applies]

REUSABLE_INFRASTRUCTURE:
- [component/util/hook]: [how it helps this step]

INTEGRATION_POINTS:
- [where new code connects]: [existing file] — [interface/contract to respect]

DATABASE_STATE:
- Tables that exist: [list with key columns]
- Tables needed: [list based on vision spec]
- Migrations required: [what new tables/columns are needed]

TECHNICAL_RISKS:
- [risk]: [why it matters] — [mitigation approach]
```

### 1C. Audit Pre-Screen

```
You are pre-screening a Civica vision step against all audit dimensions to define quality targets BEFORE building. READ-ONLY — do not modify files.

Instructions:
1. Read `docs/strategy/context/build-manifest.md` to understand what Step [N] requires.
2. Read all 6 audit command files to understand what each audit evaluates:
   - `.claude/commands/audit-sync.md` (S1-S4)
   - `.claude/commands/audit-data.md` (D1-D4)
   - `.claude/commands/audit-scoring.md` (M1-M4)
   - `.claude/commands/audit-ux.md` (U1-U6)
   - `.claude/commands/audit-journeys.md` (J1-J5)
   - `.claude/commands/audit-security.md` (SEC1-SEC5)
3. Read `docs/strategy/context/audit-rubric.md` for the scoring anchors.
4. For each audit dimension this step touches, define what "8+/10" looks like specifically for this step's features.

Return audit-aligned quality targets:

AFFECTED_DIMENSIONS:
For each dimension this step touches:
- [Dimension ID]: [Dimension Name]
  - Relevance: [how this step affects this dimension]
  - Current baseline: [estimated current score based on what exists]
  - Target: 8+/10 requires: [specific criteria for this step's features]
  - Build guidance: [what to build/avoid to hit the target on first pass]

NOT_AFFECTED:
- [Dimensions this step doesn't touch — skip during post-build verify]

QUALITY_CHECKLIST:
- [ ] [Specific quality check derived from audit pre-screen]
- [ ] [Another check]
(These become the post-build verification criteria)

ANTI-PATTERNS:
- [Things to avoid that would cause audit score regression — based on audit rubric]
```

---

## Phase 2: Architecture Proposal (Orchestrator Synthesizes)

After all three subagents return, synthesize their outputs into a build plan. Read `docs/strategy/context/work-plan-template.md` for the chunk format.

### 2.1 Chunk Breakdown

Convert remaining features into PR-sized chunks following the work plan template. For each chunk include:

- Priority, effort, audit dimensions affected
- Files to create/modify
- Which pattern to follow (from Codebase Scout)
- Audit quality targets (from Pre-Screen)
- Dependencies on other chunks

### 2.2 Decision Points

Extract from the Vision Analyst's ambiguity flags and the Codebase Scout's risks. For each decision:

- **The question**: What needs to be decided?
- **Option A**: [approach] — pros, cons, audit impact
- **Option B**: [approach] — pros, cons, audit impact
- **Recommendation**: Which option and why
- **Stakes**: What happens if we pick wrong? (reversible or not?)

### 2.3 Assumption Challenges

For each implicit assumption in the plan, explicitly state it and challenge it:

- **Assumption**: [what we're assuming]
- **Challenge**: [what if this is wrong?]
- **Mitigation**: [how the plan handles it, or why the assumption is safe]

### 2.4 World-Class Bar

For each chunk, define two levels:

- **Solid (scores 7/10 on relevant audits)**: [what "good enough" looks like]
- **World-class (scores 9+/10)**: [what the extra investment buys]
- **Recommendation**: [which level to target and why]

### 2.5 PR Grouping & Merge Sequence

Determine the deployment order:

- **Independent chunks**: Can build in parallel, merge in any order
- **Grouped chunks**: Same PR (tightly coupled, must deploy atomically)
- **Sequential chunks**: Must merge in order (infrastructure before consumers)

Present as a merge sequence diagram:

```
[Group A: chunks 1,2] ──merge──> [Group B: chunk 3] ──merge──> [Group C: chunks 4,5]
     (parallel build)                (depends on A)              (depends on B)
```

---

## Phase 3: Decision Gate (MANDATORY PAUSE)

**STOP HERE. Present the full plan to the user and wait for input.**

Present:

1. The chunk breakdown with effort estimates
2. All decision points with your recommendations
3. Assumption challenges
4. World-class bar choices
5. The merge sequence

Ask specifically:

- "Do you approve the chunk breakdown, or should any be split/merged/reordered?"
- "For each decision point, which option do you prefer? (I've noted my recommendation)"
- "For each chunk, do you want solid (7/10) or world-class (9+/10)?"
- "Any scope you want to add or cut?"

**Do NOT proceed to Phase 4 until the user explicitly approves the plan.**

---

## Phase 4: Parallel Execution (After User Approval)

Launch chunk agents in worktrees. Use `isolation: "worktree"` for each.

### Chunk Agent Instructions

Each chunk agent receives a prompt containing:

```
You are building Chunk [N]: [Name] for Civica Step [S].

## Your Scope
[Chunk description from the approved plan]

## Approved Decisions
[Any decision points resolved by the user that affect this chunk]

## Quality Targets (from audit pre-screen)
[Audit dimensions and specific criteria this chunk must meet]

## Patterns to Follow
[From Codebase Scout — which existing patterns to use]

## Files to Read First
[From the chunk spec]

## Build Instructions

1. Read all files in "Files to Read First" before writing any code.
2. Implement the chunk scope following the approved patterns.
3. Follow all hard constraints from CLAUDE.md (force-dynamic, TanStack Query, etc.)
4. Meet the quality targets — these are NOT optional. Each maps to an audit dimension.
5. Write tests for new functionality.
6. Run `npm run preflight` and fix all failures.
7. Stage specific files (no `git add -A`), commit with conventional message.
8. `gh auth switch --user drepscore`
9. Push: `git push -u origin HEAD`
10. Create PR: `gh pr create --title "[type]: [description]" --body "[chunk context, quality targets met, audit dimensions addressed]" --base main`
11. Wait for CI: `gh pr checks <N> --watch` — if fails, fix and push (max 3 retries).
12. STOP after CI passes. Do NOT merge. Report back:

CHUNK_COMPLETE:
- PR: #[number]
- Branch: [name]
- Files changed: [count]
- Tests: [pass/fail/count]
- CI: [pass/fail]
- Quality targets met: [list which audit criteria were addressed]
- Decisions encountered: [any unexpected forks — "none" if smooth]
- Ready to merge: [yes/no]

## Escalation Rules

- If you encounter a genuine architectural decision not covered in the approved plan: STOP and report the decision point. Do NOT guess.
- If a dependency is missing (table doesn't exist, API not available): STOP and report the blocker.
- If preflight fails on code you didn't write: fix it if trivial, otherwise STOP and report.
- For everything else: proceed autonomously. You have the approved plan — execute it.
```

### Parallelism Rules

- Chunks with no dependencies: launch ALL simultaneously
- Chunks in the same PR group: launch ONE agent that builds all of them together
- Chunks with dependencies: launch AFTER their dependency merges successfully

---

## Phase 5: Autonomous Deployment

After chunk agents return with completed PRs, execute the merge sequence.

### 5.0 Deploy Mode Check

Read `.claude/rules/deploy-config.md` for the current deploy target.

- **If `production`**: Execute the full merge sequence below autonomously.
- **If `staging`**: Report all PRs with their CI status and stop. Tell the user: "All PRs are ready for review. CI is green. Merge when ready."

### 5.1 Merge Sequence (Production Mode)

Process PR groups in the order determined in Phase 2.5. For each group:

1. **Rebase check**: `git fetch origin && git log --oneline origin/main..HEAD` — if behind, rebase the PR branch.
2. **Pre-merge check**: `bash scripts/pre-merge-check.sh <PR#>` — if blocked, wait and retry (max 3 attempts with 60s between).
3. **Merge**: `gh api repos/drepscore/drepscore-app/pulls/<N>/merge -X PUT -f merge_method=squash`
4. **Migrations**: If the chunk included database migrations, apply via Supabase MCP `apply_migration`, then `npm run gen:types`.
5. **Deploy wait**: Poll Railway for ~5 minutes until the new commit is deployed.
6. **Inngest sync**: If Inngest functions were added/modified, PUT `https://drepscore.io/api/inngest`.
7. **Smoke test**: `npm run smoke-test` + hit any new/changed endpoints on production.
8. **Verification gate**:
   - If smoke test PASSES: log success, proceed to next group.
   - If smoke test FAILS: **STOP the entire sequence.** Report the failure to the user with:
     - Which PR just merged
     - What failed in the smoke test
     - Which PRs are still pending
     - Suggested action (hotfix vs revert)

### 5.2 Cross-Group Coordination

Between PR groups:

- Pull latest main into the next group's branches: `git fetch origin && git rebase origin/main`
- Re-run preflight on the rebased branch if the rebase had conflicts
- Re-push if rebased: `git push --force-with-lease`

### 5.3 Handling Failures

- **CI failure on a PR**: The chunk agent should have already fixed it (max 3 retries). If it's still failing, report to user.
- **Pre-merge check blocked**: Wait for in-flight CI to complete, then retry. Max 3 attempts.
- **Smoke test failure after merge**: STOP. Alert user. Do NOT merge remaining PRs. Suggest hotfix or revert.
- **Rebase conflict**: STOP. Alert user with the conflicting files. This usually means two chunks modified the same file unexpectedly.

---

## Phase 6: Post-Build Verification

After all PRs are merged and deployed (or in staging mode, after all PRs pass CI):

### 6.1 Targeted Audit

Launch audit subagents ONLY for the dimensions identified in the Phase 1C pre-screen as "affected." Use the Agent tool — same pattern as `/audit-all` but scoped.

Each audit subagent should:

1. Read its audit command file
2. Execute only the phases relevant to the new step's features
3. Score the affected dimensions
4. Compare against the quality targets from Phase 1C

### 6.2 Build Manifest Update

Update `docs/strategy/context/build-manifest.md`:

- Check off items that were built: `[ ]` → `[x]`
- Add file references for new implementations
- Update step status if all items are now complete

### 6.3 Completion Report

Present to the user:

```
## Step [N] Build Complete

### Deployed
- PR #X: [title] — merged, deployed, verified
- PR #Y: [title] — merged, deployed, verified

### Audit Results (Post-Build)
| Dimension | Pre-Build | Post-Build | Target | Status |
|-----------|-----------|------------|--------|--------|
| [dim]     | [score]   | [score]    | 8+     | [met/gap] |

### Build Manifest Updated
- [X] items checked off
- Step status: [COMPLETE / REMAINING: list]

### Remaining Work (if any)
- [Feature not built]: [reason — deferred, blocked, needs decision]

### Lessons
- [Anything learned during the build worth recording via /learn]
```

---

## Rules

- **Phase 3 is NON-NEGOTIABLE.** Never skip the decision gate. The user must approve the plan before any code is written.
- **Chunk agents escalate, never guess.** An unexpected decision point is worth a 5-minute pause, not a wrong assumption baked into production code.
- **Deploy mode is authoritative.** Read `.claude/rules/deploy-config.md` and follow it. Don't ask the user to confirm what's already configured.
- **Smoke test failures STOP the sequence.** Never merge the next PR after a failure. The user decides whether to hotfix or revert.
- **Build manifest is the source of truth.** Update it in the same PR as the code, or immediately after all PRs merge.
- **Audit pre-alignment is the ROI.** The Phase 1C pre-screen is what prevents rework. Ensure every chunk agent has its quality targets. Building to audit targets on first pass saves an entire audit → fix cycle.
- **Challenge assumptions before building, not after.** Phase 2.3 exists to surface risks while they're cheap to address.
- **World-class is a conscious choice per chunk.** Don't gold-plate everything. Don't cut corners on fundamentals. Let the user decide where extra investment is worth it.
