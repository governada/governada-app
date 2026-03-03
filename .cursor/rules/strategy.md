---
description: Business strategy context for DRepScore — monetization, growth, and ecosystem vision
globs:
  - docs/strategy/**
  - tasks/**
alwaysApply: false
---

# Strategy Context

DRepScore has a comprehensive monetization and growth strategy documented in `docs/strategy/`.

## Foundational Document

`docs/strategy/monetization-strategy.md` is the north star for all business decisions. Reference it when making architectural choices that impact monetization, data collection, or platform growth.

## Key Strategic Principles

- **Free core, paid power tools** — Never gate basic governance accountability (discovery, scores, delegation, watchlist).
- **Data moat** — Historical score snapshots, voting patterns, and alignment data are the primary competitive advantage. Prioritize data collection and preservation.
- **DRep-side monetization** — DRep Pro tier is the primary near-term revenue stream. Build features that make DReps want to pay.
- **API-first for B2B** — Wallet integrations and third-party tools are the long-term revenue giant. Design data access patterns with API exposure in mind.
- **ADA-native payments** — When implementing payments, accept ADA directly.

## Active Strategy Tracks

- **Catalyst Proposal** — Preparing for Fund 16 (~mid-2026). See `docs/strategy/catalyst-proposal.md`.
- **DRep Pro Tier** — Premium features for DReps. See `docs/strategy/drep-pro-tier.md`.
- **Governance Data API** — Public API product. See `docs/strategy/api-product.md`.

## Product "Wow" Plan

`docs/strategy/product-wow-plan.md` is the comprehensive 7-session execution plan to transform DRepScore from a governance tool into the product that makes the crypto space say "wow." Reference it when making UX, feature, or architecture decisions.

## Architecture Implications

When building features, consider:

1. Will this data be valuable in the API product? If yes, ensure clean data modeling.
2. Does this feature belong in Free or Pro tier? Default to free unless it's clearly a power-user need.
3. Does this increase switching costs for DReps? Score history, claimed profiles, and engagement tools all increase lock-in.
4. Can this be packaged for the Catalyst proposal milestones?
5. Does this align with the "governance citizen" framing? (See product-wow-plan.md)
