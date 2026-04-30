---
paths:
  - 'scripts/**'
  - '.agents/skills/ship/**'
  - '.claude/skills/ship/**'
  - '.claude/commands/ship*'
  - '.claude/commands/hotfix*'
---

# Deploy Configuration

**Current deploy target: production, protected by chat-approved merge**

Current mode:

- Agents may autonomously prepare branches, PRs, checks, and deploy verification evidence.
- PRs do not merge unattended. Tim approves the exact `github.merge` action in chat with PR number and expected head SHA.
- Railway auto-deploys after the protected main merge.
- `npm run github:merge` performs the merge and synchronous production deploy verification.

Future staging/preview mode should add pre-merge preview verification without weakening the Phase 0B merge approval gate.

## Future Staging/Preview Checklist

When the app officially launches or the agent roadmap reaches preview-environment maturity:

1. Preview environments smoke-test before merge (`.github/workflows/preview.yml`).
2. Post-deploy verification remains automatic (`.github/workflows/post-deploy.yml`).
3. High-risk changes use `/ship-careful` for flag-gated canary planning.
4. Branch protection/rulesets encode required checks instead of relying on convention.

## Rollback Procedure

If production breaks after a deploy:

1. Treat it as a human-present incident.
2. Run `npm run rollback -- --dry-run` for diagnosis.
3. Run `npm run rollback -- --revert-commit` only to prepare a revert PR through the protected-main flow.
4. Immediate Railway rollback to a previous successful deployment is a deploy mutation and requires Tim's explicit approval/action.

## Error Rate Gate

Pre-merge check includes Sentry error rate validation (`npm run check:error-rate`). If production error rate exceeds the configured threshold, merges are blocked until the rate stabilizes.
