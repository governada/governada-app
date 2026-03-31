Root cause analysis for bugs and unexpected behavior. Use this BEFORE writing any fix for a non-trivial issue.

This skill enforces disciplined debugging. Do NOT skip phases. Do NOT guess. The goal is to understand WHY the bug exists, not just WHAT the symptom is.

## When to Use

- User reports a bug or unexpected behavior
- An agent encounters unexpected behavior during development
- A test fails and the cause isn't immediately obvious
- A deployed feature doesn't work as expected
- Any time you're tempted to "try a fix and see if it works"

## Phase 1: Reproduce

Confirm the issue exists and define exact reproduction steps.

- **If UI bug**: Use Preview tools or Claude Chrome to reproduce. Screenshot the failure.
- **If API bug**: Craft the exact request that triggers it. Show the response.
- **If data bug**: Query the specific data that's wrong. Show expected vs actual.
- **If test failure**: Run the specific test. Show the output.

If you cannot reproduce the issue, STOP. Tell the user: "I cannot reproduce this issue. Here's what I tried: [steps]. Can you provide more specific reproduction steps?"

**Output**: "Reproduction confirmed. Steps: [1, 2, 3]. Expected: [X]. Actual: [Y]."

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

## Phase 5: Fix at Root

ONLY after Phases 1-4, propose and implement a fix that addresses the ROOT cause.

Rules:

- The fix must address the root cause identified in Phase 3-4, not the symptom observed in Phase 1
- Search for other places in the codebase with the same pattern — if this bug exists here, it likely exists elsewhere. Fix all instances.
- The fix should be minimal — change only what's necessary to resolve the root cause. Do not refactor surrounding code.
- If the fix requires changing a shared function/utility, verify that all callers still work correctly.

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
