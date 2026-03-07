# Persona: The DRep (Delegated Representative)

> **Status:** Active -- defines the primary supply-side persona and first monetization target.
> **Created:** March 2026
> **Companion to:** `docs/strategy/ultimate-vision.md`, `personas/citizen.md`

---

## Who They Are

DReps are Cardano citizens who have volunteered to actively participate in governance on behalf of others. They registered on-chain as Delegated Representatives, accepting the responsibility of reviewing proposals, casting votes, and (ideally) explaining their reasoning to the people who delegated to them.

They range from highly professional governance participants treating it as a career, to community members who registered out of passion, to institutional entities representing organizations. What they all share: they've chosen to be more than passive citizens. They accepted accountability.

**A DRep is a citizen first.** They hold ADA, they stake, they have their own governance values and delegation preferences (many delegate to themselves, some to other DReps). Everything in the Citizen experience applies to them -- the briefing, the civic identity, the treasury transparency, the engagement mechanisms. The DRep layer adds professional governance tooling on top of that foundation.

The analogy is a politician who is also a citizen. They vote in elections, they pay taxes, they use public services. But they also have a professional workspace for doing the work of governance. Civica serves both roles in one product.

### Current Population

~700 registered DReps as of early 2026, though the governance-active subset (regular voters with meaningful delegation) is smaller. This is the initial addressable market for DRep Pro.

---

## What They Want

### As citizens (inherited from Citizen persona)

- The epoch briefing, treasury transparency, civic identity, smart alerts
- Everything a citizen gets -- they're ADA holders with governance rights too

### As governance professionals

- **Reputation that compounds:** A score, a profile, a track record that reflects their actual governance behavior and grows more valuable over time
- **Efficiency:** Governance is time-consuming. They need to review proposals, analyze impact, cast votes, write rationales, track delegation, communicate with constituents -- ideally without 5 tabs open
- **Delegation growth:** More delegators = more governance power = more influence. They want tools to earn and retain delegation.
- **Accountability tools:** Ways to demonstrate transparency to their delegators and the broader community
- **Competitive awareness:** Where they stand relative to peers, what's working for other DReps, where they can improve

### What would delight them

- Casting a vote and submitting a CIP-100 rationale in the same flow, in under 2 minutes
- Opening Civica and seeing exactly what needs their attention, prioritized by urgency and impact
- Watching their governance score improve as they participate more effectively
- Getting a notification that says "15 new delegators this epoch -- here's why they chose you"
- An AI that drafts their rationale from the proposal text + their voting history + their governance philosophy

---

## The DRep Experience

### Philosophy

The DRep experience is a **professional governance workspace** -- Civica is to DReps what VS Code is to developers. They open it, see what needs attention, do the work, track their performance, and communicate with constituents. The intelligence layer (AI analysis, citizen sentiment, treasury context) makes them better at governance without requiring extra effort.

The citizen experience runs underneath. The DRep layer adds to it; it never replaces it.

### The Governance Workspace

#### Inbox / Action Queue (Primary Surface)

When a DRep opens Civica, they see what needs their attention, prioritized:

- **Urgent votes:** Proposals expiring soon that they haven't voted on
- **New proposals:** Recently submitted governance actions awaiting review
- **Citizen questions:** Aggregated questions from delegators about specific proposals or past votes
- **Delegation changes:** Notable shifts in their delegator base
- **Score alerts:** Changes to their governance score and what drove them

Each item connects directly to action. A proposal in the inbox opens the full proposal workspace. A citizen question links to the response interface. A score alert explains what to do about it.

**Design principle:** The inbox should answer "what should I do right now?" within 5 seconds of opening.

#### Proposal Workspace (Analysis -> Action)

The DRep's primary work surface. Everything they need to make an informed vote and explain it, on one page:

**Analysis layer:**

- AI-generated plain-English summary of the proposal
- Treasury impact: amount requested, percentage of treasury, spending category
- Similar past proposals and their outcomes (delivered, partial, failed)
- Citizen sentiment from Civica's engagement layer: support %, concern flags, priority alignment
- Citizen questions: "31 citizens want to know your position on this"
- Inter-body context: how SPOs and CC members are leaning
- Constitutional alignment: AI analysis of whether the proposal conflicts with the ratified constitution
- Proposal author track record: delivery history on past funded proposals
- Other DRep votes (after voting, to avoid anchoring bias -- or configurable)

**Action layer:**

- **Vote casting** directly from Civica. The DRep selects Yes / No / Abstain, the app constructs the governance transaction via MeshJS (CIP-95), the DRep signs with their governance wallet, and the vote is submitted on-chain.
- **Rationale authoring** integrated with the vote flow:
  - Rich-text editor for writing the rationale
  - AI-assisted drafting: generates a first draft from the proposal text, the DRep's voting history, and their stated governance philosophy
  - Auto-formats to CIP-100 compliant JSON behind the scenes
  - Hosts the rationale document (Supabase storage or IPFS)
  - Bundles the metadata anchor with the vote transaction -- one submission: vote + rationale together
  - The rationale automatically appears on the DRep's profile
