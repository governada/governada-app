Execute a flag-gated canary deployment for high-risk changes. This wraps the normal /ship pipeline but adds gradual rollout via feature flags.

Use this instead of /ship when the change touches: scoring models, matching engine, delegation flow, wallet interactions, data migrations, or any user-facing behavioral change that could break trust.

## Pre-flight

1. **Identify the feature flag**: The change MUST already be behind a feature flag (via `getFeatureFlag()` / `<FeatureGate>`). If not, add one first.
2. **Verify flag exists**: Check `lib/featureFlags.ts` for the flag name. If missing, add it with `defaultValue: false`.
3. **Confirm flag is OFF in production**: `curl -s https://governada.io/api/admin/feature-flags | python3 -c "import json,sys; flags=json.load(sys.stdin); print([f for f in flags if f['key']=='YOUR_FLAG'])"` — value should be `false`.

## Deploy (normal /ship pipeline)

4. Run the full `/ship` sequence (preflight → commit → PR → CI → merge → deploy → verify health).
5. The feature ships to production but is invisible (flag is OFF).

## Canary Rollout

6. **Enable for founder only**: Update the flag in Supabase to target the founder's wallet address:
   ```sql
   UPDATE feature_flags SET value = true, wallets = '["stake1...FOUNDER_ADDRESS"]' WHERE key = 'YOUR_FLAG';
   ```
7. **Verify as founder**: Navigate to the affected pages on governada.io. Check Sentry for new errors.
8. **Wait 1 hour**: Monitor Sentry error rate. If no new errors related to the change, proceed.

9. **Enable for 10% of users**: Remove wallet targeting, set percentage rollout:
   ```sql
   UPDATE feature_flags SET wallets = NULL, rollout_percentage = 10 WHERE key = 'YOUR_FLAG';
   ```
10. **Monitor for 24 hours**: Check:
    - Sentry: `npm run sentry:check` or check dashboard for new errors
    - PostHog: `npm run posthog:check <relevant_event>` for engagement metrics
    - Health: `npm run smoke-test`

11. **Ramp to 50%**: If metrics are stable:
    ```sql
    UPDATE feature_flags SET rollout_percentage = 50 WHERE key = 'YOUR_FLAG';
    ```
12. **Monitor for 24 hours again.**

13. **Full rollout (100%)**: If still stable:

    ```sql
    UPDATE feature_flags SET rollout_percentage = 100 WHERE key = 'YOUR_FLAG';
    ```

14. **Clean up**: After 1 week at 100% with no issues, remove the feature flag:
    - Remove `<FeatureGate>` wrapper and `getFeatureFlag()` calls from code
    - Delete the flag row from Supabase
    - Ship cleanup via normal `/ship`

## Emergency Rollback

At any stage, if issues are detected:

```sql
UPDATE feature_flags SET value = false, wallets = NULL, rollout_percentage = NULL WHERE key = 'YOUR_FLAG';
```

This instantly hides the feature from all users. No redeploy needed.

## Notification

After each rollout stage, notify via:

```bash
npm run notify -- "info" "Canary: YOUR_FLAG at X%" "Metrics stable. Next ramp in 24h."
```

If rolling back:

```bash
npm run notify -- "deploy_blocked" "Canary rollback: YOUR_FLAG" "Disabled flag due to [reason]. Feature hidden from all users."
```
