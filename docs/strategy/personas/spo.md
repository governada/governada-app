# Persona: The SPO (Stake Pool Operator)

> **Status:** Active -- defines the staking-governance bridge persona and second monetization target.
> **Created:** March 2026
> **Companion to:** `docs/strategy/ultimate-vision.md`, `personas/citizen.md`, `personas/drep.md`

---

## Who They Are

SPOs are the infrastructure operators who keep Cardano alive. They run the nodes that produce blocks, validate transactions, and secure the network. With the Voltaire era, they also became a formal governance body -- SPO votes carry weight in protocol parameter changes and hard fork decisions.

There are ~3,000 registered pools, but the population is stratified:

- **Professional operators:** Multiple pools, significant delegation, treating pool operation as a business. They compete aggressively for delegation and need every competitive edge.
- **Community operators:** Single pool, moderate delegation, driven by mission. Often also educators, content creators, and community organizers. They're the heart of Cardano's decentralization story.
- **Hobby/small operators:** Minimal delegation, running at a cost. They believe in decentralization and contribute even when it doesn't pay. Many are at risk of shutting down.

What they all share: **their #1 problem is attracting and retaining delegators.** Everything else is secondary to pool growth.

An SPO is a citizen first. They hold ADA, they have governance values, they may delegate to a DRep for the governance dimensions outside their SPO voting authority. Everything in the Citizen experience applies to them. The SPO layer adds professional tools for governance participation, pool identity, and delegator growth.

### The Business Reality

SPO revenue = margin percentage of pool staking rewards. A pool with 10M ADA delegated at ~3.5% annual rewards and 2% margin earns roughly 7,000 ADA/year. At typical prices, that's a few thousand dollars -- not life-changing for most operators. They do it because they believe in the mission.

Competition for delegation is fierce. Most pools look identical on existing tools -- same uptime, similar ROI, comparable fees. If your pool performs like 500 others, you're invisible.

---

## What They Want

### As citizens (inherited from Citizen persona)

- The epoch briefing, treasury transparency, civic identity, smart alerts
- Everything a citizen gets -- they're ADA holders with governance rights too

### As infrastructure operators with governance responsibility

- **Delegation growth:** The #1 need. Tools and reputation that help them attract and retain staking delegators.
- **Differentiation:** A way to stand out from 3,000 other pools beyond financial metrics that all look the same.
- **A governance reputation:** Proof that they participate, that they care, that choosing their pool means something beyond ROI.
- **Communication with delegators:** A direct channel to the people staking with them -- currently impossible outside fragmented social media.
- **Efficient governance participation:** Governance is an additional responsibility on top of infrastructure operation. It needs to be quick and low-friction.

### What would delight them

- Seeing their pool discovered by delegators specifically because of their governance participation
- A rich profile page they can share everywhere that tells their pool's story -- not just metrics
- Being able to vote, submit a governance rationale, and post a delegator update in 5 minutes total
- Data showing that governance participation actually drives delegation growth
- A communication channel where their staking delegators actually see their updates

---

## The SPO Experience

### Philosophy

Civica helps SPOs build a **complete identity that makes delegators choose them.** Governance participation is the differentiating layer -- the new competitive dimension that no pool comparison tool touches. But the identity extends beyond governance into who they are, what they stand for, and how they communicate with their community.

**Civica is NOT a second PoolTool.** It does not monitor infrastructure, track block production, calculate ROI projections, or manage pool configuration. PoolTool handles operations. Civica handles identity, reputation, governance, communication, and growth.

The citizen experience runs underneath. The SPO layer adds professional governance tooling, pool identity management, and delegator relations.

### The Governance Workspace

#### Governance Inbox

Like DReps, SPOs see what needs their governance attention:

