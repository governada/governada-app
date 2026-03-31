# Skill Enforcement — Meta-Skill

This rule activates on EVERY task. Before writing any code, check whether a mandatory skill applies to the current task. If it does, invoke it. If you're already mid-task and realize you skipped an applicable skill, STOP and invoke it now.

## Mandatory Skill Mapping

| Task Type                      | Skill                 | When to Invoke                                                                                                           |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Bug fix or unexpected behavior | `/diagnose`           | Before writing ANY fix for a non-trivial bug. If you can't explain the root cause in one sentence, you need `/diagnose`. |
| Robustness/hardening pass      | `/harden`             | When explicitly asked to harden, or when review reveals missing error/loading/empty states across multiple components.   |
| Multi-phase feature build      | `/build-step`         | When the task spans multiple files, requires planning, or involves user-facing changes across multiple routes.           |
| Code review                    | `/review`             | Before approving or shipping code you or another agent wrote.                                                            |
| Deploy to production           | `/ship`               | Every deploy, no exceptions.                                                                                             |
| Hostile validation             | `/adversarial-review` | Before shipping any significant feature work (3+ files changed, new routes, user-facing changes).                        |

## How This Rule Works

At the start of every task:

1. **Classify the task** — Is it a bug fix? Feature build? Hardening? Refactor? Deploy?
2. **Check the mapping above** — Does a mandatory skill apply?
3. **If yes: invoke it.** Do not skip it because the task "seems simple" or "I already know the answer."
4. **If no: proceed normally.** Not every task needs a skill — simple config changes, docs, single-line fixes are fine without.

## Detection: When You're Skipping a Skill

You are likely skipping a mandatory skill if:

- **Bug fix without `/diagnose`**: You're about to write a fix but can't articulate the root cause → STOP, invoke `/diagnose`
- **Feature work without `/build-step`**: You're creating multiple files for a feature without a plan → STOP, consider whether `/build-step` applies
- **Shipping without `/adversarial-review`**: You're about to `/ship` a multi-file change without hostile review → STOP, run `/adversarial-review` first
- **"Quick fix" that touches 5+ files**: What started as a small fix has grown → STOP, reassess whether this needs `/build-step` planning
- **Declaring work "done" without verification**: You're about to mark a task complete but haven't verified it in Preview/Chrome → STOP, verify first

## Whack-a-Mole Detector

**When the user corrects your analysis or asks "but why?", you stopped too early.** Each correction is a signal that you proposed a fix for a symptom, not the root cause. The correct response is NOT to patch the next symptom — it's to restart root cause analysis from scratch.

Pattern to recognize:

1. You propose fix A for symptom X
2. User says "but what about Y?" or "why does X happen in the first place?"
3. You propose fix B for symptom Y ← **THIS IS WHACK-A-MOLE**
4. User says "but why does Y happen?"
5. You finally investigate and find root cause Z

What you should do at step 2:

1. STOP proposing fixes
2. Say: "You're right — I'm treating symptoms. Let me reconstruct what actually happened."
3. Gather forensic evidence (timestamps, reflog, config, file state)
4. Trace the full causal chain from root to all symptoms
5. Propose fixes that address the root cause, which will fix symptoms X AND Y

**The test**: If your fix requires the agent to "remember to do something differently," it's a process patch (fragile). If your fix changes the infrastructure so the problem can't occur regardless of agent behavior, it's a root cause fix (durable). Prefer infrastructure fixes.

## Exceptions

- **Trivial changes** (typos, single-line config, comment updates): No skill needed
- **User explicitly says "just do it"**: Respect the request, but note which skill was skipped
- **Mid-skill execution**: Don't invoke a skill recursively (e.g., don't run `/diagnose` inside `/build-step` Phase 4 unless a genuine unexpected bug appears)

## Prevention-First Thinking (Proactive, Not Reactive)

The whack-a-mole detector above triggers when the user catches you treating symptoms. But the goal is to **never need the user to catch you**. Every fix, feature, and change must proactively include a prevention layer.

### The 3-Question Gate (before every commit)

1. **"What class of problem does this fix/feature address?"** — Name the category, not just the instance. "CRLF phantom diffs" is an instance; "line-ending mismatches in Windows worktrees" is the class.

2. **"What would cause this class of problem to recur?"** — Identify the trigger conditions. If the answer involves an agent forgetting something, the fix is incomplete.

3. **"What automated guard prevents recurrence?"** — Name the hook, assertion, CI check, or runtime guard. If none exists, create one. If truly infeasible, document the failure mode in CLAUDE.md troubleshooting.

### Examples

| Fix                                | Instance thinking (incomplete)     | Class thinking (complete)                                                    |
| ---------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| CRLF phantom diffs                 | Add `.gitattributes` with `eol=lf` | `.gitattributes` + `git add --renormalize` + auto-cleanup in sync hook       |
| Agent creates branch in wrong repo | Tell agents not to do that         | Add a guard to `sync-worktree.sh` or hook that detects wrong-repo operations |
| Missing feature flag               | Add the flag                       | Add CI check or lint rule that flags ungated features                        |
| Stale data in narratives           | Add freshness check                | Staleness guard with carry-forward + alerting + per-page retry               |

**If your PR only has the left column, it's not done.** The right column is what prevents the founder from seeing the same class of bug again.

### Infrastructure > Process > Documentation

Ranked by durability:

1. **Infrastructure fix** (hook, assertion, guard, type system) — can't be bypassed by forgetting
2. **Process fix** (CI check, pre-commit hook) — requires setup but auto-enforces
3. **Documentation fix** (troubleshooting table, CLAUDE.md) — helps diagnosis but doesn't prevent

Always aim for level 1. Fall back to 2 if 1 isn't feasible. Level 3 alone is never sufficient for a recurring problem.

## Self-Check Prompt

Before any commit, ask yourself:

> "If I were the founder reviewing this work tomorrow, would they say I was thorough, or would they say I took shortcuts?"

If the answer is "shortcuts," you're probably skipping a skill or a verification step.

> "If this same class of problem happens again in 2 weeks, will my fix prevent it automatically, or will someone have to catch it again?"

If the answer is "catch it again," your fix is incomplete — add a prevention layer.
