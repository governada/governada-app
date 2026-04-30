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

### Vote Split Regional Energy

**Source:** Living Republic Epic, Chunk 4 planning session (2026-03-30)
**Priority:** Medium — fast-follow after Chunk 4 ships
**Why deferred:** Chunk 4 builds the shader infrastructure (uniform arrays, Gaussian falloff, GPU tier gating). Vote split is a second data pipeline using the same infrastructure. Shipping ambient energy first proves the visual approach before adding contextual mode switching.
**What's needed:**

- When a proposal is focused (via Seneca or entity peek), each cluster's aggregate vote (Yes/No/Abstain ratio by voting power) determines its atmosphere color
- Warm (amber/gold) = majority Yes, Cool (blue/cyan) = majority No, Neutral (dim white) = split
- Same `uRegionColors` uniform from Chunk 4 — just swap the color data when vote split mode is active
- Smooth 1-second lerp transition between ambient energy colors and vote split colors
- Data source: per-cluster voting aggregation from `drep_votes` table for the focused proposal
- Depends on: Chunk 4 shader infrastructure, Chunk 1 cluster data
  **Success criteria:** User focuses a proposal, atmosphere smoothly shifts to show which governance regions support vs. oppose it. Visually intuitive warm/cool gradient.

---

## Globe Cerebro Engine — UI Wiring Gaps

### Vote Split Globe Trigger

**Source:** Cerebro QA session (2026-04-01)
**Priority:** Medium
**Why deferred:** `voteSplitBehavior` exists and handles `voteSplit` commands, but no UI element dispatches it. Needs a proposal-context trigger (e.g., when viewing a proposal page, show vote split on the globe).
**What's needed:**

- Proposal detail page or Seneca entity peek dispatches `voteSplit` command with the proposal ref
- Globe colors nodes by Yes/No/Abstain vote via `colorOverrides`
- Requires vote data lookup per proposal (existing `drep_votes` table)
  **Success criteria:** Viewing a proposal page shows the vote split visualization on the globe.

### AI Advisor → Globe Command Bridge

**Source:** Cerebro QA session (2026-04-01)
**Priority:** High
**Why deferred:** The advisor CAN dispatch globe commands via tool callbacks, but it doesn't reliably do so. The prompt needs explicit tool definitions for globe commands, and the advisor needs to be instructed to use them when discussing entities, proposals, or spatial concepts.
**What's needed:**

- Define globe tools in the advisor prompt (flyTo, highlight, warmTopic, showActiveEntities)
- Advisor should dispatch `flyTo` when mentioning a specific DRep, `warmTopic` for topic discussions
- Test with common queries: "Tell me about DRep X", "What's controversial?", "Who are the most active?"
  **Success criteria:** 80%+ of entity-mentioning advisor responses trigger a visible globe reaction.

### Match Flow Atmosphere Warming Progression

**Source:** Cerebro QA session (2026-04-01)
**Priority:** Medium
**Why deferred:** The `setSharedIntent` on match start IS wired (focus engine processes it), but progressive atmosphere warming per answer and the atmosphere color lerp need visual verification once the engine tick race condition fix ships.
**What's needed:**

- Verify per-answer `setSharedIntent` calls update `scanProgress` and `atmosphereTemperature`
- Verify `GlobeAtmosphere` component reads and lerps atmosphere hints from FocusState
- May need explicit atmosphere fields in FocusState (currently only in the checkpoint spec, not FocusState type)
  **Success criteria:** Globe atmosphere visibly warms from teal to amber as user progresses through match questions.

### Seneca Panel Close / Focus Clear Affordance

**Source:** Cerebro QA session (2026-04-01)
**Priority:** Low
**Why deferred:** SenecaMatch cleanup does call `setSharedIntent(DEFAULT_INTENT)` on unmount, but the panel UX doesn't have a clear "close" or "navigate away" affordance during the match flow.
**What's needed:**

- Clear back/close button behavior during match that returns to idle state and clears globe focus
- Verify globe returns to idle (cool teal, no dimming) when match panel closes
  **Success criteria:** User can exit match flow and globe cleanly returns to default state.

---

## Competitive & Market

(Empty — add items as they arise)
