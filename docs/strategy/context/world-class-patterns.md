# World-Class Patterns Library

> **Purpose:** Living catalog of remarkable product patterns discovered during audits and research. Agents update this file when they find exceptional implementations via WebSearch. Future audits draw from this library for concrete inspiration instead of starting from scratch.
> **Rule:** Every entry must include a source, a date, and why it's remarkable. Entries older than 6 months should be re-verified or marked stale.
> **Updated by:** `/audit-feature`, `/audit-experience`, `/explore-feature` agents during WebSearch phases.

---

## How to Use This Document

- **During audits:** Reference patterns relevant to the feature/experience being audited. Use them as concrete benchmarks for the 10/10 spec.
- **During builds:** When designing a new feature or redesigning an existing one, check this library for proven patterns before inventing from scratch.
- **During exploration:** `/explore-feature` agents should draw heavily from this library and ADD to it.

---

## Patterns

_Organized by experience type. Add new patterns in the relevant section, or create a new section if none fits._

### Onboarding & First Impression

_(Patterns for first-time user experiences, value communication, progressive disclosure)_

#### Participation Spectrum with Depth Choice

- **Source**: Decidim + CitizenLab (Go Vocal) — https://decidim.org/ + https://www.govocal.com/
- **Discovered**: 2026-03-12
- **What they do**: Decidim offers modular participation: browse → comment → co-author → vote. CitizenLab gamifies lightweight actions (upvoting, commenting) with points, badges, leaderboards. Every interaction is ≤2 clicks.
- **Why it's world-class**: Proves that "passive" users will participate if the friction is low enough and the reward is immediate. The ladder creates natural progression without forcing it.
- **Applicable to**: Citizen experience — Monitor → Signal → Influence → Advocate → Represent progression. Each level has value without requiring the next.
- **Adoption difficulty**: Medium — requires signal infrastructure + milestone tracking

### Dashboard & Status-at-a-Glance

#### Score as Narrative, Not Just Number

- **Source**: Credit Karma — https://builtformars.com/case-studies/credit-karma
- **Discovered**: 2026-03-12
- **What they do**: Large number with color-coded gauge + weighted factor breakdown (Payment History 40%, etc.) + "what if" simulator showing projected score changes for hypothetical actions
- **Why it's world-class**: Transforms an opaque 3-digit number into a story — users know WHY their score is X, which factors drag it down, and WHAT ACTIONS would improve it. Simulator makes abstract tangible.
- **Applicable to**: DRep score presentation, workspace performance page, citizen-facing DRep evaluation
- **Adoption difficulty**: Easy — scoring engine + simulator already exist, need visualization layer

#### Daily Readiness Score with Behavioral Feedback

- **Source**: WHOOP — https://www.whoop.com/experience/recovery/
- **Discovered**: 2026-03-12
- **What they do**: Single 0-100% score, color-coded red/yellow/green, shown at wake-up. Drives daily behavior recommendations. Journal logs 300+ behaviors over 90 days to show which correlate with better scores. Monthly Performance Assessment.
- **Why it's world-class**: Proved a single daily number with color coding actually changes behavior ("red recovery sting"). Closed-loop feedback: behavior → score → behavior change.
- **Applicable to**: DRep workspace "governance readiness" score, epoch-over-epoch behavioral patterns
- **Adoption difficulty**: Medium — need epoch-level behavior aggregation + correlation analysis

#### Progressive Depth (3-Level Drill-Down)

- **Source**: Stripe Dashboard — https://mattstromawn.com/projects/stripe-dashboard/
- **Discovered**: 2026-03-12
- **What they do**: 6 type sizes/weights for clear hierarchy. Surface = simple summaries. Mid = prebuilt reports. Deep = SQL + AI assistant for natural-language queries. 1.4M users.
- **Why it's world-class**: Manages enormous complexity while remaining approachable. Every user gets the depth they want without the depth they don't.
- **Applicable to**: Workspace information architecture — surface (3 numbers), mid (pillar breakdowns), deep (advanced analytics)
- **Adoption difficulty**: Medium — surface + mid exist, deep layer (AI queries) is new

#### Ambient Analytics (Zero-Step Insights)

- **Source**: Industry pattern — https://www.datavoyagers.net/post/ambient-analytics-solving-the-dashboard-fatigue-epidemic
- **Discovered**: 2026-03-12
- **What they do**: Insights appear within existing workflow at decision points, not in a separate dashboard. Contextual embedding + timely prompts + single-KPI explanations. "Pull" models fail; "push" models succeed.
- **Why it's world-class**: Diagnoses dashboard fatigue as a fundamental design flaw. Works WITH cognitive patterns instead of against them.
- **Applicable to**: Proposal-level intelligence ("Based on your history, you vote Yes on treasury 85% of the time"), rationale writing tips
- **Adoption difficulty**: Medium — requires contextual data injection at multiple touchpoints

