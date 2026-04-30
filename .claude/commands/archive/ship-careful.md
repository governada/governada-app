# Ship Careful

Plan and execute a flag-gated canary rollout for high-risk changes. This wraps the canonical ship path from `AGENTS.md` and `.agents/skills/ship/SKILL.md`, then adds explicit approval gates for production feature-flag mutations.

Use this instead of `/ship` when the change touches scoring models, matching, delegation, wallet interactions, data migrations, or any user-facing behavior that could break trust.

## Pre-Flight

1. Identify the feature flag. The change must already be behind a flag such as `getFeatureFlag()` or `<FeatureGate>`. If not, add one first.
2. Verify the flag exists in `lib/featureFlags.ts` with a safe default.
3. Confirm the flag is OFF in production through an approved read-only status command or dashboard view. Do not run production data writes while planning.

## Deploy

1. Run the canonical ship sequence: verify, commit, brokered publish, PR-write, CI, pre-merge checks, Tim-approved `github:merge`, synchronous deploy verification.
2. Confirm the feature shipped to production but remains hidden while the flag is OFF.

## Canary Rollout

For each rollout stage, propose the exact flag mutation, expected blast radius, verification plan, and rollback action. Pause for explicit approval before applying any production flag mutation.

1. Founder-only.
2. 10 percent of users.
3. 50 percent of users.
4. 100 percent of users.

After each stage, verify the affected pages, Sentry, PostHog where relevant, and `npm run smoke-test`.

## Emergency Flag Rollback

At any stage, if issues are detected:

1. Propose the exact flag-disable mutation and impact.
2. Ask Tim for explicit approval unless Tim has already approved that exact rollback action in the current incident.
3. Apply only through an approved tool path.
4. Verify the feature is hidden and health checks pass.

## Cleanup

After one week at 100 percent with no issues:

1. Remove `<FeatureGate>` wrappers and `getFeatureFlag()` calls from code.
2. Propose deleting the production flag row only with explicit approval.
3. Ship cleanup through the canonical ship path.

## Notification

Use `npm run notify -- "info" ...` for rollout-stage notices and `npm run notify -- "deploy_blocked" ...` for rollback/blocker notices when notifications are configured.
