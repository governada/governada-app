# Agent Observability Access

Governada agents use two local wrappers for operational observability:

- `bin/betterstack.sh` for Better Stack Uptime heartbeat monitor management.
- `bin/sentry.sh` for read-only Sentry issue and event-count checks.

Both wrappers resolve API tokens from 1Password at runtime using the
`OP_AGENT_SERVICE_ACCOUNT_TOKEN` lane documented in `AGENTS.md`. The token
op-refs live in `.env.local.refs`:

```bash
BETTERSTACK_API_TOKEN_OP_REF=op://Governada-Agent/governada-betterstack-automation/token
SENTRY_AUTH_TOKEN_OP_REF=op://Governada-Agent/governada-sentry-automation/token
```

Do not paste, print, export, or commit raw Better Stack or Sentry tokens. The
wrappers redact known token prefixes in stderr before showing tool errors:
`bt_...` / `betterstack_...` for Better Stack, `sntrys_...` / `sntryu_...` for
Sentry, and `ops_...` for the 1Password service-account token.

## Better Stack

Supported commands:

```bash
bin/betterstack.sh monitor list
bin/betterstack.sh monitor get <id>
bin/betterstack.sh monitor create --type heartbeat --period 300 --grace 60 --name sample-tier1
bin/betterstack.sh monitor delete <id>
```

`monitor create` creates a Better Stack heartbeat and prints the heartbeat API
resource URL ending in the numeric heartbeat id. Use `monitor get <id>` to
inspect the response body, including the heartbeat ping URL under
`data.attributes.url`.

The wrapper calls Better Stack Uptime API v2 heartbeat endpoints:

- `GET /heartbeats`
- `GET /heartbeats/{id}`
- `POST /heartbeats`
- `DELETE /heartbeats/{id}`

## Sentry

Defaults:

```bash
SENTRY_ORG_SLUG=governada
SENTRY_PROJECT_SLUG=javascript-nextjs
```

Override with environment variables or per-command flags:

```bash
bin/sentry.sh issues --query "is:unresolved" --period 24h --limit 20
bin/sentry.sh issue get <id>
bin/sentry.sh stats --period 24h
```

The wrapper calls Sentry's project issue and project stats endpoints with
read-only bearer auth:

- `GET /projects/{org}/{project}/issues/`
- `GET /organizations/{org}/issues/{issue_id}/`
- `GET /projects/{org}/{project}/stats/`

`stats --period 24h` computes `since` and `until` timestamps locally and queries
received event counts at hourly resolution.

## Rotation

- Better Stack: rotate according to Better Stack's token TTL policy or sooner
  on suspected compromise.
- Sentry: rotate annually on the AGENTS.md cadence, or sooner on suspected
  compromise.
- After rotation, update the corresponding 1Password item field named `token`.
  Do not change the op-ref path unless the item name changes.

## Smoke Tests

These commands are safe to paste into a terminal. They do not expose tokens in
shell history because the wrappers resolve tokens internally.

```bash
# Better Stack: list monitors (read-only; cheap)
bin/betterstack.sh monitor list | head -3

# Better Stack: create a throwaway heartbeat monitor + delete it
URL=$(bin/betterstack.sh monitor create --type heartbeat --period 300 --grace 60 --name f13-smoke-throwaway)
echo "Created: $URL"
MONITOR_ID=$(echo "$URL" | grep -oE '[0-9]+$')
bin/betterstack.sh monitor delete "$MONITOR_ID"

# Sentry: list recent issues (read-only; may return [])
bin/sentry.sh issues --query "is:unresolved" | head -5

# Sentry: stats for last 24h
bin/sentry.sh stats --period 24h
```

Expected setup-failure behavior:

- Missing or non-`op://` op-ref exits nonzero with `BLOCKED: <KEY>_OP_REF...`.
- Missing `OP_AGENT_SERVICE_ACCOUNT_TOKEN` exits nonzero with remediation for
  `npm run op:agent-doctor`.
- A failed `op read` exits nonzero and redacts op-refs, service-account token
  shapes, and known observability token prefixes.
