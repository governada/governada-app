# Governada Operational Runbook

## Sync Pipeline Failure

### Symptoms

- Stale data on frontend (scores/votes not updating)
- `sync_log` shows `last_success = false` for a sync type
- SyncFreshnessBanner visible to users
- Inngest dashboard shows failed functions

### Diagnosis

1. Check Inngest dashboard: https://app.inngest.com — look for failed `sync-*` functions
2. Check sync freshness: `GET /api/health` — look for stale sync types
3. Check Koios status: `GET /api/health/deep` — `koios` dependency status
4. Check sync_log table: `SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 20;`

### Recovery

- **Koios rate-limited**: Wait for reset (typically 1 hour). The sync functions have built-in retry.
- **Koios down**: No action needed — Inngest will retry. If extended outage (>6h), post in Discord.
- **Transform error**: Check Inngest logs for the specific Zod validation error. Fix the schema in `utils/koios-schemas.ts` if Koios changed their response shape.
- **Manual re-trigger**: In Inngest dashboard, click "Replay" on the failed function run. Or trigger via API: `POST /api/inngest` with the appropriate event.

### Sync Types and Schedules

| Function               | Schedule    | Impact if Stale           |
| ---------------------- | ----------- | ------------------------- |
| sync-proposals         | \*/30 min   | New proposals not visible |
| sync-dreps             | Every 6h    | Scores outdated           |
| sync-votes             | After dreps | Vote counts wrong         |
| sync-secondary         | After dreps | Rationale data missing    |
| sync-slow              | Daily 4:00  | Historical data gaps      |
| sync-treasury-snapshot | Daily 22:30 | Treasury page stale       |

---

## Wrong DRep Score

### Diagnosis

1. Check score components: `GET /api/drep/{drepId}` — inspect `score`, `participation_rate`, `rationale_rate`, `reliability_score`, `profile_completeness`
2. Check score history: `SELECT * FROM drep_score_history WHERE drep_id = '{id}' ORDER BY epoch DESC LIMIT 10;`
3. Check vote count vs proposals: `SELECT count(*) FROM drep_votes WHERE drep_id = '{id}';`
4. Compare with Koios directly: `GET https://api.koios.rest/api/v1/drep_info?_drep_id={drepId}`

### Recovery

- Trigger a full DRep resync: Replay `sync-dreps` in Inngest
- For a single DRep, manually trigger `sync-drep-scores` (recalculates all scores)
- DRep Score V3 uses 4-pillar model in `lib/scoring/`: Engagement Quality 35%, Effective Participation 25%, Reliability 25%, Governance Identity 15%

---

## Session Compromise

### Symptoms

- User reports unauthorized activity
- Suspicious API patterns in `api_usage_log`

### Response

1. Get the user's wallet address
2. Revoke all sessions: `INSERT INTO revoked_sessions (jti, wallet_address) SELECT jti, wallet_address FROM ... ;` (extract JTIs from recent tokens if available)
3. Alternatively, rotate `SESSION_SECRET` env var in Railway to invalidate ALL sessions globally
4. Notify the affected user
5. Check `admin_audit_log` if the compromised user had admin access

---

## Inngest Failure

### Diagnosis

1. Inngest dashboard: https://app.inngest.com — check function runs tab
2. Look at the error trace — most common: Supabase timeout, Koios 429, Zod validation
3. Check if the signing key is valid: Inngest will reject requests if `INNGEST_SIGNING_KEY` is wrong

### Recovery

- **Single failure**: Click "Replay" in dashboard
- **Repeated failures**: Check if the underlying dependency (Koios, Supabase) is healthy via `/api/health/deep`
- **All functions failing**: Verify `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` in Railway env vars

---

## Database Restore

### Supabase Backups

- Pro plan: daily automated backups, 7-day retention
- Point-in-time recovery (PITR) available on Pro plan
- Access: Supabase Dashboard > Project Settings > Database > Backups

### Restore Process

1. Go to Supabase Dashboard > Backups
2. Select the backup point closest to (but before) the incident
3. Click "Restore" — this replaces the current database
4. After restore, verify data integrity: `GET /api/health/deep`
5. Trigger a full sync cycle to fill any gaps between backup and now

### RPO/RTO

- **RPO**: Up to 24 hours (daily backup) or minutes (PITR)
- **RTO**: ~5-15 minutes for restore operation

---

## Railway Deploy Rollback

### Rollback Steps

1. Go to Railway Dashboard > the Governada app service > Deployments
2. Find the last known-good deployment
3. Click the three-dot menu > "Rollback to this deployment"
4. Verify health: `GET /api/health/deep`

### When to Rollback

- Build succeeded but app is crashing (check Railway logs)
- New deployment causes 5xx errors (check Sentry)
- Database migration broke something (rollback app, then fix migration separately)

### Post-Rollback

- Investigate the failing deployment's changes
- Fix in a new commit and redeploy
- Do NOT re-deploy the broken commit
