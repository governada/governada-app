# `.env.local.refs` Example

Copy the environment block to an ignored `.env.local.refs` file for local use.
Keep GitHub CLI token reference variables out of this file:
`GH_TOKEN_OP_REF` and `GITHUB_TOKEN_OP_REF` must remain unresolved references
for the repo's GitHub wrappers. Human-present setup can cache that reference
with `npm run gh:token-cache -- cache-token --confirm gh.runtime.cache-token`;
the source of truth remains 1Password.
Also keep raw GitHub token variables out of this file: `GH_TOKEN` and
`GITHUB_TOKEN`.

Literal values are accepted only for non-secret allowlisted keys. Secret-bearing
keys must use `op://...` references.

```dotenv
KOIOS_API_KEY=op://<vault>/<item>/koios-api-key
NEXT_PUBLIC_KOIOS_BASE_URL=https://api.koios.rest/api/v1

ADMIN_WALLETS=op://<vault>/<item>/admin-wallets

NEXT_PUBLIC_VAPID_PUBLIC_KEY=op://<vault>/<item>/vapid-public-key
VAPID_PRIVATE_KEY=op://<vault>/<item>/vapid-private-key
VAPID_SUBJECT=op://<vault>/<item>/vapid-subject

SUPABASE_ACCESS_TOKEN=op://<vault>/<item>/supabase-access-token

UPSTASH_REDIS_REST_URL=op://<vault>/<item>/upstash-redis-rest-url
UPSTASH_REDIS_REST_TOKEN=op://<vault>/<item>/upstash-redis-rest-token

POSTHOG_PERSONAL_API_KEY=op://<vault>/<item>/posthog-personal-api-key
POSTHOG_PROJECT_ID=op://<vault>/<item>/posthog-project-id

DEV_MOCK_AUTH=true
DEV_ADMIN_WALLETS=op://<vault>/<item>/dev-admin-wallets

HEARTBEAT_URL_PROPOSALS=op://<vault>/<item>/heartbeat-url-proposals
HEARTBEAT_URL_BATCH=op://<vault>/<item>/heartbeat-url-batch
HEARTBEAT_URL_DAILY=op://<vault>/<item>/heartbeat-url-daily
HEARTBEAT_URL_SCORING=op://<vault>/<item>/heartbeat-url-scoring
HEARTBEAT_URL_ALIGNMENT=op://<vault>/<item>/heartbeat-url-alignment
HEARTBEAT_URL_FRESHNESS_GUARD=op://<vault>/<item>/heartbeat-url-freshness-guard
HEARTBEAT_URL_EPOCH_SUMMARY=op://<vault>/<item>/heartbeat-url-epoch-summary

# Optional Phase 0B autonomous GitHub App lane.
# Use only after Tim approves the GitHub App and 1Password service-account setup.
# The IDs and rotation timestamps are non-secret. The private key and service
# account token must remain in the narrow automation vault and must not be pasted.
# OP_SERVICE_ACCOUNT_TOKEN must not live in this file. The broker service may
# store only an op:// pointer to the 1Password item field containing the
# service-account token. After the one-time broker service install from the
# shared checkout and human-present `npm run github:broker -- cache-token
# --confirm github.runtime.cache-token`, agents use the ensure command
# (`npm run github:broker -- ensure`) and repo-local GitHub wrappers.
# 1Password remains the source of truth; macOS Keychain holds only the local
# runtime cache, and token values stay out of tracked files, LaunchAgent
# plists, logs, command arguments, and agent output.
GOVERNADA_OP_SERVICE_ACCOUNT_TOKEN_OP_REF=op://<automation-vault>/<github-app-item>/service-account-token
GOVERNADA_GITHUB_APP_ID=123456
GOVERNADA_GITHUB_APP_INSTALLATION_ID=12345678
GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF=op://<automation-vault>/<github-app-item>/private-key
GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT=2026-05-25T00:00:00Z
GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER=2026-05-18T00:00:00Z
```
