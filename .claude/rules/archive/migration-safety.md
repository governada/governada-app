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

## Post-Migration Verification

After applying to production:

1. Check `/api/health` returns healthy
2. Verify affected API endpoints still work
3. Check Sentry for new errors related to the migration
4. If issues: apply rollback SQL immediately, then investigate
