---
description: Detailed procedures for Ship It, Linear, Hotfix, and Pre-PR audit — read on demand
globs: []
alwaysApply: false
---

# Workflow Procedures

> These procedures are referenced by workflow.md and critical.md. Read this file when executing Ship It, Linear workflow, hotfix, or pre-PR audit.

## Post-Build: Ship It (MANDATORY — every feature, every time)

> A build is NOT complete until production is running the new code. This applies to ALL features, not just hotfixes. See `critical.md #2`. Corrected 5 times.

After code compiles clean and all local checks pass, execute this IMMEDIATELY without asking:

1. `git add` relevant files → `git commit -F COMMIT_MSG.txt` → `Remove-Item COMMIT_MSG.txt`
2. `git push -u origin HEAD`
3. `gh pr create --title "..." --body-file PR_BODY.md` → `Remove-Item PR_BODY.md`
4. `gh pr checks <N> --watch` — fix failures if yours, verify pre-existing if not
5. `gh pr merge <N> --squash --delete-branch`
6. Apply pending migrations via Supabase MCP `apply_migration` → then `npm run gen:types`
7. Monitor Railway deployment: `railway logs` to watch build, poll until healthy
8. PUT `/api/inngest` if Inngest functions were added/modified → `npm run inngest:status` to verify
9. Hit new/changed endpoints on `drepscore.io` to verify
10. `npm run posthog:check <event>` if new analytics events were added
11. `git checkout main; git pull`
12. Update `tasks/lessons.md` if corrections occurred

**Never** say "build complete — PR next" or "ready for review." Just ship it.

## Pre-PR Plan Audit

When a `.cursor/plans/*.plan.md` drove the work, audit before PR. See global workflow rule for full protocol.

**Trigger**: 2+ phases OR 5+ files changed. Otherwise skip.

**Process**: Spawn a readonly `generalPurpose` subagent with the plan file + `git diff main...HEAD`. It reports each plan item as Done / Adapted / Gap. Fix all Gaps, then include the audit summary in the PR body under `## Plan Audit`.

**DRepScore-specific checks** the auditor must also verify:

- PostHog events for every new user interaction (per `analytics.mdc`)
- Supabase RLS policies if new tables/columns were added
- Score/tier display consistency with `scoring-system.md`
- No orphaned components or unused imports

## Linear Workflow

### Session Start: Stale Work Audit

Before starting any new work, query Linear for tickets in **"In Progress"** state older than 24 hours. Surface them to the user:

> "You have X ticket(s) stuck In Progress from [N days ago]: [ticket titles + branch names]. Want to revisit before starting new work?"

Do not skip this check. Abandoned in-progress tickets are a liability.

### When to Create Tickets

**DO create a Linear ticket when:**

- Work is identified but will NOT be executed in the current session (deferred work, future phases)
- A bug or tech debt is discovered mid-work but is out of scope for the current task
- A blocking dependency is identified that a future session needs to resolve
- The plan includes human tasks (community, marketing, partnerships, submissions) — scaffold these immediately with due dates and relationships

**DO NOT create a ticket when:**

- You are about to immediately execute the work in this session
- The task is a sub-step of something already tracked in Linear

### Starting Work: Branch-to-Ticket Link

When beginning execution of a tracked task:

1. Move the corresponding Linear ticket to **"In Progress"**
2. Add the branch name to the ticket description: `Branch: feat/your-branch-name`
3. If no ticket exists yet and work spans multiple sessions, create one now (before coding)

### Human Task Scaffolding

When a plan includes non-code work (Catalyst proposals, community outreach, partnerships, marketing):

- Create parent tickets for each milestone with due dates
- Create child tickets for each discrete action, linked as sub-issues
- Label them `human-task` and assign appropriate priority
- Link any code prerequisites as blocking relationships so the dependency is visible
- Agents do not own these tickets — only scaffold and update blocking status

### End-of-Session: Close the Loop (MANDATORY)

After the Post-Build ship sequence completes, before ending the session:

1. **Update ticket status** — move touched tickets to Done, or back to Todo if incomplete
2. **Add a work summary comment** to each closed ticket:
   - What was built (3-5 bullets)
   - Key decisions or trade-offs made
   - Files changed (top-level)
   - Any discovered debt or follow-up tickets created
3. **Sync the plan file** — update `.cursor/plans/<feature>.plan.md` to reflect actual vs. planned state (mark phases complete, note adaptations)
4. **Zero In Progress rule** — every session ends with zero tickets in "In Progress." Either Done, or Todo with a `WIP — branch: feat/xyz` comment

