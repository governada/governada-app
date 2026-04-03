# Weekly Systems Review

> **Purpose:** Turn `/admin/systems` into a recurring operating loop instead of a passive dashboard.
> **Cadence:** Weekly on Monday morning before normal feature work.
> **Duration:** 15 minutes
> **Operator:** Founder + agents

---

## Inputs

- `/admin/systems`
- `docs/operations/slo-ledger.md`
- `docs/operations/systems-scorecard.md`
- `docs/operations/incident-log.md`

---

## The 15-Minute Loop

### 1. Refresh the live snapshot

- Open `/admin/systems`
- Read the overall narrative, launch SLOs, and `Act now` section first
- Confirm whether the system is green, watch, or act-now

**Required output:** current posture for the week

### 2. Review red and yellow SLOs

- Start with formal SLOs, not with backlog opinions
- Identify which SLO is the largest current launch risk
- If any SLO is red, switch the week into stabilization mode

**Required output:** top risk plus breach narrative

### 3. Update the scorecard and incident trail

- Log the weekly review directly in `/admin/systems` so the cockpit keeps durable operating history and open commitments
- Update `docs/operations/systems-scorecard.md`
- Log any real incident, drill, or meaningful regression in `docs/operations/incident-log.md`
- If methodology or scoring changed, update `docs/operations/methodology-changelog.md`

**Required output:** refreshed operating record

### 4. Choose one hardening commitment

- Pick the single systems-hardening move that most reduces launch risk this week
- Prefer control loops over vague cleanup
- Examples: add one pre-merge gate, record one baseline, automate one reconciliation, run one drill

**Required output:** one named hardening commitment for the week

---

## Decision Rule

Use this order every week:

1. Red SLOs
2. Yellow SLOs with weak measurement
3. Manual critical-path coverage
4. Performance drift
5. Everything else

---

## Automation Target

The review is intentionally shaped so it can be automated later from `/api/admin/systems` and `/api/admin/systems/reviews`:

- summarize current SLO posture
- highlight red/yellow shifts from the previous review
- propose one hardening commitment
- open an inbox item for founder review
