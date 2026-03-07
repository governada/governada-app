# Persona: The Constitutional Committee Member

> **Status:** Active -- defines the highest-authority governance persona, primarily an accountability surface.
> **Created:** March 2026
> **Companion to:** `docs/strategy/ultimate-vision.md`, `personas/citizen.md`, `personas/drep.md`, `personas/spo.md`

---

## Who They Are

Constitutional Committee members are the smallest and most powerful governance body in Cardano. A group of ~7-10 individuals or entities elected to serve as constitutional guardians -- they review governance actions for constitutionality and can ratify or reject proposals independent of DRep and SPO votes.

Their role is unique in Cardano's governance:

- **They don't represent delegators.** Unlike DReps, CC members aren't accountable to a constituency. They're accountable to the constitution.
- **Their votes carry disproportionate weight.** A CC rejection can block a governance action that DReps and SPOs overwhelmingly support, if it violates the constitution.
- **They interpret foundational law.** Their judgment calls on constitutionality set precedent for future governance.
- **They serve fixed terms.** CC members rotate, creating natural accountability cycles.

CC members are citizens first. They hold ADA, they stake, they have personal governance values. Some may also be DReps or SPOs. The multi-wallet identity model handles overlapping roles. But their CC function is distinct: constitutional interpretation, not representation.

### Why This Persona Is Different

With only 7-10 members, the CC is not a growth market. Civica will never have 50 paying CC Pro subscribers. The value of serving this persona flows in the opposite direction: **CC transparency is enormously valuable to every other persona.**

- Citizens want to know: are the constitutional guardians acting in good faith?
- DReps want to know: will the CC ratify the proposal I'm voting on?
- SPOs want to know: how does the CC's constitutional interpretation affect protocol parameters?
- Researchers want to know: how does the CC's voting pattern evolve over time?

The CC persona is primarily an **accountability surface** -- a public transparency layer that serves the entire ecosystem. Secondarily, Civica can offer CC members lightweight governance tooling if they choose to use it.

---

## What They Want

### As citizens (inherited from Citizen persona)

- The epoch briefing, treasury transparency, civic identity, smart alerts
- Everything a citizen gets -- they're ADA holders too

### As constitutional guardians

- **Clarity on their role:** Tools that help them review proposals against the constitution efficiently
- **Transparency mechanisms:** Ways to demonstrate that their decisions are principled, not political
- **Public record:** A clear, accessible record of their votes and reasoning that builds institutional trust
- **Communication with the community:** Ways to explain constitutional interpretations without becoming politicians

### What the ecosystem wants from them

- **Voting transparency:** How did each CC member vote on every governance action?
- **Rationale transparency:** Why did they vote that way? What constitutional reasoning applies?
- **Alignment visibility:** Do CC members vote as a bloc, or do they exercise independent judgment?
- **Accountability metrics:** Are they participating? Are they providing rationales? Are they responsive?
- **Community alignment:** How do CC decisions align with citizen sentiment, DRep votes, and SPO votes?

---

## The CC Experience

### Philosophy

The CC member experience on Civica is **80% public accountability surface, 20% lightweight governance tooling.** The primary audience for CC features is not the CC members themselves -- it's everyone else who needs to understand and trust what the CC is doing.

If CC members choose to use Civica for their governance workflow, the same vote-casting and rationale tools available to DReps and SPOs are available to them. But the product doesn't depend on CC member adoption to deliver value. The accountability surface works regardless, built from on-chain data.

### The Public Accountability Surface

#### Committee Overview Page

A dedicated page showing the current state of the Constitutional Committee:

- **Current members:** Who they are, when their term started, when it expires
- **Participation rates:** Individual and aggregate -- are they doing the job?
- **Voting record:** Every CC vote on every governance action, with rationales where provided
- **CC Transparency Index:** A composite score measuring participation, rationale provision, responsiveness, and alignment with community sentiment
- **Aggregate voting patterns:** Do they vote as a bloc? How often do they disagree? On what types of proposals?

#### Individual CC Member Profiles

Each CC member gets a profile that serves as their public accountability record:

- **Transparency Index score** with component breakdown
- **Complete voting record** with rationales where available
- **Voting alignment:** How often they agree with other CC members, with DRep consensus, with SPO consensus, with citizen sentiment
- **Constitutional reasoning patterns:** What constitutional provisions they cite, how they interpret key clauses
- **Term information:** When they joined, when their term expires, re-election status
- **Participation metrics:** Vote rate, rationale rate, responsiveness to governance actions

#### Inter-Body Dynamics

The CC's relationship to the other governance bodies is a key intelligence surface:

- **CC vs. DRep alignment:** On which proposals do they agree? Where do they diverge? When the CC rejects something DReps overwhelmingly supported, what was the constitutional reasoning?
- **CC vs. SPO alignment:** Same analysis for the SPO governance body
- **CC vs. Citizen sentiment:** How do CC decisions align with what Civica's citizen engagement layer reveals about community preferences?
- **Constitutional friction points:** Proposals where the CC's constitutional interpretation diverged from community consensus -- these are the governance moments that matter most and deserve the most visibility

#### Historical Record

Because CC members serve terms and rotate, the historical record is uniquely important:

- **Term comparisons:** How does the current CC's participation compare to previous compositions?
- **Precedent tracking:** When the CC rejects a proposal on constitutional grounds, that reasoning becomes precedent. Track and surface these.
- **Transparency trajectory:** Is the CC becoming more or less transparent over time?
- **Constitutional interpretation evolution:** How has the CC's reading of key constitutional provisions changed across terms and compositions?

