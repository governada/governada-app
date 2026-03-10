Deep-dive audit of Governada's backend engine — scoring models, data integrity, sync pipeline, calibration quality, and end-to-end delivery from chain data to user-facing intelligence.

## Scope

Argument: `$ARGUMENTS`

- If empty: Ask the user which area to focus on. List these options and WAIT for input before proceeding:
  - `full` — Complete engine audit across all 6 dimensions
  - `scoring` — DRep Score V3, SPO Score V3, GHI, PCA alignment, matching engine
  - `data` — Data integrity, completeness, consistency, freshness
  - `sync` — Sync pipeline health, self-healing, performance
  - `calibration` — Deep dive on all calibration values in calibration.ts
  - `e2e` — End-to-end trace from chain data to UI component
- If `full`: Execute all phases below
- If `scoring`: Phase 1 (scoring files only) + Phase 3 (gaming) + Phase 5 (calibration) + scoring for N1, N4, N5
- If `data`: Phase 1 (data files only) + Phase 2 (empirical validation) + scoring for N2, N6
- If `sync`: Phase 1 (sync files only) + Phase 2 (sync queries) + scoring for N3, N6
- If `calibration`: Phase 1 (calibration.ts only) + Phase 5 (full calibration audit) + scoring for N4
- If `e2e`: Phase 1 (all files) + Phase 4 (end-to-end trace) + scoring for N6

---

## Phase 1: Architecture Review

Read these files and build a mental model of the engine. Do NOT summarize what each file does — instead evaluate architecture quality, failure modes, and data flow correctness.

**Scoring:**

- `lib/scoring/drepScore.ts` — composite calculation, momentum
- `lib/scoring/engagementQuality.ts` — 3-layer pillar (provision, quality, deliberation)
- `lib/scoring/effectiveParticipation.ts` — importance weighting, treasury scaling
- `lib/scoring/reliability.ts` — 5-component temporal model
- `lib/scoring/governanceIdentity.ts` — profile quality + community presence
- `lib/scoring/spoScore.ts` — SPO parallel model
- `lib/scoring/calibration.ts` — ALL threshold values
- `lib/scoring/percentile.ts`, `lib/scoring/confidence.ts`

**Alignment & Matching:**

- `lib/alignment/pca.ts`, `lib/alignment/voteMatrix.ts`, `lib/alignment/pcaProjection.ts`
- `lib/matching/confidence.ts`, `lib/matching/userProfile.ts`

**GHI:**

- `lib/ghi/index.ts`, `lib/ghi/components.ts`, `lib/ghi/calibration.ts`

**Data & Sync:**

- `lib/data.ts` — all data reads
- `lib/sync/` — sync orchestration
- `inngest/functions/` — scheduled sync functions
- `utils/koios.ts` — Koios API helpers

For each subsystem, answer:

1. Is the architecture clean and maintainable?
2. Are there single points of failure?
3. Does the data flow make sense (chain -> Koios -> Supabase -> lib/data.ts -> components)?

---

## Phase 2: Empirical Validation (via Supabase MCP)

Run these SQL queries using `execute_sql` to collect evidence. Do NOT skip this phase — assertions without data are speculation.

```sql
-- Score distribution: are scores meaningfully spread?
SELECT
  score_tier,
  COUNT(*) as count,
  ROUND(AVG(hex_score)::numeric, 2) as avg_score,
  ROUND(MIN(hex_score)::numeric, 2) as min_score,
  ROUND(MAX(hex_score)::numeric, 2) as max_score
FROM dreps
WHERE hex_score IS NOT NULL
GROUP BY score_tier
ORDER BY avg_score DESC;

-- Ghost syncs: tables that sync but produce no useful data
SELECT
  table_name,
  MAX(synced_at) as last_sync,
  COUNT(*) as row_count
FROM sync_log
GROUP BY table_name
ORDER BY last_sync DESC;

-- Data freshness: is anything stale?
SELECT * FROM data_freshness_checks
ORDER BY last_checked DESC;

-- Orphaned records: foreign key integrity
SELECT COUNT(*) as orphaned_votes
FROM drep_votes v
LEFT JOIN dreps d ON v.drep_id = d.id
WHERE d.id IS NULL;

-- Score pillar correlation: should NOT be perfectly correlated
-- If engagement and participation are r>0.9, they're measuring the same thing
SELECT
  ROUND(CORR(engagement_quality_raw, effective_participation_raw)::numeric, 3) as eq_ep_corr,
  ROUND(CORR(engagement_quality_raw, reliability_raw)::numeric, 3) as eq_rel_corr,
  ROUND(CORR(effective_participation_raw, reliability_raw)::numeric, 3) as ep_rel_corr
FROM dreps
WHERE hex_score IS NOT NULL;
```

