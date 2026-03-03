# Data Infrastructure Build

## Completed

- [x] 019_data_infra.sql migration: sync_log table, 6 analytical views, hash_check_attempted_at, anchor fields
- [x] PostHog JS + Node SDKs installed, PostHogProvider wired into Providers.tsx
- [x] Client-side events: wallet_connected, delegation_completed/failed, sentiment_voted, drep_table_searched, drep_profile_claimed
- [x] Server-side events: sync_completed/failed on both sync routes
- [x] sync_log writes added to full sync and fast sync routes (start/finish/error pattern)
- [x] GET /api/admin/integrity endpoint querying analytical views with admin wallet auth
- [x] /admin/integrity dashboard: alerts banner, data coverage, power source breakdown, hash integrity, sync health, system stats
- [x] /api/admin/integrity/alert cron with Slack/Discord webhook support and threshold checks
- [x] Integrity alert cron added to Inngest (every 6 hours)
- [x] DRep anchor_url/anchor_hash stored as top-level columns during sync for metadata hash verification

## Before Deploy

- [ ] Run 019_data_infra.sql migration in Supabase
- [ ] Add NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST to Railway env vars (after creating PostHog project)
- [ ] Optionally add SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL to Railway env vars for alerting
