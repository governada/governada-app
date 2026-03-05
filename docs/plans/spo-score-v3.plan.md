# SPO Score V3 — 10/10 Upgrade Plan

## Goal

Upgrade SPO Governance Score from V2 (4-pillar, editorially weighted) to V3 (4-pillar, empirically grounded, confidence-aware, contestable). Addresses all identified mechanical bugs, gaming vectors, and institutional credibility gaps.

## New Formula

```
SPO Score V3 (0-100, confidence-banded) =
  Participation (35%) +
  Deliberation Quality (25%) +
  Reliability (25%) +
  Governance Identity (15%)
```

Each pillar: raw score -> percentile-normalized (confidence-weighted) -> weighted sum -> clamped 0-100.

## Phases

### Phase 1: Core Formula Rewrite (Backend)

Rewrites the scoring engine. No UI changes yet — API responses remain structurally compatible. Feature-flagged behind `spo_score_v3`.

#### 1A: Database Migrations

**New migration: `0XX_spo_score_v3.sql`**

```sql
-- SPO vote rationales (parallel to vote_rationales for DReps)
CREATE TABLE spo_vote_rationales (
  pool_id TEXT NOT NULL,
  proposal_tx_hash TEXT NOT NULL,
  proposal_index INTEGER NOT NULL,
  rationale_text TEXT,
  meta_url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_id, proposal_tx_hash, proposal_index)
);

-- Add deliberation columns to spo_votes
ALTER TABLE spo_votes ADD COLUMN rationale_quality REAL;
ALTER TABLE spo_votes ADD COLUMN has_rationale BOOLEAN DEFAULT FALSE;

-- Add confidence + V3 columns to pools table
ALTER TABLE pools ADD COLUMN score_confidence NUMERIC(5,2);
ALTER TABLE pools ADD COLUMN deliberation_raw INTEGER;
ALTER TABLE pools ADD COLUMN deliberation_pct INTEGER;
ALTER TABLE pools ADD COLUMN score_version INTEGER DEFAULT 2;

-- Rename consistency -> deliberation in snapshots (keep old columns for V2 history)
ALTER TABLE spo_score_snapshots ADD COLUMN deliberation_raw INTEGER;
ALTER TABLE spo_score_snapshots ADD COLUMN deliberation_pct INTEGER;
ALTER TABLE spo_score_snapshots ADD COLUMN score_confidence NUMERIC(5,2);
ALTER TABLE spo_score_snapshots ADD COLUMN score_version INTEGER DEFAULT 2;

-- Per-vote attribution cache
CREATE TABLE spo_score_attribution (
  pool_id TEXT NOT NULL,
  epoch_no INTEGER NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('participation','deliberation','reliability','identity')),
  attribution JSONB NOT NULL,  -- top-5 positive/negative vote contributions
  PRIMARY KEY (pool_id, epoch_no, pillar)
);

-- Outcome tracking
CREATE TABLE spo_outcome_correlations (
  epoch_no INTEGER PRIMARY KEY,
  participation_corr NUMERIC(5,3),
  deliberation_corr NUMERIC(5,3),
  reliability_corr NUMERIC(5,3),
  identity_corr NUMERIC(5,3),
  composite_corr NUMERIC(5,3),
  delegator_retention_rate NUMERIC(5,3),
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposal activity per epoch (for proposal-aware gap calculation)
CREATE TABLE epoch_proposal_activity (
  epoch_no INTEGER PRIMARY KEY,
  proposal_count INTEGER NOT NULL DEFAULT 0,
  has_votable_proposals BOOLEAN NOT NULL DEFAULT FALSE
);
```

**Files:**

- NEW: `supabase/migrations/0XX_spo_score_v3.sql`

---

#### 1B: Deliberation Quality Pillar

Replace `computeConsistency()` with `computeDeliberationQuality()`. Three sub-components:

**Rationale Provision (40%)**

- Percentage of votes with rationale, importance-weighted, with temporal decay
- Mirrors DRep `engagementQuality.ts` provision rate logic
- SPOs without any rationales score 0 on this sub-component (clear growth path)
- InfoActions excluded (non-binding)