Also run these if scope includes `data` or `full`:

```sql
-- Snapshot coverage gaps (should have entry for every active DRep every day)
SELECT d.id, MAX(s.snapshot_date) as last_snapshot,
  CURRENT_DATE - MAX(s.snapshot_date) as days_stale
FROM dreps d
LEFT JOIN drep_score_snapshots s ON d.id = s.drep_id
WHERE d.status = 'active'
GROUP BY d.id
HAVING MAX(s.snapshot_date) < CURRENT_DATE - 1
ORDER BY days_stale DESC LIMIT 20;

-- DReps with scores but no votes (should not exist)
SELECT d.id, d.hex_score FROM dreps d
LEFT JOIN drep_votes v ON d.id = v.drep_id
WHERE v.drep_id IS NULL AND d.hex_score IS NOT NULL AND d.hex_score > 0;

-- Orphan votes referencing non-existent proposals
SELECT COUNT(*) FROM drep_votes v
LEFT JOIN proposals p ON v.proposal_tx_hash = p.tx_hash AND v.proposal_index = p.index
WHERE p.tx_hash IS NULL;
```

Also run these if scope includes `sync` or `full`:

```sql
-- Sync health: last run, success rate, duration trends
SELECT
  sync_type,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE success = true) as successes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / COUNT(*), 1) as success_rate,
  MAX(finished_at) as last_finish,
  ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)))::numeric, 1) as avg_duration_s,
  ROUND(MAX(EXTRACT(EPOCH FROM (finished_at - started_at)))::numeric, 1) as max_duration_s
FROM sync_log
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY sync_type
ORDER BY last_finish DESC;

-- Ghost sync entries (started but never finished)
SELECT * FROM sync_log
WHERE finished_at IS NULL AND started_at < NOW() - INTERVAL '30 minutes'
ORDER BY started_at DESC LIMIT 10;

-- Recent failures with error messages
SELECT sync_type, started_at, error_message
FROM sync_log
WHERE success = false AND started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC LIMIT 20;
```

---

## Phase 3: Gaming Scenario Analysis

Test 5 scenarios against the scoring model. Trace through actual code in `lib/scoring/` for each — do NOT hand-wave.

1. **Rubber-stamper**: Votes Yes on everything, no rationales. Expected: low Engagement Quality, decent Participation -> mid-range score.
2. **Strategic dissenter**: Votes No on exactly 20% of proposals, generic rationales. Expected: should NOT score significantly higher than a genuine voter.
3. **Inactive DRep with great profile**: Rich governance statement, social links, registered 20 epochs ago, 2 votes total. Expected: low score despite high Identity pillar.
4. **High-frequency voter, no rationales**: Votes every proposal within 24h, zero rationales. Expected: high Participation + Reliability, low Engagement Quality.
5. **Ghost DRep**: Registered, never voted. Expected: 0 or near-0 score.

For each scenario:

- Trace through `drepScore.ts` and each pillar function
- Determine the approximate score they would receive
- Flag if the result is counterintuitive or gameable
- If a scenario reveals a gaming vector, classify severity: HIGH (score inflatable by >15 pts), MEDIUM (5-15 pts), LOW (<5 pts)

---

