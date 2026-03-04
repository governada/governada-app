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

| Label | Use |
|---|---|
| `agent-created` | Any ticket auto-created by a Cursor agent |
| `human-task` | Work owned by the user, not an agent |
| `tech-debt` | Discovered during execution, deferred |
| `bug` | Defect found in production or during build |
| `blocked` | Waiting on a prerequisite |

## Hotfix Protocol

When the user says "hotfix": deploy autonomously end-to-end. Create todos for ALL phases before writing code. Fix on `main` → commit → push → monitor CI → monitor deploy → validate → report. Run `/hotfix` for the full procedure. Never report success before post-deploy validation passes.
