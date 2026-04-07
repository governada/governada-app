# Systems SLO Ledger

> **Purpose:** Formal launch SLO set for Governada's first operating cockpit.
> **Cadence:** Review weekly during the systems review loop.
> **Primary UI:** `/admin/systems`
> **Primary references:** `docs/strategy/context/systems-operating-system.md`, `docs/operations/weekly-systems-review.md`

---

## Active SLO Set

| SLO                         | Objective                                                              | SLI                                                  | Launch target                                              | Alert threshold                                             | Primary response                                |
| --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Public availability         | Keep Governada reachable and trustworthy during dependency degradation | Live dependency probes and current platform health   | 99.5%+ availability and no critical dependency state       | Any critical dependency state or repeated degraded periods  | Stabilize dependency path before feature work   |
| Data freshness              | Prevent users from acting on stale governance state                    | Fast and full sync age versus expected operating bar | Fast < 90m and full < 26h                                  | Any critical sync lane stale beyond launch bar              | Open integrity/pipeline and restore freshness   |
| Intelligence correctness    | Protect governance truth from silent drift                             | Vote power coverage, mismatch rate, reconciliation   | Vote power >= 99%, mismatch <= 1%, no reconciliation drift | Any mismatch, major coverage drop, or unresolved drift      | Resolve correctness before new methodology work |
| Public performance          | Keep key APIs and public surfaces fast enough to feel premium          | p95 key API latency and 5xx rate                     | p95 key APIs < 500ms with low 5xx rate                     | p95 above bar, rising 5xx rate, or no current baseline      | Run baseline and address bottleneck             |
| Critical journey protection | Make launch-trust paths fail before merge rather than after deploy     | Automated coverage of launch-critical journeys       | All L0 automated; L1 deterministic where possible          | Any L0 manual gap or regression in critical-path protection | Harden the smallest missing critical path       |

---

## Operating Rules

1. Any red SLO changes the week from feature-first to stabilization-first.
2. Yellow SLOs are allowed only if the weekly review names one concrete hardening commitment.
3. A green dashboard without a fresh weekly review is not a trusted operating state.
4. If the SLI is weak or missing, the right response is to strengthen measurement, not to assume success.
5. `/admin/systems#launch-control-room` is the explicit launch call:
   `launch-ready` means no checklist item is blocked,
   `launch-risky` means no blocker is red but watch items still need owner discipline,
   and `launch-blocked` means the product should not be treated as launch-safe yet.

---

## Evidence Map

- Availability: `/api/health/ready`, `/api/health/deep`, dependency probes, BetterStack
- Freshness: `v_sync_health`, pipeline dashboard, runbook checks
- Correctness: `v_vote_power_coverage`, `v_hash_verification`, reconciliation log
- Performance: `api_usage_log`, k6 baselines, Sentry web vitals and transactions
- Critical journey protection: Playwright coverage, build manifest, journey matrix

---

## Change Log

- 2026-04-02: Initial SLO ledger created from the systems operating cockpit work.
