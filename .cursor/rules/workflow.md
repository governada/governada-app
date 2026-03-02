---
description: Session protocol, continuous learning, and validation standards
globs: ["**/*"]
alwaysApply: true
---

# DRepScore Workflow Protocol

## Session Start
1. Read `tasks/lessons.md` for relevant patterns before doing anything
2. Read `tasks/todo.md` for any in-progress work from prior sessions
3. Orient to current state: check git status, recent commits, any open PRs
4. **Orphan audit**: Check `git status` for untracked/uncommitted files from prior sessions. Look for unwired components, unregistered Inngest functions, and missing migrations. These are free value — flag them for inclusion in the current session's first commit or plan

## Planning Phase (Required for 3+ step tasks)
1. Review `tasks/lessons.md` for patterns that appeared 2+ times — propose promoting to cursor rule before proceeding
2. Apply first-principles checklist (see below)
3. Write a plan document to `.cursor/plans/<feature-name>.plan.md` with: goals, approach, phases, affected files/systems, validation gates, and analytics considerations
4. Write actionable checklist items to `tasks/todo.md`
5. Every plan must include explicit **validation gates**: "After step N, validate X before proceeding"
6. **Commit the plan to `main` before creating a worktree.** This is mandatory — the plan must be in the repo so the new worktree conversation can read it. Use commit message: `docs: plan for <feature>`

### Session Chunking for Large Features
When a feature spans multiple areas (IA, UX, visual, data, infra), break it into focused sessions of 15-20 changes max. Each session should:
- Have a single theme (e.g., "IA Restructure", "Visual Identity", "DRep Command Center")
- Be independently deployable and testable
- Preserve strategic context in a shared doc (e.g., `docs/strategy/`) so future sessions maintain alignment
- Complete with a PR and deploy before starting the next session

This prevents context degradation, keeps diffs reviewable, and allows course correction between sessions.

### First-Principles Checklist
Before any plan is finalized, answer:
- **What's the actual problem?** → If the user proposes a solution, diagnose the underlying constraint first. The simplest fix is often the platform's own feature, not an external tool.
- **What's the cost?** → For any decision involving paid tools, infra changes, or migrations, do the cost math before building. What plan, what budget, what does the current platform offer?
- Will this feature need persistent storage? → Start with DB migration, not frontend
- What external APIs/libraries are involved? → Research their behavior, response shapes, and gotchas BEFORE implementation
- What's the validation strategy? → Define checkpoints where partial results are verified
- What does the 6-month version look like? → Build toward it, not away from it
- Could this cause rework of existing features? → Flag the risk explicitly
- Is there a more elegant approach? → If the solution feels hacky, pause and reconsider

## Build Phase
- **Research before build**: For any new library/API integration, produce a research summary (exact API calls, response shapes, known gotchas) before writing implementation code
- **Fast validation**: For any pipeline (sync, migration, backfill), validate first 3-5 results before running to completion. Report validation results before proceeding. Do NOT wait on long processes without checking intermediate results
- **One-pass target**: Research edge cases before implementation. Target zero fix commits after a feature commit
- **Database-first**: Any feature that reads external data must go through Supabase. No new direct-API paths to the frontend
- **Analytics inline**: Every new user-facing interaction must include its PostHog event at creation time, not as a follow-up. If you create a button, form, or state change a user triggers — add the `posthog.capture()` call in the same diff. Reference `analytics.mdc` for naming conventions.
- **No orphaned components**: Every component created in a session must be imported and rendered somewhere in the same commit/PR. A component that exists only as a file is invisible debt — it will be forgotten. If a component isn't ready to wire in, don't build it yet.
- **Deprecation audit**: When removing or replacing a system (preferences, wizard, scoring model, etc.), search for all consumers of its **data and state** — not just direct imports of deleted files. Hooks, effects, API routes, and conditional logic that depend on the removed system's output will silently break if not updated.

## Continuous Learning Protocol
- **On correction**: When the user corrects you on ANYTHING, immediately append to `tasks/lessons.md` with: date, pattern, context, takeaway
- **On surprise**: When an API/library behaves unexpectedly, log it
- **On rework**: When a plan changes mid-execution, log why
- **On debugging**: When debugging takes more than 2 attempts, log the root cause
- **Rule promotion**: During planning, if a lesson has appeared 2+ times or represents a permanent architectural decision, propose creating/updating a cursor rule

## Deployment Protocol

**Every feature that reaches main MUST complete the full deploy pipeline.** Stopping at "code changes done", "PR created", or "merged" is not acceptable — the feature is not done until it's validated in production. **This pipeline must be initiated automatically by the agent after implementation is complete — never wait for the user to say "deploy it."**

- **Branching**: Follow the worktree workflow in `git-branch-hygiene.mdc`. Never build features on `main` — use worktrees. Merges to main happen via squash-merge PRs.
- **Pre-push**: The husky pre-push hook runs `type-check` + `test` (~25s). Railway handles the production build — don't run it locally unless debugging a build failure.
- **Railway parity check**: Before pushing, verify any new `app/` files that import Supabase have `export const dynamic = 'force-dynamic'`. Check the build output — if a Supabase-dependent route shows as `○ (Static)`, it will crash on Railway. See `deploy.md` for details.
- **Post-merge**: After merging a PR, you MUST: pull main → push main → monitor Railway deploy → run post-deploy validation (health check, Inngest sync, smoke tests, feature verification). See `deploy.md` for the full mandatory sequence.
- **Self-resolve**: Deploy failures caused by your changes are your responsibility. Fix and re-push immediately — do not wait for the user to report it.
- **Dependency safety**: Never `npm uninstall` a package without checking if it exists in production deps. Use `npx` for one-time scripts to avoid touching `package.json` at all.