### Citizen Intelligence & Accountability

#### Weekly/Epoch Performance Assessment

- **Source**: WHOOP WPA — https://www.whoop.com/thelocker/new-weekly-performance-assessment
- **Discovered**: 2026-03-12
- **What they do**: Every Monday: personalized assessment comparing strain balance, sleep vs. 3-week average, comparison to demographics. Rotating featured metric each week. Requires only passive data collection — zero user effort.
- **Why it's world-class**: Created a "check-in ritual" for passive data. The rotating metric prevents staleness. Comparative framing ("vs. your average" + "vs. population") adds context to every number.
- **Applicable to**: Epoch Governance Assessment for citizens — personalized, comparative, rotating featured governance metric. Delivered at epoch boundary without citizen effort.
- **Adoption difficulty**: Medium — needs composite Representation Pulse score + epoch-over-epoch comparison + rotating metric selection

#### Smart Alerts on Personal Thresholds

- **Source**: Ziggma — https://ziggma.com/
- **Discovered**: 2026-03-12
- **What they do**: AI-driven investment alerts on user-defined portfolio parameters. Notify only when thresholds crossed. Transforms passive watching into proactive awareness without constant checking.
- **Why it's world-class**: Solves the "alert fatigue" problem by making alerts personally relevant. Users define what matters; system handles monitoring.
- **Applicable to**: Citizen delegation alerts — DRep missed votes, alignment drift beyond threshold, proposals affecting citizen's stake. Each alert explains WHY it was triggered for this specific citizen.
- **Adoption difficulty**: Easy — drift detection exists, need citizen-scoped alert routing

#### Delegation Impact Quantification

- **Source**: DAO Portal research — https://arxiv.org/html/2601.14927
- **Discovered**: 2026-03-12
- **What they do**: Surfaces that top 10% of token holders control 76.2% of voting power, average participation ~17%. Delegation systems identified as primary solution to voter apathy. But delegators never see their contribution.
- **Why it's world-class**: Reveals the hidden truth: delegation IS participation. Without delegators, governance systems collapse. Quantifying this transforms "set and forget" into "my contribution."
- **Applicable to**: Citizen impact visualization — "Your delegation contributes X% of governance coverage. Without delegators like you, only Y% of voting power would be active."
- **Adoption difficulty**: Easy — voting power data exists, need fraction computation + messaging

#### Multi-Level Briefing Structure

- **Source**: GeoBarta — https://geobarta.com/
- **Discovered**: 2026-03-12
- **What they do**: AI news summaries in 4 geographic levels (global → local), all consumable in under 60 seconds. Designed for busy professionals who want completeness without time investment.
- **Why it's world-class**: Proves that structured levels create comprehensiveness without overwhelm. The 60-second constraint forces ruthless prioritization.
- **Applicable to**: Citizen epoch briefing in 4 levels: ecosystem → governance category → DRep-specific → personal impact. "60-second governance briefing."
- **Adoption difficulty**: Easy — briefing generation exists, needs 4-level structuring

#### Representative Accountability Synthesis

- **Source**: GovTrack — https://www.govtrack.us/ + Tally — https://www.tally.xyz/
- **Discovered**: 2026-03-12
- **What they do**: GovTrack computes derived statistics (ideology, leadership, missed votes) beyond raw records. Tally shows delegation relationship front-and-center with transparent voting power. Both synthesize accountability — not raw data dumps.
- **Why it's world-class**: Transforms "here are 47 votes" into "your rep missed 3 votes, ranks #12 in participation, and leans treasury-conservative." Synthesis is the product.
- **Applicable to**: Citizen Hub — DRep accountability summary (synthesized, not raw), delegation relationship as dominant element, one-click re-delegation
- **Adoption difficulty**: Easy — all data exists, needs citizen-facing synthesis layer

### Governance Architecture & Civic Tech

#### Composable Governance Processes

- **Source**: Decidim — https://decidim.org/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Governance is modular: proposals, budgets, debates, meetings, and elections are "components" that compose into "processes." A treasury withdrawal is a process containing proposal + vote + committee review + impact assessment components. 30+ languages, used by Barcelona and 40+ cities.
- **Why it's world-class**: Prevents monolithic page syndrome. Each governance action type has purpose-built UI. Components can be mixed into any process, enabling flexible governance workflows without custom code.
- **Applicable to**: Replace flat entity browse pages with process-oriented views. A proposal isn't just a row in a table — it's a process with vote, rationale, treasury impact, and committee review components.
- **Adoption difficulty**: Hard — requires rethinking page architecture from entity-centric to process-centric

