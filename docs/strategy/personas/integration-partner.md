# Persona: The Integration Partner

> **Status:** Active -- defines the B2B persona, API monetization target, and ecosystem distribution channel.
> **Created:** March 2026
> **Companion to:** `docs/strategy/ultimate-vision.md`, `personas/citizen.md`

---

## Who They Are

Integration Partners are the businesses, platforms, and projects that serve Cardano users and need governance intelligence they don't want to build themselves. They embed Civica's data, scores, and experiences into their own products -- extending Civica's reach to users who may never visit the site directly.

### Partner Types

**Wallet Providers** (Eternl, Lace, Vespr, Typhon)

- The highest-value integration target. Wallets are where delegation actually happens.
- Need: DRep scores, matching API, SPO governance scores, delegation health indicators, embeddable Quick Match widget.
- What they don't want to build: scoring engines, alignment models, matching algorithms, proposal intelligence.
- Impact: Every wallet embedding Civica's intelligence is distribution to every wallet user.

**Crypto Exchanges** (Binance, Coinbase, Kraken)

- Custody billions in ADA. Face growing pressure (regulatory and competitive) to participate in governance on behalf of users or enable user participation.
- Need: governance data for informed delegation decisions, DRep/SPO scoring for user-facing displays, governance health dashboards for compliance reporting.
- Emerging use case: "Your ADA on Coinbase is delegated to DRep X, who scored 85 on Civica" -- making custodied governance transparent.

**Stake Pool Comparison Tools** (PoolTool, ADApools)

- Deep infrastructure metrics but zero governance data. Civica's SPO governance scores are a completely new dimension for pool comparison.
- Need: SPO governance scores, alignment data, governance participation rates.
- Low-friction integration: adding a "Governance Score" column to existing pool listings.

**DeFi Protocols** (SundaeSwap, Minswap, Liqwid)

- Hold ADA in liquidity pools with governance exposure. Some received treasury funding.
- Need: governance context for protocol operations, treasury tracking for funded protocols, governance data for users.
- Longer-term: "Your LP position includes ADA governed by DRep X" -- governance transparency for DeFi users.

**Block Explorers** (CardanoScan, Cexplorer)

- Show raw governance transactions but no intelligence. A vote is data; Civica makes it meaning.
- Need: DRep profiles, scores, and analysis to embed alongside existing governance data views.

**Governance Tools** (GovTool, Summon)

- Handle voting mechanics but lack the intelligence layer.
- Need: proposal analysis, DRep context, citizen sentiment, constitutional alignment analysis.
- Partially competitive (Civica builds its own vote-casting flow), but the intelligence layer is complementary.

**Institutional Delegators and Funds**

- Large ADA holders making strategic delegation decisions worth millions.
- Need: deep analytics, custom reporting, portfolio governance analysis, risk assessment.
- Higher price point, custom engagement model.

---

## What They Want

### All partners share

- **Reliable data:** Governance intelligence they can depend on without building the engine themselves
- **Simple integration:** Well-documented APIs, SDKs, and widgets that work out of the box
- **Stable APIs:** Versioned endpoints with migration paths, not surprise breaking changes
- **Brand trust:** Association with the canonical source of governance intelligence in Cardano

### By integration depth

- **API consumers:** Clean REST endpoints, good rate limits, comprehensive documentation
- **Widget embedders:** Pre-built UI components that match their product's look and feel
- **Deep integrators:** Custom data feeds, co-branded experiences, shared user flows, dedicated support

---

## Why This Persona Is Strategic

### 1. Distribution Without Acquisition Cost

Every wallet embedding Civica's DRep score is marketing to every wallet user. Every pool tool showing governance scores introduces governance reputation to staking delegators. Every exchange displaying governance health makes custodied ADA holders aware of governance. Civica doesn't need to acquire those users -- the partners already have them.

This is potentially the most efficient growth channel in the entire product strategy.

### 2. Data Network Effects

Integrations create feedback loops:

- A wallet using Civica's matching API generates delegation data (which recommendations led to delegations)
- An exchange providing governance reporting validates data quality at institutional scale
- Pool tools linking to Civica profiles drive traffic that generates engagement data
- More integrations produce more data, which improves the intelligence, which makes integrations more valuable

### 3. Revenue at Scale

