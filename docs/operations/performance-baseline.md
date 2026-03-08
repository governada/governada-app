# Performance Baseline

> **Created:** 2026-03-08
> **Last updated:** 2026-03-08 (initial baseline — run load tests to populate)
> **Target:** P95 < 500ms for all key endpoints at 100 concurrent users

---

## Load Testing Setup

### Tool: Grafana k6

k6 is a standalone binary (not Node.js-based). Install:

```bash
# Windows
winget install k6 --source winget

# macOS
brew install k6

# Linux
snap install k6

# Docker (no install needed)
docker run --rm -i grafana/k6 run - <script.js
```

### Running Tests

```bash
# Against local dev server (recommended for write tests)
npm run dev  # in one terminal
k6 run tests/load/scenarios/citizen-journey.js

# Against a specific URL
BASE_URL=http://localhost:3000 k6 run tests/load/scenarios/citizen-journey.js

# With sample data for DRep-specific endpoints
DREP_IDS=drep1abc,drep1def k6 run tests/load/scenarios/drep-workspace.js

# For write-path testing (requires auth token)
AUTH_TOKEN=<jwt> PROPOSAL_TX_HASHES=<hash> k6 run tests/load/scenarios/engagement-burst.js
```

### Scenarios

| Scenario         | File                  | Purpose                                                            | Auth Required    |
| ---------------- | --------------------- | ------------------------------------------------------------------ | ---------------- |
| Citizen Journey  | `citizen-journey.js`  | Anonymous read flow: health → dreps → briefing → pulse → proposals | No               |
| Public API v1    | `api-v1.js`           | External API: pagination, search, sorting, rate limit validation   | No               |
| Engagement Burst | `engagement-burst.js` | Write path: 50 concurrent sentiment votes, rate limit enforcement  | Yes (for writes) |
| DRep Workspace   | `drep-workspace.js`   | Authenticated DRep flow: dashboard → scores → milestones → votes   | Optional         |

### Ramp Profile

Standard: 1 → 10 → 50 → 100 VUs over 5 minutes, then ramp-down.

```
VUs  100 |          ┌─────────┐
      50 |     ┌────┘         │
      10 | ┌───┘              │
       1 |─┘                  └──
         0    1m   2m   3m   4m  5m
```

---

## Endpoint Performance Baselines

> **Instructions:** Run each scenario and record results below. Update after each test cycle.

### Key Endpoints (Target: P95 < 500ms)

| Endpoint                              | P50 | P95 | P99 | Notes                              |
| ------------------------------------- | --- | --- | --- | ---------------------------------- |
| `GET /api/health`                     | —   | —   | —   | Lightweight Supabase view query    |
| `GET /api/dreps`                      | —   | —   | —   | Full DRep list with enrichment     |
| `GET /api/briefing/citizen`           | —   | —   | —   | Most complex: 11+ Supabase queries |
| `GET /api/governance/pulse`           | —   | —   | —   | Live governance overview           |
| `GET /api/governance/health-index`    | —   | —   | —   | GHI composite calculation          |
| `GET /api/v1/dreps`                   | —   | —   | —   | Public API with pagination         |
| `GET /api/v1/governance/health`       | —   | —   | —   | Public governance health           |
| `GET /api/drep/[id]/engagement`       | —   | —   | —   | Per-DRep engagement signals        |
| `POST /api/engagement/sentiment/vote` | —   | —   | —   | Write path (requires auth)         |
| `GET /api/dashboard`                  | —   | —   | —   | DRep command center                |

### Error Rates (Target: < 1%)

| Scenario         | Error Rate | 429s | Notes                         |
| ---------------- | ---------- | ---- | ----------------------------- |
| Citizen Journey  | —          | N/A  | Read-only, no rate limiting   |
| API v1           | —          | —    | Rate limiting applies         |
| Engagement Burst | —          | —    | 429s expected at burst volume |
| DRep Workspace   | —          | —    | —                             |

