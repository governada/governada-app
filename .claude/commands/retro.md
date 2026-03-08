You just completed a build session. Perform a thorough documentation review: capture learnings, update stale docs, and prune bloat. This is a maintenance task — be surgical, not expansive.

## 1. Capture Session Learnings

Review the conversation history for:

- **Corrections**: Anything the user corrected you on
- **Surprises**: APIs, tools, or platform behavior that was unexpected
- **Rework**: Plans that changed mid-execution and why
- **Debugging**: Root causes that took 2+ attempts to find
- **Process failures**: Steps skipped, wrong order, wasted time

For each, write a concise entry in `.cursor/tasks/lessons.md` with: date, context (1-2 sentences), pattern (the reusable takeaway), and whether it should be promoted to a rule.

Skip if nothing notable happened.

## 2. Audit Rules for Staleness

Read CLAUDE.md and check against the ACTUAL codebase:

- **Dead references**: Files, functions, tables, or env vars that no longer exist. Remove them.
- **Outdated counts/lists**: e.g., function counts — verify against actual `serve()` array. Update if wrong.
- **Superseded patterns**: Old approaches that have been replaced. Update to reflect current architecture.
- **Contradictions**: Resolve in favor of Critical Rules section.

## 3. Audit Lessons for Promotion or Pruning

Read `.cursor/tasks/lessons.md` end-to-end:

- **Promote**: Pattern appeared 2+ times → propose adding to CLAUDE.md. Mark as promoted.
- **Consolidate**: Multiple lessons about same topic → merge into one entry.
- **Archive**: One-time issues that can't recur → delete them.

## 4. Verify Architecture Docs

Check CLAUDE.md against reality:

- **Key Files table**: Are listed files still canonical? Any new key files missing?
- **Inngest function list**: Does it match `app/api/inngest/route.ts` `serve()` array?
- **Scoring model**: Does it match the actual implementation?

## 5. Commit Changes

After all edits, commit directly to the current branch:

```bash
git add CLAUDE.md .cursor/tasks/
git commit -m "docs: retro — <1-line summary>"
```

## 6. Output

Provide a summary of changes made.
