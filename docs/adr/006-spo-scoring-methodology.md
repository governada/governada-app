# ADR-006: SPO Governance Score Methodology and Weights

## Status

Accepted — **V2 (current, Mar 2026)**. Supersedes V1 3-pillar model.

## Context

Civica needs a single 0-100 governance score per SPO that measures governance participation quality. The score exists so citizens can evaluate their stake pool's governance engagement — it is not for SPO vanity. The score must be objective, transparent, resistant to gaming, and structurally parallel to the DRep Score V3 (ADR-005) to enable fair cross-body comparison.

V1 used three pillars (Participation 45%, Consistency 30%, Reliability 25%). V2 adds a fourth pillar — Governance Identity — to incentivize SPOs to publicly communicate their governance stance and to create structural parity with DRep scoring.

## Decision (V2 — 4-Pillar Model)

Weighted composite with four pillars, each percentile-normalized across the full SPO population:

- **Participation (38%)**: Importance-weighted voting participation with temporal decay and close-margin bonus. Highest weight because governance participation is the primary SPO governance function. SPOs who vote on more proposals, especially important ones, score higher.
- **Consistency (24%)**: Vote diversity (penalizes >85% same direction), proposal type breadth, and dissent signal (alignment with SPO majority). Measures thoughtful engagement vs rubber-stamping.
- **Reliability (23%)**: Active streak, recency, gap penalty, responsiveness (median days to vote), and tenure. Measures dependability across time.
- **Governance Identity (15%)**: Pool identity quality (tiered) + community presence (delegator count percentile). Lowest weight — enough to incentivize profile quality and governance communication, not enough to dominate.

### Weight Rationale

Proportional reduction from V1 to accommodate the 4th pillar. Participation remains highest because it IS the core governance function. Identity at 15% matches DRep Score to avoid cross-body scoring asymmetry.

### Participation (38%)

- Importance-weighted: Critical proposals (3x), Important (2x), Standard (1x). Treasury proposals get log-scaled additional weight.
- Temporal decay: exponential with 180-day half-life (`DECAY_LAMBDA = LN2/180`).
- Close-margin bonus: proposals where SPO yes/no ratio margin < 0.2 get 1.5x weight. Rewards participation on contentious votes.

### Consistency (24%)

Three equally-weighted sub-components:

- **Vote diversity**: penalizes >85% same direction votes. Full score for balanced voting patterns.
- **Type breadth**: proportion of proposal types covered. Full score for voting across all types.
- **Dissent signal**: sweet spot at 15-40% dissent rate vs SPO majority. Too low = herd behavior; too high = contrarian noise.

### Reliability (23%)

Five sub-components:

- **Active streak (30%)**: consecutive epochs with votes. `min(100, streak * 15)`.
- **Recency (25%)**: `100 * exp(-epochsSinceLastVote / 5)`.
- **Gap penalty (15%)**: longest run without voting. `max(0, 100 - longestGap * 15)`.
- **Responsiveness (15%)**: median days from proposal creation to vote. `100 * exp(-medianDays / 14)`.
- **Tenure (15%)**: `20 + 80 * (1 - exp(-tenure/30))`. New pools aren't penalized to zero.

### Governance Identity (15%)

Two sub-components:

- **Pool Identity Quality (60%)**: quality-tiered scoring across pool metadata fields (max 105, clamped to 100):
  - Ticker (10 pts, binary)
  - Pool name (10 pts, binary, >2 chars)
  - Governance statement (20 pts max, tiered: >=200 chars: 20, >=50: 15, >=1: 5)
  - Pool description (15 pts max, tiered: >=200: 15, >=50: 10, >=1: 3)
  - Homepage URL (10 pts, validated, not broken)
  - Social links (30 pts max, >=2 valid: 30, >=1 valid: 25)
  - Metadata hash verified (5 pts, binary)

- **Community Presence (40%)**: delegator count percentile across all scored pools. Count-based (not stake-based) to measure trust breadth rather than whale concentration.

**Key fairness properties:**

- Unclaimed pools score a baseline from on-chain metadata alone (ticker + name + hash = 25/100).
- Claiming a profile on Civica unlocks up to 75 additional points via governance statement, description, social links, and homepage.
- Pool size (live stake) is intentionally excluded — mirrors DRep Score's exclusion of voting power.

### Momentum

Linear regression slope over the last 14 days of score history from `spo_score_snapshots`. Same `computeMomentum()` function as DRep Score. Null if <2 data points in the window.

### Percentile Normalization

All raw pillar scores are percentile-normalized across the full SPO population before weighting. Same `percentileNormalize()` function as DRep Score (average-rank for ties, n=1 → 50).

### Score Tiers

Same tier system as DRep Score: Emerging (0-39), Bronze (40-54), Silver (55-69), Gold (70-84), Diamond (85-94), Legendary (95-100).

## Implementation

- Core: `lib/scoring/spoScore.ts`, `lib/scoring/spoGovernanceIdentity.ts`
- Shared: `lib/scoring/percentile.ts`, `lib/scoring/types.ts`
- Pipeline: `inngest/functions/sync-spo-scores.ts`
- Storage: `pools` table (current scores), `spo_score_snapshots` (history)

## Consequences

- 4-pillar model creates structural parity with DRep Score, enabling fair cross-body comparison
- Governance Identity pillar incentivizes SPOs to publicly explain their governance stance
- Score is deterministic and reproducible — no AI in the scoring itself
- Percentile normalization means scores reflect relative standing among SPOs
- SPOs with few votes get naturally low scores (intentional — no minimum-vote threshold)
- Pool size/stake intentionally excluded (conflicts with decentralization mission)
- Unclaimed pools are not penalized to zero, but claiming provides significant upside
- The claim incentive drives SPO onboarding — a key growth loop
