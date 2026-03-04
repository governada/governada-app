# ADR-005: DRep Scoring Methodology and Weights

## Status

Accepted — **V3 (current, Mar 2026)**. Supersedes earlier V1/V2 models.

## Context

Civica needs a single 0-100 score per DRep that measures governance accountability. The score must be objective, transparent, and resistant to gaming.

## Decision (V3 — 4-Pillar Model)

Weighted composite with four pillars, each percentile-normalized across the full DRep population:

- **Engagement Quality (35%)**: Rationale provision rate (decay-weighted), AI-assessed rationale quality, deliberation signal (dissent, type breadth). Highest weight because explaining governance decisions separates engaged DReps from rubber-stampers.
- **Effective Participation (25%)**: Importance-weighted participation with treasury scaling and close-margin bonus.
- **Reliability (25%)**: Consistency, abstention penalty, responsiveness (median days to vote).
- **Governance Identity (15%)**: Quality-tiered profile completeness + delegator count percentile. Lowest weight — may tune down further per citizen-centric vision review.

Momentum: linear regression slope over score history. Temporal decay: exponential with 180-day half-life. Implementation: `lib/scoring/`.

### Historical note (V1/V2)

V1 used simple participation rate + rationale provision rate. V2 added reliability and profile completeness with different weights (rationale 35%, participation 30%, reliability 20%, profile 15%). V3 redesigned all pillars, added percentile normalization, momentum, and temporal decay. V1/V2 code may exist in `utils/scoring.ts` as legacy — audit and remove.

## Consequences

- 4-pillar model incentivizes DReps to explain votes, participate consistently, and maintain quality profiles
- Score is deterministic and reproducible — AI only used for rationale quality assessment, not the score itself
- Percentile normalization means scores reflect relative standing, not absolute thresholds
- DReps with few votes get naturally low scores (no minimum-vote threshold) — this is intentional
- Voting power/influence intentionally excluded (conflicts with decentralization mission)
- Score tiers (Emerging → Legendary) planned to add emotional weight to numeric scores
