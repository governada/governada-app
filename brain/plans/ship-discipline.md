# Feature Plan

## Spec Link

User request in this Codex thread: Ship discipline follow-up PR.

## Files Read

- AGENTS.md
- .claude/commands/ship.md
- .claude/commands/plan.md
- docs/templates/feature-plan.md
- package.json
- .mcp.example.json
- .claude/settings.json
- scripts/deploy-verify.js
- scripts/github-merge.mjs
- .github/workflows/post-deploy.yml
- .github/workflows/preview.yml
- __tests__/scripts/agentShipWorkflow.test.ts
- __tests__/scripts/githubMerge.test.ts
- README.md
- .agents/skills/ship/SKILL.md
- .claude/agents/deploy-verifier.md

## Existing Implementations Found

- `health:*` scripts already exist for readiness/status checks.
- Deploy verification implementation lives in `scripts/deploy-verify.ts` and reusable helpers under `scripts/lib/deployVerification.ts`.
- Active merge verification shells through `scripts/github-merge.mjs`.
- MCP templates already define Supabase, Sentry, GitHub, and Linear.

## Sites Affected

Implementation files:

- package.json
- scripts/deploy-verify.js
- scripts/github-merge.mjs
- .mcp.json
- .mcp.example.json
- .claude/settings.json

Test files referencing changed APIs:

- __tests__/scripts/agentShipWorkflow.test.ts
- __tests__/scripts/githubMerge.test.ts

Type definitions/usages:

- TBD: no TypeScript type definitions are expected to change.

Documentation referencing changed names:

- AGENTS.md, if references exist
- README.md
- .claude/commands/ship.md
- .claude/commands/plan.md
- .claude/agents/deploy-verifier.md
- .agents/skills/ship/SKILL.md
- docs/templates/feature-plan.md

## ADRs That Apply

- TBD: no ADRs found for this command/config rename.

## Scope

In:

- Rewrite active ship command to the requested bounded CI/deploy discipline.
- Add Sites Affected to planning command and feature-plan template.
- Rename the active legacy deploy verification script key to `health:verify`.
- Update active script/test/workflow/docs references to the new script name.
- Add Railway MCP placeholder config and permissions.

Out:

- Archived docs and command/rule history.
- Product runtime code.
- Hooks and preserved command files.
- Real Railway credentials or production mutations.

## Edge Cases

- Loading: not applicable.
- Empty: not applicable.
- Error: verification must catch bad references, invalid JSON, and failing checks.
- Mobile 375px: not applicable.
- A11y: not applicable.
- Auth: Railway token remains a placeholder sentinel.
- Data freshness: no data reads or migrations.

## Verification Plan

- URL: not applicable.
- Screenshot: not applicable.
- Grep-similar: scoped legacy-name grep excludes archive roots and must return zero active hits.
- Tests/checks: line counts, type-check, lint, agent:validate, health script help, JSON parse.

## Evidence Trail

Commands run:

- `git fetch origin main`
- `git worktree add .claude/worktrees/ship-discipline -b feat/ship-discipline origin/main`
- Full legacy-name grep across the repository
- Scoped legacy-name grep excluding archive roots

Claims verified:

- The base branch is `origin/main`.
- Archive references exist and must remain historical.
- Active references include package scripts, live scripts, tests, workflows, README, and active agent docs.