#### Community Agenda Setting

- **Source**: Consul Democracy — https://consuldemocracy.org/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: 350+ governments, 100M+ citizens. Citizens create issues AND prioritize them, defining their own city agenda. Open debates double as community building AND citizen interviews with politicians. Madrid citizens decide 100M EUR annually.
- **Why it's world-class**: Collapses the distance between "watching governance" and "doing governance." Citizens don't just react — they set the agenda. Won UN Public Service Award 2018.
- **Applicable to**: Let citizens surface which governance actions matter most, creating a community-prioritized governance agenda rather than chronological listing.
- **Adoption difficulty**: Medium — needs prioritization/upvote mechanism + agenda view

#### Spectrum-of-Opinion Voting

- **Source**: Loomio — https://www.loomio.com/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Multiple voting types (thumbs, ranked choice, dot voting, score voting) per decision. Shows full spectrum of opinion, not just yes/no. Decision deadlines with automatic reminders. Designed for "solution finding rather than majority rule."
- **Why it's world-class**: Acknowledges that different decisions need different decision-making tools. The spectrum view reveals WHERE agreement exists, not just whether a majority exists.
- **Applicable to**: DRep voting pattern visualization — show opinion spectrum, not just vote counts. Different proposal types could use different analysis modes.
- **Adoption difficulty**: Medium — UI layer over existing vote data + spectrum visualization

#### Public Testimony as Accountability Loop

- **Source**: MAPLE (Massachusetts Platform for Legislative Engagement) — https://www.mapletestimony.org/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Anyone can browse bills, read published testimony, and submit their own. AI organizes legislative data. Testimony is PUBLIC — legislators know their constituents' views are visible to everyone.
- **Why it's world-class**: Making testimony public creates an accountability loop. The transparency itself changes behavior — representatives know their constituents are watching AND that others can see what constituents are saying.
- **Applicable to**: DRep rationale publishing as public accountability. Citizen sentiment on proposals as public testimony. The transparency loop already exists in Governada's design — MAPLE validates it.
- **Adoption difficulty**: Easy — rationale system exists, citizen sentiment exists. Just needs public visibility emphasis.

#### Inline Tracker Lists with Notification

- **Source**: GovTrack.us — https://www.govtrack.us/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: In-list tracking buttons throughout the site. Build personal watchlists of bills, subject areas, committees, or Members without leaving browse context. Personalized email/RSS updates. Leave notes on legislative activity.
- **Why it's world-class**: The "track" button is zero-friction — don't leave the page, don't open settings, just click. Turns passive browsing into active monitoring.
- **Applicable to**: Inline watchlist buttons on proposals, DReps, pools. "Track this proposal" → get updates when votes happen. "Watch this DRep" → get alerts on score changes.
- **Adoption difficulty**: Easy — needs watchlist table + notification trigger + inline button component

### Search & Discovery

_(Patterns for finding, filtering, matching, recommendation)_

### Profile & Identity

#### Passive Data as Shareable Identity (Spotify Wrapped Pattern)

- **Source**: Spotify Wrapped — https://newsroom.spotify.com/wrapped/
- **Discovered**: 2026-03-12 (explore-feature: citizen hub)
- **What they do**: 200M users in 24 hours (2025), 500M shares. 16 personality archetypes from passive listening data. "Listening Age," "Wrapped Party" for social comparison. Annual ritual with anticipation cycle. Second-day engagement drop improved from 60% to 14%.
- **Why it's world-class**: Proved that passive data reflected as identity creates the strongest viral loop in consumer software. Users don't share their data — they share who their data says they ARE.
- **Applicable to**: "Governance Wrapped" — annual/quarterly identity review from delegation data. Governance Archetypes ("Treasury Hawk," "Protocol Guardian") from PCA alignment vectors. Shareable personality cards sized for social media.
- **Adoption difficulty**: Medium — PCA data exists, needs archetype classification rules + card renderer + temporal ritual

#### Visual Self-Placement as Identity (Political Compass Pattern)

- **Source**: iSideWith (81M users, 83% quiz completion) + Political Compass (600K+ Reddit subculture)
- **Discovered**: 2026-03-12 (explore-feature: citizen hub)
- **What they do**: Place users on a 2D+ grid showing political identity. iSideWith matches to candidates ("You side 87% with X"). The grid itself becomes the identity — users describe themselves by quadrant. Low stakes, high self-expression.
- **Why it's world-class**: The visual MAP is more powerful than any score. It's instantly shareable, debatable, and creates community around shared positions. 83% completion on a 42-question quiz proves intrinsic motivation.
- **Applicable to**: Citizen alignment radar (6D) showing where you sit in governance space. DRep overlay showing alignment/drift. "Citizens Like You" clustering. The radar IS the identity.
- **Adoption difficulty**: Easy — alignment vectors exist, need radar visualization + DRep overlay + cluster labels