### Lightweight Governance Tooling (Optional)

If CC members choose to use Civica, they get the same core governance tools as DReps and SPOs:

- **Vote casting** via MeshJS (CIP-95) -- same integrated flow
- **Rationale authoring** with CIP-100 compliance -- particularly valuable for CC because constitutional reasoning benefits from structured, well-documented rationales
- **Proposal workspace** with the full analysis layer -- AI summary, treasury impact, citizen sentiment, inter-body context, plus constitutional alignment analysis tailored to CC concerns
- **Constitutional reference:** Quick access to the ratified constitution with AI-assisted search for relevant provisions per proposal

The incentive for CC members to use Civica: their rationales appear on their profile automatically, improving their Transparency Index score. If the tool makes constitutional reasoning easier to publish, CC members who use it will appear more transparent and accountable.

### Citizen Engagement with CC

The citizen engagement mechanisms apply to CC specifically:

- **Citizen sentiment on CC decisions:** "72% of citizens agree with the CC's rejection of Proposal X"
- **Concern flags on CC votes:** When citizens flag a CC vote as concerning, it surfaces as community feedback
- **Citizen questions to CC:** Aggregated, structured: "85 citizens want to understand why the CC rejected the treasury proposal." CC members can respond once, publicly.
- **Trust signals:** Citizen endorsements of individual CC members, tracked over their term

---

## The CC Transparency Index

A composite accountability score for CC members, designed to be simple, fair, and transparent:

### Components

- **Participation (35%):** What percentage of governance actions did they vote on? Non-participation is the most basic accountability failure.
- **Rationale Quality (30%):** Do they explain their votes? Do they cite constitutional provisions? Is the reasoning substantive or boilerplate? AI-assessed with human-readable scoring criteria.
- **Responsiveness (15%):** How quickly do they vote relative to proposal deadlines? Do they wait until the last moment or engage early?
- **Independence (10%):** Do they exercise independent judgment, or do they vote identically with the rest of the CC on every proposal? Some agreement is expected; perfect unanimity on every vote suggests groupthink.
- **Community Engagement (10%):** Do they respond to citizen questions? Do they publish explanations beyond minimal rationales? Are they accessible?

### Design Principles

- The index measures process, not outcomes. A CC member who votes against community sentiment but provides thorough constitutional reasoning scores well. A CC member who votes with the crowd but never explains why scores poorly.
- All components are derived from on-chain data and Civica's engagement layer. No subjective editorial judgment.
- The methodology is published and transparent. CC members know exactly how they're being evaluated.

---

## Free Only (No Pro Tier)

There is no CC Pro tier. The population is too small to monetize, and gating CC transparency features would undermine the accountability mission.

Everything CC-related is free:

- The public accountability surface (committee page, individual profiles, inter-body dynamics)
- CC governance tooling (vote casting, rationale submission, proposal workspace) -- if CC members choose to use it
- The Transparency Index
- Historical records and precedent tracking
- Citizen engagement with CC (sentiment, questions, endorsements)

The value of CC transparency flows to other personas: citizens trust the system, DReps understand CC positions, researchers analyze constitutional dynamics. This is infrastructure, not a product to monetize.

---

## How CC Members Connect to Other Personas

| Persona            | Relationship                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Citizens**       | CC accountability is a key trust signal. Citizens want to know their constitutional guardians are acting in good faith. CC transparency directly affects citizen confidence in Cardano governance.                       |
| **DReps**          | DReps need to understand CC positions to govern effectively. A DRep voting Yes on a proposal the CC will reject on constitutional grounds is wasting governance effort. CC voting patterns inform DRep strategy.         |
| **SPOs**           | SPOs interact with CC on protocol parameters and hard forks. CC ratification is required for these actions. SPOs benefit from understanding CC constitutional interpretation on technical matters.                       |
| **Treasury Teams** | Treasury proposals require CC ratification. Proposal teams benefit from understanding what the CC considers constitutionally compliant before submitting. CC precedent on treasury spending creates informal guidelines. |
| **Researchers**    | CC dynamics are a rich research subject: constitutional interpretation patterns, inter-body tension, independence metrics, term-over-term comparison. Small population makes individual-level analysis tractable.        |

---

## Metrics That Matter

| Metric                             | What It Measures                                           | Target                                                           |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| **CC page views**                  | Is the accountability surface valuable?                    | Consistent traffic, spikes around controversial decisions        |
| **CC member profile views**        | Are people checking individual accountability?             | Each member's profile viewed regularly                           |
| **CC rationale submission rate**   | If CC members use Civica, are they providing rationales?   | Higher rationale rate than through other tools                   |
| **Citizen questions to CC**        | Is the engagement layer working?                           | Meaningful question volume on significant governance actions     |
| **Inter-body analysis engagement** | Do DReps/SPOs use CC data for decision-making?             | CC alignment data referenced in DRep/SPO rationales              |
| **Trust correlation**              | Does CC transparency affect citizen governance confidence? | Citizen engagement metrics correlate with CC transparency levels |

---

## The One-Line Vision

**Civica makes the Constitutional Committee the most transparent governance body in any blockchain -- not by requiring their participation, but by building the accountability surface the ecosystem needs to trust them.**

The CC page isn't for the CC. It's for the 700 DReps, 3,000 SPOs, and millions of ADA holders who need to trust that their constitutional guardians are doing their job. If CC members choose to use Civica's governance tools, they become more transparent. If they don't, the on-chain record still speaks.
