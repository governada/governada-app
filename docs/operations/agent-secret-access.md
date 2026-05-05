# Agent Secret Access

Governada has two separate credential lanes:

- Service-account automation lane: routine non-git reads for autonomous agents.
- Tim/manual approval lane: SSH signing, PR merge approval, production deploy approval, secret rotation, production data writes, and destructive or administrative actions.

This document implements the `lean-agent-harness` addendum for scoped, non-git secret reads. Git auth stays SSH+1Password Desktop.

## Lane Contract

Service account:

- Name: `governada-agent-automation`
- Token env var exposed to agent runtimes: `OP_AGENT_SERVICE_ACCOUNT_TOKEN`
- Vault: `Governada-Agent`
- Purpose: read-only access to approved non-git agent verification credentials.
- No GitHub access.
- No production scopes.
- No permission to create, edit, delete, rotate, move, export, administer, or manage vaults/users.

Vault scope:

- Contains only non-production preview/staging credentials and read-only credentials needed to verify autonomous agent work.
- Production credentials are never in this vault and are structurally inaccessible to the service account.
- The doctor treats obvious production/admin item names as blockers, but the monthly manual vault audit is the definitive control.

## Allowed Items At Slice Start

| Item                        | Fields                                                                       | Scope                                          |
| --------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `governada-posthog-staging` | `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `NEXT_PUBLIC_POSTHOG_HOST` | PostHog dev/staging project read/query access. |

Sentry is intentionally deferred. Add it only after observed need, by adding the item to `Governada-Agent` and configuring `GOVERNADA_OP_AGENT_ITEMS`; do not make this doctor fail closed on an anticipated Sentry item.

## What This Vault Must Not Contain

Never place any of these in `Governada-Agent`:

- Production credentials.
- GitHub-capable tokens, including any credential that can push, merge, or read production source.
- Deploy-trigger tokens.
- Secret-rotation tokens.
- On-chain submit credentials.
- Admin tokens for any provider.
- Mainnet wallet keys.
- Production Supabase, Railway, database, or infrastructure credentials.

## Local Runtime Token Placement

`OP_AGENT_SERVICE_ACCOUNT_TOKEN` is the Governada bootstrap credential for this lane. Do not commit it, paste it into chat, print it in logs, or place it in `.env.local`.

Canonical local runtime file:

```text
/Users/tim/dev/agent-runtime/env/governada-agent.env
```

Expected contents:

```dotenv
OP_AGENT_SERVICE_ACCOUNT_TOKEN=ops_REDACTED
GOVERNADA_OP_AGENT_VAULT=Governada-Agent
GOVERNADA_OP_AGENT_ROTATE_AFTER=YYYY-MM-DD
```

File permissions:

```bash
chmod 600 /Users/tim/dev/agent-runtime/env/governada-agent.env
```

Store the generated service-account token itself in Tim's manual 1Password area, not in the agent vault the service account can read. The runtime env file is a local bootstrap copy, not the source of truth for provider credentials.

## Expiration And Rotation Policy

- Rotation cadence: every 90 days, plus immediately after suspected exposure, machine loss, role/scope change, or accidental log/chat disclosure.
- First target: if created on May 4, 2026, rotate by August 2, 2026. Otherwise set the first rotation target to 90 days from creation.
- Rotation overlap: set the existing token to expire in 3 days, update the runtime env file, run `npm run op:agent-doctor`, then revoke/expire the old token after the doctor is green.
- Emergency compromise: rotate and expire the old token immediately, then audit service-account usage.
- Scope change: create a new least-privilege service account instead of broadening this one in place.
- Review cadence: monthly vault and usage-report check.

## Doctor

Run:

```bash
npm run op:agent-doctor
```

The doctor checks:

- `OP_AGENT_SERVICE_ACCOUNT_TOKEN` is present and has the `ops_` service-account shape.
- The old decommissioned token env var is not being used for this lane.
- `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN` are absent.
- `op` is installed at version `2.18.0` or newer.
- The configured vault is readable.
- Vault item names do not match obvious forbidden production/admin patterns: `prod`, `production`, `mainnet`, `admin`, `deploy`, `rotate`.
- Expected item fields are readable with values revealed to the child process, parsed in memory, and never printed.

Override the env file, vault, or expected item contract when needed:

```bash
npm run op:agent-doctor -- --agent-env-file /path/to/local.env
npm run op:agent-doctor -- --vault "Governada-Agent"
npm run op:agent-doctor -- --item "governada-posthog-staging=POSTHOG_PERSONAL_API_KEY,POSTHOG_PROJECT_ID,NEXT_PUBLIC_POSTHOG_HOST"
```

To override expected items through environment:

```dotenv
GOVERNADA_OP_AGENT_ITEMS=governada-posthog-staging=POSTHOG_PERSONAL_API_KEY,POSTHOG_PROJECT_ID,NEXT_PUBLIC_POSTHOG_HOST
```

## Lane Visibility

Run:

```bash
npm run env:doctor
```

The first line reports exactly one active lane:

- `Active credential lane: agent (OP_AGENT_SERVICE_ACCOUNT_TOKEN, vault=Governada-Agent)`
- `Active credential lane: human (SSH+1Password Desktop)`
- `Active credential lane: NONE`

This is intentionally one line. Per-secret read logging is deferred until the 2026-06-01 audit if lane confusion actually happens.

## Manual Gates Stay Manual

The service-account lane is not a merge, deploy, admin, git, or production-write lane.

Always pause for Tim's explicit approval before:

- Merging a PR.
- Approving or mutating production deploys.
- Running production data writes, sync backfills, migrations, restores, or replays that can mutate production state.
- Creating, rotating, moving, deleting, or changing real secrets.
- Changing 1Password service-account permissions, vault access, or token state.
- Changing GitHub App permissions, branch protection, billing/admin settings, Railway project settings, or Supabase project settings.

## Tim Setup Checklist

1. Confirm service account `governada-agent-automation` exists.
2. Confirm it is scoped only to `Governada-Agent`.
3. Confirm `Governada-Agent` contains `governada-posthog-staging` only, unless Sentry is later added after observed need.
4. Confirm the PostHog token is dev/staging project read/query scope, not production and not admin.
5. Confirm the service account has zero GitHub access and zero production scopes.
6. Confirm first rotation date is set 90 days from token creation.
7. Confirm `/Users/tim/dev/agent-runtime/env/governada-agent.env` exists with mode `600`.
8. Run `npm run op:agent-doctor`.
9. Run `npm run env:doctor`.

## References

- 1Password app integration security: https://developer.1password.com/docs/cli/app-integration-security/
- 1Password Service Accounts: https://developer.1password.com/docs/service-accounts/
- Use service accounts with 1Password CLI: https://developer.1password.com/docs/service-accounts/use-with-1password-cli/
- 1Password Service Account security: https://developer.1password.com/docs/service-accounts/security/
- Manage service accounts: https://developer.1password.com/docs/service-accounts/manage-service-accounts/
