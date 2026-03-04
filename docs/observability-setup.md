# Observability Setup Guide

Dashboard and external service configurations for the DRepScore observability stack. These cannot be automated via code and must be set up manually.

---

## 1. Sentry Alert Rules

Navigate to **Sentry > drepscore > Alerts > Create Alert Rule**.

### 1a. Error Spike

- **Type:** Issue Alert
- **Conditions:** Number of events in an issue > 10 in 5 minutes
- **Filter:** Environment = production
- **Action:** Send notification to Discord `#alerts`
- **Name:** `Error Spike (>10 in 5m)`

### 1b. New Issue in Production

- **Type:** Issue Alert
- **Conditions:** A new issue is created
- **Filter:** Environment = production
- **Action:** Send notification to Discord `#alerts`
- **Name:** `New Production Issue`

### 1c. Unhandled 5xx Rate

- **Type:** Metric Alert
- **Metric:** `count()` where `http.status_code:5xx`
- **Threshold:** > 5% of total transactions in 15 minutes
- **Action:** Send notification to Discord `#alerts`
- **Name:** `5xx Rate > 5%`

### 1d. Web Vitals Regression

- **Type:** Metric Alert (Performance)
- **Metric:** `p75(measurements.lcp)` > 4000ms OR `p75(measurements.inp)` > 300ms
- **Comparison:** Weekly rolling average
- **Action:** Send notification to Discord `#alerts`
- **Name:** `Web Vitals Regression (LCP/INP)`

---

## 2. Sentry Web Vitals Dashboard

Navigate to **Sentry > drepscore > Performance > Web Vitals**.

The built-in Web Vitals view already shows LCP, FID/INP, CLS by page. To create a custom dashboard:

1. Go to **Dashboards > Create Dashboard**
2. Add widgets:
   - **LCP by Page** — `p75(measurements.lcp)` grouped by `transaction`
   - **INP by Page** — `p75(measurements.inp)` grouped by `transaction`
   - **CLS by Page** — `p75(measurements.cls)` grouped by `transaction`
   - **Device Class Breakdown** — Filter by `device.class` (low/medium/high)
3. Save as **"Web Vitals by Page"**

Key pages to watch: `/`, `/drep/[drepId]`, `/discover`, `/match`, `/proposals`.

---

## 3. PostHog Funnels

Navigate to **PostHog > Funnels > New Funnel**.

### 3a. Quick Match Funnel

Steps:

1. `quick_match_page_viewed`
2. `governance_dna_quiz_started`
3. `governance_dna_quiz_completed`
4. `governance_dna_reveal_viewed`
5. `delegation_completed`

**Conversion window:** 7 days

### 3b. Discovery Funnel

Steps:

1. `homepage_viewed`
2. `discover_page_viewed` OR `quick_match_page_viewed`
3. `drep_profile_viewed`
4. `delegation_completed`

**Conversion window:** 14 days

---

## 4. PostHog Dashboards

Navigate to **PostHog > Dashboards > New Dashboard**.

### 4a. Acquisition Dashboard

| Insight                | Type   | Event(s)                                                                            |
| ---------------------- | ------ | ----------------------------------------------------------------------------------- |
| Weekly page views      | Trends | `homepage_viewed`, `discover_page_viewed`, `quick_match_page_viewed` (unique users) |
| Quick Match conversion | Funnel | See 3a above                                                                        |
| Wallet connections     | Trends | `wallet_connected`, `wallet_authenticated` (unique users, weekly)                   |
| Delegations            | Trends | `delegation_completed` (total count, weekly)                                        |

### 4b. Engagement Dashboard

| Insight               | Type      | Event(s)                                                             |
| --------------------- | --------- | -------------------------------------------------------------------- |
| DAU/WAU ratio         | Formula   | `unique_users(any event, daily)` / `unique_users(any event, weekly)` |
| Profile views         | Trends    | `drep_profile_viewed` (unique sessions)                              |
| Proposal detail views | Trends    | `proposal_detail_viewed` (unique sessions)                           |
| Quiz completions      | Trends    | `governance_dna_quiz_completed` (cumulative)                         |
| Share actions         | Breakdown | `share_action` by `type` property                                    |

### 4c. DRep Dashboard

| Insight            | Type   | Event(s)                                       |
| ------------------ | ------ | ---------------------------------------------- |
| Profile claims     | Trends | `drep_profile_claimed` (cumulative)            |
| Philosophy saves   | Trends | `philosophy_saved`, `position_statement_saved` |
| AI rationale usage | Trends | `rationale_draft_generated`                    |
| Dashboard visits   | Trends | `dashboard_page_viewed` (weekly uniques)       |

---

## 5. BetterStack (External Uptime)

Sign up at [betterstack.com](https://betterstack.com) (free tier: 5 monitors, 3-min intervals).

### Monitors to Create

| Monitor     | URL                                    | Method | Interval | Expected                                  |
| ----------- | -------------------------------------- | ------ | -------- | ----------------------------------------- |
| Deep Health | `https://drepscore.io/api/health/deep` | GET    | 3 min    | status 200, body contains `"status":"ok"` |

### Heartbeat URLs

Create 3 heartbeat monitors in BetterStack:

1. **Proposals Sync** — Expected every 30 minutes
2. **Batch Sync** — Expected every 6 hours
3. **Daily Sync** — Expected every 24 hours

Then set the following environment variables in Railway:

```
HEARTBEAT_URL_PROPOSALS=<betterstack heartbeat URL 1>
HEARTBEAT_URL_BATCH=<betterstack heartbeat URL 2>
HEARTBEAT_URL_DAILY=<betterstack heartbeat URL 3>
```

The Inngest functions already call `pingHeartbeat()` with these env var keys.

---

## 6. Verification Checklist

After completing all setup:

- [ ] Sentry: 4 alert rules active, test by triggering a test error
- [ ] Sentry: Web Vitals dashboard shows data for key pages
- [ ] Sentry: Cron Monitors show check-ins for all 6 Inngest functions
- [ ] PostHog: Quick Match funnel shows step-by-step conversion
- [ ] PostHog: 3 dashboards created with correct insights
- [ ] BetterStack: Deep health monitor shows green
- [ ] BetterStack: Heartbeat monitors show activity after next sync cycle