#### Consistency Heatmap as Social Signal

- **Source**: GitHub — https://gitblend.com/kb/understanding-github-contribution-graphs
- **Discovered**: 2026-03-12
- **What they do**: 365-day heatmap, each cell = one day, color intensity = activity level. Current streak + longest streak prominently displayed. Weekly columns for instant pattern recognition.
- **Why it's world-class**: Became a social signal — people share screenshots of "green walls" as proof of consistency. Information-dense yet instantly readable. Gamifies consistency without being gamified.
- **Applicable to**: DRep governance activity heatmap — voting, rationale writing, delegator engagement. Shareable. Streak-motivating.
- **Adoption difficulty**: Easy — vote timestamps exist, need calendar heatmap visualization

#### Rating Over Time with Named Brackets

- **Source**: Chess.com ELO — https://chesscheatsheets.com/blogs/chess-openings/chess-elo
- **Discovered**: 2026-03-12
- **What they do**: Line chart of rating over time (resample daily/weekly/monthly). Named brackets (Beginner → Master). Percentile ranking vs player base. Per-game rating change with explanation.
- **Why it's world-class**: Line chart creates improvement/decline narrative. Named brackets make numbers meaningful ("I'm an Expert now!"). Per-event breakdown creates accountability.
- **Applicable to**: DRep score trajectory chart with tier names, per-epoch score change attribution
- **Adoption difficulty**: Easy — score history + tiers exist, need timeline chart + per-epoch attribution

### Data Visualization & Intelligence

#### Sankey Money Flow Visualization

- **Source**: USAspending.gov Data Lab — https://datalab.usaspending.gov/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Sankey diagrams showing federal spending flow from Budget Functions to Object Classes. Multiple entry points to the same data (by function, agency, or object class). Interactive treemaps for budget proportions. Daily Treasury Statement visualization.
- **Why it's world-class**: Makes abstract spending tangible. Money flow from source → destination → outcome as a visual narrative. Multiple entry points mean different users find what matters to them.
- **Applicable to**: Cardano treasury ADA flow: Treasury → Proposals → Recipients → Outcomes. Sankey diagram showing where ADA goes. Multiple entry points: by category, by recipient, by epoch.
- **Adoption difficulty**: Medium — treasury data exists, needs Sankey/treemap visualization components

#### Budget Anomaly Detection

- **Source**: OpenBudgets.eu — https://openbudgets.eu/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Semantic data model for heterogeneous budget data + outlier detection + rule mining + trend discovery + cross-jurisdiction KPI comparison. Journalists and activists use it for data-driven accountability investigations.
- **Why it's world-class**: Doesn't just visualize spending — flags anomalies ("this withdrawal is 3x the median for this category"), finds patterns across jurisdictions, and enables comparative analysis. Active intelligence, not passive display.
- **Applicable to**: Treasury anomaly detection: flag unusual proposal amounts, detect spending pattern changes, cross-epoch trend lines that tell a story. Turn passive treasury monitoring into active accountability.
- **Adoption difficulty**: Medium — needs statistical analysis layer over treasury data

#### Money-to-Votes Connection Mapping

- **Source**: OpenSecrets / FollowTheMoney — https://www.opensecrets.org/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Connect campaign contributions to voting behavior. "My District" tool shows money flowing into your specific area. Search donors, trace financial networks. "Follow the money" narrative structure turns dry financial data into investigative storytelling.
- **Why it's world-class**: The connection between money and votes is the killer feature. Shows correlations, not just amounts. The narrative structure ("follow the money") creates engagement that raw data doesn't.
- **Applicable to**: Connect treasury proposals to who votes for them and their delegation/staking relationships. "Follow the ADA" — show the money trail. Do DReps with large treasuries delegated to them vote differently on treasury proposals?
- **Adoption difficulty**: Medium — vote data + delegation data exist, needs cross-correlation + narrative generation

#### Delegation as Portfolio with Emotional Color