**Vote Timing Distribution (30%)**

- Compute standard deviation of (voteTime - proposalCreationTime) across all votes
- Normalize: very low stddev (bot-like, all votes within minutes) = penalty; very high stddev (erratic) = mild penalty; moderate stddev (natural human pattern) = full score
- Formula: `score = 100 * (1 - exp(-stddev / targetStddev)) * exp(-max(0, stddev - 3*targetStddev) / targetStddev)`
  - Where `targetStddev` is calibrated to ~3 days (typical human deliberation variance)

**Proposal Coverage Entropy (30%)**

- Shannon entropy of vote distribution across proposal types
- `H = -sum(p_i * log2(p_i))` where p_i = fraction of votes on type i
- Normalize to 0-100: `score = (H / log2(totalTypes)) * 100`
- Balanced engagement across fewer types > token engagement across all types

**Files:**

- EDIT: `lib/scoring/spoScore.ts` — replace `computeConsistency()` with `computeDeliberationQuality()`, update weights to (0.35, 0.25, 0.25, 0.15), update `SpoScoreResult` interface (add deliberation fields, keep consistency fields for V2 compat)
- NEW: `lib/scoring/spoDeliberationQuality.ts` — extracted pillar implementation
- EDIT: `lib/scoring/types.ts` — add `SPO_V3_PILLAR_WEIGHTS`, `SpoVoteDataV3` interface with rationale fields

---

#### 1C: Participation Fixes

**Global close-margin weighting**

- Instead of 1.5x bonus per individual SPO vote, increase the proposal's `importanceWeight` globally when the SPO population splits within 20% margin
- This means contentious proposals count more for ALL SPOs, not just those who voted
- Move margin computation to proposal-level preprocessing, not per-SPO scoring

**Files:**

- EDIT: `lib/scoring/spoScore.ts` — `computeParticipation()`: remove per-vote margin bonus, accept pre-computed proposal importance weights that already include margin adjustment
- EDIT: `inngest/functions/sync-spo-scores.ts` — compute adjusted importance weights (base weight \* margin multiplier) before passing to `computeSpoScores()`

---

#### 1D: Reliability Fixes

**Proposal-aware gap calculation**

- Use `epoch_proposal_activity` table to skip epochs with no votable proposals
- Gap penalty only counts epochs where the SPO _could_ have voted but didn't

**Uniform temporal decay**

- Apply 180-day decay to streak, gap, and responsiveness sub-components (not just participation)
- Recent reliability matters more than historical

**Replace responsiveness with engagement consistency**

- Move timing analysis to Deliberation Quality pillar
- New sub-component: coefficient of variation of votes-per-active-epoch
- Steady participation > bursty participation

**Updated sub-weights:**

- Active streak (30%) — proposal-aware
- Recency (25%) — unchanged
- Gap penalty (15%) — proposal-aware
- Engagement consistency (15%) — new, replaces responsiveness
- Tenure (15%) — unchanged

**Files:**

- EDIT: `lib/scoring/spoScore.ts` — rewrite `computeReliability()` with proposal-aware logic, add `activeEpochs` parameter
- EDIT: `inngest/functions/sync-spo-scores.ts` — populate `epoch_proposal_activity`, pass active epochs to scoring

---

#### 1E: Governance Identity Fixes

**Keyword quality checklist for governance statement**
Replace character-length tiers with:

- Statement present (5pts)
- > 100 characters (5pts)
- Contains governance-relevant keywords from set: ["vote", "govern", "delegate", "cardano", "treasury", "proposal", "constitution", "drep", "stake", "community", "accountability", "transparency", "decentraliz"] (5pts for >= 3 matches)
- Content distinct from pool description (Jaccard distance > 0.5) (5pts)
- Max: 20pts (same as before, but quality-based)

**Delegation responsiveness (replaces raw delegator count)**

- Track delegator count change in the 2 epochs following governance votes
- `retentionScore = 100 * (delegatorsAfter / delegatorsBefore)` clamped to 0-100
- Falls back to delegator count percentile if insufficient history (<3 data points)
- Uses existing `spo_power_snapshots` for before/after comparison

**Files:**

