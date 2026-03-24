---
name: new-sync
description: Add a new Inngest sync function with all required boilerplate
---

Create a new Inngest sync function for: $ARGUMENTS

Follow the established sync pattern:

1. Create `inngest/functions/sync-<name>.ts` with:
   - Durable function with `step.run()` for each phase
   - `onFailure` handler to clean up sync_log ghost entries
   - Keep each step under 60s (Cloudflare timeout)
   - Zod schema validation for external API responses

2. Create `lib/sync/<name>.ts` with the `execute*Sync()` function
   - Explicit column selects (never `select('*')` cast to external types)
   - Use `.range(0, 99999)` for queries that may exceed 1000 rows

3. Register in `app/api/inngest/route.ts` (same commit)

4. Add sync type to `SyncType` union in `lib/sync-utils.ts`

5. Create migration to add type to `sync_log` CHECK constraint

6. Add threshold to health route + freshness guard

7. Apply migration via Supabase MCP, run `npm run gen:types`
