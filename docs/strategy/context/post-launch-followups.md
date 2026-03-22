# Post-Launch Follow-Ups

Single source of truth for work intentionally deferred to post-launch. Every agent that defers work must add it here. Review this document regularly to prioritize and schedule deferred items.

**Last updated:** 2026-03-22

---

## Scoring & Methodology

### External Validation of DRep Scoring Methodology

**Source:** DRep Score V3.2 Defensibility Rebuild (2026-03-22)
**Priority:** High
**Why deferred:** Requires real user data and time — can't validate before users exist.
**What's needed:**

- Correlation analysis: do citizens delegated to high-scoring DReps report higher satisfaction?
- Backtesting: do DReps whose scores improved also show improved governance outcomes?
- Publish analysis: "We analyzed the top 20 DReps by score and here's what they have in common"
- If correlation is weak, revisit pillar weights and signals
  **Success criteria:** Published validation report showing score correlates with at least one measurable governance outcome (delegation retention, citizen satisfaction survey, proposal outcome quality).

### Empirical Calibration Curve Validation

**Source:** DRep Score V3.2 Defensibility Rebuild (2026-03-22)
**Priority:** Medium
**Why deferred:** Calibration curves were justified by behavioral analysis but not validated against actual score distributions. Need live data from V3.2 scoring.
**What's needed:**

- Query Supabase for raw pillar scores across all active DReps after V3.2 has run for 2+ weeks
- Compute actual tier distribution (% in Emerging, Bronze, Silver, Gold, Diamond, Legendary)
- Verify distribution matches intent: most in Silver/Bronze, few in Diamond/Legendary, near-zero in Legendary
- If distribution is skewed, adjust calibration breakpoints with empirical percentiles
- Publish calibration report documenting methodology
  **Success criteria:** Tier distribution within 10% of intended targets, documented and versioned.

---

## Infrastructure

(Empty — add items as they arise)

---

## UX & Journey

(Empty — add items as they arise)

---

## Competitive & Market

(Empty — add items as they arise)