- EDIT: `lib/scoring/spoGovernanceIdentity.ts` — replace `computePoolIdentityQuality()` statement scoring, replace `computeCommunityPresence()` with `computeDelegationResponsiveness()`
- EDIT: `inngest/functions/sync-spo-scores.ts` — compute delegation responsiveness from power snapshots, pass to identity scorer

---

#### 1F: Confidence System

**Confidence metric per SPO:**

```typescript
function computeConfidence(voteCount: number, epochSpan: number, typeCoverage: number): number {
  const voteFactor = 1 - Math.exp(-voteCount / 12); // 80% at ~15 votes
  const spanFactor = 1 - Math.exp(-epochSpan / 20); // 80% at ~20 epochs
  const typeFactor = Math.min(1, typeCoverage / 0.6); // 100% at 60% type coverage
  return Math.round((voteFactor * 0.5 + spanFactor * 0.3 + typeFactor * 0.2) * 100);
}
```

**Effects:**

- Confidence stored in `pools.score_confidence` and snapshots
- Tier assignment gated: `confidence < 60` -> max tier is Emerging
- Percentile normalization weighted by confidence (low-confidence SPOs contribute less to distribution)

**Files:**

- NEW: `lib/scoring/confidence.ts` — confidence computation + confidence-weighted percentile normalization
- EDIT: `lib/scoring/percentile.ts` — add `percentileNormalizeWeighted(rawScores, confidences)` variant
- EDIT: `lib/scoring/tiers.ts` — add confidence gate to `computeTier()`
- EDIT: `lib/scoring/spoScore.ts` — integrate confidence into composite computation
- EDIT: `inngest/functions/sync-spo-scores.ts` — compute and store confidence

---

#### 1G: Momentum Window Extension

- Change momentum window from 14 days to 30 days (5-6 data points vs 2-3)
- Require minimum 3 data points (was 2)

**Files:**

- EDIT: `lib/scoring/spoScore.ts` — `computeMomentum()`: change cutoff from 14 to 30 days, min points from 2 to 3

---

#### 1H: Tie-Breaking Fix

- Fix systematic Yes bias in `computeSpoMajorityByProposal()` when Yes and No counts are equal
- When tied, set majority to null (no majority) — tied votes don't count for dissent calculation in the legacy V2 path, and V3 drops dissent entirely

**Files:**

- EDIT: `lib/scoring/spoScore.ts` — fix tie-breaking in `computeSpoMajorityByProposal()`

---

### Phase 2: Attribution & Explainability (Backend + API)

Builds the per-vote attribution engine and exposes it via API. This is what makes the score contestable.

#### 2A: Attribution Engine

For each SPO, compute per-vote marginal contribution to each pillar:

- **Participation**: each vote's weighted contribution / totalProposalPool
- **Deliberation**: each vote's rationale contribution, timing contribution
- **Reliability**: which gaps cost the most points, which streaks helped
- **Identity**: which metadata fields are missing/weak

Store top-5 positive and top-5 negative contributors per pillar in `spo_score_attribution`.

**Files:**

- NEW: `lib/scoring/spoAttribution.ts` — attribution computation
- EDIT: `inngest/functions/sync-spo-scores.ts` — compute and store attribution after scoring

---

#### 2B: Attribution API

New endpoint: `GET /api/governance/pools/[poolId]/attribution`

Returns:

```json
{
  "poolId": "pool1...",
  "epoch": 510,
  "confidence": 78,
  "pillars": {
    "participation": {
      "score": 72,
      "percentile": 68,
      "topContributors": [
        { "proposalKey": "abc-0", "type": "HardFork", "contribution": +12.3, "reason": "Critical proposal, close margin" },
        ...
      ],
      "topDetractors": [
        { "proposalKey": null, "type": null, "contribution": -8.1, "reason": "Missed 3 proposals in epochs 482-484" }
      ]
    },
    ...
  },
  "recommendations": [
    "Add a governance statement to your pool profile (+15 identity points)",
    "Vote on InfoAction proposals to improve type coverage entropy"
  ]
}
```

**Files:**

- NEW: `app/api/governance/pools/[poolId]/attribution/route.ts`

---

