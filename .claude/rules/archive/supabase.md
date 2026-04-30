---
paths:
  - 'supabase/**'
  - 'lib/supabase.ts'
  - 'lib/data.ts'
  - 'types/database.ts'
---

# Supabase Rules

- Migrations go in `supabase/migrations/` with sequential 3-digit prefix
- Apply migrations via Supabase MCP `apply_migration` -- NEVER the CLI
- After applying: run `npm run gen:types` and commit `types/database.ts`
- `dreps` table: `id` is bech32 PK, metadata in `info` JSONB, no `drep_id` column
- `drep_votes` PK is `vote_tx_hash`, epoch column is `epoch_no`
- `notification_log` uses `sent_at` not `created_at`
- PostgREST default limit is 1000 -- use `.range(0, 99999)` for large tables
- All frontend reads go through `lib/data.ts` -- use `mapRow()` to unpack `info` JSONB
- Feature flags: add to `feature_flags` table via migration
- RLS enabled on all tables
