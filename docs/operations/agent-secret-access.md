# Agent Secret Access

Governada has two separate credential lanes:

- Service-account automation lane: routine approved agent reads, GitHub API operations, and guarded branch publication.
- Tim/manual approval lane: SSH signing, PR merge approval, production deploy approval, secret rotation, production data writes, and destructive or administrative actions.

This document implements the `lean-agent-harness` service-account addenda. Addendum #4 is canonical for the GitHub App pivot; this operations doc describes how the local lane behaves.

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

- Contains only non-production preview/staging credentials and the GitHub App credential approved in Addendum #4.
- Production credentials are never in this vault and are structurally inaccessible to the service account.
- The doctor treats obvious production/admin item names as blockers, but the monthly manual vault audit is the definitive control.

## Items In Vault

| Item                        | Fields                                                                       | Scope                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `governada-posthog-staging` | `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `NEXT_PUBLIC_POSTHOG_HOST` | PostHog dev/staging project read/query access.                                                  |
| `governada-agent-app`       | `client_id`, `installation_id`, `private_key`                                | GitHub App installed only on `governada/app` for API operations and guarded branch publication. |

The old `governada-app-agent` user token item is being decommissioned by Tim after the Addendum #4 PR merges. Expanding the App's repository access, permissions, or vault contents requires an explicit ADR addendum, not a vault-content change.

Sentry is intentionally deferred. Add it only after observed need, by adding the item to `Governada-Agent` and configuring the relevant doctor expectation; do not make this lane fail closed on an anticipated Sentry item.

## What This Vault Must Not Contain

Never place any of these in `Governada-Agent`:

- Production credentials.
- GitHub admin tokens.
- Merge-capable credentials or bypass tokens.
- App credentials for any repo other than `governada/app`.
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

The runtime env file is a local bootstrap copy. Provider credentials remain canonical in 1Password.

## GitHub App Lane

The autonomous GitHub lane uses a GitHub App installation token minted per command invocation:

1. `.env.local.refs` names the three 1Password references for `governada-agent-app`: client ID, installation ID, and private key.
2. The wrapper reads `OP_AGENT_SERVICE_ACCOUNT_TOKEN` from `/Users/tim/dev/agent-runtime/env/governada-agent.env`.
3. The wrapper maps that token to `OP_SERVICE_ACCOUNT_TOKEN` only for the `op` subprocess and unsets Desktop/Connect override env vars.
4. `scripts/mint-installation-token.mjs` mints a short-lived GitHub App JWT, exchanges it for an installation token, and prints only that token to stdout.
5. The wrapper injects the installation token into the child process as `GH_TOKEN` and redacts token-shaped output.

The helper has no external dependencies beyond Node's `crypto` module and global `fetch`. It does not cache, persist, or log tokens.

## GitHub API Lane

Run GitHub API commands through the wrapper:

```bash
bin/gh.sh api user
npm run gh -- pr view 952 --repo governada/app
```

The wrapper:

- Resolves `GOVERNADA_GITHUB_CLIENT_ID_OP_REF`, `GOVERNADA_GITHUB_INSTALLATION_ID_OP_REF`, and `GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF`.
- Enforces a command and endpoint allowlist before any 1Password token resolution.
- Blocks token-printing `gh auth` commands.
- Redacts GitHub token, service-account token, and op-ref shapes from stdout and stderr.
- Never prints or writes the GitHub token.

This is the GitHub API write lane from `lean-agent-harness` Addendum #4. It can create draft PRs and update PR metadata within the App installation scope. It is not a merge lane.

### Capability Allowlist

`bin/gh.sh` is a governed capability lane, not a generic `gh` shell.

Allowed command groups:

- `gh api` for narrow Governada read endpoints: authenticated user, `governada/app` repo metadata, PR reads, check-run reads, and workflow-run/job log reads.
- `gh api POST /repos/governada/app/pulls` only when the request includes `draft=true`.
- `gh pr view`, `gh pr list`, `gh pr diff`, `gh pr checks`, and `gh pr status`.
- `gh pr create` only with `--draft`.
- `gh pr edit` for PR title/body metadata.
- `gh pr comment` for posting PR comments. **Etiquette:** agents post at most one comment per PR — typically the closeout summary. Multi-comment threads are human-driven only. Comments that contain log dumps, progress updates, or per-step status are out of scope and indicate a workflow problem, not a wrapper one.

Blocked command groups include:

- `gh auth token` and `gh auth status --show-token`.
- `gh pr merge`, `gh pr ready`, `gh pr close`, `gh pr reopen`, and `gh pr review`.
- Destructive or administrative `gh api` methods/endpoints such as `DELETE`, repo settings, secrets, variables, environments, branch protection, workflow dispatch, releases, deployments, and actions mutation.
- Any repo target other than `governada/app`.

## Branch Publication Lane

Use the GitHub App branch-publication wrapper for autonomous pushes:

```bash
bin/git-push.sh --dry-run origin HEAD:refs/heads/feat/gh-auth-doctor-probe
npm run git:push -- --set-upstream origin feat/my-branch
```

The wrapper:

- Mints an installation token using the same service-account and helper path as `bin/gh.sh`.
- Pushes to `https://github.com/governada/app.git` for this invocation only.
- Leaves the persistent `origin` remote unchanged.
- Supplies credentials through a transient git credential helper sourced from env and disables hooks for the wrapped push so repo hook code cannot inherit the installation token.
- Allows only `feat/*` and `codex/*` branch targets.
- Allows `--dry-run`, `-u`, and `--set-upstream`.
- Blocks `main`, `master`, `release/*`, `production*`, force-push flags, delete/mirror/all/tags/prune flags, and non-`origin` remotes.