#### 2C: Update Existing APIs

Update summary and competitive endpoints to include V3 fields:

- `score_confidence` in summary response
- `deliberation_pct` replacing `consistency_pct`
- `score_version: 3` field
- Keep `consistency_pct` in response for backward compat (deprecated)

**Files:**

- EDIT: `app/api/governance/pools/[poolId]/summary/route.ts`
- EDIT: `app/api/governance/pools/[poolId]/competitive/route.ts`
- EDIT: `app/api/governance/pools/route.ts`

---

### Phase 3: Gaming Analysis & Outcome Validation (Backend)

#### 3A: Gaming Analysis Script

Automated script that computes optimal gaming strategies against the current formula:

- Strategy 1: Vote Yes on everything
- Strategy 2: Vote randomly on everything
- Strategy 3: Vote only on close-margin proposals (snipe high-importance votes)
- Strategy 4: Max metadata + dust delegators + minimal votes
- Strategy 5: Copy another SPO's votes exactly

For each strategy, compute the maximum achievable composite score and tier. Output a report.

**Files:**

- NEW: `scripts/spo-gaming-analysis.ts` — runs against current formula, outputs report
- NEW: `docs/methodology/spo-score-v3-gaming-analysis.md` — published findings

---

#### 3B: Sybil Detection Signal

Flag SPOs with >95% vote correlation (same votes on same proposals):

- Compute pairwise vote agreement matrix for all SPOs
- Flag pairs above threshold
- Store in `spo_sybil_flags` table (not score-affecting, but visible to team)

**Files:**

- NEW: `lib/scoring/sybilDetection.ts`
- EDIT: `inngest/functions/sync-spo-scores.ts` — run sybil check after scoring
- Migration: add `spo_sybil_flags` table

---

#### 3C: Outcome Validation Pipeline

New Inngest function: `compute-spo-outcome-correlations` (weekly)

- For each epoch, correlate SPO score changes with delegator count changes (from `spo_power_snapshots`)
- Compute Pearson correlation per pillar and composite
- Store in `spo_outcome_correlations`

**Files:**

- NEW: `inngest/functions/compute-spo-outcomes.ts`
- EDIT: `app/api/inngest/route.ts` — register new function

---

#### 3D: Sensitivity Analysis Script

Script that varies each pillar weight by +/-10% and measures:

- Spearman rank correlation of top-50 SPOs vs baseline
- Number of tier changes across all SPOs
- Maximum score delta for any single SPO

Outputs a stability matrix. Run manually when considering weight changes.

**Files:**

- NEW: `scripts/spo-sensitivity-analysis.ts`

---

### Phase 4: UI Updates

#### 4A: Pool Profile Page — V3 Score Display

- Replace "Consistency" pillar label with "Deliberation Quality"
- Add confidence indicator (e.g., "Score confidence: High (82%)" or a visual band)
- Show score version badge ("V3")
- Update pillar progress bars for new pillar structure

**Files:**

- EDIT: `app/pool/[poolId]/page.tsx` — update pillar display, add confidence
- EDIT: any SPO-related components in `components/` that reference consistency_pct

---

#### 4B: Attribution View

New section on pool profile: "Score Breakdown"

- Per-pillar expandable cards showing top contributors/detractors
- Actionable recommendations ("Add a governance statement", "Vote on more proposal types")
- Fetches from `/api/governance/pools/[poolId]/attribution`

**Files:**

- NEW: `components/SpoScoreAttribution.tsx`
- EDIT: `app/pool/[poolId]/page.tsx` — integrate attribution component

---

#### 4C: Confidence Badge on Leaderboard

- SPO leaderboard shows confidence indicator next to score
- Low-confidence SPOs get a "Provisional" badge
- Tooltip explains what confidence means

**Files:**

- EDIT: `app/api/governance/pools/route.ts` — include confidence in list response
- EDIT: components rendering the SPO leaderboard

---

#### 4D: Cross-Body Comparison Caveat

- Where DRep and SPO scores are shown side-by-side, add a subtle note: "Scores measure different governance functions"
- Encourage inter-body alignment view instead of raw score comparison

**Files:**

- EDIT: any component showing DRep vs SPO score comparison

