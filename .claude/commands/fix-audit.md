Take audit findings and autonomously fix them: plan, approve, execute in parallel, deploy, verify scores improved.

## Input

Argument: `$ARGUMENTS`

- If empty: Ask which audit to fix
- If "last": Use most recent audit findings from current conversation
- If audit name (e.g., "sync", "ux", "security"): Run that audit first, then fix
- If "all": Run `/audit-all quick`, then fix all P0 and P1

## Checkpoint System

Writes session state to `.claude/checkpoints/fix-audit.md` after each phase. If context compacts or session resumes, read the checkpoint file to recover state. Also check `.claude/audit-results/` for prior audit output.

## Phase 1: Gather Findings

Extract from existing audit, conversation history, or `.claude/audit-results/` files. Produce consolidated gap list and **write to checkpoint** (`.claude/checkpoints/fix-audit.md`) with status `PHASE_2_PLANNING`:

```
GAP_ID | Priority | Source Audit | Dimension | Description | Affected Files | Effort
```

## Phase 2: Plan Fix Chunks

Per `docs/strategy/context/work-plan-template.md`:

1. Group related gaps into PR-sized chunks (same files → same chunk, P0s separate)
2. Order: independent P0s (parallel) → sequential P0s → P1 batches
3. Per chunk: gap IDs, dimensions improved, expected score impact, fix approach, files, verification, risk

## Phase 3: Decision Gate (MANDATORY PAUSE)

Present: gap summary, chunk breakdown, fix sequence, scope choices, skip list. Ask for approval. **Do NOT proceed until approved.**

Send notification: `bash scripts/notify.sh "decision_gate" "/fix-audit: Plan ready" "[gap count, chunk count]"`

**Update checkpoint**: Set status to `PHASE_4_EXECUTING`, record approved decisions.

## Phase 4: Parallel Execution

Launch agents in worktrees (`isolation: "worktree"`). Two modes:

**Foundation fixes (Tier 1):** Fix ONLY identified gaps. Don't refactor surrounding code. Don't add features. **Before writing any fix: search for existing patterns that handle the same case elsewhere in the codebase. Reuse existing error handling, validation, or component patterns. Do NOT create new utility functions if a suitable one exists in `lib/` or `utils/`. See `.claude/rules/build-on-existing.md`.** If fixing reveals deeper issue → note but don't fix. Preflight → commit `fix: [description]` → push → PR → CI → STOP.

**Craft items (Tier 2 — intelligence, delight, design):** Creative license within scope. Match the 10/10 spec. Purpose-built over generic. Micro-interactions matter. Dark mode first-class. Commit `feat: [description]` → push → PR with "Craft:" prefix → CI → STOP.

Escalation: >200 line fix → STOP. Fix breaks another area → STOP. Approach doesn't work → propose alternative.

**Update checkpoint**: Record each PR# and status as agents complete.

## Phase 5: Autonomous Deployment

Read `.claude/rules/deploy-config.md`. Merge P0 fixes first → verify → then P1s. Follow deploy pipeline in `docs/strategy/context/commands-reference.md`. Smoke test failure → STOP, alert.

## Phase 6: Verification

Re-run affected audit dimensions. Present before/after score table. Report remaining gaps. Foundation before craft — Tier 2 only starts after Tier 1 merged.

## Rules

- Foundation fixes: fix gaps, don't add features
- Craft items: make it remarkable, not just adequate
- Phase 3 is non-negotiable
- Checkpoint written after EVERY phase transition
- Verify after fixing — a fix without re-audit is hope, not a fix
- Small blast radius per PR