`HEAD:refs/heads/feat/gh-auth-doctor-probe` is the self-contained refspec used by `npm run gh:auth-status` for non-mutating push capability checks.

## Allowlist Extension Policy

The allowlist is intentionally narrow. Extending it is a deliberate action, not a silent edit.

1. An agent flow hits `BLOCKED: ...` from a wrapper. The blocked operation is recorded with its exact command shape.
2. Tim decides whether the operation is in scope for the autonomous lane.
3. If yes: a one-line entry is added to the relevant ADR addendum, the wrapper allowlist gets the new entry, and `gh-auth-status` gets a positive probe plus a near-miss negative probe.
4. The change ships as a single PR reviewed against the addendum diff.

## Expiration And Rotation Policy

- Service-account token rotation cadence: every 90 days, plus immediately after suspected exposure, machine loss, role/scope change, or accidental log/chat disclosure.
- GitHub installation tokens auto-rotate hourly and are minted per wrapper invocation.
- GitHub App private-key rotation: annually, plus immediately on suspected compromise. Tim performs this manual action in GitHub and 1Password.
- Emergency compromise: rotate the App private key and service-account token immediately, then audit service-account usage.
- Scope change: record the change in the ADR addendum before changing the vault item or App permissions.
- Review cadence: monthly vault and usage-report check.

## Doctors

Run:

```bash
npm run gh:auth-status
npm run op:agent-doctor
npm run env:doctor
```

`npm run gh:auth-status` checks:

- SSH + 1Password git lane still works for Tim's manual lane.
- Agent service-account env file exists, is owner-only, and contains an `ops_` token shape.
- `bin/gh.sh` does not invoke Desktop auth.
- `bin/gh.sh` blocks token-printing commands, merge commands, unsafe API methods, direct non-draft PR creation, API-layer merge bypass, ref-overwrite via API, and the GraphQL endpoint before secret resolution.
- The three GitHub App op-refs are configured.
- The agent service account can read the App private key without printing it.
- JWT and installation-token minting succeeds.
- GitHub API read works for `governada/app`.
- `bin/git-push.sh --dry-run origin HEAD:refs/heads/feat/gh-auth-doctor-probe` succeeds.
- Push to `main` and force-push attempts fail closed with `BLOCKED:` before secret resolution.

`npm run op:agent-doctor` checks the broader 1Password service-account lane and expected vault items. It fails closed if `OP_CONNECT_HOST` or `OP_CONNECT_TOKEN` are set, because those override service-account auth. It must not print secret values.

`npm run env:doctor` prints the first-line active credential lane indicator:

- `Active credential lane: agent (OP_AGENT_SERVICE_ACCOUNT_TOKEN, vault=Governada-Agent)`
- `Active credential lane: human (SSH+1Password Desktop)`
- `Active credential lane: NONE`

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
3. Confirm `Governada-Agent` contains `governada-posthog-staging` and `governada-agent-app`; during the transition it may also contain the soon-to-be-decommissioned old token item until Tim removes it after merge.
4. Confirm the PostHog token is dev/staging project read/query scope, not production and not admin.
5. Confirm the GitHub App is installed only on `governada/app` with Contents:read+write, Pull requests:read+write, Metadata:read, Actions:read, and Workflows:read.
6. Confirm `/Users/tim/dev/agent-runtime/env/governada-agent.env` exists with mode `600`.
7. Run `npm run op:agent-doctor`.
8. Run `npm run env:doctor`.
9. Run `npm run gh:auth-status`.

## References

- 1Password app integration security: https://developer.1password.com/docs/cli/app-integration-security/
- 1Password Service Accounts: https://developer.1password.com/docs/service-accounts/
- Use service accounts with 1Password CLI: https://developer.1password.com/docs/service-accounts/use-with-1password-cli/
- 1Password Service Account security: https://developer.1password.com/docs/service-accounts/security/
- Manage service accounts: https://developer.1password.com/docs/service-accounts/manage-service-accounts/