---

### Phase 5: Public Methodology & Governance

#### 5A: ADR Update

- Update `docs/adr/006-spo-scoring-methodology.md` to V3
- Document all formula changes, rationale, and migration path
- Include sensitivity analysis results and gaming analysis summary

**Files:**

- EDIT: `docs/adr/006-spo-scoring-methodology.md`

---

#### 5B: Public Methodology Page

- New page at `/methodology/spo-score` (or section on existing methodology page)
- Explains all 4 pillars, weights, confidence system
- Links to gaming analysis and outcome validation data
- "Last updated: Epoch XXX, V3" with changelog

**Files:**

- NEW: `app/methodology/spo-score/page.tsx`
- Content sourced from ADR-006 V3

---

#### 5C: Score Change Announcement System

- When methodology version changes, show a banner on SPO profile pages: "Score methodology updated to V3. Your score may have changed. Learn more."
- One-time dismissible notification
- Link to methodology page with "simulate your V3 score" comparison (shows V2 vs V3 side by side for transition period)

**Files:**

- NEW: `components/ScoreMethodologyBanner.tsx`
- EDIT: `app/pool/[poolId]/page.tsx` — conditionally render banner

---

### Phase 6: SPO Rationale Infrastructure

This is the long-term enabler for the Deliberation Quality pillar. Without it, the rationale provision sub-component (40% of Deliberation Quality, 10% of total score) starts at 0 for all SPOs.

#### 6A: SPO Vote Rationale Submission

- On the SPO dashboard, after casting a vote, prompt: "Want to explain your vote? (optional)"
- Store in `spo_vote_rationales` table
- No AI quality scoring initially — just presence/absence
- This creates the data pipeline for future quality scoring

**Files:**

- EDIT: `components/SpoDashboard.tsx` — add rationale prompt after vote
- NEW: `app/api/governance/pools/[poolId]/rationale/route.ts` — POST endpoint
- EDIT: `inngest/functions/sync-spo-scores.ts` — join rationale data when computing deliberation quality

---

#### 6B: SPO Rationale Quality Scoring (Future)

Once sufficient rationale data exists (>50 SPOs with >5 rationales each):

- Adapt `lib/alignment/rationaleQuality.ts` for SPO context
- Score on specificity, reasoning depth, proposal awareness (same as DRep)
- Add as 2nd layer to Deliberation Quality (provision rate + quality rating)

**Files:**

- NEW: `lib/scoring/spoRationaleQuality.ts` — adapted from DRep version
- EDIT: `lib/scoring/spoDeliberationQuality.ts` — integrate quality scores

---

## File Change Summary

### New Files (14)

| File                                                     | Phase |
| -------------------------------------------------------- | ----- |
| `supabase/migrations/0XX_spo_score_v3.sql`               | 1A    |
| `lib/scoring/spoDeliberationQuality.ts`                  | 1B    |
| `lib/scoring/confidence.ts`                              | 1F    |
| `lib/scoring/spoAttribution.ts`                          | 2A    |
| `app/api/governance/pools/[poolId]/attribution/route.ts` | 2B    |
| `scripts/spo-gaming-analysis.ts`                         | 3A    |
| `docs/methodology/spo-score-v3-gaming-analysis.md`       | 3A    |
| `lib/scoring/sybilDetection.ts`                          | 3B    |
| `inngest/functions/compute-spo-outcomes.ts`              | 3C    |
| `scripts/spo-sensitivity-analysis.ts`                    | 3D    |
| `components/SpoScoreAttribution.tsx`                     | 4B    |
| `app/methodology/spo-score/page.tsx`                     | 5B    |
| `components/ScoreMethodologyBanner.tsx`                  | 5C    |
| `app/api/governance/pools/[poolId]/rationale/route.ts`   | 6A    |

### Edited Files (16)

