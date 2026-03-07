# Persona: The Cardano Citizen

> **Status:** Active -- defines the anchor persona and primary acquisition target for Civica.
> **Created:** March 2026
> **Companion to:** `docs/strategy/ultimate-vision.md`

---

## Who They Are

The Cardano Citizen is anyone who holds ADA. Not governance experts, not DReps, not pool operators -- just people who own a stake in the Cardano network. They range from the ultra-passive investor who only cares about price to the moderately engaged holder who follows ecosystem news. They are 80%+ of Civica's potential userbase and the foundation the entire product is built on.

Most Cardano Citizens today:

- Bought ADA as an investment and check its price occasionally
- May or may not stake their ADA (many do for rewards, without thinking much about it)
- Have heard of "governance" but think it's not for them -- too technical, too political, too time-consuming
- Don't know they have governance rights, or know but don't understand what that means practically
- Have never delegated to a DRep, or delegated once and forgot about it
- Get their Cardano news from Twitter, Reddit, or YouTube -- fragmented, noisy, often misleading

### The Identity Shift

The fundamental job of Civica is to transform the Citizen's self-perception from **"I own tokens"** to **"I'm a citizen of a digital nation."**

This is not marketing language. Cardano has a ratified constitution, a treasury worth billions of ADA, elected representatives (DReps), three branches of governance, and a 5-day legislative cycle. It is structurally more democratic than most countries. Every ADA holder has governance rights whether they exercise them or not.

The product's job is to make that citizenship feel _real_ -- tangible, valuable, and effortless to participate in.

---

## What They Want (Whether They Know It or Not)

### What they say they want

- "Number go up"
- Easy staking with good returns
- To know if Cardano is "doing well"

### What they actually need

- To understand that governance decisions directly affect their ADA (treasury spending, protocol parameters, staking rewards)
- Representation in governance that aligns with their values (delegation)
- Confidence that the people making decisions are doing a good job
- A way to stay informed without it becoming a second job

### What would delight them

- Feeling like a citizen of something real, not just a token holder
- A civic identity that grows over time and reflects their participation
- Being able to understand governance in 30 seconds per epoch
- Having a voice without needing to become an expert
- Knowing exactly where treasury money goes and whether it was well spent

---

## The Citizen Experience

### Philosophy

The Citizen experience is **summary intelligence, not analytics.** It answers: "What's happening with my ADA in governance, and should I care right now?" The default answer most epochs should be: "Everything's fine. Here's what happened." Calm is a feature.

The Citizen does not want a simpler version of the DRep dashboard. They want a **fundamentally different product** -- a governance health monitor and civic briefing, not a data platform.

Progressive depth is available for the curious. Every summary has a path to more detail. But the default experience is conclusive, not exploratory.

### Pre-Connection: The Front Door

Before connecting a wallet, Civica should feel like an invitation, not a dashboard. The anonymous experience has one job: convince the visitor that being an active Cardano citizen is easy, valuable, and risk-free.

**What they see:**

- A clear, unintimidating explanation of what Cardano governance is and why it matters to them
- Two familiar paths in: **Stake** (find a pool that represents your values) and **Govern** (find a representative in 60 seconds)
- Enough free intelligence to demonstrate value -- DRep browse, SPO browse, proposal summaries, the Constellation, governance health overview
- A persistent, gentle prompt to connect their wallet for personalized experience
- Education woven into every surface, not a separate "/learn" destination

**What they don't see:**

- Full navigation (reduced to Explore, Match, Learn, Connect)
- Analytics, charts, or data-heavy surfaces
- Jargon without explanation

**The messaging:**

- "Your ADA gives you a voice in Cardano's future. It takes 60 seconds to use it."
- "Choose someone who shares your values. Your ADA stays in your wallet."
- "Delegate and forget -- as long as you pick a good representative, you've done your job."

### Post-Connection: The Civic Hub

