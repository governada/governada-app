Build a vision step end-to-end: research, plan, get user approval, execute in parallel, deploy autonomously.

## Input

Argument: `$ARGUMENTS` — Required: step/phase number (e.g., "2", "3"). Optional scope qualifier.

## Checkpoint System

Writes session state to `.claude/checkpoints/build-step-[N].md` after each phase. If context compacts or session resumes, read the checkpoint file to recover state.

## Phase 1: Vision Intelligence (3 Parallel Subagents)

Launch ALL simultaneously. READ-ONLY research. Each writes findings to a checkpoint file.

**IMPORTANT:** All subagents MUST read `docs/strategy/context/product-registry.md` first to understand what features already exist. The Codebase Scout must also read the relevant `docs/strategy/context/registry/<domain>.md` files for domains touched by this phase.

**1A. Vision Analyst** — "Read `docs/strategy/context/product-registry.md` + `docs/strategy/ultimate-vision.md` Phase [N] + `docs/strategy/context/build-manifest.md` + relevant persona docs. Cross-reference registry to identify which vision items are already shipped vs. genuinely remaining. Extract every remaining [ ] item with: feature name, vision spec, persona impact, dependencies, success criteria. Flag ambiguities as decision points. **Write findings to `.claude/checkpoints/build-step-[N]-vision.md`**. Return: item count, already-shipped count, decision point count."

**1B. Codebase Scout** — "Read `docs/strategy/context/product-registry.md` + relevant `registry/<domain>.md` files. Then read build-manifest for Phase [N] requirements. Use registry as starting point to find: partial implementations, patterns to follow, reusable infrastructure, integration points. Check database tables + migrations. **Per `.claude/rules/build-on-existing.md`: For every feature in the phase, search for existing implementations that can be extended. The default recommendation MUST be 'extend existing' unless extension is genuinely infeasible — document why for each case.** Also assess foundation health: are the dependencies this phase builds on solid, or do they need hardening first? Flag any dependency that is fragile, undertested, or missing edge case handling. **Write findings to `.claude/checkpoints/build-step-[N]-codebase.md`**. Return: existing work summary, extend-vs-new count, foundation concerns count, technical risk count."

**1C. Audit Pre-Screen** — "Read build-manifest for Phase [N]. Read audit command files + `audit-rubric.md`. For each affected audit dimension: define what 8+/10 looks like for this phase's features. **Write findings to `.claude/checkpoints/build-step-[N]-audit.md`**. Return: affected dimension count."

**After all return**, write consolidated checkpoint to `.claude/checkpoints/build-step-[N].md` with status `PHASE_1B_CHALLENGE`, phase 1 summary, and links to detail files.

## Phase 1B: Strategic Challenge (MANDATORY DISCUSSION)

Before jumping to architecture, force a deeper conversation with the user. This is not a formality — this is where the best decisions get made.

Present findings from Phase 1, then ASK these questions (adapt to context, but cover all categories):

### Problem Space

- "Here's my understanding of what we're solving and who it's for. Is there a dimension I'm missing?"
- "What adjacent problems does this touch that we should consider? Even if we don't solve them now, should the architecture accommodate them?"
- "Are there user scenarios we haven't discussed that would change the approach?"

### Foundation Health

- "The Codebase Scout found [N] foundation concerns. Before we build on top of these, should we harden them first?" (Present specifics from 1B)
- "These existing components would be extended: [list]. Are any of them overdue for a rethink rather than another extension?"

### Ambition Calibration

- "Here's what 'solid' (7/10) looks like for this phase, and here's what 'world-class' (9+/10) looks like. Which features deserve the 9+/10 treatment? Where is solid sufficient?"
- "Is there anything we could build here that would genuinely surprise and delight users — something competitors haven't even attempted?"
- "What would a world-class CTO push back on in this plan? What would they add?"

### Scope & Sequencing

- "Here's what I think we should defer vs include. Does this match your priorities?"
- "If we could only ship 3 things from this phase, which 3 would matter most?"
- "Is there a smaller version of this that delivers 80% of the value and lets us validate before building the rest?"

### Surface Area

- "This phase touches these surfaces: [list routes/components]. Are there other surfaces that should reflect these changes that I haven't considered?"
- "Which existing features should behave differently once this ships?"

**Do NOT proceed to Phase 2 until the user has engaged with these questions.** The goal is mutual understanding, not a rubber stamp. If the user's answers reveal new requirements or change priorities, update the checkpoint.

**Update checkpoint**: Set status to `PHASE_2_PLANNING`, record discussion outcomes.

## Phase 2: Architecture Proposal

Read all Phase 1 checkpoint files + Phase 1B discussion outcomes. Synthesize into a build plan per `docs/strategy/context/work-plan-template.md`:

1. **Chunk breakdown**: PR-sized chunks with priority, effort, audit dimensions, files, patterns
2. **Existing code audit**: Per chunk — list files being modified vs new files being created. If new > modified, justify each new file. The default is extension over creation. Reference Codebase Scout findings.
3. **Foundation prerequisites**: If Phase 1B identified foundation concerns, include hardening chunks BEFORE feature chunks. No building on shaky ground.
4. **Decision points**: Question, options with pros/cons, recommendation, reversibility
5. **Assumption challenges**: State, challenge, mitigation for each implicit assumption
6. **World-class bar**: Per chunk — solid (7/10) vs world-class (9+/10), per user's Phase 1B preferences
7. **Merge sequence**: Independent (parallel) → grouped (atomic) → sequential (ordered)
8. **Visual acceptance criteria**: Per chunk that touches UI — describe what "done" looks like visually. Include:
   - What the user should see on the page (specific components, data, states)
   - How it should behave on mobile (375px)
   - What error/loading/empty states should look like
   - Which personas see which variations
   - A "screenshot test" — a sentence describing what a screenshot of the finished work should show

