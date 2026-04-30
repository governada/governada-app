# Persona Quick Reference

> **Purpose:** Compact lookup for agents. For full persona specs, see `docs/strategy/personas/`.
> **Rule:** The Citizen is the anchor. Every feature passes the citizen test: "Does this make a citizen's life better?"

---

## Citizen (ADA Holder) -- 80%+ of users

**Experience:** Summary intelligence, not analytics. Epoch briefing (30-second read), delegation health (green/yellow/red), treasury transparency ("your proportional share"), civic identity (milestones, streaks), community engagement (7 structured mechanisms).
**Home surface:** Epoch Briefing (NOT a dashboard). Returns every ~5 days at epoch boundary.
**Monetization:** Free core. Premium Delegator ($5-10/mo) for AI advisor, advanced alerts, portfolio management.
**Key components:** `EpochBriefing.tsx`, `CivicIdentityCard.tsx`, `TreasuryCitizenView.tsx`, `CitizenCommandCenter.tsx`
**Full spec:** `docs/strategy/personas/citizen.md`

## DRep -- ~700 elected representatives

**Experience:** Governance workspace. Vote casting + rationale submission (CIP-95/CIP-100) from proposal analysis page. AI-assisted rationale drafting. Reputation management. Delegator communication.
**Home surface:** Governance inbox (pending votes, citizen questions, delegator changes).
**Monetization:** Free governance ops. DRep Pro ($15-25/mo) for delegation analytics, score simulator, competitive intelligence.
**Key components:** `DRepCommandCenter.tsx`, `VoteCaster.tsx`, `RationaleFlow.tsx`, `DRepProfileHero.tsx`
**Full spec:** `docs/strategy/personas/drep.md`

## SPO -- ~3,000 infrastructure operators

**Experience:** Identity platform. Governance reputation as competitive differentiator. Rich pool profile, delegator communication, governance-based pool discovery.
**Home surface:** Pool identity + governance score alongside citizen briefing.
**Monetization:** Free governance + basic identity. SPO Pro ($15-25/mo) for growth analytics, competitive intelligence.
**Key components:** `SPOCommandCenter.tsx`, `SpoProfileHero.tsx`, `SPOStatementComposer.tsx`
**Full spec:** `docs/strategy/personas/spo.md`

## CC Member -- ~7-10 constitutional guardians

**Experience:** 80% public accountability surface, 20% optional tooling. Transparency Index, voting record, inter-body dynamics. NOT a user product -- an ecosystem trust layer.
**Monetization:** Free (no Pro tier). Value is ecosystem trust.
**Key components:** `CommitteeOverview.tsx`, `CCTransparencyIndex.tsx`
**Full spec:** `docs/strategy/personas/cc-member.md`

## Treasury Team -- builders seeking governance funding

**Experience:** Mutual benefit. Proposer reputation, pre-proposal validation, milestone tracking, citizen impact reports. Accountability as competitive advantage.
**Monetization:** Verified Project badge ($10-25/project).
**Key components:** `TreasuryAccountabilityPoll.tsx`, proposal workspace surfaces
**Full spec:** `docs/strategy/personas/treasury-team.md`

## Researcher -- governance scholars, analysts, data journalists

**Experience:** API-first data platform. Historical datasets, methodology docs, bulk exports, versioned data. Credibility flows back to all personas.
**Monetization:** Research API subscriptions ($50-200/mo).
**Key components:** `DeveloperPage.tsx`, `ApiExplorer.tsx`, `/api/v1/`
**Full spec:** `docs/strategy/personas/researcher.md`

## Integration Partner -- wallets, exchanges, pool tools (B2B)

**Experience:** Governance intelligence via API + embeddable widgets. Every integration extends Governada's reach.
**Monetization:** API tiers ($50-200/mo). Custom widget integrations.
**Priority:** Eternl -> Lace -> PoolTool -> Vespr -> CardanoScan -> ADApools -> Exchanges.
**Key components:** Embed routes (`/embed/*`), `/api/v1/`
**Full spec:** `docs/strategy/personas/integration-partner.md`

---

## Segment Fluidity

Users span multiple personas. Governada treats segments as additive facets of one identity (via `user_wallets` + segment detection). A DRep sees citizen experience PLUS governance workspace. Nobody loses the citizen layer.
