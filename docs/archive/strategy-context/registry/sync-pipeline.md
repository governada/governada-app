# Sync & Data Pipeline — Domain Registry

## Architecture

Inngest self-hosted on Railway. 55+ functions. Event-driven + scheduled.

```
Koios API → sync functions → Supabase tables → score computation → snapshots → AI generation
```

**Inngest server:** `inngest-server.railway.internal:8288`
**Registration:** `app/api/inngest/route.ts` — ALL functions must be registered here
**Client:** `lib/inngest.ts`
**Helpers:** `inngest/helpers.ts`

## Function Categories

### Core Sync (every 5-15 min)

| Function                 | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `sync-dreps`             | DRep metadata, delegation counts, voting power |
| `sync-proposals`         | Governance actions from chain                  |
| `sync-votes`             | DRep votes                                     |
| `sync-spo-cc-votes`      | SPO and CC votes                               |
| `sync-secondary`         | Secondary data (pools, stake distribution)     |
| `sync-slow`              | Slow-changing data (parameters, epoch info)    |
| `sync-catalyst`          | Catalyst/treasury data                         |
| `sync-treasury-snapshot` | Treasury balance snapshots                     |

### Score Computation (after sync)

| Function             | Purpose                         |
| -------------------- | ------------------------------- |
| `sync-drep-scores`   | Recompute all DRep scores       |
| `sync-spo-scores`    | Recompute all SPO scores        |
| `sync-alignment`     | Recompute PCA alignment vectors |
| `score-proposers`    | Proposer track record scoring   |
| `score-ai-quality`   | Rationale quality assessment    |
| `compute-ai-quality` | Batch AI quality computation    |

### Snapshots (per epoch)

| Function                      | Purpose                       |
| ----------------------------- | ----------------------------- |
| `snapshot-ghi`                | GHI point-in-time snapshot    |
| `snapshot-citizen-rings`      | Civic identity ring snapshots |
| `check-snapshot-completeness` | Verify all snapshots captured |

### AI Generation (event-driven)

| Function                       | Purpose                                   |
| ------------------------------ | ----------------------------------------- |
| `generate-proposal-briefs`     | AI summaries for new proposals            |
| `generate-governance-brief`    | Periodic governance briefing              |
| `generate-epoch-summary`       | End-of-epoch AI recap                     |
| `generate-cc-briefing`         | CC transparency briefing                  |
| `generate-citizen-briefings`   | Personalized citizen briefings            |
| `generate-state-of-governance` | Comprehensive governance report           |
| `generate-drep-epoch-updates`  | Per-DRep epoch change summaries           |
| `generate-weekly-digest`       | Email digest generation                   |
| `generate-governance-wrapped`  | Year/epoch-in-review for entities         |
| `generateAiContent`            | Generic AI content generation             |
| `generate-citizen-assembly`    | AI-generated citizen assembly discussions |

### Intelligence (scheduled)

| Function                           | Purpose                          |
| ---------------------------------- | -------------------------------- |
| `precompute-proposal-intelligence` | Proposal analysis cache          |
| `precompute-engagement-signals`    | Engagement signal aggregation    |
| `precompute-citizen-summaries`     | Citizen governance summaries     |
| `compute-community-intelligence`   | Community sentiment analysis     |
| `compute-cc-relations`             | CC voting bloc detection         |
| `cluster-perspectives`             | Perspective diversity clustering |
| `extract-matching-topics`          | Topic extraction for matching    |
| `consolidate-feedback`             | Feedback theme consolidation     |
| `detect-alignment-drift`           | Alignment change detection       |
| `detect-gaming-signals`            | Anti-gaming monitoring           |
| `track-proposal-outcomes`          | Proposal outcome tracking        |
| `update-passage-predictions`       | Passage probability predictions  |
| `analyze-cc-rationales`            | CC rationale analysis            |
| `sync-data-moat`                   | Data moat metric tracking        |
| `sync-governance-benchmarks`       | Cross-ecosystem benchmarks       |

### Embeddings

| Function                  | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| `generate-embeddings`     | Semantic embeddings for proposals/entities |
| `generate-user-embedding` | Per-user governance fingerprint            |

### Integrity & Alerting

| Function                     | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `reconcile-data`             | Blockfrost cross-reference verification |
| `sync-freshness-guard`       | Detect stale sync data                  |
| `alert-api-health`           | API response time monitoring            |
| `alert-inbox`                | Notification delivery monitoring        |
| `alert-integrity`            | Data integrity alerts                   |
| `check-accountability-polls` | Accountability poll expiration          |
| `check-notifications`        | Notification pipeline health            |
| `notify-engagement-outcomes` | Engagement result notifications         |
| `notify-epoch-recap`         | Epoch recap notifications               |

### Other

| Function                   | Purpose                 |
| -------------------------- | ----------------------- |
| `cleanup-revoked-sessions` | Session cleanup         |
| `backfill-ghi`             | Historical GHI backfill |

## Key Data Layer Files

| File                  | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `lib/data.ts`         | Master database-first read layer (ALL reads go through here) |
| `lib/supabase.ts`     | Supabase client                                              |
| `utils/koios.ts`      | Koios API helpers (sync only, never from pages)              |
| `lib/sync/`           | Sync utilities and helpers                                   |
| `lib/sync-utils.ts`   | Shared sync utilities                                        |
| `lib/reconciliation/` | Data reconciliation engine                                   |
| `lib/redis.ts`        | Upstash Redis caching                                        |

## Connections

- **Scoring:** Score computation functions run after each sync
- **AI:** AI generation functions produce briefs, summaries, wrapped content
- **Hub:** Freshness guard ensures Hub data is current
- **Engagement:** Engagement signal precomputation runs on schedule
- **Integrity:** Reconciliation engine cross-references with Blockfrost