Individual consumers pay $15-25/mo. Integration partners pay $50-200/mo for API access, with enterprise tiers going much higher. Per-customer revenue is 10-100x the consumer tier, with lower support overhead.

### 4. Ecosystem Lock-In

When a wallet's delegation picker depends on Civica's scoring API, switching costs are high. When a pool tool displays Civica's governance scores, removing them means removing a feature their users value. Each integration deepens Civica's position as infrastructure.

---

## Integration Models

### Tier 1: API Consumers (Data In, Data Out)

Partners pull governance intelligence via REST API. Lowest integration effort, broadest applicability.

**Available data:**

- DRep scores, alignment, voting records, delegation stats
- SPO governance scores, participation rates, alignment data
- Proposal metadata, classification, status, vote breakdowns
- GHI, EDI, inter-body alignment, governance health metrics
- Treasury data: spending, project outcomes, effectiveness metrics
- Matching API: submit user governance preferences, get ranked DRep/SPO recommendations

**Pricing tiers:**

| Tier       | Rate Limit      | Price   | Target                                 |
| ---------- | --------------- | ------- | -------------------------------------- |
| Free       | 100 req/day     | $0      | Evaluation and hobby projects          |
| Basic      | 10,000 req/day  | $50/mo  | Small integrations, community tools    |
| Pro        | 100,000 req/day | $200/mo | Production integrations, exchanges     |
| Enterprise | Custom          | Custom  | Institutional, high-volume, SLA-backed |

**Requirements:** API key registration. "Powered by Civica" attribution encouraged but not required at this tier.

### Tier 2: Widget Embedders (UI Components)

Partners embed pre-built Civica UI components directly in their products. Moderate integration effort, higher value.

**Available widgets:**

- **Quick Match widget:** The 3-question matching flow, embeddable in any web product. User completes the quiz inside the partner's UI, gets DRep/SPO recommendations, can delegate without leaving the partner's product.
- **DRep Score card:** Compact score display with governance radar, embeddable alongside DRep listings.
- **SPO Governance badge:** Governance score and participation indicator for pool comparison surfaces.
- **Governance Health gauge:** GHI visualization for dashboards and landing pages.
- **Delegation Health indicator:** Green/yellow/red delegation status for wallet dashboards.

**Customization:** Widgets support theming to match the partner's UI. Colors, typography, and layout adapt to the embedding context.

**Pricing:** Premium tier pricing or revenue share model. Negotiated per partner.

**Requirements:** "Powered by Civica" attribution required. Links back to full profiles on Civica.

### Tier 3: Deep Integrations (Strategic Partnerships)

Custom, co-developed experiences for high-value partners. Highest integration effort, highest value for both parties.

**Examples:**

- Eternl embeds Civica's full delegation flow: quiz, match, compare, delegate -- all inside the wallet
- Coinbase integrates governance reporting: custodied ADA governance transparency powered by Civica
- PoolTool co-brands governance metrics: "Governance data by Civica" as a first-class section in pool profiles

**What Civica provides:**

- Custom data feeds optimized for the partner's use case
- Co-branded UI components
- Shared user flows (e.g., wallet connect -> Civica quiz -> delegation -> back to wallet)
- Dedicated integration support and developer relations
- Custom pricing, potentially including revenue share

**What partners provide:**

