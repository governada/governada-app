---
description: Core workflow protocol and behavioral standards
globs: ['**/*']
alwaysApply: true
---

<!-- LINE BUDGET: 60 lines. Overflow → workflow-procedures.md -->

# Workflow Protocol

> Read `.cursor/rules/critical.md` FIRST. It overrides everything here.

## Session Start

1. Read `tasks/lessons.md` for patterns from prior sessions
2. Read `tasks/todo.md` for any in-progress work
3. `git branch --show-current` + `git status` — orient to current state
4. For multi-step tasks, run `/start` for a full session setup
5. Check `tasks/lessons.md` line count — if over 80 lines, archive promoted entries to `tasks/lessons-archive.md`

## Planning (3+ step tasks)

First-principles checklist:

- What's the actual problem? (Diagnose before solving)
- What external APIs/libraries? (Research before building)
- What's the validation strategy? (Define checkpoints)
- What does the 6-month version look like? (Build toward it)
- Could this cause rework? (Flag risks)
- Check lessons for patterns that appeared 2+ times — propose promoting to a rule
  Write plan to `.cursor/plans/<feature>.plan.md` with goals, phases, validation gates.

## Build Phase

- **Branch check (step 0)**: `git branch --show-current`. On `main` and not a hotfix → STOP and branch first
- **Preflight after each batch**: Run `npm run preflight` after completing each batch in multi-batch plans. Catch formatting, lint, type, and test issues incrementally — not at the end
- **Research before build**: New library/API → research summary before implementation
- **Analytics inline**: Every new user interaction gets a PostHog event in the same diff (see `analytics.mdc`)
- **No orphaned components**: Every component created must be imported and rendered in the same commit
- **Deprecation audit**: When removing a system, search for all consumers of its data and state — not just imports
- **After migrations**: Run `npm run gen:types` to regenerate Supabase types. Commit the updated `types/database.ts`
- **Client data fetching**: Use TanStack Query (`useQuery`/`useMutation`) for ALL new client-side API calls. Never raw `fetch` + `useState` + `useEffect`. See `lib/queryClient.ts` for defaults
- **Server-side caching**: Use `cached()` from `lib/redis.ts` instead of in-memory `Map` caches for data that should survive deploys or be shared across replicas
- **E2E tests**: For UI-touching changes, add or update Playwright tests in `e2e/`. Run `npm run test:e2e` locally before pushing

## Post-Execution Review (MANDATORY)

> After completing any plan/batch: run `workflow-procedures.md` → "Post-Execution Review" (opportunities, bugs, dead code, open questions, vision alignment). Ask user which recs to execute before shipping.

## Ship It (MANDATORY)

> A build is NOT complete until production is running the new code. See `workflow-procedures.md` for the full checklist.
> Your TodoWrite MUST include ship-it steps (commit → PR → CI → merge → deploy) before starting implementation.

## Shell Compatibility (PowerShell — mandatory)

| Task               | Correct                                                                                      | Wrong                              |
| ------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| Chain commands     | `cmd1 ; cmd2`                                                                                | `cmd1 && cmd2`                     |
| Multi-line commit  | Write to `COMMIT_MSG.txt`, `git commit -F COMMIT_MSG.txt`, then `Remove-Item COMMIT_MSG.txt` | Heredocs, `.git/COMMIT_MSG`        |
| Multi-line PR body | Write to `PR_BODY.md`, `--body-file PR_BODY.md`, then `Remove-Item PR_BODY.md`               | Inline `--body`, `.git/PR_BODY.md` |
| Search/Read files  | Grep/Read tools                                                                              | `grep`/`cat`/`head`/`tail`         |

## Anti-Patterns

- Do NOT create status report files in project root — use `tasks/todo.md`
- Do NOT proceed past a failed or unvalidated step
- Do NOT build features that bypass Supabase
- Do NOT assume library/API behavior — verify first
- Do NOT use `git add -A` without reviewing staged files

## Mode Awareness

If the user's message is a question (not a change request), suggest Ask mode for cost efficiency.

## Cost & Loop Risk Assessment

Before attempting any high-effort autonomous action, evaluate whether it's worth trying vs. telling the user to do it themselves:

**Stop and tell the user instead of attempting autonomously when:**

- Writing or restoring a file > 300 lines — prefer StrReplace for targeted edits; if the whole file must be rewritten and Write fails once, stop and say why
- A task requires recovering lost/uncommitted data — point to Cursor Timeline, git stash, or local history first; these are instant and free
- You've already failed at the same action twice — looping costs more credits than asking
- The user action is < 5 seconds (e.g., "right-click → Open Timeline → click restore") vs. your approach being 10+ tool calls

**Pattern to follow:**

1. Attempt once with the right tool
2. If it fails, immediately explain the failure and offer the user-action alternative
3. Never retry the same failed approach more than once without a different strategy

## Continuous Learning

### Lesson Lifecycle (on every correction)

1. **Search before writing** — grep existing rules for the pattern. If a rule covers it, increment its violation count in `critical.md` and clarify the wording. Don't create a duplicate lesson.
2. **Route correctly** — New pattern → `tasks/lessons.md`. Restatement of existing rule → harden the rule.
3. **Promote = archive** — When promoting a lesson to a rule, move it to `tasks/lessons-archive.md` in the same commit. Promotion and archival are one atomic action.

### Session-End Rule Hygiene (mandatory, 5 min)

1. New lessons this session? Check against existing rules. Deduplicate.
2. Any rule violated? Update violation count + date in `critical.md`.
3. `tasks/lessons.md` over 80 lines? Archive oldest promoted entries.
4. Any always-apply file over its line budget? Move overflow to contextual files.
