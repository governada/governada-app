# Persona: The Governance Researcher

> **Status:** Active -- defines the data consumer persona and research API monetization target.
> **Created:** March 2026
> **Companion to:** `docs/strategy/ultimate-vision.md`, `personas/citizen.md`

---

## Who They Are

Governance Researchers are the people who study, analyze, and publish findings about Cardano's governance system. They don't participate in governance directly -- they study the system itself. Their work validates, critiques, and advances understanding of how decentralized governance functions.

They span several sub-segments:

- **Academic researchers:** Political scientists, institutional economists, blockchain governance scholars. They publish papers, present at conferences, and contribute to the theoretical foundation of decentralized governance. They need citation-ready data with transparent methodology.
- **Professional analysts:** Governance consultants, institutional advisory firms, research divisions of crypto funds. They produce reports for clients making delegation or investment decisions. They need reliable, structured data at scale.
- **Data journalists:** Writers covering Cardano governance for media outlets, newsletters, or community publications. They need accessible data that tells stories and supports narrative.
- **Independent community researchers:** Cardano community members who dig into governance data out of curiosity or civic interest. They bridge the researcher and citizen personas -- they consume data like researchers but are motivated like citizens.

### What Makes This Persona Different

Researchers are the only persona that doesn't directly interact with the governance system through Civica. They don't vote, delegate, submit proposals, or manage reputation. They observe, analyze, and publish. Their relationship with the platform is extractive in the best sense: they take data out and return credibility and insight.

When an academic paper cites Civica's DRep scoring methodology or a governance report uses Civica's historical alignment data, it legitimizes the entire platform. That credibility flows to every other persona -- citizens trust the scores because researchers validated them, DReps respect the methodology because it withstands academic scrutiny.

---

## What They Want

- **Data access:** Comprehensive, well-structured governance data through APIs and exports. Not consumer-friendly summaries -- raw and semi-processed data they can analyze with their own tools.
- **Historical depth:** Time-series data spanning many epochs. Snapshots of scores, alignment, GHI, EDI, delegation, treasury flows. The longer the history, the richer the research.
- **Methodology transparency:** Published scoring models, alignment algorithms, GHI components. They need to understand how derived metrics are calculated to cite them responsibly.
- **Exportability:** CSV, JSON, bulk downloads. Data in formats their tools can ingest -- R, Python, Stata, Excel.
- **Versioned datasets:** When methodology changes, the ability to access data under both old and new models. Research reproducibility requires stable datasets.
- **Cross-sectional queries:** Ability to query across entities, time periods, and dimensions. "All DRep alignment shifts between epochs 480-520" or "treasury proposal outcomes by category and budget tier."

### What would delight them

- A single API call that returns a DRep's complete governance history: scores, alignment, votes, delegation, rationales -- across every epoch since registration
- Bulk export of the entire alignment dataset with PCA coordinates, ready for statistical analysis
- Published methodology docs that are rigorous enough to cite in an academic paper
- Historical EDI metrics for cross-chain governance comparison research
- A dataset versioning system: "Download the Q1 2026 governance dataset, frozen at methodology v3.2"

---

## The Researcher Experience

### Philosophy

Researchers don't need a consumer product. They need a **data platform with excellent documentation.** The experience is API-first, documentation-heavy, and optimized for programmatic access rather than visual interaction.

The consumer surfaces (DRep profiles, proposal pages, Pulse) serve as visual references for the data they access programmatically. But the primary interface is the API, the docs, and the export tools.

### Data Access Tiers

#### Free Tier (Discovery + Basic Research)

- Public API access: 100 requests/day
- Current-state endpoints: DRep scores, alignment, basic proposal data, GHI
- Documentation and methodology papers
- Enough to evaluate the data quality and decide if deeper access is worth paying for

#### Basic Research ($50/mo)

- 10,000 requests/day
- Historical endpoints: score snapshots, alignment trajectories, GHI/EDI time series
- Bulk data exports: CSV/JSON for major datasets
- Custom date range queries
- Standard support

#### Pro Research ($200/mo)

- 100,000 requests/day
- Full historical depth: every snapshot, every epoch, every entity
- Cross-sectional query API: complex queries across entities and time periods
- Versioned datasets with methodology documentation
- Priority support
- Early access to new data sources and methodology changes

#### Enterprise / Academic (Custom pricing)

- Unlimited access
- Custom dataset preparation
- Dedicated support
- Co-research opportunities
- Academic pricing available ($50-100/mo for verified academic institutions)

### API Surface

The research API exposes the full depth of Civica's intelligence engine:

**Entity data:**

- `/v2/dreps/:id` -- full DRep profile with current scores, alignment, metadata
- `/v2/dreps/:id/history` -- score and alignment snapshots across all epochs
- `/v2/dreps/:id/votes` -- complete voting record with rationales
- `/v2/dreps/:id/delegation` -- delegation history and trends
- `/v2/pools/:id` -- SPO governance profile, score, alignment
- `/v2/pools/:id/history` -- SPO score and alignment snapshots
- `/v2/pools/:id/votes` -- SPO voting record
- `/v2/committee/:id` -- CC member profile and transparency index
- `/v2/committee/:id/votes` -- CC voting record