- Distribution to their user base
- Data feedback (anonymized usage data that improves Civica's intelligence)
- Brand amplification and co-marketing
- Real-world validation of Civica's data quality at scale

---

## The "Powered by Civica" Brand Strategy

Every integration is a brand touchpoint. The strategy:

- **API consumers:** Attribution encouraged. "Governance data from Civica" link in footnotes or tooltips.
- **Widget embedders:** Attribution required. "Powered by Civica" with link. The widget itself is a brand impression.
- **Deep integrations:** Co-branding negotiated per partnership. "Governance intelligence by Civica" or equivalent.

**The flywheel:** More integrations -> more brand recognition -> more direct users -> more data -> better intelligence -> more integration value -> more integrations.

**The end state:** "Civica" becomes synonymous with Cardano governance intelligence the way "Powered by Google" became synonymous with search or "Charts by TradingView" became synonymous with financial data. Not everyone visits Civica directly, but everyone encounters Civica's intelligence through the products they already use.

---

## What Partners Need From Civica

### Technical Requirements

- **Reliability:** SLA guarantees for paid tiers. If a wallet's delegation picker depends on the API, downtime is unacceptable.
- **Documentation:** OpenAPI spec, SDKs (TypeScript, Python at minimum), integration guides, example implementations, interactive API explorer.
- **Sandbox:** Test environment with realistic sample data for development and testing.
- **Versioning:** Semantic versioning with deprecation notices. At least 6 months migration window for breaking changes.
- **Webhooks:** Event-driven notifications for partners who need real-time updates (new proposals, score changes, delegation events).

### Business Requirements

- **Developer relations:** Dedicated support for integration partners. Not a support ticket queue -- a relationship.
- **Attribution guidelines:** Clear branding specs that work across partner UIs. Logo assets, placement guidelines, color variations.
- **Usage analytics:** Partners want to know how their users interact with Civica's data. Aggregate metrics, not individual tracking.
- **Roadmap visibility:** Partners building on Civica's API need confidence that the data they depend on will continue to exist and improve.

---

## How Integration Partners Connect to Other Personas

| Persona            | How Partners Serve Them                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Citizens**       | Every integration ultimately serves citizens. A wallet embedding Quick Match means more citizens find aligned DReps. A pool tool showing governance scores means governance-informed staking decisions. An exchange displaying governance health means custodied holders see governance. Partners are Civica's distribution channel to citizens. |
| **DReps**          | Wallet integrations surface DRep scores and profiles to potential delegators inside the tools where delegation happens. This drives delegation to high-scoring DReps.                                                                                                                                                                            |
| **SPOs**           | Pool comparison tools embedding governance scores create market pressure for SPO governance participation. SPOs who participate are visible; those who don't are invisible on a new competitive dimension.                                                                                                                                       |
| **Treasury Teams** | Explorer integrations that show Civica's proposal intelligence and project tracking extend treasury transparency beyond Civica's direct user base.                                                                                                                                                                                               |
| **Researchers**    | Researchers and integration partners share the API surface. Researcher needs drive API depth; partner needs drive API reliability. Both benefit from the same infrastructure investment.                                                                                                                                                         |

---

## Integration Priority (By Likelihood and Impact)

1. **Eternl** -- Most governance-forward wallet. Natural first deep integration. Highest citizen reach for governance features.
2. **Lace** -- IOG's wallet. Strategic alignment with Cardano's governance vision. Institutional credibility.
3. **PoolTool** -- Dominant pool comparison tool. SPO governance scores as a new dimension would be immediately valuable and high-visibility.
4. **Vespr** -- Growing mobile wallet. Mobile-first governance experience via widget embedding.
5. **CardanoScan** -- Most-used block explorer. Intelligence layer on top of raw governance data.
6. **ADApools** -- Second pool comparison target after PoolTool.
7. **Exchanges** -- Longer sales cycle, higher value. Start conversations early, expect integration in 6-12 months.
8. **DeFi protocols** -- Emerging need. Position for when DeFi governance integration matures.

---

## Metrics That Matter

| Metric                                   | What It Measures           | Target                                                            |
| ---------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| **Active API keys**                      | Developer adoption         | 20+ registered, 5-10 active integrations                          |
| **API request volume**                   | Usage depth                | Growing monthly request volume                                    |
| **Paid API subscriptions**               | Monetization               | $1,500-4,000/mo from 5-10 partners                                |
| **Widget deployments**                   | Embedded distribution      | Quick Match or score cards in 3+ wallets/tools                    |
| **Delegations via partner integrations** | Distribution effectiveness | Measurable delegation flow from embedded Quick Match              |
| **"Powered by Civica" impressions**      | Brand reach                | Civica attribution visible to 100K+ monthly users across partners |
| **Partner retention**                    | Integration stickiness     | >90% annual retention of paying partners                          |

---

## The One-Line Vision

**Civica becomes the governance intelligence engine underneath every Cardano product -- wallets, exchanges, explorers, and pool tools all surface Civica's data because building it themselves would take years and never catch up.**

Not every Cardano user will visit Civica. But every Cardano user will encounter Civica's intelligence through the products they already use. The API and widget ecosystem turns Civica from a destination into infrastructure -- the canonical source of governance truth for the entire ecosystem.
