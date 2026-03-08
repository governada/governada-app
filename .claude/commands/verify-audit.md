Verify that gaps identified in a previous audit have been closed.

## Purpose

Lightweight follow-up after agents execute work plan chunks. Re-scores ONLY the affected dimensions — not a full audit.

## Input

Argument: `$ARGUMENTS`

- If a file path: Read the work plan document at that path
- If empty: Look for the most recent work plan in `docs/strategy/` or ask the user which audit to verify

## Process

1. **Read the previous audit's work plan.** Identify which chunks were executed (check git log for related PRs/commits).

2. **For each completed chunk:**
   - Read the "Verification" section from the chunk definition
   - Execute the verification steps (check files exist, run tests, verify production endpoints)
   - Score PASS / PARTIAL / FAIL with evidence

3. **Re-score affected dimensions only.** Read `docs/strategy/context/audit-rubric.md` for criteria. Score only the dimensions that the completed chunks were supposed to improve.

4. **Update build-manifest.md** if any gaps were closed (new `[x]` checkboxes).

5. **Update the Audit Score History** at the bottom of `docs/strategy/context/build-manifest.md` with the new dimension scores.

## Output Format

```markdown
## Audit Verification — [DATE]

### Previous audit: [date/reference]

### Chunks verified: [N of M completed]

| Chunk | Status            | Evidence | Score Impact         |
| ----- | ----------------- | -------- | -------------------- |
| ...   | PASS/PARTIAL/FAIL | ...      | Dimension X: old→new |

### Updated Scores (affected dimensions only)

| Dimension | Previous | Current | Delta |
| --------- | -------- | ------- | ----- |
| ...       | X/10     | Y/10    | +/-Z  |

### Remaining Gaps

[List any chunks that were PARTIAL or FAIL, with guidance on what's still needed]
```

## Rules

- Don't re-evaluate dimensions that weren't targeted by the work plan
- Don't inflate scores — if a chunk was PARTIAL, the dimension score should reflect that
- Update `build-manifest.md` in the same response if checkboxes changed
- If all chunks pass, congratulate briefly and suggest the next audit focus area