**Governance system data:**

- `/v2/governance/health` -- GHI with all components and EDI breakdown
- `/v2/governance/health/history` -- GHI and EDI time series
- `/v2/governance/decentralization` -- 7 EDI metrics, current and historical
- `/v2/governance/inter-body` -- tri-body alignment analysis
- `/v2/governance/trends` -- proposal trends, participation trends, category analysis

**Proposal data:**

- `/v2/proposals` -- all proposals with metadata, classification, status
- `/v2/proposals/:id/votes` -- complete vote breakdown by body (DRep, SPO, CC)
- `/v2/proposals/:id/inter-body` -- inter-body alignment on specific proposals
- `/v2/proposals/:id/similar` -- semantically similar proposals
- `/v2/proposals/:id/sentiment` -- citizen sentiment data (aggregated, anonymized)

**Treasury data:**

- `/v2/treasury/balance` -- treasury balance history
- `/v2/treasury/spending` -- spending by category, time period, outcome
- `/v2/treasury/projects` -- funded projects with delivery scores and citizen impact
- `/v2/treasury/effectiveness` -- ROI analysis by category and time period

**Matching and alignment:**

- `/v2/alignment/dimensions` -- the 6D alignment framework definition and methodology
- `/v2/alignment/pca` -- PCA coordinates for all scored entities
- `/v2/alignment/clusters` -- governance faction detection and cluster analysis

**Bulk exports:**

- `/v2/export/dreps` -- all DRep data, filterable by date range
- `/v2/export/proposals` -- all proposal data with outcomes
- `/v2/export/votes` -- complete voting record across all bodies
- `/v2/export/snapshots` -- all snapshot tables, versioned

### Documentation

Research-grade documentation is essential:

- **Methodology papers:** Published scoring models for DRep Score, SPO Score, GHI, EDI, CC Transparency Index. Rigorous enough to cite in academic work.
- **Data dictionaries:** Every field in every API response documented with type, source, calculation method, and update frequency.
- **Changelog:** Every methodology change documented with rationale, date, and impact on historical data.
- **Dataset versioning guide:** How to access data under specific methodology versions for reproducibility.
- **OpenAPI spec:** Machine-readable API specification for SDK generation and tooling integration.

### The Feedback Loop

Researchers generate intelligence that flows back to other personas:

- Published analyses of DRep voting patterns become content for citizen briefings
- Academic validation of scoring methodology builds trust across all personas
- Treasury effectiveness research informs DRep voting strategy and citizen confidence
- Cross-chain governance comparisons (using EDI data) attract attention from outside Cardano
- Identified anomalies or governance risks surface as intelligence for the platform

Civica can amplify this: feature notable research on the Pulse page, cite academic papers in methodology documentation, reference published findings in AI-generated narratives.

---

## How Researchers Connect to Other Personas

| Persona                   | Relationship                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizens**              | Research findings inform the intelligence layer that citizens consume. Academic validation builds citizen trust in scores and recommendations.                  |
| **DReps**                 | Research on voting patterns, score dynamics, and governance effectiveness gives DReps strategic context. Published methodology keeps DReps honest about gaming. |
| **SPOs**                  | Research on SPO governance participation rates and impact validates the governance-growth connection.                                                           |
| **CC Members**            | CC dynamics research (independence metrics, constitutional interpretation patterns) feeds the accountability surface.                                           |
| **Treasury Teams**        | Treasury effectiveness research helps teams understand what works and informs DRep voting.                                                                      |
| **Cross-Chain Observers** | Researchers are often the same people producing cross-chain governance comparisons. Their work feeds the Observatory.                                           |

---

## Metrics That Matter

| Metric                          | What It Measures            | Target                                                       |
| ------------------------------- | --------------------------- | ------------------------------------------------------------ |
| **API registrations**           | Interest in governance data | Growing developer/researcher signups                         |
| **Paid research subscriptions** | Monetization                | 5-10 paying subscribers at $50-200/mo                        |
| **Academic citations**          | Credibility impact          | Civica data cited in governance research papers              |
| **API usage patterns**          | What data is valuable?      | Identifies which datasets to expand or prioritize            |
| **Export downloads**            | Bulk data demand            | Steady usage of export endpoints                             |
| **Research feedback**           | Methodology improvement     | Researcher reports that lead to scoring or data improvements |

---

## The One-Line Vision

**Civica provides the most comprehensive, well-documented governance dataset in blockchain -- the canonical source for anyone studying how decentralized governance works.**

Researchers don't need a pretty interface. They need deep data, transparent methodology, and reliable access. Every paper published using Civica's data validates the platform for every other persona. The data moat that compounds daily is the same moat that makes this dataset irreplaceable for research.
