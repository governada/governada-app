---
description: Analytics instrumentation map and event catalog — reference data for component/API work
globs:
  - components/**
  - app/**
  - hooks/**
  - lib/posthog*
alwaysApply: false
---

# Analytics Reference

## Instrumentation Map

| Layer         | Tool                      | Location                                               |
| ------------- | ------------------------- | ------------------------------------------------------ |
| Client events | PostHog JS SDK            | `lib/posthog.ts`, components                           |
| Server events | PostHog Node SDK          | `lib/posthog-server.ts`, API routes                    |
| Dashboards    | Observable Framework      | `analytics/src/*.md` (12 pages)                        |
| Data loaders  | Observable + Supabase     | `analytics/src/data/*.json.ts` (17 loaders)            |
| Alerts        | Cron + webhooks           | `/api/admin/integrity/alert`, `/api/admin/inbox-alert` |
| In-app alerts | `useAlignmentAlerts` hook | `hooks/useAlignmentAlerts.ts`                          |
| Sync health   | Supabase `sync_log`       | `/api/sync/*` routes                                   |

## Event Catalog

### Governance DNA / Discovery

| Event                           | Type   | Properties                                                                                                            |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `governance_dna_quiz_started`   | Client | `proposal_count`                                                                                                      |
| `governance_dna_quiz_vote`      | Client | `vote`, `proposal_type`, `question_number`                                                                            |
| `governance_dna_quiz_completed` | Client | `votes_count`, `top_match_score`, `matches_found`                                                                     |
| `governance_dna_quiz_retake`    | Client | `previous_votes_count`                                                                                                |
| `governance_matches_calculated` | Server | `matches_count`, `top_match_score`, `has_current_drep_match`, `match_method`, `user_vote_count`, `overall_confidence` |
| `governance_dna_reveal_viewed`  | Client | `votes_count`, `top_match_score`, `matches_count`, `has_current_drep_match`, `match_method`, `overall_confidence`     |
| `quick_match_completed`         | Server | `treasury`, `protocol`, `transparency`, `personality_label`, `top_match_score`, `matches_count`                       |
| `drep_view_mode_changed`        | Client | `mode`                                                                                                                |
| `drep_quick_view_opened`        | Client | `drep_id`, `drep_score`, `has_match`, `view_mode`                                                                     |

### Page Views

Use `<PageViewTracker event="..." />` in server-rendered pages.

| Event                     | Page                      |
| ------------------------- | ------------------------- |
| `homepage_viewed`         | `app/page.tsx`            |
| `discover_page_viewed`    | `app/discover/page.tsx`   |
| `proposals_page_viewed`   | `app/proposals/page.tsx`  |
| `compare_page_viewed`     | `app/compare/page.tsx`    |
| `governance_page_viewed`  | `app/governance/page.tsx` |
| `quick_match_page_viewed` | `app/match/page.tsx`      |
| `simulator_viewed`       | `app/simulate/page.tsx`   |

### Observable Data Loaders

| Loader                      | Data                                 |
| --------------------------- | ------------------------------------ |
| `notification-log.json.ts`  | Notification delivery and read rates |
| `user-activity.json.ts`     | User signups, claims, daily activity |
| `governance-events.json.ts` | Poll activity, watchlist activity    |

## Completion Checklist

Before marking a feature complete, verify all five layers:

1. **Client events**: Every component with user-visible content has a `_viewed` event; every interaction has an action event
2. **Server events**: Every POST/PUT API route captures via `captureServerEvent()` with wallet address as distinctId
3. **Observable loaders**: New Supabase table or data dimension → corresponding loader
4. **Integrity checks**: New table → covered by integrity system (spam, orphans, volume alerts)
5. **Dashboard page**: New loader → update existing Observable page or create one, add to `observablehq.config.ts` sidebar