After connecting a wallet, the Citizen sees their personalized civic experience. This is the product they return to every epoch.

#### The Briefing (Primary Surface)

A personalized, plain-English digest updated every epoch (~5 days). This is the core return driver.

**Content:**

- **Personal status:** Delegation health (green/yellow/red). Staking rewards this epoch. Any alerts that need attention. Usually: "Everything's fine."
- **What happened:** 2-4 headline cards summarizing governance activity this epoch. Written like news, not data: "The community approved funding for a new developer toolkit (4.2M ADA). Your DRep voted Yes."
- **Treasury update:** How much was spent, on what, current treasury balance. "Your proportional share of the treasury: X ADA." Make the collective treasury feel personal.
- **What's coming:** Active proposals, upcoming deadlines, anything the citizen might want to know about.
- **Your DRep this epoch:** How your representative performed. Votes cast, rationales provided, score change. One-line verdict: "Your DRep is representing you well" or "Your DRep missed 3 votes this epoch -- consider checking their profile."

**What it is NOT:**

- A dashboard with charts and metrics
- An analytics view with filters and sorting
- A firehose of every governance action

**Design principle:** If a citizen reads their briefing in 30 seconds and closes the app feeling informed and confident, the product succeeded.

#### Treasury Transparency

A dedicated surface for understanding where the money goes. This bridges the gap between "number go up" and "governance matters" by making treasury spending tangible and personal.

**What citizens see:**

- Treasury balance and trend (growing? shrinking? at what rate?)
- What got funded: plain-English descriptions of funded projects with delivery status
- Spending categories: how much goes to development, marketing, research, infrastructure
- Project accountability: did funded projects deliver? Citizen impact reports.
- "Your proportional share" framing: personalize the treasury relative to their holdings
- Who voted for what: connect spending decisions to specific DReps (accountability trail)
- Historical trends: is spending accelerating? Are projects delivering?

**Why this matters:** The treasury is the most concrete connection between governance and the citizen's economic interest. "People are spending billions of your collective ADA" is an attention-getter. "Here's exactly where it went and whether it worked" is the value.

#### Civic Identity

A persistent, growing profile that represents the citizen's relationship with the Cardano network. Not gamification for its own sake -- meaningful markers of civic participation.

**Components:**

- **Citizen since:** When they first staked or delegated (epoch + approximate date)
- **Delegation streak:** Consecutive epochs delegated
- **Representation summary:** "Your DRep has cast X votes on your behalf since you delegated"
- **Governance alignment:** Their values profile (from Quick Match), visualized simply
- **Governance footprint:** Total ADA governed across their delegation + staking, proposals touched through their representative, cumulative epoch participation
- **Milestones:** "100 epochs delegated," "Your DRep voted on 200 proposals on your behalf," "Participated in 5 Citizen Assemblies"

**Why this matters:** Identity creates attachment. A citizen who has been delegated for 100 epochs and can see that history doesn't casually abandon the product. The identity also enables Wrapped -- shareable civic moments that drive acquisition.

#### Civic Engagement (Community Layer)

Structured mechanisms for citizens to participate beyond delegation. Every interaction generates data that feeds the intelligence engine. None require free-text input. None require moderation.

**Engagement mechanisms:**

1. **Proposal Sentiment**
   - On every active proposal: "Do you support this? Yes / No / Not sure"
   - Aggregate shown publicly: "72% of Civica citizens support this proposal"
   - Divergence highlighted: "Citizens support this 80%, but DReps are voting 55% Yes"
   - Creates accountability signal and citizen voice without formal governance weight

2. **Priority Signals**
   - Periodic prompt: "What should governance focus on?" (rank from structured list)
   - Categories: treasury oversight, protocol development, ecosystem growth, decentralization, education, security
   - Aggregate becomes the "Citizen Mandate" -- visible to DReps and the community
   - Updated quarterly or when the system detects shifting priorities

