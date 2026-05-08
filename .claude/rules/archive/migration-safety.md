---
paths:
  - 'lib/supabase*'
  - 'types/database*'
  - '**migration**'
---

# Migration Safety Rules

All database migrations MUST follow this safety procedure:

## Before Applying to Production

1. **Generate rollback SQL**: For every migration, write the inverse operation.
   - `CREATE TABLE` → `DROP TABLE IF EXISTS`
   - `ALTER TABLE ADD COLUMN` → `ALTER TABLE DROP COLUMN`
   - `CREATE INDEX` → `DROP INDEX IF EXISTS`
   - `INSERT` → `DELETE WHERE`
   - Store in `migrations/rollback/<migration_name>.sql`

2. **Test on branch database** (when Supabase branching is available):
   - Create branch: `mcp__supabase__create_branch(name: "migration-test-<name>")`
   - Apply migration on branch
   - Run validation queries (SELECT from affected tables)
   - Delete branch after test

3. **Verify types**: After applying migration, always run `npm run gen:types` and commit the updated `types/database.ts`.

## Migration Patterns

### Safe (no downtime):

- Adding a nullable column
- Creating a new table
- Creating an index (CONCURRENTLY when possible)
- Adding RLS policies

### Dangerous (requires extra care):

- Dropping a column (ensure no code references it)
- Renaming a column (requires code change in same deploy)
- Changing column types (may lock table)
- Dropping a table

### Forbidden without explicit approval:

- Dropping a table that has data
- Removing RLS policies
- Changing column types on large tables (>100K rows)
- Any migration that requires a backfill of existing data

## Production Data Restores

Production data restores (backfilling missing rows, recomputing derived data, repairing corrupt records) require explicit user approval AND must follow the "tested function, not raw SQL" pattern.

Related cleanup: when migration or restore work ships through a PR preview, the orchestrator closeout in `governada-brain/agents/homepage-orchestrator.md` requires deleting that PR's Supabase preview branch via MCP `delete_branch`, even if project auto-cleanup is configured.

### The pattern

1. **Factor the operation into a function in `lib/`.** Not a one-off SQL string in chat. Not a Supabase MCP `execute_sql` call with arbitrary SQL. A typed, tested, idempotent function with a clear signature.
2. **Make it idempotent.** Re-running with the same inputs produces the same result. Use `upsert` with `onConflict`, or check-then-insert with a SELECT-first guard. A user who runs the restore twice (because the first run looked unclear) shouldn't double-write.
3. **Test the function.** Unit tests covering the happy path AND the existing-row skip case. The function's correctness is what the user is approving — tests are the evidence.
4. **Bound the scope explicitly.** Function signature should take exact ranges (e.g., `fromEpoch`, `toEpoch`) — not "everything missing." Bounded scope means a wrong invocation has limited blast radius.
5. **Wire the function into the same code path future automation uses.** If a cron will eventually heal this gap, the cron and the manual restore call the SAME function. No drift possible.

### Approval format

When asking for approval, include:

- **Diagnose section**: root cause of why the restore is needed.
- **Function signature + invocation**: the exact call you will make (e.g., `backfillMissingGovernanceParticipationSnapshots(supabase, 623, 628)`).
- **Test evidence**: the tests that validate the function's correctness.
- **Idempotency proof**: explain why re-running is safe.
- **Bounded scope**: what range is being restored, and what's NOT being touched.
- **Post-restore verification**: the read-only check that confirms restoration worked.

### Anti-patterns

- Asking for approval to run an `INSERT INTO ... SELECT ...` SQL statement directly (the trust surface is just the SQL string — no tests, no future-proofing).
- Asking for approval to run a one-off Supabase MCP call without a corresponding committed function (no audit trail, no reuse, no test coverage).
- "Just fix the data manually" via the Supabase dashboard SQL editor (no idempotency guarantee, no record of what was done).

### Precedents

- 2026-05-07: Phase 9 migration applied via Supabase MCP after explicit approval. Migration was a CREATE TABLE in the SAFE class.
- 2026-05-08: `governance_participation_snapshots` restore via `backfillMissingGovernanceParticipationSnapshots` for epochs 623-628. Function shipped in `codex/diagnose-gps-health` (PR pending). Tested, idempotent, bounded.

## Post-Migration Verification

After applying to production:

1. Check `/api/health` returns healthy
2. Verify affected API endpoints still work
3. Check Sentry for new errors related to the migration
4. If issues: apply rollback SQL immediately, then investigate
