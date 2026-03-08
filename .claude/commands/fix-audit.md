Take audit findings and autonomously fix them: plan, approve, execute in parallel, deploy, and verify scores improved.

## Input

Argument: `$ARGUMENTS`

- If empty: Ask the user which audit to fix — they may have just run one, or you can run a fresh `/audit-all quick`
- If "last": Use the most recent audit findings from the current conversation
- If an audit command name (e.g., "sync", "ux", "security"): Run that specific audit first, then fix its findings
- If "all": Run `/audit-all quick`, then fix all P0 and P1 findings

---

## Phase 1: Gather Findings

### Option A: Use existing audit results

If the user just ran an audit in this conversation, extract:
- All scored dimensions with evidence
- All P0 and P1 gaps
- Any work plan chunks already produced

### Option B: Run a fresh audit

Launch the appropriate audit as a subagent (or multiple via `/audit-all`). Wait for results.

### Output

Produce a consolidated gap list:

```
GAP_ID | Priority | Source Audit | Dimension | Description | Affected Files | Estimated Effort
G1     | P0       | Security     | SEC3      | API routes missing rate limiting | lib/api/ | M
G2     | P0       | UX           | U4        | No loading skeletons on 5 pages | app/discover/ | S
...
```

---

## Phase 2: Plan Fix Chunks

Read `docs/strategy/context/work-plan-template.md` for the chunk format.

### 2.1 Convert Gaps to Chunks

Group related gaps into PR-sized chunks:
- Gaps affecting the same files → same chunk
- Gaps in the same audit dimension → consider grouping
- P0 gaps → separate chunks (ship fast, small blast radius)
- Related P1 gaps → can be batched for efficiency

### 2.2 Determine Fix Order

```
[Independent P0 chunks] ──all parallel──> [Sequential P0 chunks] ──> [P1 batches]
```

Rules:
- All independent P0s launch simultaneously
- P1s only start after all P0s are merged and verified
- Infrastructure fixes (migrations, lib changes) before consumer fixes (components, pages)

### 2.3 For Each Chunk, Define

- **Gap IDs addressed**: Which gaps from the list this fixes
- **Audit dimensions improved**: Which scores should increase
- **Expected score impact**: e.g., "SEC3: 5→7 (+2)"
- **Fix approach**: Specific technical approach (not just "fix it")
- **Files to modify**: Exact files
- **Verification**: How to confirm the fix works
- **Risk assessment**: Could this fix break something else?

---

## Phase 3: Decision Gate (MANDATORY PAUSE)

Present the fix plan to the user:

1. **Gap summary**: Total gaps found, by priority and audit domain
2. **Chunk breakdown**: Each chunk with gaps addressed, approach, effort, risk
3. **Fix sequence**: Visual merge order with parallelism
4. **Scope choices**: Any gaps where there are multiple fix approaches (quick patch vs proper fix)
5. **Skip list**: Any P2/P3 gaps intentionally deferred — explain why

Ask:
- "Do you approve this fix plan?"
- "Any gaps you want to reprioritize or skip?"
- "Any fix approaches you want to change?"

**Do NOT proceed until the user explicitly approves.**

---

## Phase 4: Parallel Execution

Same pattern as `/build-step` Phase 4. Launch chunk agents in worktrees.

### Fix Agent Instructions

Each fix agent receives:

```
You are fixing audit gaps for Civica. This is a TARGETED FIX — not a feature build.

## Gaps to Fix
[List of gap IDs, descriptions, and affected files from the approved plan]

## Fix Approach
[Approved technical approach for each gap]

## Files to Modify
[Exact file list]

## Constraints
- Fix ONLY the identified gaps. Do not refactor surrounding code.
- Do not add features. Do not "improve" things that weren't flagged.
- If fixing a gap reveals a deeper issue not in the plan, note it in your report but do not fix it.
- Follow all CLAUDE.md hard constraints (force-dynamic, TanStack Query, etc.)
- Write tests for fixes where the gap was "missing test coverage"

## Build Instructions
1. Read all affected files before writing any code.
2. Implement the fix following the approved approach.
3. Run `npm run preflight` and fix all failures.
4. Stage specific files, commit with message: `fix: [gap description]`
5. `gh auth switch --user drepscore`
6. Push: `git push -u origin HEAD`
7. Create PR referencing the gap IDs in the body.
8. Wait for CI: `gh pr checks <N> --watch` (max 3 retries on failure).
9. STOP after CI passes. Do NOT merge. Report back:

FIX_COMPLETE:
- PR: #[number]
- Gaps fixed: [G1, G2, ...]
- Files changed: [count]
- Tests added/modified: [count]
- CI: [pass/fail]
- Risk notes: [any concerns about the fix]
- Ready to merge: [yes/no]

## Escalation Rules
- If a fix is more complex than expected (would change >200 lines): STOP, report the complexity.
- If fixing one gap would break another area: STOP, report the conflict.
- If the approved approach doesn't work: STOP, propose an alternative.
- For everything else: proceed autonomously.
```

---

## Phase 5: Autonomous Deployment

Same pattern as `/build-step` Phase 5. Read `.claude/rules/deploy-config.md` for deploy mode.

### Merge Sequence

1. Merge all P0 fix PRs first (in dependency order)
2. Verify production after each merge (smoke test)
3. Then merge P1 fix PRs
4. If any smoke test fails: STOP, alert user

---

## Phase 6: Verification

### 6.1 Re-Run Affected Audits

Launch audit subagents ONLY for the dimensions that had gaps fixed. Each should:
1. Score the dimension fresh (not referencing the old score)
2. Compare against the pre-fix baseline
3. Report whether the gap is confirmed closed

### 6.2 Score Comparison

Present a before/after table:

```
| Dimension | Before | After | Target | Gap Closed? |
|-----------|--------|-------|--------|-------------|
| SEC3      | 5/10   | 7/10  | 8+     | Partially   |
| U4        | 6/10   | 8/10  | 8+     | Yes         |
```

### 6.3 Remaining Gaps

If any gaps weren't fully closed:
- Explain why (fix was partial, deeper issue found, etc.)
- Recommend whether to run another `/fix-audit` cycle or defer

### 6.4 Completion Report

```
## Audit Fix Cycle Complete

### Fixed
- [X] gaps closed across [Y] PRs
- Dimensions improved: [list with score deltas]

### Remaining
- [N] gaps partially addressed (details above)
- [M] gaps deferred to next cycle

### Lessons
- [Anything worth recording via /learn]
```

---

## Rules

- **Fix gaps, don't add features.** This command exists to close known issues, not to expand scope. If a fix agent discovers something new, it notes it but doesn't act on it.
- **Phase 3 is non-negotiable.** The user must approve the fix plan.
- **P0 before P1.** Always. No batching P0s with P1s for "efficiency."
- **Verify after fixing.** A fix that isn't verified is a hope, not a fix. The re-audit in Phase 6 is mandatory.
- **Small blast radius.** Each fix PR should be as small as possible. A fix that introduces a new bug is worse than the original gap.
- **Don't over-fix.** If the audit says "loading skeletons missing on 5 pages," add loading skeletons to those 5 pages. Don't redesign the loading system.
