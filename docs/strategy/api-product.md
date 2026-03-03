# Governance Data API — Product Spec & Go-to-Market

> **Status:** Planned
> **Parent:** [monetization-strategy.md](monetization-strategy.md) — Section 2 (B2B / API Revenue)
> **Last updated:** February 2026

## Overview

Public API packaging DRepScore's governance data (scores, voting history, alignment, proposals) for wallet providers, exchanges, and third-party tools.

## Open Questions

- [ ] Which wallet teams are most likely early adopters? (Lace, Eternl, Vespr?)
- [ ] REST vs GraphQL vs both?
- [ ] Rate limiting tiers and pricing structure?
- [ ] What data do wallet providers actually need for governance UX?
- [ ] Embeddable widget vs API-only vs both?

## Target Customers

1. Wallet providers (Lace, Eternl, Typhon, Vespr)
2. Staking platforms and exchanges
3. Governance analytics tools
4. Academic researchers

## API Surface

_To be designed — initial endpoint candidates:_

- `/dreps` — list with scores, filtering, sorting
- `/dreps/:id` — full profile with score breakdown
- `/dreps/:id/votes` — voting history
- `/proposals` — governance proposals with vote summaries
- `/alignment` — value alignment scoring

## Pricing Tiers

_To be validated._

## Next Actions

1. Survey wallet providers on governance data needs
2. Design API spec (OpenAPI)
3. Build rate-limited public beta