---

## Known Bottlenecks

### 1. `/api/briefing/citizen` — Sequential Supabase Queries

**Issue:** The citizen briefing endpoint makes 11+ sequential Supabase queries. This is the most expensive endpoint and the most likely to degrade under load.

**Queries executed:**

1. `governance_stats` — current epoch
2. `epoch_recaps` — recap data
3. `user_wallets` — DRep delegation lookup (auth only)
4. `users` — fallback delegation lookup (auth only)
5. `dreps` — DRep profile
6. `drep_votes` — vote count (count query)
7. `drep_votes` — vote details (for rationale lookup)
8. `vote_rationales` — rationale count
9. `drep_score_history` — score delta
10. `drep_power_snapshots` — delegated stake
11. `treasury_snapshots` × 2 + `proposals` count — treasury (parallel batch)
12. `proposals` — active/critical count
13. `citizen_sentiment` + parallel batch (auth only)

**Mitigation options:**

- Batch sequential queries where possible (queries 5-9 could partially overlap)
- Redis cache the unauthenticated briefing (already has `s-maxage=120`)
- Pre-compute briefing data in Inngest on epoch boundary
- Add database indexes for `drep_votes(drep_id, epoch_no)` if not already present

### 2. `/api/governance/matches` — PCA Computation

**Issue:** Loads PCA model, projects user vector, computes cosine similarity against all DReps, then fetches metadata for top 200. Computationally intensive.

**Mitigation options:**

- PCA coordinates are pre-computed (already cached in `drep_pca_coordinates`)
- Redis cache match results per user (keyed on poll_responses hash)
- Limit to top 50 matches instead of 200

### 3. Rate Limiting Under Concurrency

**Issue:** The Upstash sliding window rate limiter is eventually consistent. Under burst traffic from the same IP, a few requests beyond the limit may slip through before the counter catches up.

**Expected behavior:**

- Route-level: 10 req/60s per wallet or IP hash
- Epoch-level: 50 sentiment votes per epoch per user
- `X-RateLimit-Remaining` header may lag by 1-2 under concurrent access

---

## Caching Architecture

### HTTP Cache Headers

| Pattern                                             | TTL    | Stale  | Used By                   |
| --------------------------------------------------- | ------ | ------ | ------------------------- |
| `public, s-maxage=120, stale-while-revalidate=600`  | 2 min  | 10 min | Briefing, activity        |
| `public, s-maxage=300, stale-while-revalidate=600`  | 5 min  | 10 min | DRep profiles, engagement |
| `public, s-maxage=600, stale-while-revalidate=3600` | 10 min | 1 hr   | Similar DReps, GHI        |
| `public, s-maxage=900, stale-while-revalidate=1800` | 15 min | 30 min | v1 API responses          |
| `private, s-maxage=60, stale-while-revalidate=120`  | 1 min  | 2 min  | User-specific data        |

### Redis Cache (`lib/redis.ts`)

- **Pattern:** Read-through with TTL (`cached(key, ttlSeconds, fetcher)`)
- **Failure mode:** Falls back to direct Supabase query (no error to user)
- **Used for:** Rate limit counters, epoch rate limits, cached query results
- **Connection:** Upstash REST API (not TCP — works from serverless)

### Cache Effectiveness Targets

| Metric                         | Target                        | How to Measure                       |
| ------------------------------ | ----------------------------- | ------------------------------------ |
| CDN hit rate (Cloudflare)      | > 60% for public endpoints    | Cloudflare Analytics dashboard       |
| Redis hit rate                 | > 80% for repeated queries    | Upstash dashboard → Usage            |
| Stale-while-revalidate serving | Seamless during cache refresh | Monitor P95 spikes at TTL boundaries |

---

## Supabase Connection Pool