| File                                                     | Phase     | Changes                                                                    |
| -------------------------------------------------------- | --------- | -------------------------------------------------------------------------- |
| `lib/scoring/spoScore.ts`                                | 1B-1H     | New weights, new pillar, reliability fixes, momentum window, tie-breaking  |
| `lib/scoring/types.ts`                                   | 1B        | V3 weights, extended interfaces                                            |
| `lib/scoring/spoGovernanceIdentity.ts`                   | 1E        | Keyword quality, delegation responsiveness                                 |
| `lib/scoring/percentile.ts`                              | 1F        | Confidence-weighted normalization                                          |
| `lib/scoring/tiers.ts`                                   | 1F        | Confidence gate                                                            |
| `inngest/functions/sync-spo-scores.ts`                   | 1C-3B     | Global margin weighting, proposal activity, confidence, attribution, sybil |
| `app/api/governance/pools/[poolId]/summary/route.ts`     | 2C        | V3 fields                                                                  |
| `app/api/governance/pools/[poolId]/competitive/route.ts` | 2C        | V3 fields                                                                  |
| `app/api/governance/pools/route.ts`                      | 2C, 4C    | V3 fields, confidence                                                      |
| `app/pool/[poolId]/page.tsx`                             | 4A-4D, 5C | V3 display, attribution, confidence, banner                                |
| `components/SpoDashboard.tsx`                            | 6A        | Rationale prompt                                                           |
| `app/api/inngest/route.ts`                               | 3C        | Register outcome function                                                  |
| `docs/adr/006-spo-scoring-methodology.md`                | 5A        | V3 update                                                                  |
| `__tests__/scoring.test.ts` or new test file             | All       | Unit tests for all new scoring logic                                       |

### New Test Coverage Required

| Test                                         | Phase            |
| -------------------------------------------- | ---------------- |
| `__tests__/spo-deliberation-quality.test.ts` | 1B               |
| `__tests__/spo-confidence.test.ts`           | 1F               |
| `__tests__/spo-attribution.test.ts`          | 2A               |
| `__tests__/spo-sybil-detection.test.ts`      | 3B               |
| `__tests__/spo-score-v3-composition.test.ts` | 1B (integration) |

## Rollout Strategy

1. **Feature flag**: `spo_score_v3` controls which formula runs. V2 continues running in parallel during transition.
2. **Shadow scoring**: Run V3 alongside V2 for 2+ epochs. Store V3 scores in new columns without surfacing them.
3. **Comparison report**: Generate V2 vs V3 comparison for all SPOs. Review for surprising rank changes.
4. **Gradual cutover**: Enable V3 in UI behind feature flag for team/beta users first.
5. **Announcement**: Publish methodology page + banner 1 epoch before public switch.
6. **Public launch**: Flip feature flag. V2 scores remain in snapshot history with version tag.
7. **Post-launch**: Monitor outcome correlations weekly for 1 month. Adjust if needed.

## Dependencies & Risks

| Risk                                                                 | Mitigation                                                                                                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rationale data is sparse (SPOs don't explain votes yet)              | Deliberation Quality starts at 0 for rationale provision — other 2 sub-components (timing, entropy) still differentiate SPOs. Phase 6 builds the rationale pipeline. |
| Delegation responsiveness requires sufficient power snapshot history | Fall back to delegator count percentile if <3 epochs of data                                                                                                         |
| Confidence gating may frustrate new SPOs                             | Emerging tier is still visible and meaningful. Confidence is explained in UI.                                                                                        |
| V2->V3 transition causes rank changes                                | Shadow scoring + comparison report before cutover. Announcement with "simulate your score" tool.                                                                     |
| Gaming analysis reveals unexpected vulnerabilities                   | Fix before public launch. This is the point of the analysis.                                                                                                         |
| Small SPO population makes percentiles coarse                        | Confidence-weighted percentiles reduce distortion. Document limitation in methodology page.                                                                          |

## Estimated Scope

- Phase 1 (Core formula): ~12 files touched, heaviest phase
- Phase 2 (Attribution): ~4 new files, moderate
- Phase 3 (Gaming/validation): ~5 new files, can run in parallel with Phase 2
- Phase 4 (UI): ~5 files, depends on Phase 1-2
- Phase 5 (Docs): ~3 files, can start after Phase 1
- Phase 6 (Rationale infra): Independent, can start anytime

Phases 1-2 are the critical path. Phases 3-6 can be parallelized or sequenced flexibly.
