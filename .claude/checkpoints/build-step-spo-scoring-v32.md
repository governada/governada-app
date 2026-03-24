# SPO Score V3.2 Defensibility Rebuild — Checkpoint

**Status:** COMPLETE (core build) | POST-LAUNCH items remaining
**Created:** 2026-03-22
**Last Updated:** 2026-03-22
**Defensibility:** ~90/100 (up from ~40/100 pre-V3.2)

## Shipped PRs

| PR   | Content                                                                                                | Status                     |
| ---- | ------------------------------------------------------------------------------------------------------ | -------------------------- |
| #533 | Engine core: deliberation rewrite, identity hardening, graduated confidence, sybil penalty, versioning | Merged, deployed, verified |
| #534 | Attribution expansion, methodology page update, ScoreVersionBadge, ADR-006                             | Merged, deployed, verified |
| #544 | Gaming analysis, sensitivity analysis, worked examples, sybil transparency on profiles                 | Merged, deployed, verified |

## Approved Decisions

1. **Deliberation Quality at 25%** — voting behavior signals carry full pillar weight because SPOs lack rationale infrastructure. Intentional divergence from DRep (7% effective weight).
2. **Graduated confidence tier caps** — matching DRep architecture (0-4=Emerging, 5-9=Bronze, 10-14=Silver, 15+=uncapped).
3. **Delegator count in DRep identity** — flagged for DRep V3.2 team to evaluate. Not changed in SPO plan.
4. **Stake pool performance excluded** — governance-only scope. Pool performance displayed alongside but not in the score.

## Phase Tracking

| Phase                               | Status   | PR   |
| ----------------------------------- | -------- | ---- |
| 1. Shared Versioning Infrastructure | COMPLETE | #533 |
| 2. Deliberation Quality Rewrite     | COMPLETE | #533 |
| 3. Governance Identity Hardening    | COMPLETE | #533 |
| 4. Confidence Graduation + Sybil    | COMPLETE | #533 |
| 5. Attribution Expansion            | COMPLETE | #534 |
| 6. UI + Methodology + Versioning    | COMPLETE | #534 |
| 7. Defensibility Hardening          | COMPLETE | #544 |

---

## Post-Launch Implementation Items

### P0 — Required before activating `spo_score_v32` feature flag

**1. Shadow scoring comparison (V3.1 vs V3.2)**

- Run the SPO sync with V3.2 enabled in shadow mode (write V3.2 scores to separate columns or log them without overwriting V3.1)
- Generate a comparison report: which SPOs change tiers, which gain/lose >10 points
- Manual review of outliers — verify the new formula produces sensible results for known pools
- **Why**: Activating V3.2 without reviewing real-world impact risks surprising SPOs with unexplained score changes
- **Depends on**: Feature flag `spo_score_v32` wired into sync pipeline (infrastructure exists, needs activation logic)

**2. Deliberation calibration curve recalibration**

- Current curve `{ floor: 5, targetLow: 20, targetHigh: 55, ceiling: 80 }` was tuned when 55% of the pillar was always zero
- After first V3.2 sync, examine the actual raw deliberation score distribution
- Adjust targetLow/targetHigh so scores spread across the intended range (not clustered)
- **Why**: Gaming analysis showed all non-zero strategies cluster at cal 69-95 on deliberation. The curve may need widening to create meaningful differentiation.
- **Depends on**: At least 1 full sync cycle with V3.2 formula

**3. Sync pipeline V3.2 gating**

- Wire the `spo_score_v32` feature flag into `sync-spo-scores.ts` so it toggles between V3.1 and V3.2 formula paths
- Currently the code always runs V3.2 formula — need conditional logic for the shadow period
- **Why**: Allows gradual rollout per the approved strategy (shadow → internal → public cutover)

### P1 — Should do within first month post-launch

**4. Outcome validation pipeline**

- New Inngest function: `compute-spo-outcome-correlations` (weekly)
- For each epoch, correlate SPO score changes with delegator count changes (from `spo_power_snapshots`)
- Compute Pearson correlation per pillar and composite
- Store in `spo_outcome_correlations` table (schema exists in original V3 plan)
- **Why**: Proves scores are _useful_, not just _fair_. "Pools with higher governance scores retain X% more delegators" is the strongest possible defensibility argument.
- **Effort**: Medium (new Inngest function, new table, weekly computation)

