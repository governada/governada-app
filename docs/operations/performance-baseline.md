# Performance Baseline

> **Purpose:** Keep load discipline inside the systems cockpit instead of as a one-off benchmark doc.
> **Working surface:** `/admin/systems#performance-baseline`
> **Cadence:** Every 14 days and after risky route, query, caching, or payload-shape changes
> **Target:** Slowest recorded p95 under the minimum public-read baseline stays under 500ms with less than 1.0% 5xx

---

## What Counts as a Baseline

A performance baseline is only valid if it leaves behind all of the following in `/admin/systems#performance-baseline`:

- baseline date
- environment (`production`, `preview`, or `local`)
- scenario label
- concurrency profile
- p95 for:
  - `/api/health`
  - `/api/dreps`
  - `/api/v1/dreps`
  - `/api/v1/governance/health`
- 5xx rate
- the primary bottleneck
- the mitigation owner
- the next concrete step
- an artifact link when a k6 report or dashboard snapshot exists

If one of those fields is missing, the baseline is not durable enough to drive the weekly review.

---

## Operator Loop

### 1. Run the minimum public-read baseline

Use the repo load scenarios as the starting point:

```bash
k6 run tests/load/scenarios/citizen-journey.js
k6 run tests/load/scenarios/api-v1.js
```

If the change is specific to authenticated or write-heavy paths, add the narrower scenario that matches the risk:

```bash
k6 run tests/load/scenarios/drep-workspace.js
AUTH_TOKEN=<jwt> PROPOSAL_TX_HASHES=<hash> k6 run tests/load/scenarios/engagement-burst.js
```

The baseline should reflect the smallest realistic concurrency profile that can still catch launch-critical regressions. The default profile remains `1 -> 10 -> 50 -> 100 VUs over 5 minutes`.

### 2. Log the result in `/admin/systems`

Open `/admin/systems#performance-baseline` and record:

- the measured p95s
- the bottleneck that dominated the run
- who owns the next mitigation
- the exact rerun condition or next step

This writes a durable audit-log record that the cockpit, the weekly draft generator, and the automation history can all read.

### 3. Review the resulting status

The cockpit derives baseline status automatically:

- `Good`: slowest p95 is 500ms or lower and 5xx stays at 1.0% or lower
- `Warning`: slowest p95 is above 500ms or 5xx rises above 1.0%
- `Critical`: slowest p95 is above 1000ms or 5xx rises above 5.0%

Freshness is tracked separately. A baseline becomes stale after 14 days even if the last recorded result was healthy.

---

## Automation Behavior

The daily systems sweep treats performance baseline discipline as a first-class control loop.

It opens a `systems:performance-baseline` follow-up when:

- no durable baseline has ever been logged
- the latest baseline is stale
- the latest baseline is still `warning` or `critical`

The follow-up appears in `/admin/systems#automation` and the centralized automation history. The weekly systems review draft also uses the latest baseline record or follow-up to:

- call out performance drift in the weekly narrative
- suggest the correct owner for the mitigation
- turn an unresolved bottleneck into the week's hardening commitment when appropriate

---

## Where to Monitor It

- `/admin/systems#performance-baseline`: current baseline summary, log form, and durable history
- `/admin/systems#automation`: open follow-ups, latest sweep output, and baseline-related automation activity
- `docs/operations/weekly-systems-review.md`: founder operating loop that consumes the signal
- `docs/operations/systems-scorecard.md`: weekly scorecard interpretation of the signal

---

## Rerun Triggers

Rerun the baseline immediately when any of these happen:

- public API payload shape changes
- a cache key, TTL, or invalidation rule changes
- a high-traffic route adds new joins or query fanout
- a production smoke check shows repeat latency drift
- a weekly review marks performance as the top launch risk

Do not wait for the 14-day cadence if one of those changes lands first.

---

## Baseline Quality Bar

Before closing a performance-baseline follow-up, make sure the record answers all of these:

- Which route was slowest?
- Was the regression caused by query shape, payload size, cache misses, or something else?
- Who owns the next mitigation?
- What exact change or rerun condition should happen next?
- Where is the evidence if someone wants to inspect the raw run?

If the answer to any of those is vague, the baseline log is not finished.