- **Information requests** to proposal authors: structured asks for clarification, aggregated with other DRep requests ("4 DReps requested clarification on milestones"), proposal authors respond publicly

**Why this matters:** Today, voting and rationale submission are separate, tedious processes across multiple tools. Making them a single 2-minute flow inside the analysis workspace fundamentally changes DRep behavior. DReps who use Civica will provide more rationales, score higher, and attract more delegation. The tool makes them better at governance.

#### Reputation Dashboard

The DRep's view of their own governance reputation -- how the ecosystem sees them:

**Score and standing:**

- Current governance score with pillar breakdown (Engagement Quality, Effective Participation, Reliability, Governance Identity)
- Score trend over time (trajectory, momentum)
- Rank among active DReps
- Strengths and weaknesses: "Your participation rate is top 10%, but your rationale rate is below average"

**Delegation health:**

- Total delegators and voting power
- Delegation trend: growing, stable, or declining
- Recent delegation events: who arrived, who left (anonymized or by address)
- Citizen endorsements: how many, in which domains

**Profile as others see it:**

- Preview of their public DRep profile page
- What citizens see when evaluating them
- Governance philosophy, featured positions, voting record highlights

#### Delegator Communication Hub

Structured governance communication -- not a blog, not a forum:

**Vote explanations:**

- Every vote + rationale is automatically visible to delegators on the DRep's profile
- Civica surfaces these as "Your DRep voted Yes on Proposal X" in delegator briefings
- The rationale IS the communication -- Civica just makes it visible where it matters

**Position statements:**

- Structured declarations: "Here's where I stand on treasury spending / protocol changes / decentralization"
- Attached to their profile and governance philosophy
- Feed into the alignment engine: stated positions can be compared to actual voting behavior

**Epoch updates (optional):**

- A short, structured "letter to delegators" each epoch
- AI-assisted: "Based on your 4 votes this epoch, here's a draft update"
- Visible on their profile and in delegator briefings

**Citizen question responses:**

- Aggregated questions from the citizen engagement layer
- "47 citizens asked why you voted Yes on Proposal X"
- DRep responds once, publicly
- The response is attached to the relevant proposal and visible on the DRep's profile

**Governance philosophy:**

- A persistent profile section explaining who they are and what they represent
- Values, priorities, areas of expertise, governance approach
- Their "campaign page" -- the thing potential delegators read when deciding

#### Campaign and Growth Tools

For DReps seeking to grow their delegation:

- Shareable profile cards and governance summaries
- "Why delegate to me" highlight reel: best votes, impact, score trajectory
- Comparison highlights: "I voted on 95% of proposals vs. the average of 62%"
- Governance Wrapped moments: shareable epoch and annual summaries
- Embeddable governance card for personal websites, social media, forum signatures

---

## Free vs. Pro

The free tier gives DReps everything they need to govern effectively. Pro gives them the edge to grow their delegation and outperform peers.

### Free (Essential Governance Operations)

Everything a DRep needs to do their job:

- **Vote casting** from within Civica
- **Rationale authoring + submission** (editor, CIP-100 formatting, hosting, bundled submission)
- **Proposal workspace** (full analysis: AI summary, treasury impact, citizen sentiment, similar proposals, constitutional alignment)
- **Basic delegation stats** (total delegators, voting power, recent changes)
- **Profile management** (governance philosophy, position statements, basic bio)
- **Citizen question responses** (see and respond to aggregated questions)
- **Information requests to proposal authors**
- **The full citizen experience** (briefing, treasury, civic identity, engagement)
- **Score visibility** (their score, pillar breakdown, basic trend)

### Pro (Competitive Advantage + Growth)

Tools for DReps who want to actively grow their reputation and delegation:

- **AI rationale drafting assistant** -- AI writes the first draft from the proposal + the DRep's history + their governance philosophy. The DRep edits and submits. Dramatically faster than writing from scratch.
- **Delegation analytics** -- who arrived, who left, trends over time, delegator composition, voting power trajectory, churn analysis
- **Score simulator** -- "if you provide rationales for the next 5 proposals, your score will reach X." "If you vote on every proposal this epoch, your rank will move from 45th to 32nd."
- **Competitive intelligence** -- peer comparison, alignment neighborhood analysis, which DReps are gaining delegation and why, where they rank on specific dimensions
- **Advanced inbox prioritization** -- AI-ranked by impact on score, delegation risk, proposal importance, constitutional significance
- **Campaign tools** -- enhanced shareable cards, comparison highlights, embeddable widgets, custom branding
- **Delegator communication suite** -- AI-assisted epoch updates, position statement templates, enhanced delegator analytics
- **Custom alerts** -- score threshold alerts, delegation movement warnings, competitive shift notifications, proposal-type-specific alerts
- **Performance coaching** -- AI-generated suggestions: "DReps in your score range who provide rationales on treasury proposals see 15% more delegation growth"