- **Proposals requiring SPO votes:** Not all proposals involve SPOs. The inbox filters to governance actions where SPO votes carry weight (protocol parameters, hard forks), while surfacing other proposals for optional participation.
- **Urgency indicators:** What's expiring soon, what's new, what they've already voted on.
- **Citizen context:** How their staking delegators feel about active proposals (from Civica's citizen engagement layer).

**Design principle:** Governance should feel like a 10-minute weekly task, not a second job. The inbox makes that possible by surfacing exactly what matters and nothing else.

#### Vote Casting + Rationale Submission

The same integrated flow as DReps, adapted for SPOs:

- **Vote casting** directly from Civica via MeshJS (CIP-95). SPOs connect their pool governance key, review the proposal workspace, and vote.
- **Rationale authoring** with AI assistance. Even more valuable for SPOs than DReps because SPO governance rationales are extremely rare today. The friction of CIP-100 compliance is too high when governance is your secondary function.
- **Governance statement** setup: A guided, one-time flow for SPOs to publish their governance philosophy. "Tell your delegators what you stand for in governance." Very few SPOs have one because the tooling doesn't exist. Civica makes it a 5-minute setup.

**Why this matters for SPOs specifically:** SPO governance participation rates are lower than DRep participation because governance feels like an extra burden on top of infrastructure work. If Civica reduces the entire governance workflow to 10 minutes per epoch, participation rates rise. Every SPO who starts voting through Civica improves Cardano's overall governance health.

#### Proposal Workspace

The same analysis environment as DReps, with SPO-relevant context:

- AI-generated proposal summary
- Treasury impact analysis
- SPO-specific relevance: does this proposal affect protocol parameters, staking mechanics, or pool operations?
- Inter-body context: how are DReps and CC voting on this?
- Citizen sentiment from Civica's engagement layer
- Constitutional alignment analysis
- Vote + rationale submission integrated at the bottom

### Pool Identity (The Rich Profile)

This is where Civica goes beyond governance into the broader SPO identity. The pool profile on Civica should be the richest SPO presence on the internet -- the page SPOs share everywhere as their home page.

#### Who They Are

- Team members, mission statement, why they run a pool
- The human story behind the infrastructure
- Location, community involvement, contributions to the ecosystem
- Links to social channels, websites, other projects they're involved in

#### What They Stand For in Governance

- Governance philosophy and priorities (from the governance statement)
- Voting record with rationales
- Governance score with pillar breakdown (Participation, Consistency, Reliability, Governance Identity)
- 6D alignment visualization -- what values drive their governance decisions
- Score trajectory over time
- Inter-body alignment: how their votes compare to DRep consensus and CC positions

#### How They Perform

- Basic pool metrics: delegation size, fee structure, pledge, active status
- Enough for a delegator to confirm the pool is healthy
- NOT deep infrastructure analytics (defer to PoolTool for that)
- Link to PoolTool/ADApools for delegators who want deeper operational metrics

#### What Their Community Says

- Citizen endorsements: "342 citizens endorse this pool"
- Domain-specific trust: "Endorsed for governance" / "Endorsed for community contribution"
- Delegation trend: growing, stable, or declining

**The positioning:** PoolTool answers "is this pool technically reliable?" Civica answers "who are these people and do they share my values?"

### Delegator Communication Hub

SPOs currently have no native way to reach their staking delegators. If they need to announce maintenance, share a governance vote, or engage their community, they post on Twitter and hope someone sees it.

Civica solves this because citizens are already checking in every epoch:

#### Pool Updates

- Maintenance announcements: "Planned relay migration this weekend -- no rewards impact expected"
- Milestone celebrations: "We produced our 10,000th block this epoch"
- Community news: "We're sponsoring the Cardano Summit side event in Tokyo"
- General communication: a direct line to the people who chose their pool

#### Governance Communication

- Vote explanations: "Here's why we voted Yes on the protocol parameter change"
- Governance philosophy updates: "Our priorities for governance this quarter"
- Rationale highlights: automatically surfaced when the SPO votes and provides a rationale

#### How Citizens See It

- Updates appear in the citizen's epoch briefing: "Your pool operator posted an update"
- Vote explanations appear alongside "Your SPO voted Yes on Proposal X"
- Creates a two-way relationship: citizens feel connected to their pool operator, SPOs feel accountable to their delegators

### Delegation Growth Intelligence

This is where Civica directly addresses the SPO's #1 need: growing their pool.

#### The Governance-Growth Connection

- Empirical data: "Pools that participate in governance attract X% more delegation than pools that don't"
- Personal insight: "Your pool is ranked 145th by delegation but 23rd by governance score -- your governance reputation is an underutilized growth lever"
- Retention data: "Delegators who found your pool through Civica's governance-based discovery retained at 2x the rate"

#### Competitive Position

- Governance comparison with pools of similar size
- Financial + governance combined ranking: where they stand on the dimensions that matter
- What high-performing pools in their size tier do differently

#### Delegator Analytics

- Delegation trends: growing, stable, declining
- Who's arriving and who's leaving
- Where departing delegators go (which pools they move to)
- What those destination pools offer that this pool doesn't

#### Staking Delegator Education

- Ready-made content SPOs can share with their delegators about governance participation
- "Help your delegators understand governance" -- encouraging DRep delegation through the trusted SPO relationship
- SPOs become a channel for citizen onboarding: staking delegators who don't yet have DRep delegation get prompted through their SPO

---

## The Flywheel

The self-reinforcing loop that benefits SPOs, citizens, and Cardano governance:

1. SPO participates in governance (votes through Civica)
2. They score higher on Civica's SPO governance score
3. They rank better in governance-based pool discovery
4. Governance-conscious delegators find and stake with them
5. Their delegation grows
6. More delegation = more incentive to keep participating in governance
7. Other SPOs see governance participation driving growth and start participating
8. Overall SPO governance participation increases
9. Cardano's governance health improves (stronger inter-body representation)
10. Citizens get richer SPO governance data in their briefings
11. More citizens choose pools through governance-based discovery
12. Return to step 4

Civica doesn't just serve SPOs -- it creates market pressure for governance participation across the entire SPO ecosystem.

---

## Free vs. Pro

### Free (Essential Governance + Basic Identity)

Everything an SPO needs to participate in governance and establish their identity:

- **Vote casting** from within Civica
- **Rationale submission** (editor, CIP-100 formatting, hosting, bundled submission)
- **Governance statement** setup (guided flow, one-time)
- **Proposal workspace** (full analysis for proposals relevant to SPOs)
- **Pool profile** (basic -- mission, team, governance data, score, voting record)
- **Basic delegation stats** (total delegation, trend direction)
- **Delegator communication** (announcements, vote explanations, governance updates)
- **The full citizen experience** (briefing, treasury, civic identity, engagement)
- **Governance score visibility** (score, pillar breakdown, basic trend)

### Pro (Growth + Competitive Edge)

Tools for SPOs who want to actively grow their delegation and build their brand:

- **Rich pool profile** -- full marketing page with custom branding, featured content, expanded team bios, media gallery
- **Delegation analytics** -- detailed growth trends, churn analysis, delegator sources, arrival/departure patterns, retention metrics
- **Competitive intelligence** -- peer comparison across governance and financial metrics, pool tier analysis, growth benchmarking
- **Growth coaching** -- AI-generated suggestions: "Pools in your tier that publish governance rationales see 20% more delegation growth"
- **AI governance statement drafting** -- AI writes the first draft from their voting history and stated values
- **Advanced communication tools** -- scheduled updates, delegator segmentation, engagement analytics on published content
- **Campaign tools** -- enhanced shareable cards, embeddable governance widgets, social media assets, custom branding
- **Custom alerts** -- delegation movements, competitive shifts, governance opportunities, score threshold notifications
- **Score simulator** -- "If you vote on every proposal this epoch and provide rationales, your governance score will reach X"

### Why This Split Works

The free tier is generous because SPO adoption drives the flywheel:

- Every SPO voting through Civica generates governance data that enriches the intelligence engine
- Every governance statement published improves citizen pool discovery
- Every pool profile created makes Civica's SPO discovery more comprehensive
- The more SPOs participate, the more valuable governance-based pool discovery becomes for citizens

Pro monetizes the growth and competitive layer. SPOs who want to actively grow their delegation -- attract more stakers, outperform peers, build their brand -- will pay for the edge. The free tier makes them governance-active. Pro makes them strategically competitive.

---

## The Staking-Governance Bridge

SPOs occupy a unique position in the Civica ecosystem: they're the bridge between the familiar world of staking and the unfamiliar world of governance.

**For citizens:** SPO discovery is the comfortable entry point. "Find a stake pool" is something ADA holders already understand. Civica's twist -- "find a pool that represents your values in governance" -- reframes staking from a purely financial decision to a civic one. The SPO relationship becomes the gateway to governance engagement.

**For the ecosystem:** SPOs who communicate governance through their delegator channel become an organic onboarding funnel for DRep delegation. A staking delegator who sees their pool operator's governance updates thinks: "I should probably delegate my governance too." The SPO-citizen relationship seeds governance participation across the network.

**For Cardano's governance health:** SPO governance participation strengthens the inter-body balance. When SPOs vote actively, the three-body governance system (DReps + SPOs + CC) functions as designed. Civica's incentive to drive SPO participation through discovery and growth tools directly serves Cardano's constitutional design.

---

## How SPOs Connect to Other Personas

| Persona            | Relationship                                                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizens**       | Citizens stake with SPOs and discover pools through governance-based alignment. SPO communication reaches citizens through the epoch briefing. SPOs are often the first governance touchpoint for passive stakers.                                               |
| **DReps**          | SPOs and DReps are parallel governance bodies. Inter-body alignment analysis reveals where they agree and diverge. Some individuals are both SPOs and DReps (multi-wallet identity handles this). Healthy tension between the two bodies strengthens governance. |
| **CC Members**     | SPOs interact with CC on constitutional and protocol matters. SPO votes on hard fork proposals are particularly significant and visible.                                                                                                                         |
| **Treasury Teams** | SPOs vote on treasury proposals. Their collective voting patterns on spending shape treasury accountability. Some SPOs may also be treasury proposal teams (building tools for the ecosystem).                                                                   |
| **Researchers**    | SPO governance participation data is a key research subject: governance participation rates across the operator ecosystem, correlation between governance activity and pool performance, inter-body dynamics.                                                    |

---

## Scope Boundaries

**In scope (Civica's SPO offering):**

- Governance participation (voting, rationales, governance statements)
- Pool identity and reputation (profile, story, governance values)
- Delegator communication (updates, governance explanations, announcements)
- Governance-based pool discovery (the unique competitive dimension)
- Delegation growth intelligence (analytics, competitive position, coaching)
- Staking delegator education (governance onboarding through the SPO channel)

**Out of scope (defer to existing tools):**

- Infrastructure monitoring (block production, relay health, missed blocks)
- Detailed rewards calculations and ROI projections
- Pool configuration and operational management
- Node setup and maintenance guides
- Detailed financial analytics beyond basic delegation metrics

**The line:** Civica helps SPOs with identity, reputation, governance, communication, and growth. Not with operations. SPOs use PoolTool for infrastructure monitoring and Civica for everything people-facing.

---

## Metrics That Matter

| Metric                                     | What It Measures                 | Target                                                                           |
| ------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------- |
| **SPOs voting through Civica**             | Governance workspace adoption    | >15% of governance-active SPOs within 6 months                                   |
| **SPO governance participation rate**      | Is Civica driving participation? | Measurable increase in overall SPO vote rates                                    |
| **Governance statements published**        | Identity adoption                | >200 SPOs with published governance statements                                   |
| **Pool profiles created**                  | Platform as home page            | >500 SPOs with complete Civica profiles                                          |
| **SPO Pro conversion**                     | Monetization                     | 50-100 paying SPOs at $15-25/mo                                                  |
| **Delegator-SPO communication engagement** | Is the channel valuable?         | >40% of staking delegators view their SPO's updates                              |
| **Governance-based discovery conversions** | Is the differentiator working?   | Measurable delegation flow from Civica discovery to pools                        |
| **Staking delegator -> DRep delegation**   | Is the bridge working?           | SPO delegators who also delegate to a DRep at higher rates than non-Civica users |

---

## The One-Line Vision

**Civica is where SPOs build their governance reputation, communicate with their delegators, and grow their pool through the one competitive dimension nobody else measures.**

PoolTool tells delegators a pool is reliable. Civica tells them the pool operator shares their values. In a market where 500 pools have identical financial metrics, governance reputation becomes the differentiator -- and Civica is the only place it exists.