**5. Score change announcement system**

- When `spo_score_v32` flag is activated publicly, show a one-time dismissible banner on SPO profile pages: "Score methodology updated to V3.2. Your score may have changed. Learn more."
- Link to methodology page with changelog
- Component stub exists (`ScoreVersionBadge` links to methodology), but the banner for transitions doesn't
- **Why**: SPOs deserve to know why their score changed

**6. Methodology page — render changelog from database**

- The `scoring_methodology_changelog` table is seeded with V3.1 and V3.2 entries
- The methodology page currently has static V3.2 text but doesn't query the database
- Add a "Version History" section that reads from the changelog table
- **Why**: Future methodology changes auto-surface without code deploys

### P2 — Should do within first quarter post-launch

**7. Random voting detection**

- Gaming analysis revealed: random voting (Strategy B) scores identically to ideal governance (Strategy F) on vote diversity
- V3.2 cannot distinguish random from intentional mixed voting
- Potential solutions: vote timing analysis (random voters vote at identical intervals), rationale provision (when SPO rationales become available), or correlation with proposal content (random voters don't correlate with proposal topics)
- **Why**: Known attack surface. Acceptable for launch because random voting IS participation, but worth closing.
- **Effort**: Large (requires new signals not currently available)

**8. SPO rationale infrastructure**

- Phase 6 of the original V3 plan: SPO vote rationale submission flow
- After casting a vote, prompt: "Want to explain your vote? (optional)"
- Store in `spo_vote_rationales` table (migration in original plan)
- Once data exists, add rationale provision as a 5th sub-component of Deliberation Quality
- **Why**: Closes the gap between DRep and SPO scoring. DReps are scored on rationale quality; SPOs currently are not.
- **Effort**: Large (new UI flow, new table, rationale quality scoring adaptation)

**9. DRep V3.2 alignment items (flagged for DRep team)**

- Evaluate whether `DELEGATOR_TIERS` in DRep identity is defensible long-term (SPO removed it in V3.2)
- Consider adding DRep sybil detection (SPO has it, DRep doesn't)
- These are flagged in the Intentional Divergences table of the approved plan

### P3 — Nice to have

**10. Academic methodology whitepaper**

- Formal documentation of the scoring methodology suitable for academic review
- Include: mathematical formulations, calibration rationale, gaming resistance proofs, sensitivity analysis results, outcome validation data
- **Why**: Moves defensibility from "we published our methodology" to "our methodology has been formally documented"
- **Effort**: Large (writing, not code)

**11. Score simulator**

- "If you vote on the next 5 proposals, your score would increase to X"
- Uses the attribution engine + projection logic
- **Why**: Makes scores actionable. SPOs can see exactly what to do to improve.
- **Effort**: Medium (frontend + projection logic)

---

## Key Findings from Gaming Analysis

```
Strategy                  | Composite | Tier     | Deliberation Cal
Rubber-Stamper (all Yes)  |    88     | Diamond  | 69
Random Voter              |    94     | Diamond  | 95
Sybil Clone               |    88     | Diamond  | 69
Metadata Gamer (2 votes)  |    59     | Emerging | 66
Abstain Farmer            |    89     | Diamond  | 75
Ideal Governor            |    94     | Diamond  | 95
```

**Key insight**: Deliberation is the primary differentiator (26-point spread). Graduated confidence blocks metadata-only gaming. Random voting matches ideal — acceptable tradeoff for now.

## Key Findings from Sensitivity Analysis

```
Pillar              | Rank Corr | Tier Changes | Max Delta
Participation ±10%  |   0.9988  |      0       |    2.0
Deliberation ±10%   |   0.9986  |      0       |    1.0
Reliability ±10%    |   0.9988  |      1       |    1.0
Identity ±10%       |   0.9986  |      0       |    2.0
```

**Conclusion**: Rankings are stable. Weight choices are robust.
