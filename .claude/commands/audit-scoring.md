Audit scoring methodology, calibration quality, and real-world impact.

## Purpose

Evaluate whether Civica's scoring systems (DRep Score V3, SPO Score V3, GHI, CC Transparency Index, PCA alignment, matching engine) are achieving their intended goals:

1. **Differentiation**: Do scores meaningfully separate good governance behavior from bad?
2. **Defensibility**: Can the methodology withstand public scrutiny from the Cardano community?
3. **Gaming resistance**: Can a DRep/SPO artificially inflate their score?
4. **Calibration**: Are the 80+ magic numbers in `calibration.ts` producing the intended effects?
5. **Impact**: Do scores actually influence user behavior (delegation changes, rationale quality)?

## Scope

Argument: `$ARGUMENTS`

- If empty: Full scoring audit (all scoring systems + alignment + matching)
- If "drep": DRep Score V3 deep dive
- If "spo": SPO Score V3 deep dive
- If "alignment": PCA alignment + matching engine
- If "ghi": Governance Health Index
- If "calibration": Calibration values audit only

## Phase 1: Methodology Review

### 1.1 Pillar Architecture

Read the scoring model files and evaluate:

- `lib/scoring/drepScore.ts` — composite calculation, momentum
- `lib/scoring/engagementQuality.ts` — 3-layer pillar (provision, quality, deliberation)
- `lib/scoring/effectiveParticipation.ts` — importance weighting, treasury scaling
- `lib/scoring/reliability.ts` — 5-component temporal model
- `lib/scoring/governanceIdentity.ts` — profile quality + community presence
- `lib/scoring/spoScore.ts` — SPO parallel model
- `lib/scoring/calibration.ts` — ALL threshold values

For each pillar, answer:

- Does the weighting (35/25/25/15) still make sense given current governance patterns?
- Are there new governance behaviors (post-Chang era) not captured by the model?
- Are there perverse incentives? (e.g., does the dissent sweet spot encourage strategic dissent?)

### 1.2 Percentile Normalization Assessment

- Read `lib/scoring/percentile.ts` and `lib/scoring/confidence.ts`
- Query actual score distributions from production
- Check: are scores actually spread across 0-100 or clustering?
- Check: does the confidence system (SPO) appropriately cap low-data entities?
- Check: should DReps have a confidence system too?

### 1.3 Alignment & PCA Review

- Read `lib/alignment/pca.ts`, `lib/alignment/voteMatrix.ts`, `lib/alignment/pcaProjection.ts`
- Check: what % of total variance do the first 6 components explain?
- Check: are the dimension labels stable across epochs or do they rotate?
- Check: does the hybrid alignment (manual + PCA) produce intuitive results?

### 1.4 Matching Engine Review

- Read `lib/matching/confidence.ts`, `lib/matching/userProfile.ts`
- Check: do confidence weights reflect actual signal quality?
- Check: are matched DReps actually good recommendations? (compare against manual evaluation)

### 1.5 GHI Review

- Read `lib/ghi/index.ts`, `lib/ghi/components.ts`, `lib/ghi/calibration.ts`
- Check: do calibration curves produce intuitive GHI values?
- Check: does GHI track actual governance health? (correlate with community sentiment)

## Phase 2: Empirical Validation

### 2.1 Score Distribution Analysis (via Supabase MCP)

```sql
-- DRep score distribution with pillar breakdown
SELECT
  d.id,
  d.hex_score,
  d.engagement_quality_raw,
  d.effective_participation_raw,
  d.reliability_raw,
  d.governance_identity_raw,
  d.score_tier,
  (SELECT COUNT(*) FROM drep_votes v WHERE v.drep_id = d.id) as vote_count
FROM dreps d
WHERE d.hex_score IS NOT NULL
ORDER BY d.hex_score DESC;

-- Pillar correlation check (should NOT be perfectly correlated)
-- If engagement and participation are r>0.9, they're measuring the same thing
```

### 2.2 Gaming Scenario Analysis

Test these scenarios against the model mentally or via calculation:

1. **Rubber-stamper**: Votes Yes on everything, no rationales. Expected: low Engagement Quality, decent Participation → mid-range score.
2. **Strategic dissenter**: Votes No on exactly 20% of proposals (hits dissent sweet spot), provides generic rationales. Expected: should NOT score significantly higher than genuine voter.
3. **Inactive DRep with great profile**: Rich governance statement, many social links, registered 20 epochs ago, 2 votes total. Expected: low score despite high Identity pillar.
4. **High-frequency voter, no rationales**: Votes on every proposal within 24h, zero rationales. Expected: high Participation + Reliability, low Engagement Quality.
5. **Ghost DRep**: Registered, never voted. Expected: 0 or near-0 score.

### 2.3 Temporal Behavior

