---
paths:
  - '**'
---

# Deploy Configuration

**Current deploy target: production**

Modes:

- `production` — PRs merge to main automatically. Railway auto-deploys. Full autonomous pipeline.
- `staging` — PRs created and CI verified, but NOT merged. User reviews and approves merge manually.

To switch after public launch: change "production" above to "staging".
