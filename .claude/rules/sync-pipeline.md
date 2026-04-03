---
paths:
  - 'lib/sync/**'
  - 'inngest/**'
  - 'app/api/sync/**'
  - 'app/api/inngest/**'
  - 'utils/koios*.ts'
---

# Sync Pipeline Rules

- Core syncs export `execute*Sync()` from `lib/sync/<name>.ts`
- Inngest functions call these inside `step.run()` -- keep each step under 60s (Cloudflare 524 timeout)
- Every Inngest function writing to `sync_log` MUST have an `onFailure` handler (prevents ghost entries)
- All Koios responses validated via Zod schemas (`utils/koios-schemas.ts`) -- invalid records skipped, not entire batch
- Not all syncs have HTTP routes -- some run directly in Inngest. Check before adding to route-based configs
- Zod `.passthrough()` breaks strict types -- cast validated output at consumption sites
- DB columns != API columns -- use explicit selects + mapping functions
- PostgREST limit is 1000 -- use `.range(0, 99999)` for large tables
- `sync_log` CHECK constraint must include any new sync type -- verify with:
  `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'sync_log'::regclass`
- After adding new Inngest function: register in `app/api/inngest/route.ts`, then run `npm run inngest:register` after deploy
- **Inngest is SELF-HOSTED on Railway** (not Inngest Cloud). The server runs at `inngest-server.railway.internal:8288`. Never use `inn.gs` or Inngest Cloud API endpoints.
- To trigger events manually: `curl -X POST "https://inngest-server-production.up.railway.app/e/<INNGEST_EVENT_KEY>" -H "Content-Type: application/json" -d '{"name":"<event>","data":{}}'`
- After Inngest server restarts or redeploys: re-register functions with `npm run inngest:register`
- The `serve()` config in `app/api/inngest/route.ts` uses `INNGEST_SERVE_ORIGIN` to route callbacks through Railway private network (avoids Cloudflare timeouts)
