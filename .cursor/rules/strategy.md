---
description: Governada product vision, strategy, and design principles — condensed for agent context
globs:
  - docs/strategy/**
  - tasks/**
  - components/**
  - app/**
alwaysApply: false
---

<!-- LINE BUDGET: 80 lines. Full detail → docs/strategy/ultimate-vision.md -->

# Governada Strategy Context

**Governada** is the civic hub for the Cardano Nation. Every ADA holder is a citizen of a decentralized nation. Governada makes governance visible, accountable, and participatory. Read `docs/strategy/ultimate-vision.md` for the full north star.

## Core Identity

- **Name:** Governada. Update all user-facing references.
- **Thesis:** Civic infrastructure for the Cardano Nation — not a dashboard, not a scoring tool.
- **Primary persona:** Citizens (ADA holders). Representatives are served because it serves citizens.
- **Moat:** Compounding historical governance data that grows every epoch. Time is the advantage.

## Personas (citizen-first order)

1. **Citizens** (ADA holders) — find representatives, track delegation health, accountability reports, civic pride
2. **DReps** — governance reputation, score tiers, delegator attraction. Monetized via DRep Pro
3. **SPOs** — governance participation scores, pool differentiation. Monetized via SPO Pro
4. **Constitutional Committee** — transparent judicial accountability
5. **Treasury Proposal Teams** — delivery track record. Monetized via Verified Project
6. **Governance Researchers** — academic data exports. Monetized via Research API
7. **Cross-Chain Observers** — Cardano governance showcase

## Scoring Systems (audit summary)

**Keep & reframe:** DRep Score V3 (4-pillar), SPO Score, GHI, EDI, Alignment (6D), Rationale Quality, Matching, User Profiles, Treasury metrics, Vote Impact, Inter-Body Alignment, CC Transparency Index, Identity/Personality.
**Build new:** Score Tiers (Emerging→Legendary), Score Impact Prediction, Citizen Engagement Level, Alignment Drift Score, DRep Report Card.
**Deprecate:** GHI Platform Engagement sub-metric. Audit `utils/scoring.ts` for vestigial V1/V2 code.
**Change:** SPO Score gets 4th pillar (Governance Identity). DRep Score Governance Identity weight (15%) may tune down.

## Build Phases

- **Steps 0-2.5:** ✅ Backend complete (V3 scoring, alignment, GHI, matching, SPO/CC votes, treasury)
- **Phase A:** Backend gaps (tiers, drift detection, impact prediction, notifications, SPO parity) + **clean-sheet frontend redesign**
- **Phase B:** Growth & engagement (Wrapped, DRep-citizen comms, notification-driven civic life)
- **Phase C:** Monetization (DRep Pro, SPO Pro, Verified Projects)
- **Phase D:** Premium Citizen + AI Advisor, API v2, Network Graph, Simulation
- **Phase E:** Catalyst Score, Cross-Ecosystem Identity, Governance-as-a-Service

## Product Experience Architecture

- **4 nav items max:** Home, Discover, Pulse, My Gov
- **Segment detection on wallet connect:** Anonymous → Undelegated → Delegated → DRep → SPO (each sees different experience)
- **Action over information:** Every screen drives behavior. Command center = action feed, not data wall
- **Score tiers:** Emerging (0-39), Bronze (40-54), Silver (55-69), Gold (70-84), Diamond (85-94), Legendary (95-100) — applied to DRep + SPO scores
- **Kill pages:** `/methodology`, `/simulate`, `/delegation`, `/learn`
- **Consolidate:** `/governance` → My Gov, `/treasury` → Pulse, `/decentralization` → Pulse

## Design Principles (non-negotiable)

1. Citizens first, always
2. Action over information — every screen must drive behavior
3. Scores must have consequences (tiers, celebrations, competitive pressure)
4. First principles every time — don't copy, don't use generic patterns
5. Ambition over feasibility — design ideal experience first
6. V3 is the new V1 — quality over speed, no half-built features
7. Custom everything — if a chart library has it, we're not using it
8. Free core, paid power tools
9. Data is the moat — never stop collecting
10. Platform neutrality — no favoritism
11. Representatives are the sales force — make sharing effortless
12. Ship complete or don't ship
13. Build in public

## Strategy Documents

- `docs/strategy/ultimate-vision.md` — **THE** north star. Full vision, personas, scoring audit, build phases, growth, monetization, rubric, principles
- `docs/strategy/monetization-strategy.md` — Detailed business model, moat analysis, revenue phases
- `docs/strategy/catalyst-proposal.md` — Fund 16 proposal draft
