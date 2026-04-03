---
paths:
  - 'scripts/**'
  - '.claude/skills/ship/**'
  - '.claude/commands/ship*'
  - '.claude/commands/hotfix*'
---

# Deploy Configuration

**Current deploy target: production**

Modes:

- `production` — PRs merge to main automatically. Railway auto-deploys. Full autonomous pipeline.
- `staging` — PRs created and CI verified, but NOT merged. User reviews and approves merge manually.

To switch to staging mode for post-launch: change "production" above to "staging".

## Post-Launch Checklist (switch to staging when ready)

When the app officially launches, switch the deploy target to `staging` and:

1. All PRs require human review before merge
2. Preview environments smoke-test before merge (`.github/workflows/preview.yml`)
3. Post-deploy verification runs automatically (`.github/workflows/post-deploy.yml`)
4. High-risk changes use `/ship-careful` (flag-gated canary rollout)

## Rollback Procedure

If production breaks after a deploy:

1. Run `npm run rollback` — auto-detects broken state, reverts, verifies health
2. With git revert: `npm run rollback -- --revert-commit`
3. Manual: Railway dashboard → Deployments → Redeploy previous

## Error Rate Gate

Pre-merge check now includes Sentry error rate validation (`npm run check:error-rate`).
If production error rate exceeds 200 errors/hour, merges are blocked until the rate stabilizes.