- **Source**: Robinhood — https://design.google/library/robinhood-investing-material
- **Discovered**: 2026-03-12
- **What they do**: First screen = big line chart of portfolio performance. Only four colors: white, black, green (up), red (down). When portfolio performs well, entire background shifts green. Card-based modularity. Essentially two screens: dashboard + detail.
- **Why it's world-class**: Reduced investing to emotional core: "am I up or down?" Full-screen color shift creates visceral response. Two-screen simplicity prevents getting lost.
- **Applicable to**: Delegation health hero chart (voting power over time), green/red emotional signal, card-based delegator segments
- **Adoption difficulty**: Easy — delegator snapshots exist, need hero chart + color theming

#### Merchant CRM with Customizable Metrics

- **Source**: Shopify — https://www.shopify.com/blog/merchant-overview-dashboard
- **Discovered**: 2026-03-12
- **What they do**: Central hub for all business operations. Customizable dashboard — pin metrics that matter to YOU. CRM-integrated: customer profiles with full history, segmentation for targeted campaigns. Handles beginner to enterprise.
- **Why it's world-class**: Same dashboard scales from "just started" to "10K orders/day." Customization means each user's dashboard reflects their priorities. CRM is first-class, not an afterthought.
- **Applicable to**: DRep workspace widget customization, delegator CRM with profiles, engagement segments
- **Adoption difficulty**: Medium — requires widget system + delegator profile views

### Engagement & Participation

#### Feed-First Voting with AI Summaries

- **Source**: Snapshot v2 — https://snapshot.mirror.xyz/0qnfjmE0SFeUykArdi664oO4qFcZUoZTTOd8m7es_Eo
- **Discovered**: 2026-03-12
- **What they do**: Proposal feed homepage. Vote directly from feed for basic proposals without opening full page. AI-powered summaries for quick comprehension. Audio playback of proposals. Draft system for rationales.
- **Why it's world-class**: Reduced "see proposal → cast vote" to essentially one click. AI summaries solve "I don't have time to read this 5000-word proposal."
- **Applicable to**: DRep workspace action queue, inline voting, proposal summarization
- **Adoption difficulty**: Easy — action queue exists, needs inline vote + AI summary

#### Opinion Clustering for Consensus Discovery

- **Source**: Pol.is — https://compdemocracy.org/polis/
- **Discovered**: 2026-03-12
- **What they do**: PCA + K-means clustering arranges participants into opinion groups in 2D space. Consensus statements (where all clusters agree) surfaced automatically. Used by Taiwan for legislation, Anthropic for AI constitution.
- **Why it's world-class**: Transforms chaotic disagreement into structured understanding. Shows WHY people disagree, not just that they do. Consensus discovery is the killer feature.
- **Applicable to**: Proposal analysis (DRep position clusters), governance landscape visualization, alignment intelligence
- **Adoption difficulty**: Hard — requires opinion embeddings + clustering, but alignment vectors provide foundation

### Workspace & Productivity

#### Triage Queue with Keyboard-First Flow

- **Source**: Linear — https://linear.app/ + Superhuman — https://blog.superhuman.com/how-to-split-your-inbox-in-superhuman/
- **Discovered**: 2026-03-12
- **What they do**: Every item demands a decision. Single-letter shortcuts (V/R/S/D). J/K navigation. Command palette (Cmd+K). Split inbox by category with AI auto-categorization. "Inbox Zero" methodology — process sequentially, every item gets 1-2 seconds then moves.
- **Why it's world-class**: Turns task management into flow state. Speed is the product. Triage model forces decisions rather than letting items pile up.
- **Applicable to**: DRep workspace action queue — proposals as inbox items, forced-decision workflow, keyboard shortcuts
- **Adoption difficulty**: Medium — needs keyboard handler layer + sequential processing UX

#### Spaces for Context Switching

- **Source**: Arc Browser — https://blog.logrocket.com/ux-design/ux-analysis-arc-opera-edge/
- **Discovered**: 2026-03-12
- **What they do**: Group tabs by context (Work, Personal, Research). Command Bar handles search, commands, and AI queries. Figure-ground principle minimizes UI chrome so content takes center stage.
- **Why it's world-class**: Solved the "100 tabs" problem through spatial organization. Universal command bar adapts to intent. Content always primary.
- **Applicable to**: Workspace modes — Voting space, Writing space, Reputation space. Mode switching without chaos.
- **Adoption difficulty**: Medium — requires workspace mode architecture + persistent state per mode

#### Conversational + Visual Hybrid UI

- **Source**: 2025-2026 emerging pattern — https://research.aimultiple.com/conversational-ui/
- **Discovered**: 2026-03-12
- **What they do**: Three parallel streams: (1) Conversational AI, (2) Visual/structural UI, (3) Business logic. Chat queries reshape visual layer. "Show me proposals where my delegators are split" → filtered view appears.
- **Why it's world-class**: Resolves chat-vs-dashboard debate. Conversational layer handles ad-hoc queries; structural layer handles spatial understanding. Together more powerful than either.
- **Applicable to**: Workspace AI sidebar — ask questions, get visual answers in the workspace view
- **Adoption difficulty**: Hard — requires AI query → UI state mapping, natural language interface