3. **Concern Flags**
   - On any proposal: flag a specific concern from a structured list
   - Options: "too expensive," "unclear deliverables," "conflicts of interest," "rushed timeline," "affects my staking," "insufficient rationale"
   - Threshold-based surfacing: when enough citizens flag the same concern, it becomes prominent
   - Crowdsourced risk assessment without needing expertise

4. **Impact Tags**
   - On funded projects: "I use this" / "I tried it" / "I didn't know about it"
   - If they use it: "essential" / "useful" / "okay" / "disappointing"
   - Optional one-sentence context (the only free-text, and it's optional + short)
   - Crowdsourced accountability: "89 citizens report using this project, 71% say it's essential"

5. **Citizen Endorsements**
   - Endorse DReps, SPOs, or funded projects with a single tap
   - Optional conditional endorsements: "I trust this DRep on treasury proposals"
   - Social proof alongside algorithmic scores: "342 citizens endorse this DRep"
   - Domain-specific trust signals feed the matching and scoring engines

6. **Citizen Questions**
   - Pose structured questions to DReps about specific proposals or votes
   - Similar questions merge: "47 citizens asked why you voted Yes on Proposal X"
   - DReps respond once to the aggregate, publicly
   - Creates accountability loop without becoming messaging/chat

7. **Citizen Assemblies**
   - Periodic invitations to a random sample of citizens for deeper deliberation
   - Presented with balanced, AI-generated proposal summaries
   - Citizens vote and select reasoning from structured options
   - Published as "Citizen Assembly verdict" alongside official governance results
   - Digital sortition: random citizen samples produce better collective signals than self-selected participation

**Anti-forum principle:** None of these mechanisms create threads, conversations, or debate spaces. They create _signals_ -- structured, aggregatable, analyzable data that feeds the intelligence engine while giving citizens meaningful agency.

#### Smart Alerts

The default state is quiet. Most epochs, nothing needs the citizen's attention. When something does, the alert earns trust because the platform doesn't cry wolf.

**Alert triggers:**

- "A proposal to change staking reward parameters is being voted on" (affects their income)
- "Your stake pool announced it's retiring in 3 epochs" (action required)
- "Your DRep hasn't voted in 2 epochs" (representation degrading)
- "Your DRep's score dropped significantly" (representation quality change)
- "A major treasury withdrawal was approved" (large spending event)
- "Governance participation dropped below 50%" (systemic health concern)

**Alert philosophy:** Every alert must connect to an action. "Your DRep missed votes" links to DRep profile and re-delegation. "Your pool is retiring" links to SPO discovery. No alert is purely informational -- Principle #8 (intelligence demands action) applies especially here.

---

## Discovery Surfaces (Free, Pre- and Post-Connection)

These surfaces remain accessible to everyone (Principle #1: never gate discovery, basic scores, delegation, Quick Match, basic alerts). They serve as both the free value proposition and the ongoing browse experience.

### DRep Browse

**Citizen-appropriate view:**

- Name, score, one-line philosophy, match percentage (if they've done Quick Match)
- Enough to choose, not enough to overwhelm
- Sort by match, score, or popularity
- Quick delegate action on every card

**NOT the citizen view:** alignment radars, temporal trajectories, pillar breakdowns, PCA coordinates. These exist on the full profile for those who drill in.

### SPO Browse

**Citizen-appropriate view:**

- Pool name, ticker, governance score, governance participation rate
- What makes this different from PoolTool: governance values alignment, not just ROI
- "This pool operator shares your values on decentralization and votes on 95% of proposals"

### Proposal Browse

**Citizen-appropriate view:**

- Title, one-sentence plain-English summary, status, your DRep's vote
- Treasury proposals: amount + "X% of treasury"
- Urgency indicator for proposals closing soon
- Citizen sentiment (if they or others have voted)

### Quick Match

The primary acquisition funnel. 3 questions, 60 seconds, delegation. Dual-mode: "Find my DRep" / "Find my SPO." The citizen doesn't need to understand governance philosophy -- the quiz translates their values into delegation.

---

## How Citizens Connect to Other Personas

The citizen persona doesn't exist in isolation. Every other persona serves citizens or is accountable to them:

| Persona            | Relationship to Citizens                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DReps**          | Represent citizens. Citizens evaluate, delegate to, endorse, and question them. DRep quality directly determines citizen governance health.                                                             |
| **SPOs**           | Operate infrastructure citizens stake with. Citizens discover SPOs through governance values, not just financial metrics. SPO governance participation affects the citizen's "full governance picture." |
| **CC Members**     | Highest-level representatives. Citizens track CC transparency and alignment with citizen sentiment.                                                                                                     |
| **Treasury Teams** | Spend citizens' collective treasury. Citizens provide impact reports and accountability signals on funded projects.                                                                                     |
| **Researchers**    | Consume and analyze the data citizens generate through engagement signals. Research findings flow back as intelligence that improves the citizen briefing.                                              |

---

## Metrics That Matter

How to know if the Citizen experience is working:

| Metric                           | What It Measures                               | Target                                                                |
| -------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| **Wallet connections per week**  | Acquisition funnel effectiveness               | Growing week-over-week                                                |
| **Delegations completed**        | Core conversion (visitor -> citizen)           | >30% of wallet connections lead to delegation                         |
| **Epoch return rate**            | Do citizens come back?                         | >40% of connected citizens return within 2 epochs                     |
| **Briefing read rate**           | Is the digest compelling?                      | >60% of returning citizens view their briefing                        |
| **Sentiment participation rate** | Is civic engagement working?                   | >20% of active citizens vote on at least one proposal per epoch       |
| **Delegation churn**             | Are citizens sticking with their DRep?         | Low churn = healthy matching; high churn = matching needs improvement |
| **Time to value**                | How quickly does a new visitor feel "I get it" | <60 seconds to understand value prop; <3 minutes to delegation        |

---

## What This Persona Does NOT Need

Clarity on what to exclude is as important as what to include:

- **Analytics dashboards** -- citizens want conclusions, not charts
- **Raw data exports** -- that's for researchers
- **Score methodology deep dives** -- citizens trust the score or they don't; methodology is for transparency docs
- **DRep management tools** -- that's for DReps
- **Competitive analysis** -- citizens don't compare DReps analytically; they match and delegate
- **API access** -- that's for integrators
- **Admin or moderation capabilities** -- the structured engagement model doesn't need user-facing moderation
- **Complex filtering or sorting** -- sensible defaults with minimal controls

---

## The Return Loop

What brings a citizen back every epoch:

1. **The Briefing** -- fresh, personalized, 30 seconds. "What happened with my governance?"
2. **Identity growth** -- their footprint, streak, and milestones accumulate passively
3. **Civic engagement** -- active proposals to weigh in on, priority signals to set, impact to report
4. **Smart alerts** -- occasional, high-signal notifications when something actually matters
5. **Wrapped moments** -- periodic shareable summaries of their civic participation

The cadence is natural: Cardano epochs are ~5 days. Every epoch is a new briefing, potentially new proposals to react to, new treasury activity to review. The product doesn't need to manufacture engagement -- the governance cycle provides it.

---

## The One-Line Vision

**Civica tells Cardano citizens what their ADA is doing in governance, so they don't have to follow it themselves.**

Not analytics. Not research. Not deep intelligence. Just: "Here's what happened. Here's what your representative did. Here's whether you should care. And here's how to make your voice heard if you want to."

The deeper intelligence, DRep/SPO analytics, research tools, and power features serve the other personas and eventually monetize. But the thing that makes Civica a _hub_ for every Cardano citizen is the 30-second epoch check-in that nobody else provides, wrapped in a civic identity that grows over time and a community layer that gives every citizen a voice.