## Phase 4: End-to-End Trace

Build a trace table showing how each engine capability flows from chain data to user-facing UI. This is the audit's unique contribution — it reveals broken links in the chain that no single-subsystem audit would catch.

| Capability              | Computation                           | Storage                      | Sync Schedule            | API Route       | UI Component     |
| ----------------------- | ------------------------------------- | ---------------------------- | ------------------------ | --------------- | ---------------- |
| DRep Score V3           | lib/scoring/drepScore.ts              | dreps.hex_score              | [Inngest fn name + cron] | [route.ts path] | [component path] |
| Engagement Quality      | lib/scoring/engagementQuality.ts      | dreps.engagement_quality_raw | [schedule]               | [route]         | [component]      |
| Effective Participation | lib/scoring/effectiveParticipation.ts | [column]                     | [schedule]               | [route]         | [component]      |
| Reliability             | lib/scoring/reliability.ts            | [column]                     | [schedule]               | [route]         | [component]      |
| Governance Identity     | lib/scoring/governanceIdentity.ts     | [column]                     | [schedule]               | [route]         | [component]      |
| PCA Alignment           | lib/alignment/pca.ts                  | [table]                      | [schedule]               | [route]         | [component]      |
| Matching                | lib/matching/                         | [table]                      | [schedule]               | [route]         | [component]      |
| GHI                     | lib/ghi/                              | [table]                      | [schedule]               | [route]         | [component]      |
| SPO Score               | lib/scoring/spoScore.ts               | [table]                      | [schedule]               | [route]         | [component]      |

Fill in every cell with actual file paths, table/column names, Inngest function names, API route paths, and React component paths. For any cell you cannot fill, flag it as a **broken link** — a capability that is computed but not delivered, or delivered but not computed.

---

## Phase 5: Calibration Audit

Read `lib/scoring/calibration.ts` in full. For EVERY exported threshold value, evaluate:

1. Is it documented with rationale in the code?
2. Has it been validated against actual Cardano voting data?
3. What happens if this value is wrong by 2x? (sensitivity)

Key values to scrutinize with extra rigor:

- **`ENGAGEMENT_LAYER_WEIGHTS`**: Is rationale quality worth this weight relative to provision and deliberation?
- **`VOTE_DIVERSITY_THRESHOLDS`**: Validated against real vote distribution data?
- **`DISSENT_SWEET_SPOT`**: Is this range empirically justified or theoretical?
- **`TEMPORAL_DECAY_HALFLIFE`**: Is this the right window for Cardano's governance cadence?
- **`RELIABILITY_WEIGHTS`**: Does the 5-component breakdown reflect actual importance to governance quality?
- **`TREASURY_SCALING_CAP`**: Why this specific cap? What would break if it were 1.5x or 3x?

Classify each value as: VALIDATED (evidence exists), REASONED (logical justification but no data), or MAGIC (no documentation or justification).

---

## Phase 6: Scoring (6 dimensions, 10 pts each = 60 total)

Follow ALL rules from `.claude/rules/audit-integrity.md`. Every score must have evidence. Every finding must have a specific code path, concrete user impact, and reproduction method. List what is already strong before listing gaps.

### N1: Scoring Methodology (10 pts)

| Score | Anchor                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------- |
| 1-3   | Scores cluster, poor separation between active/inactive, gaming vectors obvious                     |
| 4-6   | Some differentiation, but gaming scenarios produce inappropriately high scores                      |
| 7-8   | Clear separation, gaming scenarios score low, tier boundaries meaningful, multi-pillar model robust |
| 9-10  | Scores predict governance outcomes, validated methodology, community-reviewed                       |

### N2: Data Integrity (10 pts)

| Score | Anchor                                                                               |
| ----- | ------------------------------------------------------------------------------------ |
| 1-3   | Orphaned records, missing foreign keys, stale data served to users                   |
| 4-6   | Basic integrity maintained but gaps in coverage, some staleness                      |
| 7-8   | Comprehensive coverage, freshness checks in place, no orphans, consistency validated |
| 9-10  | Zero-loss pipeline, automated integrity monitoring, self-healing on data gaps        |

