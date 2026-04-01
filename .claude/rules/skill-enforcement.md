---
paths:
  - '**'
---

# Skill Enforcement — Meta-Skill

This rule activates on EVERY task. Before writing any code, check whether a mandatory skill applies. If it does, invoke it. If you're already mid-task and realize you skipped one, STOP and invoke it now.

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
4. **If no: proceed normally.** Simple config changes, docs, single-line fixes are fine without a skill.

## Detection: When You're Skipping a Skill

- **Bug fix without `/diagnose`**: Can't articulate root cause in one sentence → STOP, invoke `/diagnose`
- **Feature work without `/build-step`**: Creating multiple files without a plan → STOP
- **Shipping without `/adversarial-review`**: Multi-file change without hostile review → STOP
- **"Quick fix" that touches 5+ files**: What started small has grown → STOP, reassess
- **Declaring work "done" without verification**: Not verified in Preview/Chrome → STOP

## Whack-a-Mole Detector

When the user corrects your analysis or asks "but why?", you stopped too early. Do NOT patch the next symptom — restart root cause analysis from scratch. Gather forensic evidence, trace the full causal chain, then propose a fix that addresses the root cause and eliminates all symptoms together.

**The test**: If your fix requires the agent to "remember to do something differently," it's a process patch (fragile). If it changes the infrastructure so the problem can't occur regardless of behavior, it's durable. Prefer infrastructure fixes.

## Exceptions

- **Trivial changes** (typos, single-line config, comment updates): No skill needed
- **User explicitly says "just do it"**: Respect the request, but note which skill was skipped
- **Mid-skill execution**: Don't invoke a skill recursively

## Verify Before Hypothesizing

**NEVER form a hypothesis before checking actual data.** Run the most direct diagnostic command first. Name your evidence — "I believe X because line Y of file Z shows..." — if you can't complete that sentence, you're guessing. If your first fix doesn't work, your hypothesis is wrong — go back to raw data.

Anti-pattern: Multiple agents assumed a phantom diff was CRLF because CRLF warnings appeared in hook output. None ran `git status --short`. It was untracked `perf-snapshots/` files — unrelated to CRLF.

## Prevention-First Thinking

Every fix must include a prevention layer. Before committing, ask:

1. **What class of problem does this address?** (not just this instance)
2. **What would cause this class to recur?** (if the answer involves an agent forgetting, the fix is incomplete)
3. **What automated guard prevents recurrence?** (hook, assertion, CI check — create one if none exists)

Infrastructure fixes (hooks, type system) beat process fixes (CI checks) beat documentation. Aim for level 1.

**Before any commit**: "If this same class of problem happens again in 2 weeks, will my fix prevent it automatically?" If the answer is "someone has to catch it," add a prevention layer.
