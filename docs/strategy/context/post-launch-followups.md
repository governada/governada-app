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

### CuratedVoteFlow Real-Time Position Nudging

**Source:** Living Republic Epic, Chunk 3 planning session (2026-03-30)
**Priority:** Medium
**Why deferred:** The core spatial match reveal (quiz → user node placement → neighborhood glow → Seneca narrative) needs to ship and be validated first. Progressive position refinement is a second-order feature that depends on the core being solid.
**What's needed:**

- After spatial match reveal places user node, CuratedVoteFlow lets users vote on real proposals to refine their alignment
- Each vote updates the user's alignment vector and should animate their node drifting to a more precise position on the globe
- Requires: position interpolation (lerp user node from old → new position), FocusState update per vote, Seneca narration of the shift ("Your vote on the treasury proposal moved you closer to the Fiscal Conservatives")
- Depends on: Chunk 3 spatial match reveal being shipped and working
  **Success criteria:** User votes on 3+ proposals via CuratedVoteFlow; their node visibly shifts position on the globe after each vote; Seneca narrates the movement.

---

## Competitive & Market

(Empty — add items as they arise)