- **Plan:** Pro (Supavisor transaction mode)
- **Max connections:** 60 (shared across all Railway instances)
- **Current usage:** Monitor via Supabase Dashboard → Database → Connections

### Connection Pool Under Load

| Concurrent Users | Expected Connections | Risk                 |
| ---------------- | -------------------- | -------------------- |
| 1-10             | 2-5                  | None                 |
| 10-50            | 5-20                 | None                 |
| 50-100           | 15-40                | Monitor closely      |
| 100+             | 40-60                | Pool saturation risk |

**Mitigation:** Briefing endpoint is the biggest consumer (11+ queries per request). Redis caching reduces this significantly for unauthenticated users.

---

## Scaling Plan

### Current Capacity: ~100 Concurrent Users

Based on architecture analysis (validate with actual load test results):

| Component        | Current Limit                         | Bottleneck At                   |
| ---------------- | ------------------------------------- | ------------------------------- |
| Railway (Docker) | ~100 req/s                            | 200+ concurrent users           |
| Supabase Pool    | 60 connections                        | 100+ concurrent complex queries |
| Upstash Redis    | 10K req/day (free) / unlimited (paid) | N/A (paid plan)                 |
| Cloudflare CDN   | No practical limit                    | N/A                             |

### At 1,000 Users

- **Must:** Pre-compute briefing data (remove 11-query waterfall)
- **Must:** Redis cache match results
- **Should:** Add read replicas for Supabase
- **Should:** Horizontal scale Railway to 2+ instances

### At 10,000 Users

- **Must:** Dedicated Supabase connection pooler
- **Must:** CDN cache all public pages (ISR or full static)
- **Must:** Redis cache all governance data (refresh via Inngest)
- **Should:** Move PCA computation to background job

### At 100,000 Users

- **Must:** Full CDN-first architecture
- **Must:** Separate read/write database instances
- **Must:** Queue-based write path (sentiment, endorsements)
- **Must:** Edge function deployment for public APIs

---

## Redis Memory Projections

| Data Type           | Current Est. | At 10K Users | At 100K Users |
| ------------------- | ------------ | ------------ | ------------- |
| Rate limit counters | < 1 MB       | ~10 MB       | ~100 MB       |
| Epoch rate limits   | < 1 MB       | ~5 MB        | ~50 MB        |
| Cached queries      | ~5 MB        | ~20 MB       | ~50 MB        |
| **Total**           | **~7 MB**    | **~35 MB**   | **~200 MB**   |

Upstash free tier: 256 MB. Pro tier: 10 GB. Current usage is well within free tier.

---

## How to Run a Full Baseline

```bash
# 1. Ensure local dev server is running
npm run dev

# 2. Run all read-only scenarios
k6 run tests/load/scenarios/citizen-journey.js
k6 run tests/load/scenarios/api-v1.js
k6 run tests/load/scenarios/drep-workspace.js

# 3. Run write-path scenario (requires auth)
AUTH_TOKEN=<jwt> PROPOSAL_TX_HASHES=<hash> k6 run tests/load/scenarios/engagement-burst.js

# 4. Record results in the tables above
# 5. Check Supabase Dashboard → Query Performance for slow queries
# 6. Check Upstash Dashboard → Usage for Redis hit rates
# 7. Check Cloudflare Analytics for CDN hit rates
```

---

## Query Optimization Checklist

After running load tests, check Supabase Dashboard → Query Performance for:

- [ ] Queries > 100ms average execution time
- [ ] Sequential scans on large tables (dreps, drep_votes, proposals)
- [ ] Missing indexes on `drep_votes(drep_id, epoch_no)` (used by briefing)
- [ ] Missing indexes on `citizen_sentiment(proposal_tx_hash, proposal_index)`
- [ ] Missing indexes on `drep_pca_coordinates(run_id)` (used by matches)
- [ ] JSONB column queries without expression indexes (`.info->>field`)
- [ ] Connection pool utilization during peak load (target < 80%)
