---
paths:
  - 'lib/scoring/**'
  - 'lib/ghi/**'
  - 'lib/alignment/**'
---

# Scoring & Analytics Engine Rules

- DRep Score V3: Engagement Quality 35%, Effective Participation 25%, Reliability 25%, Governance Identity 15%
- SPO Score: Participation 45%, Consistency 30%, Reliability 25%
- All scores are percentile-normalized (0-100)
- Tiers: Emerging (0-39), Bronze (40-54), Silver (55-69), Gold (70-84), Diamond (85-94), Legendary (95-100)
- Voting power/influence is explicitly excluded from scoring
- GHI uses 6 components + Edinburgh Decentralization Index (7 mathematical metrics)
- Alignment uses PCA across 6 dimensions (Treasury, Decentralization, Security, Innovation, Transparency, +1)
- Size tiers: Small (<10k), Medium (10k-1M), Large (1M-10M), Whale (>10M ADA)
- ADR: `docs/adr/005-scoring-methodology.md`, `docs/adr/006-spo-scoring-methodology.md`
