# Architecture

This is the compact map of Governada's current app architecture. The archive source of truth consolidated here is `docs/archive/strategy-context/build-manifest.md`, with navigation shape from `docs/archive/strategy-context/navigation-architecture.md`.

## System DAG

```text
Cardano data sources
  -> sync pipeline (`lib/sync/`, `inngest/functions/`)
  -> database tables and snapshots
  -> cached data access (`lib/data.ts`)
  -> intelligence engines (`lib/scoring/`, `lib/alignment/`, `lib/ghi/`, `lib/matching/`)
  -> API routes (`app/api/`)
  -> product surfaces (`app/`, `components/`)
  -> Hub, Workspace, Governance, You, Match, Delegation
```

## Where Features Live

- Hub: `/`, `components/hub/`, `components/governada/home/`.
- Workspace: `app/workspace/`, `components/workspace/`, `components/studio/`, `lib/workspace/`.
- Governance browse: `app/governance/`, DRep/SPO/CC/proposal detail routes, governance components.
- Match and alignment: `app/match/`, `components/governada/panel/SenecaMatch.tsx`, `lib/matching/`, `lib/alignment/`.
- Identity and account: `app/you/`, `app/my-gov/`, `lib/identity/`, wallet/auth routes.
- Intelligence and Seneca: `app/api/intelligence/`, `components/governada/SenecaThread.tsx`, `hooks/useSeneca*`, `lib/ai/`.
- Public API and embeds: `app/api/v1/`, `app/embed/`, `app/developers/`.

## Major Subsystems

### Sync Pipeline

- `inngest/functions/` contains scheduled and event-driven jobs for DReps, SPOs, CC, proposals, votes, snapshots, briefings, and derived intelligence.
- New functions must be registered in `app/api/inngest/route.ts`.
- Sync writes canonical tables and historical snapshot tables; UI reads derived/cached views instead of direct chain calls.

### Scoring

- DRep Score V3 lives in `lib/scoring/drepScore.ts`.
- SPO scoring lives in `lib/scoring/spoScore.ts`.
- CC transparency lives in `lib/scoring/ccTransparency.ts`.
- Score history tables support trend and percentile narratives.

### Alignment

- Six-dimensional PCA alignment lives in `lib/alignment/`.
- Proposal classification and similarity cache power alignment explanations, match flows, and review context.
- Alignment is shared across DRep, SPO, proposal, and citizen preference surfaces.

### Matching

- Matching lives in `lib/matching/` and powers `/match`, quick match APIs, and Seneca-guided match flows.
- Matching is persona-agnostic: the same underlying alignment concepts can match citizens to DReps, pools, and governance positions.

### GHI

- Governance Health Index lives in `lib/ghi/` and `/governance/health`.
- GHI combines participation, decentralization, engagement, and related metrics into a governance-wide signal.
- GHI snapshots preserve epoch-level history.

### Treasury

- Treasury intelligence lives under `app/api/treasury/`, `components/treasury/`, and `/governance/treasury`.
- Treasury surfaces should translate spending and proposal data into citizen-readable consequences, not raw accounting dumps.

### Governance Browse

- Governance browse lives under `/governance` and entity detail routes.
- Core pages: proposals, representatives, pools, committee, treasury, health, briefing.
- Entity pages stand alone but breadcrumb back to Governance.

### Workspace

- Workspace is for doing governance work: review, vote, author, manage profile, understand delegators, improve score.
- Studio mode is the focused author/review shell used by workspace flows.
- DRep and SPO workspace surfaces share patterns but must not fork parallel implementations for the same behavior.

### Identity

- Identity covers connected wallets, civic identity, public profiles, delegation state, and preferences.
- Wallet auth is the primary identity path; email is only a notification channel when introduced.
- Account-management surfaces live in You/My Gov, while governance actions live in Hub or Workspace.

## Data Flow

- Ingest: chain and governance sources enter through sync jobs and API adapters.
- Normalize: sync writes normalized tables, caches, and snapshots.
- Derive: scoring, alignment, matching, GHI, treasury, and briefing code compute user-facing intelligence.
- Serve: routes and APIs read cached governance data through `lib/data.ts` and subsystem libraries.
- Render: Hub and Workspace prioritize action; Governance prioritizes understanding; You prioritizes identity.

## Testing

Governada uses staging and per-PR preview environments for UX and telemetry
verification. The non-production stack is isolated from production writes, but
it still reads mainnet governance data where the product experience depends on
current chain state.

- Staging is a persistent Railway environment at `https://stg.governada.io`
  backed by a persistent Supabase staging branch, non-prod Redis, and the
  non-prod PostHog project.
- Railway PR environments inherit from staging, not production. This keeps PR
  previews production-shaped without copying production-write credentials.
- Each eligible feature PR gets a Supabase branch database through the Supabase
  preview integration. Migrations apply to that branch before smoke checks run.
- Each eligible feature PR gets a Railway preview deploy. Railway injects the
  preview domain and Git metadata, and the deploy is torn down automatically
  when the PR closes.
- Preview Supabase auth is separate from production auth. Preview keys and
  service-role credentials are configured in GitHub or Railway secrets, never in
  committed files.
- Preview delegation runs in sandbox mode with `GOVERNADA_DELEGATION_MODE` set
  to `sandbox`. Sandbox delegation preserves the normal validation and telemetry
  path, writes the simulated delegation to the preview Supabase branch, and skips
  wallet signing and on-chain transaction submission.
- Production defaults to mainnet mode. Sandbox mode is only for delegation
  writes; DRep state, proposal state, sentiment reads, matching, scoring, and
  other governance reads remain driven by the normal mainnet-backed data paths.
- Synthetic preview seed data is deterministic and contains no real PII. It
  exists to make homepage cinema, sentiment, proposal, and delegation smoke tests
  meaningful on a fresh branch database.
- `npm run preview:verify` is the per-PR smoke command. It checks
  `/api/health/ready`, confirms the homepage renders, and verifies the expected
  structured-data signal is present before a PR is treated as UX-verifiable.
- Preview PR descriptions should link the Railway URL and include screenshot or
  recording evidence. PRs that touch funnel telemetry should also include
  PostHog evidence from the dev project.

## Navigation Model

- Home/Hub: persona-adaptive control center.
- Workspace: available to governance actors and delegated citizens doing work.
- Governance: universal understanding and browse surface.
- You: account, identity, settings, and notification history.
- Match: conversion and representation-discovery funnel.
- Delegation: relationship health for citizens with DRep and pool representation.