#### Proactive AI Agent (Ambient Monitoring)

- **Source**: Industry pattern — https://earlybirdlabs.com/insights/what-are-ambient-agents
- **Discovered**: 2026-03-12
- **What they do**: Background agents monitor digital environments, detect key events, take action based on context without waiting for prompts. Learn "normal" behavior, detect deviations, alert or auto-act.
- **Why it's world-class**: Next paradigm beyond chatbots. Tools anticipate needs rather than waiting for instructions.
- **Applicable to**: Governance agent monitoring proposals, delegator changes, score projections, rationale opportunities
- **Adoption difficulty**: Hard — requires event system + notification infrastructure + AI inference pipeline

### AI-Powered Intelligence

#### AI Briefing with Progress + Citations

- **Source**: Perplexity — https://perplexity.ai/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: 780M+ queries/month. Every response includes clear citations and sources. Progress indicators show "Considering 8 sources" and step-by-step execution plans. Pro Search shows the AI's plan being executed in real-time.
- **Why it's world-class**: Two UX innovations: (1) showing the AI's work process builds trust AND makes users willing to wait, (2) citations as core UX, not afterthought. Every claim links to its source.
- **Applicable to**: AI governance briefing showing its reasoning: "Analyzed 12 proposals, 847 votes, 3 treasury actions since your last visit" with each data point linked to source. Trust through transparency.
- **Adoption difficulty**: Medium — structured prompt pipeline + citation linking system

#### Compress/Expand Physical Metaphor

- **Source**: Arc Search (The Browser Company) — https://arc.net/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: "Pinch-to-Summarize" physically folds a webpage origami-style while generating a summary, with haptic feedback. "Browse for Me" reads multiple sites and constructs a custom summarized page. Hover-to-preview generates summaries without clicking.
- **Why it's world-class**: The physical metaphor (pinching to compress) makes AI summarization feel tangible and intuitive. Interaction design makes an AI feature feel like a natural extension, not a separate "AI mode."
- **Applicable to**: Compress/expand governance entities: full proposal → 3-line summary. Full DRep profile → card summary. User controls information density with a gesture metaphor.
- **Adoption difficulty**: Easy — UI pattern, no new data needed

#### Multi-Level Summary Styles

- **Source**: Artifact (Instagram founders, acquired by Yahoo) — https://artifact.news/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: AI-recommended personalized news. Rewrite clickbait headlines. Summarize in different styles ("Gen Z," "Explain Like I'm Five," "Expert"). Despite great AI UX, shut down due to insufficient market size.
- **Why it's world-class**: The "rewrite clickbait headlines" is a masterclass — AI adding value without being gimmicky. Different complexity levels for different users. The shutdown lesson: great AI UX alone needs a large addressable market.
- **Applicable to**: Proposal summaries at complexity levels: "Expert" (constitutional language), "Community" (plain English), "Quick" (one sentence). AI-rewritten proposal titles that strip jargon.
- **Adoption difficulty**: Easy — Claude API call per proposal, cache result

#### Behavioral VIP Identification

- **Source**: Gmail AI Inbox (Google, 2025-2026)
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: AI Inbox acts as "personalized briefing" — highlights to-dos, identifies VIPs based on interaction signals (not explicit settings). Merges AI Mode, AI Overviews, and Web Guide into unified interface.
- **Why it's world-class**: Shift from "inbox" (everything dumped) to "briefing" (curated for you). VIP identification based on behavioral signals means the system learns who matters to you.
- **Applicable to**: Governance briefing that identifies "VIP" entities: DReps user follows closely, proposals viewed multiple times, pools staked to. Prioritize updates from these entities.
- **Adoption difficulty**: Medium — needs interaction tracking + behavioral signal pipeline

### Delegate-Centric Design

#### Relationship-First, Not Entity-First

- **Source**: Tally — https://www.tally.xyz/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Delegate-centric UX designed around the delegate, not the proposal. Instead of "here are proposals, who voted?" it's "here is your delegate, what have they done?" Powers 10x more onchain DAOs than competitors, secures $30B+.
- **Why it's world-class**: Reframes governance from proposal-centric to relationship-centric. Lead with the relationship first. This maps to how citizens actually think: "What is MY representative doing?" not "What proposals exist?"
- **Applicable to**: Lead with delegation relationship on governance section: "Your DRep voted on 3 proposals this epoch" not "Here are 3 proposals." Citizen Hub, governance briefing, everywhere.
- **Adoption difficulty**: Easy — data exists, needs UX reframing from entity to relationship

