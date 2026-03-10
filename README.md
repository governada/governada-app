# Governada

**Governance Intelligence for Cardano**

Governada is the governance intelligence platform for Cardano. It serves every participant in the ecosystem — citizens (ADA holders), DReps, SPOs, Constitutional Committee, treasury proposal teams, and governance researchers — through one interconnected data engine.

## What It Does

- **Citizen Matching** — Find an aligned DRep or SPO in 60 seconds via PCA-based governance value matching
- **DRep Scoring (V3)** — 4-pillar accountability scoring (Engagement Quality, Effective Participation, Reliability, Governance Identity) with percentile normalization
- **SPO Governance Scoring** — First-of-its-kind scoring of stake pool operators on governance participation
- **Governance Health Index** — 6-component system health metric with Edinburgh Decentralization Index (7 mathematical metrics)
- **Inter-Body Alignment** — Tri-body analysis showing how DReps, SPOs, and Constitutional Committee vote on the same proposals
- **Treasury Intelligence** — Spending effectiveness, DRep treasury judgment, accountability polls, proposal similarity
- **AI-Powered Narratives** — Epoch recaps, governance briefs, rationale quality analysis, personalized summaries
- **6D Alignment System** — PCA-based alignment across Treasury, Decentralization, Security, Innovation, Transparency dimensions with temporal trajectories

## Tech Stack

- **Framework**: Next.js 16 App Router, TypeScript strict mode
- **UI**: shadcn/ui + Radix UI + Tailwind CSS v4 + custom governance visualizations
- **Wallet**: MeshJS (Eternl, Lace, Typhon, Vespr)
- **Data**: Koios API (mainnet) → Supabase (persistent cache) → Next.js (reads)
- **Background Jobs**: Inngest Cloud (22 durable functions)
- **Hosting**: Railway (Docker)
- **CDN/DNS**: Cloudflare
- **Caching/Rate Limiting**: Upstash Redis
- **Error Tracking**: Sentry
- **Analytics**: PostHog (JS + Node SDKs)
- **AI**: Anthropic Claude (narratives, classification, rationale analysis)
- **Testing**: Vitest + Playwright

## Getting Started

### Prerequisites

- Node.js 18.17.0+
- npm

### Installation

```bash
git clone <repository-url>
cd governada-app
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See `.env.example` for required environment variables. Note: `.env.local` connects to **production** Supabase — treat all local operations as production operations.

## Architecture

```
Koios API (source of truth)
    ↓  Inngest durable functions (22 functions, 30min-weekly schedules)
Supabase (persistent cache, 33+ tables)
    ↓  lib/data.ts reads
Next.js App (server components + 90+ API routes + client components)
```

All frontend reads go through Supabase via `lib/data.ts`. Direct Koios calls only happen inside sync functions. See `.cursor/rules/architecture.md` for the full technical reference.

## Key Directories

| Directory        | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `app/`           | Next.js App Router pages and API routes                               |
| `components/`    | React components (223 files)                                          |
| `lib/`           | Core logic — data access, scoring, alignment, GHI, matching, treasury |
| `lib/scoring/`   | V3 DRep scoring engine (4 pillars + percentile normalization)         |
| `lib/alignment/` | PCA alignment system (6 dimensions, AI classification)                |
| `lib/ghi/`       | Governance Health Index (6 components + EDI)                          |
| `lib/matching/`  | Citizen-to-representative matching engine                             |
| `lib/sync/`      | Durable sync logic (called by Inngest functions)                      |
| `inngest/`       | Background function definitions                                       |
| `utils/`         | Koios helpers, scoring utilities                                      |
| `types/`         | TypeScript type definitions                                           |
| `docs/`          | Strategy, ADRs, runbook, observability                                |

## Deployment

Deployed on Railway via Docker. Auto-deploys from `main`. Background jobs run on Inngest Cloud. DNS/CDN via Cloudflare.

```bash
npm run build          # Production build
npm run gen:types      # Regenerate Supabase types (after migrations)
npm run inngest:status # Verify Inngest function health
npm run smoke-test     # HTTP health checks against production
npm run test           # Vitest unit/integration tests
npm run test:e2e       # Playwright E2E tests
```

## Security

- Content Security Policy (CSP) with report-only mode
- HSTS with 2-year max-age, includeSubDomains, preload
- Row Level Security (RLS) on all Supabase tables
- JWT wallet auth with session revocation (Redis + Supabase)
- Upstash Redis rate limiting on all API endpoints (fails closed)
- Admin audit logging for all privileged actions

## Documentation

- `docs/strategy/ultimate-vision.md` — Product vision (the north star)
- `docs/strategy/monetization-strategy.md` — Business model and revenue phases
- `docs/strategy/catalyst-proposal.md` — Catalyst Fund 16 proposal draft
- `docs/adr/` — Architecture Decision Records
- `docs/runbook.md` — Operational runbook
- `docs/observability-setup.md` — Monitoring setup guide

## License

This project is licensed under the MIT License.
