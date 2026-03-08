# Competitive Landscape (Living Document)

> **Purpose:** Agents update this file during `/audit` runs with current competitive intelligence via WebSearch. Timestamps ensure freshness.
> **Rule:** Every entry must include a date. Entries older than 90 days should be re-verified or marked stale.
> **Last updated:** 2026-03-08 (initial creation — seed during first `/audit` run)

---

## Direct Competitors (Cardano Governance)

### GovTool (Intersect)

- **URL:** https://gov.tools
- **Last checked:** —
- **What they do:** Official Cardano governance tool. Vote casting, DRep registration, proposal submission.
- **Strengths:** Official backing, wallet integration, CIP-95 native
- **Weaknesses:** No intelligence layer, no scoring, no matching, no citizen experience, no engagement
- **Our advantage:** Everything beyond raw voting mechanics

### DRep.tools

- **URL:** https://drep.tools
- **Last checked:** —
- **What they do:** Basic DRep listing and delegation
- **Strengths:** Simple, focused
- **Weaknesses:** No scoring, no matching, no AI, no analytics, DReps only
- **Our advantage:** Full intelligence engine, multi-persona, community engagement

### Cardano Forum / Governance channels

- **Last checked:** —
- **What they do:** Unstructured governance discussion
- **Our advantage:** Structured signal over open discourse (Principle #7)

---

## Adjacent Competitors (Cross-Chain Governance)

### Tally (Ethereum)

- **URL:** https://tally.xyz
- **Last checked:** —
- **What they do:** Proposal voting, delegate profiles, on-chain governance
- **Strengths:** Multi-chain (Ethereum, Polygon, Arbitrum), clean UX, delegate discovery
- **Weaknesses:** No scoring, no matching, no intelligence layer, no cross-body analysis, single governance body
- **UX notes:** [Update during audit — screenshot key pages, note design patterns]
- **Our advantage:** Multi-body analysis, intelligence engine, community engagement, scoring

### Snapshot

- **URL:** https://snapshot.box
- **Last checked:** —
- **What they do:** Off-chain voting, space management
- **Strengths:** Widely used, simple UX, gasless voting
- **Weaknesses:** Off-chain only, no accountability, no intelligence, no reputation
- **Our advantage:** On-chain accountability, scoring, matching, intelligence

### SubSquare (Polkadot)

- **URL:** https://subsquare.io
- **Last checked:** —
- **What they do:** Referendum tracking, basic analytics for Polkadot/Kusama
- **Strengths:** Multi-chain Polkadot ecosystem, clean interface
- **Weaknesses:** No reputation system, no multi-body analysis, no citizen experience
- **Our advantage:** Full intelligence engine, structured engagement, civic identity

---

## Benchmark Products (UX & Data)

### Linear (Workspace UX)

- **URL:** https://linear.app
- **Last checked:** —
- **Relevant patterns:** Dark mode excellence, keyboard-first, real-time updates, minimal chrome, beautiful transitions
- **What to adopt:** [Update during audit]

### Vercel Dashboard (Dashboard UX)

- **URL:** https://vercel.com/dashboard
- **Last checked:** —
- **Relevant patterns:** Information density, deployment status visualization, log streaming
- **What to adopt:** [Update during audit]

### Stripe Dashboard (Data Presentation)

- **URL:** https://dashboard.stripe.com
- **Last checked:** —
- **Relevant patterns:** Financial data clarity, chart design, status indicators
- **What to adopt:** [Update during audit]

### Robinhood (Finance Simplification)

- **Last checked:** —
- **Relevant patterns:** Complex financial data made accessible, portfolio summary, push notifications
- **What to adopt:** [Update during audit]

---

## Data Platforms

### Dune Analytics

- **URL:** https://dune.com
- **Last checked:** —
- **Relevant patterns:** API quality, query flexibility, data freshness, community dashboards
- **Our differentiation:** Opinionated intelligence vs. raw query platform

### DefiLlama

- **URL:** https://defillama.com
- **Last checked:** —
- **Relevant patterns:** Comprehensive data, fast updates, clean charts, API access
- **Our differentiation:** Governance-specific intelligence, not general DeFi metrics

---

## Civic Tech (Engagement Mechanisms)

### Pol.is

- **URL:** https://pol.is
- **Last checked:** —
- **Relevant patterns:** Structured deliberation, opinion clustering, visualization of consensus
- **Applicable to:** Citizen engagement mechanisms, priority signals, assembly design

### Decidim

- **URL:** https://decidim.org
- **Last checked:** —
- **Relevant patterns:** Participatory budgeting, structured proposals, citizen participation
- **Applicable to:** Treasury accountability, citizen engagement

---

## Key Competitive Insights

_Updated during audits. Format: [DATE] — insight._

- [2026-03-08] No competitor in the Cardano governance space has a scoring/intelligence layer. The opportunity window is open but won't stay open indefinitely.
- [2026-03-08] Tally is the closest cross-chain competitor in terms of product ambition. Their multi-chain expansion and delegate profiles are the main areas to watch.
- [2026-03-08] No governance tool in any ecosystem has structured civic engagement mechanisms (sentiment, concern flags, citizen assemblies). This is a genuine differentiator.

---

## Update Protocol

When running `/audit`, agents should:

1. WebSearch each competitor's current state
2. Update "Last checked" dates
3. Note any new features, design changes, or competitive moves
4. Add insights to the "Key Competitive Insights" section
5. Flag any competitor moves that threaten Civica's advantages