## Phase 3: Decision Gate (MANDATORY PAUSE)

Present full plan. Ask: chunk breakdown OK? Decision point preferences? Solid vs world-class per chunk? Scope changes? Foundation-first ordering acceptable? Visual acceptance criteria match your vision? **Do NOT proceed until user approves.**

Send notification: `npm run notify -- "decision_gate" "/build-step [N]: Plan ready" "[chunk count, migration count, estimated time]"`

**Update checkpoint**: Set status to `PHASE_4_EXECUTING`, record approved decisions, approved visual acceptance criteria.

## Phase 4: Parallel Execution

Launch chunk agents in worktrees (`isolation: "worktree"`).

Each agent gets:

- Scope and approved decisions
- Quality targets from audit pre-screen
- Patterns to follow and files to read
- **Visual acceptance criteria** from Phase 2 — the agent MUST verify these before declaring done
- **The "Robust & Correct" philosophy** from CLAUDE.md — understand deeply, extend existing, root causes

### Chunk Agent Instructions

```
Read first. Understand the existing code before writing anything.

Implement the chunk scope per the approved plan.

Follow CLAUDE.md constraints (force-dynamic, TanStack Query, feature flags, etc.).

Search for existing patterns before creating anything new (build-on-existing rule).

BEFORE declaring done, verify EVERY visual acceptance criterion:

1. Start the dev server with preview_start (name "dev")
2. Authenticate as each relevant persona (preview_eval with /api/auth/dev-mock)
3. Navigate to every affected route
4. For each route:
   a. preview_snapshot — verify content matches acceptance criteria (correct components, data, states)
   b. preview_console_logs level "error" — zero errors
   c. preview_network filter "failed" — zero failed requests
   d. preview_resize preset "mobile" — verify mobile layout works
   e. preview_screenshot — capture proof
5. Test error states: use preview_eval to simulate API failure or empty data where applicable
6. Test loading states: verify skeletons appear (not spinners or blank screens)

If ANY acceptance criterion is not met:
- Fix it. Do not skip it. Do not note it as "follow-up."
- If you genuinely cannot fix it (blocked by dependency, requires data you don't have), ESCALATE — do not silently ship without it.

Only after ALL criteria pass:
- preflight
- commit (conventional: feat:/fix:/refactor:)
- gh auth switch --user governada
- push, create PR (include Existing Code Audit + Robustness checklist in body)
- wait for CI (max 3 retries)
- STOP, report: PR#, files changed, tests, CI status, which acceptance criteria passed, screenshots as evidence
```

**Escalation rules**: Unexpected decision → STOP. Missing dependency → STOP. Acceptance criterion can't be met → STOP with explanation. Otherwise proceed autonomously.

Parallelism: independent chunks launch simultaneously. Same-PR groups = one agent. Dependent chunks wait for dependency merge.

**Update checkpoint**: Record each PR# and status as agents complete. Include acceptance criteria pass/fail per chunk.

## Phase 5: Autonomous Deployment

Read `.claude/rules/deploy-config.md` for mode. Follow deploy pipeline in `docs/strategy/context/commands-reference.md`.

For each PR group in merge order: rebase check → `npm run pre-merge-check -- <PR#>` → merge (squash) → apply migrations → wait for Railway → Inngest sync if needed → smoke test. If smoke test FAILS → STOP entire sequence, alert user.

Between groups: rebase next group's branches onto updated main.

## Phase 6: Post-Build Verification

1. **Visual verification in production** (REQUIRED for any UI changes):
   - Open production in Claude Chrome or Preview
   - Navigate to every route affected by the build
   - Verify each chunk's visual acceptance criteria against PRODUCTION (not just local)
   - Screenshot at desktop + mobile
   - If anything doesn't match the approved acceptance criteria → flag immediately, fix before declaring complete

2. Launch targeted audit subagents for affected dimensions only
3. Validate affected user journeys end-to-end (not just individual pages)
4. Update `build-manifest.md` checkboxes
5. Present completion report:
   - PRs deployed
   - Acceptance criteria: passed/failed/deferred per chunk
   - Audit scores: pre vs post vs target
   - Screenshots as evidence
   - Remaining work (honest — what didn't make it and why)

Send notification: `npm run notify -- "complete" "/build-step [N] finished" "[results summary]"`

**Update checkpoint**: Set status to `COMPLETE`, record final scores and verification evidence.

## Rules

- Phase 1B is NON-NEGOTIABLE — the user must engage with strategic questions before planning
- Phase 3 is NON-NEGOTIABLE — user must approve before code
- Checkpoint file is written after EVERY phase transition
- Chunk agents verify their own work visually before declaring done — code that compiles is not done, code that looks right in the browser is done
- Chunk agents escalate, never guess, never silently skip acceptance criteria
- Smoke test failures STOP the sequence
- Audit pre-alignment prevents rework — every chunk gets quality targets
- Foundation concerns are addressed BEFORE feature chunks — no building on shaky ground
- If a chunk agent can't meet an acceptance criterion, it STOPS and explains why. The orchestrator decides whether to proceed, descope, or fix the dependency.
