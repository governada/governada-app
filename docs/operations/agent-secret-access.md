# Agent Secret Access

Governada has two separate credential lanes:

- Service-account automation lane: routine approved agent reads and GitHub API operations.
- Tim/manual approval lane: SSH signing, PR merge approval, production deploy approval, secret rotation, production data writes, and destructive or administrative actions.

This document implements the `lean-agent-harness` service-account addenda. Git push/pull stays SSH+1Password Desktop. GitHub API operations use `GH_TOKEN_OP_REF` resolved through the agent service account per Addendum #3.

## Lane Contract

Service account:

- Name: `governada-agent-automation`
- Token env var exposed to agent runtimes: `OP_AGENT_SERVICE_ACCOUNT_TOKEN`
- Runtime file: `/Users/tim/dev/agent-runtime/env/governada-agent.env`
- Vault: `Governada-Agent`
- Purpose: read approved automation credentials non-interactively.
- No production scopes.
- No permission to create, edit, delete, rotate, move, export, administer, or manage vaults/users.

Vault scope:

- Contains only non-production preview/staging credentials and read-only credentials needed to verify autonomous agent work, plus the single bounded GitHub API credential approved in Addendum #3.
- Production credentials are never in this vault and are structurally inaccessible to the service account.
- The doctor treats obvious production/admin item names as blockers, but the monthly manual vault audit is the definitive control.

## Items In Vault

| Item                        | Fields                                                                       | Scope                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `governada-posthog-staging` | `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `NEXT_PUBLIC_POSTHOG_HOST` | PostHog dev/staging project read/query access.                                                                        |
| `governada-app-agent`       | `credential`                                                                 | Fine-grained GitHub PAT for `governada/app` only: Contents:write, Pull requests:write, Metadata:read, Workflows:read. |

Sentry is intentionally deferred. Add it only after observed need, by adding the item to `Governada-Agent` and configuring the relevant doctor expectation; do not make this lane fail closed on an anticipated Sentry item.

## What This Vault Must Not Contain

Never place any of these in `Governada-Agent`:

- Production credentials.
- GitHub admin tokens.
- Merge-capable credentials or bypass tokens.
- PATs or app credentials for any repo other than `governada/app`.
- Deploy-trigger tokens.
- Secret-rotation tokens.
- On-chain submit credentials.
- Admin tokens for any provider.
- Mainnet wallet keys.
- Production Supabase, Railway, database, or infrastructure credentials.

The `governada-app-agent` PAT is the only GitHub credential allowed in this vault. Expanding its scope requires an explicit ADR addendum, not a vault-content change.

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

The runtime env file is a local bootstrap copy. Provider credentials remain canonical in 1Password.

## GitHub API Lane

Run GitHub API commands through the wrapper:

```bash
bin/gh.sh api user
npm run gh -- pr view 952 --repo governada/app
```

The wrapper:

- Reads `GH_TOKEN_OP_REF=op://Governada-Agent/governada-app-agent/credential`.
- Reads `OP_AGENT_SERVICE_ACCOUNT_TOKEN` from `/Users/tim/dev/agent-runtime/env/governada-agent.env`.
- Maps that token to `OP_SERVICE_ACCOUNT_TOKEN` only for the `op` subprocess.
- Unsets `OP_ACCOUNT`, `OP_CONNECT_HOST`, and `OP_CONNECT_TOKEN` so 1Password Desktop and Connect do not override service-account auth.
- Blocks token-printing `gh auth` commands.
- Redacts GitHub token, service-account token, and op-ref shapes from stdout and stderr.
- Never prints or writes the GitHub token.

This is the GitHub API write lane from `lean-agent-harness` Addendum #3. It can create draft PRs and update PR metadata within the PAT scope. It is not a merge lane.

## Expiration And Rotation Policy

- Service-account token rotation cadence: every 90 days, plus immediately after suspected exposure, machine loss, role/scope change, or accidental log/chat disclosure.
- GitHub PAT rotation target: `GH_TOKEN_ROTATE_AFTER=2026-08-02`, then every 90 days.
- Rotation overlap: update the real credential in 1Password, run `npm run gh:auth-status`, then revoke/expire the old token after the doctor is green.
- Emergency compromise: rotate and expire the old token immediately, then audit service-account usage.
- Scope change: record the change in the ADR addendum before changing the vault item or PAT permissions.
- Review cadence: monthly vault and usage-report check.

## Doctors

Run:

```bash
npm run gh:auth-status
npm run op:agent-doctor
```

`npm run gh:auth-status` checks:

- SSH + 1Password git lane still works.
- Agent service-account env file exists, is owner-only, and contains an `ops_` token shape.
- `bin/gh.sh` does not invoke Desktop auth.
- `bin/gh.sh` resolves the GitHub token through service-account auth without prompt-shaped output.
- GitHub API read works for `governada/app`.
- PR-create capability reaches GitHub validation with `pull_requests:write`.
- GitHub PAT rotation date is valid and outside the 14-day warning window.

`npm run op:agent-doctor` checks the broader 1Password service-account lane and expected vault items. It must not print secret values.

## Manual Gates Stay Manual

The service-account lane is not a merge, deploy, admin, production-write, or secret-rotation lane.

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
3. Confirm `Governada-Agent` contains exactly `governada-posthog-staging` and `governada-app-agent`, unless a future ADR addendum explicitly changes this list.
4. Confirm the PostHog token is dev/staging project read/query scope, not production and not admin.
5. Confirm the GitHub PAT is scoped to `governada/app` only with Contents:write, Pull requests:write, Metadata:read, and Workflows:read.
6. Confirm first rotation dates are set for the service-account token and GitHub PAT.
7. Confirm `/Users/tim/dev/agent-runtime/env/governada-agent.env` exists with mode `600`.
8. Run `npm run op:agent-doctor`.
9. Run `npm run gh:auth-status`.

## References

- 1Password app integration security: https://developer.1password.com/docs/cli/app-integration-security/
- 1Password Service Accounts: https://developer.1password.com/docs/service-accounts/
- Use service accounts with 1Password CLI: https://developer.1password.com/docs/service-accounts/use-with-1password-cli/
- 1Password Service Account security: https://developer.1password.com/docs/service-accounts/security/
- Manage service accounts: https://developer.1password.com/docs/service-accounts/manage-service-accounts/