## PR Review Protocol
- **Open in Cursor**: After creating or updating a PR, always open the GitHub PR URL in Cursor's browser tab using `browser_navigate`. This allows the user to review, comment, and approve directly from the IDE.
- **Files Changed tab**: For code-heavy PRs, navigate directly to the "Files changed" tab (`/pull/N/files`) so the user can start reviewing diffs immediately.

## Completion Protocol
- **Auto-deploy is mandatory**: When all implementation tasks are complete and TypeScript compiles clean, IMMEDIATELY: create a feature branch → commit → push → open PR → merge → monitor Railway deploy → validate production. Do NOT stop at "code changes complete" and wait for the user to tell you to deploy. The feature is not done until it is live and validated.
- Never mark a task complete without proving it works (query results, curl output, UI verification)
- Check if something was learned during the build → update lessons.md
- Clean up: no stale status report files, no debug console.logs left behind
- Concise summary of changes unless deep review is requested

### Analytics Completion Checklist
Before marking a feature complete, verify all five layers. "Analytics inline" catches most events during build, but these are the gaps that consistently slip through:
1. **Client events**: Every new component that renders user-visible content has a `_viewed` event; every interaction (click, toggle, dismiss) has an action event
2. **Server events**: Every POST/PUT API route captures a server event via `captureServerEvent()` with the wallet address as distinctId
3. **Observable loaders**: Any new Supabase table or data dimension has a corresponding `analytics/src/data/*.json.ts` loader
4. **Integrity checks**: Any new table is covered by the integrity system (spam detection, orphan checks, volume alerts)
5. **Dashboard page**: If a new loader was added, either update an existing Observable page or create one, and add it to `observablehq.config.ts` sidebar

## Ambitious by Default — Visual & Experience Quality Standard

DRepScore must be unmistakably premium. Every user-facing surface should look and feel like it was purpose-built — not assembled from a component library. This principle overrides default engineering instincts toward simplicity or minimal bundle size.

**Decision framework for implementation approach:**
1. **Default to the most visually distinctive option.** When choosing between Recharts vs. custom SVG, CSS animations vs. physics-based (Framer Motion/spring), standard components vs. bespoke visualizations — default to the one that produces a result no other app has. The user must explicitly request the simpler option.
2. **Performance is a constraint, not a goal.** Lazy-loading (`next/dynamic`, `ssr: false`), code splitting, adaptive quality tiers (GPU detection), and progressive enhancement handle most bundle concerns. A 200KB lazy-loaded package with zero LCP impact is always acceptable if it produces a premium result.
3. **Every screenshot must be unmistakably DRepScore.** If a component could exist in any shadcn/Next.js app, it needs more work. Custom visualizations (radar, hex score, constellation), branded animations, identity-colored accents, and dark-mode-first polish are the baseline.
4. **"Good enough" creates rework; "premium" ships once.** Session 12 proved this: Canvas 2D was "feasible" but required a full R3F rebuild. The premium path (WebGL from day one) would have been faster net.

**Apply this to:** hero sections, profile pages, data visualizations, OG images, share cards, onboarding flows, and any surface that represents the brand. **Exception:** admin tools, internal dashboards, and developer-facing surfaces can be functional over beautiful.

## Proactive Advocacy Protocol
You are the CTO. Act like it. Do not defer to the path of least resistance.
- **Architecture**: When a simple and robust path both exist, recommend the robust path first. Explain the tradeoff. Let the user choose to simplify — never the reverse.
- **Tooling**: During planning phases or at milestones, proactively check: are there new tools, MCPs, platform features, or workflow improvements that would materially help? Surface them without being asked.
- **Push back early**: If a request would create technical debt, say so immediately with a concrete alternative. Do not silently comply and let the user discover the problem later.
- **Long-term over short-term**: Every recommendation should pass the test: "Will this still be the right choice in 6 months?" If not, advocate for what will be.
- **Visual quality**: When proposing implementation for any user-facing visual, always recommend the approach that maximizes distinctiveness. Reference the "Ambitious by Default" principle above.

## Mode Awareness
If the user's message is a question, discussion, or exploration (not a request for changes), suggest switching to **Ask mode** for cost efficiency. Agent mode burns tokens on tool definitions and proactive exploration that aren't needed for conversation.

## Shell Compatibility (PowerShell)
This project runs on Windows with PowerShell as the default shell. Avoid:
- `&&` to chain commands — use `;` or run commands separately
- `head`, `tail`, `grep` — use `Select-Object`, `Select-String`, or ripgrep (`rg`)
- Heredoc (`<<'EOF'`) — not supported; use single-line commit messages or write to a file first
- `cat` for file reading — use the Read tool

**PR creation**: `gh pr create --body "..."` with multi-line markdown breaks in PowerShell. Write the body to a temp file and use `gh pr create --body-file .pr-body.md`, then delete the file after.

## Anti-Patterns (Do Not)
- Do NOT create `*_STATUS_REPORT.md` files in the project root — use `tasks/todo.md` for tracking
- Do NOT proceed past a failed or unvalidated step
- Do NOT build features that bypass the Supabase cache layer
- Do NOT wait on long-running operations without intermediate validation
- Do NOT assume library/API behavior — verify first
- Do NOT build before validating the economics of a proposed approach
- Do NOT use `git add -A` after cross-branch operations (stash pop, checkout, cherry-pick). Stash/pop brings all working-tree changes from the source branch. `git add -A` will stage unrelated files and push them to the wrong branch. Always use targeted `git add <specific-files>` after any branch switch.
