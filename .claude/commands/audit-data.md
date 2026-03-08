Audit data integrity, completeness, and quality across the entire system.

## Purpose

Verify that the data in Supabase is accurate, complete, and consistent. The intelligence engine is only as good as the data underneath it. Stale snapshots, orphan records, or inconsistent cross-table references silently degrade every surface.

## Scope

Argument: `$ARGUMENTS`

- If empty: Full data integrity audit
- If a domain (e.g., "scores", "alignment", "treasury", "engagement", "snapshots"): Focused audit

## Phase 1: Completeness Checks

### 1.1 Snapshot Coverage

Query production database (via Supabase MCP `execute_sql`):

```sql
-- Score snapshot gaps (should have entry for every DRep every day)
SELECT d.id, MAX(s.snapshot_date) as last_snapshot,
  CURRENT_DATE - MAX(s.snapshot_date) as days_stale
FROM dreps d
LEFT JOIN drep_score_snapshots s ON d.id = s.drep_id
WHERE d.status = 'active'
GROUP BY d.id
HAVING MAX(s.snapshot_date) < CURRENT_DATE - 1
ORDER BY days_stale DESC LIMIT 20;

-- Same for alignment_snapshots, spo_score_snapshots, ghi_snapshots, edi_snapshots, treasury_snapshots
```

For each snapshot table:

- How many entities are missing snapshots for the current epoch?
- What's the longest gap in the snapshot history?
- Are there any NaN/Infinity/null values in numeric columns?

### 1.2 Cross-Table Consistency

```sql
-- Orphan votes (votes referencing non-existent DReps)
SELECT COUNT(*) FROM drep_votes v
LEFT JOIN dreps d ON v.drep_id = d.id
WHERE d.id IS NULL;

-- Orphan votes (votes referencing non-existent proposals)
SELECT COUNT(*) FROM drep_votes v
LEFT JOIN proposals p ON v.proposal_tx_hash = p.tx_hash AND v.proposal_index = p.index
WHERE p.tx_hash IS NULL;

-- DReps with scores but no votes
SELECT d.id, d.hex_score FROM dreps d
LEFT JOIN drep_votes v ON d.id = v.drep_id
WHERE v.drep_id IS NULL AND d.hex_score IS NOT NULL AND d.hex_score > 0;

-- Proposals with votes but no classification
SELECT p.tx_hash, COUNT(v.*) as vote_count
FROM proposals p
JOIN drep_votes v ON p.tx_hash = v.proposal_tx_hash
LEFT JOIN proposal_classifications pc ON p.tx_hash = pc.tx_hash
WHERE pc.tx_hash IS NULL
GROUP BY p.tx_hash ORDER BY vote_count DESC LIMIT 20;
```

### 1.3 Engagement Data Quality

```sql
-- Sentiment votes without valid proposal references
SELECT COUNT(*) FROM citizen_sentiment cs
LEFT JOIN proposals p ON cs.proposal_tx_hash = p.tx_hash
WHERE p.tx_hash IS NULL;

-- Engagement signal freshness
SELECT
  'citizen_sentiment' as table_name, MAX(created_at) as latest, COUNT(*) as total
FROM citizen_sentiment
UNION ALL
SELECT 'citizen_concern_flags', MAX(created_at), COUNT(*) FROM citizen_concern_flags
UNION ALL
SELECT 'citizen_impact_tags', MAX(created_at), COUNT(*) FROM citizen_impact_tags
UNION ALL
SELECT 'citizen_priority_signals', MAX(created_at), COUNT(*) FROM citizen_priority_signals;

-- Credibility score distribution (should not be all zeros or all 100s)
SELECT
  CASE
    WHEN credibility_score < 20 THEN '0-20'
    WHEN credibility_score < 40 THEN '20-40'
    WHEN credibility_score < 60 THEN '40-60'
    WHEN credibility_score < 80 THEN '60-80'
    ELSE '80-100'
  END as bucket,
  COUNT(*) as count
FROM citizen_credibility
GROUP BY 1 ORDER BY 1;
```

### 1.4 Score Distribution Analysis

