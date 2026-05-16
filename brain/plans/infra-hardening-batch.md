# Feature Plan

## Spec Link

Path or URL:

- `/Users/tim/dev/governada/governada-brain/governada/initiatives/sync-pipeline-architecture.md`
- `/Users/tim/dev/governada/governada-brain/learnings/sync-pipeline-architecture/phase-1.md`
- `/Users/tim/dev/governada/governada-brain/agents/homepage-orchestrator.md`

## Files Read

- `AGENTS.md`
- `.claude/rules/archive/migration-safety.md`
- `bin/supabase-mcp.sh`
- `.claude/hooks/migration-pr-binding.sh`
- `.claude/settings.json`
- `supabase/migrations/20260509205815_repair_unqualified_set_updated_at_in_migration_metadata.sql`

## Existing Implementations Found

- PR #991 established the pattern for metadata-only Supabase replay repair.
- The Supabase MCP `apply_migration` tool currently accepts only `name` and `query`; it cannot pin `schema_migrations.version`.
- The migration safety hook binds `apply_migration` to committed files, but F3 must use `execute_sql` to avoid creating a new orphan metadata row.

## Sites Affected

Implementation files:

- `supabase/migrations/20260516001754_reconcile_filename_metadata_versions.sql`
- `supabase/migrations/rollback/20260516001754_reconcile_filename_metadata_versions.down.sql`

Test files referencing changed APIs:

- None; this is migration metadata repair.

Type definitions/usages:

- None; no public schema or application type changes.

Documentation referencing changed names:

- This plan records the infra-hardening batch scope.

## ADRs That Apply

- Agent secret access and Supabase MCP boundaries in `docs/operations/agent-secret-access.md`.

## Scope

In:

- F3: reconcile production `supabase_migrations.schema_migrations.version` values to local migration filename timestamps.
- F6: follow-up PR to fix `plan-required.sh` linked-worktree commit-message lookup.
- F9: follow-up PR to warn on stale shared checkout when `git pull` would fail.
- F7: follow-up PR to gate merges on red CI checks.

Out:

- Retrying F4 rebaseline metadata repair in this PR.
- Applying migrations through `apply_migration` for F3.
- Branch protection changes before the F7 PR.

## Edge Cases

- Loading: not user-facing.
- Empty: no-op if the metadata repair is already applied.
- Error: mixed metadata state raises before mutation.
- Mobile 375px: not user-facing.
- A11y: not user-facing.
- Auth: production write requires explicit Tim approval and uses the Supabase MCP lane.
- Data freshness: post-apply scan must show remote-only migration rows reduced from 5 to 0.

## Verification Plan

- URL: not applicable.
- Screenshot: not applicable.
- Grep-similar: compare production migration versions against local `supabase/migrations/*.sql` filenames.
- Tests/checks: run read-only pre/post Supabase scans, `list_migrations`, and optional throwaway `create_branch` diagnostic if available.

## Evidence Trail

Commands run:

- `git -C /Users/tim/dev/governada/governada-app fetch origin main`
- Supabase MCP tool-schema scan confirmed `apply_migration` has no version parameter.
- Supabase MCP read-only reconciliation scan found five remote-only rows.

Claims verified:

- F3 must use `execute_sql`, not `apply_migration`, to avoid creating a new orphan row.
- The two Phase 1 rows `20260510014538` and `20260510041749` already match local filenames.