### Why This Split Works

The free tier is generous because DRep usage IS the product:

- Every vote cast through Civica feeds the intelligence engine
- Every rationale submitted improves the citizen experience
- Every DRep managing their profile through Civica creates better data
- The more DReps use free Civica, the more valuable the platform is for everyone

Pro monetizes the competitive layer. DReps who want to _win_ -- attract more delegation, climb rankings, outperform peers -- will pay for the edge. The free tier makes them effective. Pro makes them strategic.

---

## How DReps Connect to Other Personas

| Persona            | Relationship                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizens**       | DReps serve citizens. Citizens delegate to them, endorse them, question them, and evaluate them. Every DRep action flows to citizen surfaces. The DRep's primary audience is their delegators.                      |
| **SPOs**           | DReps and SPOs are parallel governance bodies. Inter-body alignment between DRep votes and SPO votes is a key intelligence surface. Some individuals are both DReps and SPOs (multi-wallet identity handles this).  |
| **CC Members**     | DReps interact with CC on constitutional matters. CC ratification or rejection of proposals that DReps voted on creates inter-body dynamics. DReps may reference CC positions in their rationales.                  |
| **Treasury Teams** | DReps vote on treasury proposals. Their track record of approving projects that deliver (or don't) is part of their reputation. They ask proposal authors for clarification through the information request system. |
| **Researchers**    | DRep voting patterns, alignment shifts, and score trajectories are primary research subjects. Researcher analysis feeds back into the intelligence layer that DReps consume.                                        |

---

## The Rationale Revolution

The single most impactful thing Civica can do for DRep governance quality is make rationale submission effortless. Today:

- CIP-100 rationale submission requires manual JSON creation, self-hosting, and anchor hash submission
- Most DReps skip it because the friction is too high
- Citizens have no idea why their DRep voted the way they did
- Rationale quality is a major scoring factor, but the tooling punishes DReps for trying

If Civica reduces rationale submission to "write (or edit an AI draft) and click submit," the effects cascade:

- More rationales exist on-chain (better for the entire ecosystem)
- DReps who use Civica score higher (better for them)
- Citizens can see why their DRep voted a certain way (better citizen experience)
- The AI gets more training data for governance analysis (better intelligence)
- Governance transparency improves measurably (better for Cardano's reputation)

This is the feature that could make Civica indispensable for DReps overnight. It solves a real pain point that no other tool addresses, and the benefits compound across every persona.

---

## Technical Requirements

**Vote casting:**

- MeshJS governance transaction construction (CIP-95)
- Wallet connector supporting governance keys
- Transaction building, signing, and submission flow
- Vote confirmation and on-chain verification

**Rationale submission:**

- CIP-100 JSON schema generation from rich-text input
- Document hosting (Supabase Storage or IPFS pinning)
- Metadata anchor generation and bundling with vote transaction
- AI drafting endpoint (existing `/api/rationale/draft`, enhanced with DRep context)

**Proposal workspace:**

- Proposal data enrichment pipeline (AI summary, constitutional analysis, similar proposal matching)
- Citizen engagement data aggregation (sentiment, flags, questions per proposal)
- Inter-body vote aggregation

**Communication:**

- Citizen question aggregation and deduplication
- DRep response system (one response per question cluster, publicly visible)
- Information request system for proposal authors
- Position statement and epoch update authoring

---

## Metrics That Matter

| Metric                                 | What It Measures                      | Target                                                   |
| -------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| **DReps using Civica for voting**      | Workspace adoption                    | >30% of active DReps within 6 months                     |
| **Rationale submission rate**          | Did we solve the friction problem?    | 2x increase in rationale rate for Civica-using DReps     |
| **Time from proposal to vote**         | Workspace efficiency                  | Measurable reduction vs. multi-tool workflow             |
| **DRep Pro conversion**                | Monetization                          | 50-100 paying DReps at $15-25/mo                         |
| **DRep Pro retention**                 | Is Pro actually valuable?             | >80% monthly retention                                   |
| **Delegation growth for Civica DReps** | Does the platform help DReps succeed? | Civica-using DReps grow delegation faster than non-users |
| **Citizen question response rate**     | Is the accountability loop working?   | >50% of aggregated questions get DRep responses          |

---

## The One-Line Vision

**Civica is where DReps do governance -- review proposals, cast votes, explain their reasoning, and build their reputation, all in one place.**

The intelligence layer makes them better at governance. The citizen engagement layer keeps them accountable. The reputation system rewards quality participation. And underneath it all, they're citizens too -- receiving the same briefing, building the same civic identity, participating in the same community as the people they represent.