```sql
-- DRep score distribution (should spread 0-100, not cluster)
SELECT
  CASE
    WHEN hex_score < 10 THEN '0-10'
    WHEN hex_score < 20 THEN '10-20'
    WHEN hex_score < 30 THEN '20-30'
    WHEN hex_score < 40 THEN '30-40'
    WHEN hex_score < 50 THEN '40-50'
    WHEN hex_score < 60 THEN '50-60'
    WHEN hex_score < 70 THEN '60-70'
    WHEN hex_score < 80 THEN '70-80'
    WHEN hex_score < 90 THEN '80-90'
    ELSE '90-100'
  END as bucket,
  COUNT(*) as count
FROM dreps
WHERE hex_score IS NOT NULL
GROUP BY 1 ORDER BY 1;

-- SPO score distribution (same bucketing)
-- GHI trend (last 30 snapshots)
-- Alignment dimension distributions (should be roughly normal per PCA)
```

### 1.5 Metadata Integrity

- Hash verification: % of DReps where stored metadata hash matches recalculated hash
- Rationale anchor verification: % of rationales where stored hash matches content hash
- CIP-100 compliance: % of rationales with valid JSON-LD structure

## Phase 2: Consistency Validation

### 2.1 Temporal Consistency

- Are score snapshots monotonically timestamped (no gaps, no duplicates per entity per day)?
- Does GHI trend match aggregate DRep behavior? (GHI up when avg scores up)
- Do alignment trajectories show realistic drift rates? (not jumps >30% in one epoch)

### 2.2 Cross-Body Consistency

- Inter-body alignment records: do they cover all proposals with multi-body votes?
- Are CC votes linked to the same proposals as DRep/SPO votes?

### 2.3 User Data Consistency

- `user_governance_profiles`: are all fields populated for users who completed Quick Match?
- `citizen_milestones`: are milestones being awarded for qualifying actions?
- `citizen_briefings`: are briefings generated for all active users each epoch?

## Phase 3: Scoring (5 dimensions, 10 pts each = 50 total)

### D1: Snapshot Completeness (10 pts)

| Score | Anchor                                                                            |
| ----- | --------------------------------------------------------------------------------- |
| 1-3   | Major gaps in snapshot history, many entities missing                             |
| 4-6   | Most entities covered, some gaps, no NaN/Infinity checks                          |
| 7-8   | >95% entity coverage, <2 day gaps, validity checks in place                       |
| 9-10  | 100% coverage, zero gaps, automated validity checks, historical backfill verified |

### D2: Referential Integrity (10 pts)

| Score | Anchor                                                                          |
| ----- | ------------------------------------------------------------------------------- |
| 1-3   | >5% orphan records across tables                                                |
| 4-6   | <2% orphan records, some unlinked data                                          |
| 7-8   | <0.5% orphan records, cross-table references validated in integrity checks      |
| 9-10  | Zero orphan records, FK constraints or integrity checks cover all relationships |

### D3: Score Distribution Quality (10 pts)

| Score | Anchor                                                                                      |
| ----- | ------------------------------------------------------------------------------------------- |
| 1-3   | Scores cluster in narrow band, poor differentiation                                         |
| 4-6   | Reasonable spread but some clustering, a few zero-score anomalies                           |
| 7-8   | Full 0-100 spread, clear tier boundaries, distribution matches expected governance behavior |
| 9-10  | Distribution validated against governance outcomes, calibration documented with evidence    |

### D4: Engagement Data Quality (10 pts)

| Score | Anchor                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------- |
| 1-3   | Engagement tables empty or stale, no credibility scoring                                           |
| 4-6   | Some engagement data flowing, basic anti-spam, credibility distribution skewed                     |
| 7-8   | All 6 mechanisms collecting data, credibility scores normally distributed, quorum thresholds met   |
| 9-10  | Engagement data demonstrably improving intelligence surfaces, citizen participation rates measured |

### D5: Metadata Integrity (10 pts)

| Score | Anchor                                                                                  |
| ----- | --------------------------------------------------------------------------------------- |
| 1-3   | No hash verification, metadata frequently stale                                         |
| 4-6   | Basic hash verification, <10% mismatch rate                                             |
| 7-8   | <2% hash mismatch, CIP-100 compliance verified, rationale anchors validated             |
| 9-10  | Zero hash mismatches, automated re-verification on change detection, provenance tracked |

## Phase 3: Work Plan

Output findings as actionable chunks per `docs/strategy/context/work-plan-template.md`.
Classify each issue: correctness (wrong data), completeness (missing data), consistency (conflicting data), freshness (stale data).

## Recommended Cadence

- **Daily**: `check-snapshot-completeness` Inngest function (already exists, verify it's running)
- **Weekly**: Quick `/audit-data snapshots` to verify snapshot coverage
- **Monthly**: `/audit-data` full to check cross-table consistency and distributions
- **Per epoch boundary**: Verify briefings generated and milestones awarded