```sql
-- Score trajectory analysis: are scores trending up/down/stable?
SELECT
  drep_id,
  MIN(composite_score) as min_score,
  MAX(composite_score) as max_score,
  MAX(composite_score) - MIN(composite_score) as range,
  COUNT(*) as snapshot_count
FROM drep_score_snapshots
WHERE snapshot_date > CURRENT_DATE - 30
GROUP BY drep_id
HAVING COUNT(*) >= 5
ORDER BY range DESC LIMIT 20;

-- Momentum distribution: what % of DReps have positive vs negative momentum?
```

### 2.4 Calibration Value Audit

Read `lib/scoring/calibration.ts` and for each threshold:

- Is the value documented with rationale?
- Has it been validated against actual Cardano voting data?
- When was it last reviewed?
- Key values to scrutinize:
  - `ENGAGEMENT_LAYER_WEIGHTS` (40/40/20): Is rationale quality really worth 40%?
  - `VOTE_DIVERSITY_THRESHOLDS` (75/90/95): Are these validated against real distributions?
  - `DISSENT_SWEET_SPOT` (15-40%): Is this range empirically justified?
  - `TEMPORAL_DECAY_HALFLIFE` (180 days): Is 6 months the right window?
  - `RELIABILITY_WEIGHTS`: 30/25/20/15/10 breakdown — does this reflect actual importance?
  - `TREASURY_SCALING_CAP` (2.4x): Why this cap specifically?

## Phase 3: State of the Art Assessment

Research (via WebSearch if full audit) whether:

- Any governance scoring system (Tally, Snapshot, SubSquare) has published a peer-reviewed methodology
- Academic governance measurement frameworks exist that we should reference
- Any new on-chain data sources could improve scoring (e.g., metadata updates, governance script interactions)
- The Cardano community has published criticism or feedback on DRep scoring approaches

## Phase 4: Scoring (5 dimensions, 10 pts each = 50 total)

### M1: Differentiation Quality (10 pts)

| Score | Anchor                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------- |
| 1-3   | Scores cluster, poor separation between active and inactive DReps                                 |
| 4-6   | Some differentiation, but gaming scenarios produce high scores                                    |
| 7-8   | Clear separation, gaming scenarios score appropriately low, tier boundaries meaningful            |
| 9-10  | Scores predict governance outcomes, validated against community perception, published methodology |

### M2: Calibration Rigor (10 pts)

| Score | Anchor                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| 1-3   | Magic numbers with no documentation, never validated                                                         |
| 4-6   | Centralized config, some documentation, not validated against data                                           |
| 7-8   | All values in calibration.ts with rationale, validated against 1+ epoch of real data, review cadence defined |
| 9-10  | Every value validated against Cardano voting data, sensitivity analysis published, A/B tested alternatives   |

### M3: Gaming Resistance (10 pts)

| Score | Anchor                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------- |
| 1-3   | Simple strategies (vote everything, copy top rationales) produce high scores                      |
| 4-6   | Basic gaming mitigated (rubber-stamp penalty), but sophisticated strategies work                  |
| 7-8   | Multi-pillar model prevents single-strategy gaming, adversarial tests documented                  |
| 9-10  | Red-team tested, gaming strategies enumerated and mitigated, community bounty for gaming exploits |

### M4: Alignment & Matching Quality (10 pts)

| Score | Anchor                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------- |
| 1-3   | PCA components don't separate meaningful voting blocs                                               |
| 4-6   | Components explain >60% variance, dimension labels mostly stable                                    |
| 7-8   | Clear voting bloc separation, confidence-weighted matching, progressive profile updates             |
| 9-10  | Validated against manual expert matching, citizen satisfaction measured, delegation follows matches |

### M5: Methodology Transparency (10 pts)

| Score | Anchor                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------- |
| 1-3   | Scoring methodology is opaque, no public documentation                                             |
| 4-6   | Basic methodology page exists, calibration values not public                                       |
| 7-8   | Full methodology published, ADRs for decisions, calibration rationale documented                   |
| 9-10  | Peer-reviewed methodology, open-source scoring engine, community governance of calibration changes |

## Phase 5: Work Plan

For each gap, propose improvements following `docs/strategy/context/work-plan-template.md`.
Categorize: methodology (model change), calibration (threshold tuning), validation (testing), transparency (documentation).

**Key decision prompts for the user:**

- Should calibration values be adjusted based on findings? (requires careful rollout)
- Should a DRep confidence system be added (paralleling SPO confidence)?
- Should engagement signals feed directly into scores, or remain separate?
- Should scoring methodology be published for community review?

## Recommended Cadence

- **Per epoch**: Automated distribution check (could be an Inngest function)
- **Monthly**: Quick `/audit-scoring calibration` — check if thresholds need tuning
- **Quarterly**: Full `/audit-scoring` with gaming analysis and methodology review
- **Annually**: Community review of published methodology + calibration values