### Push-Before-Pivot Rule

Before switching to a new task or ending a session with incomplete work:

1. `git push -u origin HEAD` — even for WIP branches
2. Update the Linear ticket: move to Todo, add comment with last commit SHA and what remains
3. Never leave uncommitted work without a ticket pointing at the branch

### Labels Convention

| Label           | Use                                        |
| --------------- | ------------------------------------------ |
| `agent-created` | Any ticket auto-created by a Cursor agent  |
| `human-task`    | Work owned by the user, not an agent       |
| `tech-debt`     | Discovered during execution, deferred      |
| `bug`           | Defect found in production or during build |
| `blocked`       | Waiting on a prerequisite                  |

## Post-Execution Review (MANDATORY after plan completion)

> Every completed plan gets a structured review before shipping. This is how we catch gaps, kill dead code, and keep the product aligned with `docs/strategy/ultimate-vision.md`.

### Trigger

Run this review after completing **any plan or named batch of work**. Scale depth to scope:

| Scope                                            | Review Depth                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1-3 focused fixes / small batch                  | Light — scan each section, 1-2 sentences per heading. Skip sections with nothing to report. |
| Multi-batch feature / named plan phase           | Full — thorough analysis per section, code-level citations, ranked recommendations.         |
| Multi-phase milestone (e.g., "Phase A complete") | Full + strategic alignment check against `docs/strategy/ultimate-vision.md` end-to-end.     |

### Review Structure

Present findings under these headings, in order. For each heading that has items, provide specific file paths, line numbers, and concrete descriptions — not vague observations.

#### 1. Opportunities (ordered by impact/severity)

Identify work that would make the feature more complete, robust, performant, or delightful. Categorize each as:

- **Fully wired** — logic exists but isn't connected end-to-end (e.g., registered but never triggered)
- **Robustness** — missing error handling, edge cases, data validation
- **Performance** — N+1 queries, missing indexes, unbatched operations, stale caches
- **UX refinement** — missing loading states, confusing flows, accessibility gaps
- **Wow factor** — the feature works but doesn't yet create an emotional response

For each opportunity, state: what it is, where it lives (file + line), estimated effort (S/M/L), and whether it should be done **now** (before shipping) vs **later** (tracked for a future phase). Always cross-reference against `docs/strategy/ultimate-vision.md` to ensure net-new opportunities align with the overarching vision.

#### 2. Bug Review

Review code touched or introduced by the plan for correctness issues:

- Logic errors, off-by-ones, null handling, type mismatches
- Stale data patterns (caching something that changes, not refreshing what should be refreshed)
- Race conditions in concurrent/async flows
- Also review **adjacent existing code** that the new work interacts with — integration bugs often live at boundaries

#### 3. Dead Code Audit

Identify code made obsolete by the plan's changes **and** pre-existing dead code discovered while working in the affected areas:

- Unused exports, unreachable branches, deprecated helpers still imported
- Tables/columns no longer written to or read from
- Feature-flagged code where the flag is permanently on/off
- Over time this section should shrink as the codebase gets cleaner

#### 4. Open Questions & Ambiguity

Flag unresolved decisions across these dimensions. For each, provide a **recommended answer** (not just the question):

- **Tech**: Architecture choices, library selection, scaling concerns
- **Data**: Schema gaps, migration needs, data freshness/staleness
- **Product**: Feature completeness, edge cases in user journeys, prioritization
- **Design**: UI/UX patterns not yet defined, responsive behavior, accessibility
- **Business model**: Monetization implications, tier gating, API access

#### 5. Vision Alignment Check

Explicitly verify against `docs/strategy/ultimate-vision.md`:

- Are there capabilities the vision describes for this phase that weren't built?
- Does anything built contradict the vision's principles or values?
- Are there Phase B/C/D prerequisites that should have been scaffolded but weren't?

### Delivery

After presenting the review:

1. **Ask the user**: "Would you like me to execute any of these recommendations before we ship? I can tackle them in priority order."
2. **Track deferrals**: Any item the user declines to address now should be added to the relevant plan document (e.g., as "Retrospective Action Items") or created as a Linear ticket, so nothing is lost.
3. **Update lessons**: If the review surfaced a repeating pattern (e.g., "we keep forgetting to wire notification triggers"), add it to `tasks/lessons.md`.

## Hotfix Protocol

When the user says "hotfix": deploy autonomously end-to-end. Create todos for ALL phases before writing code. Fix on `main` → commit → push → monitor CI → monitor deploy → validate → report. Run `/hotfix` for the full procedure. Never report success before post-deploy validation passes.