#### Focus and Unveil Graph Interaction

- **Source**: Kumu — https://kumu.io/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Web-based network visualization. Start with one node and unveil the network step-by-step ("focus and unveil"). Built-in metrics (betweenness, eigenvector centrality). Automated community detection colors elements by community, identifies bridges between groups.
- **Why it's world-class**: Instead of showing the entire overwhelming graph, start with one entity and explore outward. Automated community detection finds patterns humans miss. Built-in centrality identifies who actually matters.
- **Applicable to**: DRep delegation network exploration. Start with user's DRep, expand to see delegates, proposal clusters, voting blocs. Future graph visualization.
- **Adoption difficulty**: Hard — needs WebGL graph engine + community detection + relationship data format

#### Reputation as Visible Portfolio

- **Source**: Dework — https://dework.xyz/
- **Discovered**: 2026-03-12 (explore-feature: /governance)
- **What they do**: Web3-native task management. Token-based rewards, on-chain identity (wallet = identity, completed tasks = resume). Aggregates bounties from 500+ DAOs. Your wallet IS your identity, completed actions ARE your resume.
- **Why it's world-class**: Turns governance participation from "civic duty" (boring) to "building on-chain reputation" (engaging). Every action builds a visible portfolio.
- **Applicable to**: Every governance action (vote review, delegation, proposal analysis) builds a visible "governance reputation" profile. Citizenship as a visible, growing portfolio.
- **Adoption difficulty**: Medium — needs engagement action tracking + reputation computation + profile visualization

### Emotional Design & Delight

#### Writer-First Analytics with Distraction-Free Authoring

- **Source**: Substack — https://on.substack.com/p/dashboard + Ghost CMS — https://ghost.org/
- **Discovered**: 2026-03-12
- **What they do**: Substack: 3 hero numbers (subscribers, views, open rate), recent posts with quick stats. Ghost: "invisible until you need it" editor — minimal chrome, contextual power features (embed cards, formatting). Time to first publish: 20-40 min.
- **Why it's world-class**: Keeps analytics simple and writer-focused. Editor gets out of the writer's way. Writing feels like creation, not form-filling.
- **Applicable to**: Rationale authoring experience — distraction-free editor, 3 hero numbers (rationales published, avg engagement, ratio)
- **Adoption difficulty**: Medium — CIP-100 flow exists, needs Ghost-style minimal editor + content analytics

### Consequence & Feedback Loops

#### Consequence Visibility as Return Driver #1

- **Source**: Participatory budgeting research (Decidim Barcelona 7+ years, 31 digital PB cases across Europe)
- **Discovered**: 2026-03-12 (explore-feature: citizen hub)
- **What they do**: Platforms that show "Your vote helped fund Project X" get repeat participation. Platforms that collect input but never show what happened see participation COLLAPSE in subsequent rounds. The #1 cited factor for return visits is "closing the feedback loop."
- **Why it's world-class**: This isn't a design trick — it's the fundamental mechanism of democratic engagement. Citizens return when they see consequences, not when they see dashboards.
- **Applicable to**: Citizen Hub as consequence story: "This epoch, your delegation helped decide 15.2M ADA." Each proposal shows outcome + DRep vote + citizen signal. Lifetime impact counter grows over time.
- **Adoption difficulty**: Easy — proposal outcomes, DRep votes, and treasury amounts all exist. Need composition layer.

#### Personal Spending Receipt (Treasury Transparency)

- **Source**: "Where Does My Money Go?" (UK) + USAspending.gov + "Where Did My Tax Go?"
- **Discovered**: 2026-03-12 (explore-feature: citizen hub)
- **What they do**: Transform abstract government spending into personal receipt: "Of YOUR money, $X went to defense, $Y to healthcare." Treemap/bubble visualizations create exploration sessions. Comparison over time creates narrative.
- **Why it's world-class**: The shift from "the budget" to "YOUR money" is the entire engagement trick. Personalization transforms civic data from boring to compelling.
- **Applicable to**: Citizen treasury receipt: "Your delegation represents X ADA of voting power. This quarter, treasury proposals worth Y ADA were decided. Here's how that breaks down." Treemap by spending category.
- **Adoption difficulty**: Easy — treasury data + proposal amounts exist. Need treemap visualization + personalized framing.

### Gamification & Habit Formation

#### Epoch Streaks with Grace Mechanics

