Root cause analysis for bugs and unexpected behavior. Use this BEFORE writing any fix for a non-trivial issue.

This skill enforces disciplined debugging. Do NOT skip phases. Do NOT guess. The goal is to understand WHY the bug exists, not just WHAT the symptom is.

## When to Use

- User reports a bug or unexpected behavior
- An agent encounters unexpected behavior during development
- A test fails and the cause isn't immediately obvious
- A deployed feature doesn't work as expected
- Any time you're tempted to "try a fix and see if it works"

## Phase 1: Reproduce & Reconstruct Timeline

Confirm the issue exists, define exact reproduction steps, and reconstruct the timeline of events that led to it.

- **If UI bug**: Use Preview tools or Claude Chrome to reproduce. Screenshot the failure.
- **If API bug**: Craft the exact request that triggers it. Show the response.
- **If data bug**: Query the specific data that's wrong. Show expected vs actual.
- **If test failure**: Run the specific test. Show the output.
- **If environment/infra issue** (wrong state, stale code, broken tools, config drift): Reconstruct the forensic timeline using hard evidence — not assumptions:
  - `git reflog --date=iso` — when was the branch/worktree created? From what commit?
  - `git log --format="%H %ai %s"` — when did relevant PRs actually merge?
  - `git ls-files --eol` — are line endings causing phantom modifications?
  - `git config --list --show-origin` — what config is inherited from where?
  - `git diff --numstat` — are reported "modifications" real or zero-change diffs?
  - Hook output from session start — did any hooks warn or fail?

**The first plausible explanation is usually a symptom, not the root cause.** Before accepting any hypothesis, verify it with timestamped evidence. "The agent didn't commit frequently" is a process symptom. "CRLF phantom diffs prevented auto-rebase" is the infrastructure root cause.

If you cannot reproduce the issue, STOP. Tell the user: "I cannot reproduce this issue. Here's what I tried: [steps]. Can you provide more specific reproduction steps?"

**Output**: "Reproduction confirmed. Steps: [1, 2, 3]. Expected: [X]. Actual: [Y]. Timeline: [timestamps of key events]."

## Phase 2: Trace

Follow the data/control flow from symptom to source. READ the code — do not guess.

Start at the symptom (the component/route/function that produces wrong output) and trace backward:

1. What function produces this output?
2. What data does it receive?
3. Where does that data come from?
4. Is the data wrong, or is the transformation wrong?
5. Keep tracing until you find the point where correct becomes incorrect.

**Read every file in the chain.** Do not skip files because you assume they work correctly. The bug is in the place you didn't look.

**Output**: "Trace complete. The data flow is: [A] → [B] → [C] → [D]. The issue originates at [C] because [specific observation from reading the code]."

## Phase 3: Hypothesize

Form a specific, falsifiable hypothesis about the root cause.

A good hypothesis:

- "The `getScoreHistory` function in `lib/data.ts:142` returns stale data because the Supabase query doesn't filter by the current epoch, so it includes historical records that should be excluded."

A bad hypothesis:

- "Something is wrong with the scoring." (too vague)
- "Maybe the database has bad data." (not specific enough to verify)
- "The component might not be rendering correctly." (describes the symptom, not the cause)

**Output**: "Hypothesis: [specific claim]. If this is correct, I expect to find [X] when I check [Y]."

## Phase 4: Verify Hypothesis

Prove or disprove your hypothesis. Do NOT write a fix yet.

- Read the specific code your hypothesis points to
- Check the specific data your hypothesis claims is wrong
- Run the specific test that would confirm your hypothesis
- If you claimed "X doesn't filter by Y", verify by reading the query

**If hypothesis is CORRECT**: Proceed to Phase 5.

**If hypothesis is WRONG**: Return to Phase 2 with the new information you learned. Do NOT guess a different cause — trace again with updated understanding. After 3 wrong hypotheses, escalate to the user with everything you've learned:

> "I've investigated this issue through 3 hypotheses, all disproven. Here's what I've learned:
>
> - Hypothesis 1: [what + why wrong]
> - Hypothesis 2: [what + why wrong]
> - Hypothesis 3: [what + why wrong]
> - The data flow is: [trace]
> - What I've ruled out: [list]
> - What I haven't checked: [list]
>   I need your input on where to look next."

## Phase 5: Fix at Root + Prevent Recurrence

ONLY after Phases 1-4, propose and implement a fix that addresses the ROOT cause AND prevents the same class of problem from recurring.

Every fix has TWO parts. Both are required:

### Part A: The immediate fix

- The fix must address the root cause identified in Phase 3-4, not the symptom observed in Phase 1
- Search for other places in the codebase with the same pattern — if this bug exists here, it likely exists elsewhere. Fix all instances.
- The fix should be minimal — change only what's necessary to resolve the root cause. Do not refactor surrounding code.
- If the fix requires changing a shared function/utility, verify that all callers still work correctly.

### Part B: The prevention layer

Ask: **"What infrastructure change would make this class of problem impossible, regardless of agent behavior?"**

Examples of prevention layers:

- Bug was caused by missing validation → add a schema/type guard that rejects bad input at the boundary
- Bug was caused by stale state → add a hook/check that auto-refreshes or blocks on stale data
- Bug was caused by a process being skipped → add a pre-commit hook, CI check, or runtime assertion that enforces the process
- Bug was caused by wrong directory/context → add a guard that detects and blocks the wrong context

**The litmus test**: If the prevention layer requires an agent to "remember to do X," it's not a prevention layer — it's a wish. Prevention layers are automated checks, hooks, guards, or assertions that fire without human/agent memory.

If no automated prevention is feasible, document the failure mode in the relevant CLAUDE.md troubleshooting table so future agents can self-diagnose.

## Phase 6: Verify Fix

Confirm the fix resolves the original issue AND doesn't break adjacent behavior.

1. **Re-reproduce**: Run the exact reproduction steps from Phase 1. The issue must be resolved.
2. **Adjacent behavior**: Check that related functionality still works (e.g., if you fixed score calculation, verify that score display, score history, and score comparisons all still work).
3. **Write a test**: If a test doesn't already exist for this case, write one that would have caught the original issue. The test should fail without the fix and pass with it.
4. **Run full test suite**: `npx vitest run` to verify no regressions.

## Rules

- **Never skip phases.** Even if you "know" the answer, prove it by tracing.
- **Never guess.** If you're about to type "maybe" or "might be", you need to read more code.
- **Wrong hypothesis = back to Phase 2, not a different guess.** Each failed hypothesis gives you new information. Use it.
- **3 failures = escalate.** Don't spiral. Share what you've learned and ask for help.
- **Minimal fix.** The fix addresses the root cause and nothing else. No cleanup, no refactoring, no "while I'm here" changes.
- **Test the fix.** A fix without a test is hope, not a fix.
