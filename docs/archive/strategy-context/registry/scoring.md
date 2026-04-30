# Scoring & Reputation — Domain Registry

## Architecture

Three independent scoring models + one composite health index, all deterministic (no AI in scores). AI used only for rationale quality assessment which feeds into Engagement Quality.

```
Koios chain data → sync pipeline → Supabase tables → scoring engine → percentile normalization → snapshots
```

## DRep Score V3 (4 pillars)

| Pillar                       | Weight | Key File                                | What It Measures                                             |
| ---------------------------- | ------ | --------------------------------------- | ------------------------------------------------------------ |
| Engagement Quality (EQ)      | 35%    | `lib/scoring/engagementQuality.ts`      | Rationale depth, AI quality score, vote explanation rate     |
| Effective Participation (EP) | 25%    | `lib/scoring/effectiveParticipation.ts` | Vote coverage, timeliness, governance action breadth         |
| Reliability (R)              | 25%    | `lib/scoring/reliability.ts`            | Consistency, uptime, delegation stability                    |
| Governance Identity (GI)     | 15%    | `lib/scoring/governanceIdentity.ts`     | Profile completeness, metadata anchoring, CIP-100 compliance |

**Composition:** `lib/scoring/drepScore.ts` — weighted sum, percentile-normalized via `lib/scoring/percentile.ts`
**Momentum:** Inline in `drepScore.ts` — 5-epoch rolling window
**Tiers:** 5 tiers based on percentile thresholds (also in `drepScore.ts`)
**Snapshots:** `drep_score_history` table, daily via `sync-drep-scores` Inngest

## SPO Governance Score (4 pillars)

| Pillar              | Key File                                     |
| ------------------- | -------------------------------------------- |
| SPO Deliberation    | `lib/scoring/spoDeliberation.ts`             |
| Engagement Quality  | `lib/scoring/engagementQuality.ts` (shared)  |
| Reliability         | `lib/scoring/reliability.ts` (shared)        |
| Governance Identity | `lib/scoring/governanceIdentity.ts` (shared) |

**Composition:** `lib/scoring/spoScore.ts` | **Snapshots:** `spo_score_snapshots` table

## CC Transparency Index

Single transparency score for CC members. **File:** `lib/scoring/ccTransparency.ts`

## GHI (Governance Health Index)

Ecosystem-level health composite (NOT per-entity): 6 components + 7 EDI metrics.
**Files:** `lib/ghi/ghiComposite.ts`, `lib/ghi/ediMetrics.ts`
**Snapshots:** `ghi_snapshots` table, `snapshot-ghi` Inngest

## Supporting Infrastructure

| Component          | File                                             |
| ------------------ | ------------------------------------------------ |
| Percentile engine  | `lib/scoring/percentile.ts`                      |
| Gaming detection   | `lib/scoring/gamingDetection.ts`                 |
| AI quality scoring | `score-ai-quality`, `compute-ai-quality` Inngest |
| Semantic diversity | `lib/scoring/semanticDiversity.ts`               |

## Connections

- **Matching:** Scores on match results, tier badges on discovery cards
- **Engagement:** Signals feed EQ pillar
- **Hub:** Score tier in civic identity card
- **Profiles:** Score breakdown on every entity profile
- **Sync:** Score computation triggered after each sync cycle