- **Source**: Streak research (Plotline, UX Magazine, WeWard) + gamified civic engagement experiments (Springer)
- **Discovered**: 2026-03-12
- **What they do**: Users 2.3x more likely to engage daily after 7+ day streak. Apps combining streaks + milestones see 40-60% higher DAU. "Streak Freezes" allow recovery from missed days. For infrequent activities, cadence must match natural rhythm — not arbitrary daily targets.
- **Why it's world-class**: Controlled experiments prove gamified civic apps outperform non-gamified. But long-term retention unproven — gamification must be spice, not main course.
- **Applicable to**: Epoch streaks (~5-day governance cycle). "12-epoch check-in streak." Grace: "Missed last epoch — catch-up summary. Streak preserved." Reward awareness, not obsession.
- **Adoption difficulty**: Easy — needs check-in event tracking + streak computation + catch-up summary generation

### Scoring & Reputation Systems

#### Methodology Transparency as Moat

- **Source**: FICO Score — https://www.myfico.com/credit-education/whats-in-your-credit-score
- **Discovered**: 2026-03-12
- **What they do**: Published methodology with 5 factor categories and approximate weights (Payment History 35%, etc.). Despite being one of many possible scoring approaches, became THE standard through transparency and regulatory adoption. Third-party tools reference FICO as canonical.
- **Why it's world-class**: Defensibility through standardization, not secrecy. Transparent methodology builds trust; trust builds adoption; adoption builds network effects. Other tools consuming your score creates switching cost.
- **Applicable to**: Governada scoring API — become the Cardano governance reputation standard. Publish methodology, create embeddable badges, let other tools consume scores.
- **Adoption difficulty**: Medium — API layer over existing engine + methodology documentation

#### Data-as-Identity Storytelling

- **Source**: Spotify Wrapped — https://newsroom.spotify.com/wrapped/
- **Discovered**: 2026-03-12
- **What they do**: Transform a year of listening data into personalized, emotionally resonant "identity cards." 500M+ shares in 2025. Cards designed for social media aspect ratios. Archetypes + superlatives + comparative stats. Users voluntarily promote the brand en masse.
- **Why it's world-class**: Made personal data feel like self-expression. The share moment IS the product. Data becomes identity ("I'm a jazz head in the top 1%").
- **Applicable to**: Governance personality cards — "The Fiscal Watchdog: top 5% participation, 12-epoch streak." Shareable visual with archetype + stats.
- **Adoption difficulty**: Easy — scoring data exists, need card renderer + archetype classification

#### Community-Algorithm Hybrid Reputation

- **Source**: Stack Overflow Reputation — https://stackoverflow.com/help/whats-reputation
- **Discovered**: 2026-03-12
- **What they do**: Reputation combines algorithmic scoring (upvotes, accepts) with community judgment (bounties, peer review). Privileges unlock at reputation thresholds. Community moderation (flags, edits) is itself reputation-gated. Creates self-reinforcing quality loop.
- **Why it's world-class**: Pure algorithms miss human context; pure human judgment doesn't scale. Hybrid captures both. Reputation-gated moderation means the system polices itself.
- **Applicable to**: Delegator endorsement system — community input layered on algorithmic scores. Duration-weighted credibility prevents gaming.
- **Adoption difficulty**: Medium — needs endorsement schema + UI + weighting

#### Dynamic Risk Scoring (Real-Time Adaptation)

- **Source**: AML/Fraud Industry — https://www.flagright.com/post/best-dynamic-risk-scoring-algorithm-for-aml-fraud
- **Discovered**: 2026-03-12
- **What they do**: Scores update in real-time based on behavioral events, not batch computation. Exponentially weighted moving averages with configurable decay. Anomaly detection triggers re-scoring. Risk profiles adapt to individual behavior patterns over time.
- **Why it's world-class**: Static scores become stale between computation cycles. Real-time scoring creates immediate feedback loops and faster anomaly detection.
- **Applicable to**: Event-driven score updates on vote/rationale submission. Immediate feedback: "You just gained +3 on Engagement Quality."
- **Adoption difficulty**: Hard — requires event-driven architecture shift from batch sync

### Performance & Perceived Speed

_(Patterns for loading states, optimistic UI, streaming, progressive rendering)_

### Mobile & Responsive

_(Patterns for mobile-first design, touch interactions, adaptive layouts)_

---

## Update Protocol

When adding a pattern, use this format:

```
### [Pattern Name]
- **Source**: [Product name] — [URL if available]
- **Discovered**: [DATE]
- **What they do**: [Specific implementation detail — not vague praise]
- **Why it's world-class**: [What makes this exceptional vs. merely good]
- **Applicable to**: [Which Governada features/personas could use this]
- **Adoption difficulty**: [Easy/Medium/Hard — what would it take to implement in Governada]
```