### N3: Pipeline Reliability (10 pts)

| Score | Anchor                                                                                  |
| ----- | --------------------------------------------------------------------------------------- |
| 1-3   | Sync failures go unnoticed, no retry logic, manual intervention required                |
| 4-6   | Basic retry logic, some monitoring, occasional silent failures                          |
| 7-8   | Robust retry with backoff, self-healing, comprehensive logging, alert on failure        |
| 9-10  | Zero-downtime pipeline, graceful degradation, automated recovery, SLA-grade reliability |

### N4: Calibration Quality (10 pts)

| Score | Anchor                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------ |
| 1-3   | Magic numbers with no documentation, never validated                                             |
| 4-6   | Centralized config, some documentation, not validated against data                               |
| 7-8   | All values in calibration.ts with rationale, validated against real data, review cadence defined |
| 9-10  | Every value validated, sensitivity analysis done, A/B tested alternatives                        |

### N5: Score Communication (10 pts)

| Score | Anchor                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------- |
| 1-3   | Raw numbers shown without context — users cannot interpret what scores mean                              |
| 4-6   | Basic score display with some context, but pillar breakdown confusing or missing                         |
| 7-8   | Clear score presentation, pillar breakdown intuitive, methodology explainable to non-technical user      |
| 9-10  | Scores tell a story — users understand WHY a DRep scored this way and what it means for their delegation |

### N6: End-to-End Delivery (10 pts)

| Score | Anchor                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 1-3   | Broken links in the chain — engine computes but UI does not surface, or sync does not feed scoring        |
| 4-6   | Chain works but with gaps — some capabilities computed but not exposed to all relevant personas           |
| 7-8   | Complete chain for all major capabilities, minor gaps in secondary features                               |
| 9-10  | Every engine capability flows seamlessly from chain data to persona-appropriate UI with correct freshness |

### Output Format

Present scores in a summary table:

| Dimension                | Score    | Key Strength | Key Gap |
| ------------------------ | -------- | ------------ | ------- |
| N1: Scoring Methodology  | X/10     | ...          | ...     |
| N2: Data Integrity       | X/10     | ...          | ...     |
| N3: Pipeline Reliability | X/10     | ...          | ...     |
| N4: Calibration Quality  | X/10     | ...          | ...     |
| N5: Score Communication  | X/10     | ...          | ...     |
| N6: End-to-End Delivery  | X/10     | ...          | ...     |
| **Total**                | **X/60** |              |         |

For any dimension scored 8+/10: state "This is strong because [specific reason]" and answer "What would it take to make this a 10?" If the answer is "nothing meaningful," say so.

---

## Phase 7: Work Plan

Read `docs/strategy/context/work-plan-template.md`. Convert all findings into executable chunks using that format.

Categorize each chunk as one of:

- **methodology** — scoring model change (pillar weights, formulas, new signals)
- **calibration** — threshold tuning in calibration.ts
- **data** — integrity fix (orphans, gaps, consistency)
- **pipeline** — sync improvement (reliability, performance, self-healing)
- **communication** — score UX (how scores are presented to users)

Order chunks by priority (P0 first), then by dependency chain. Flag any chunks that require a product decision before execution.

End with: **"Which chunks should I start?"** and wait for user input.

---

## Rules

- Use Supabase MCP `execute_sql` for all database queries — do NOT skip empirical validation
- Trace through actual code for gaming scenarios — do NOT hand-wave
- The end-to-end trace table (Phase 4) is mandatory — it is the audit's unique contribution over the old separate commands
- Follow all rules from `.claude/rules/audit-integrity.md` (evidence requirement, cost-benefit gate, "already good" requirement, score calibration, anti-patterns)
- Be brutally honest about calibration — undocumented magic numbers are a finding, not a feature
- Compare against competitors in `docs/strategy/context/competitive-landscape.md`, not against an imaginary ideal
