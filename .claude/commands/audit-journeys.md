Audit user journeys end-to-end for task completion, friction, edge cases, and regression safety.

## Purpose

Verify that each persona can complete their critical tasks through Civica with world-class efficiency and resilience. Unlike `/audit-ux` (which evaluates surfaces, intelligence leverage, and design), this audit tests **actual user flows** — clicking through the product as each persona would, measuring friction, catching broken paths, and establishing a regression baseline.

This audit answers: **Can every persona accomplish what they came here to do, and does the experience get better, not worse, over time?**

## Scope

Argument: `$ARGUMENTS`

- If empty: Full journey audit (all personas, all critical tasks)
- If a persona (e.g., "citizen", "drep", "spo", "cc", "treasury", "researcher"): All tasks for that persona
- If a specific task (e.g., "delegation", "voting", "match", "briefing"): Deep dive on that task across relevant personas
- If "regression": Re-run the baseline task checklist only (fast pass for post-deploy verification)
- If "edge-cases": Focus on unusual states and error paths only

## The Standard

Every journey is measured against these principles from the persona docs:

1. **Task, not tour.** Users come to DO something, not to explore. Every journey must have a clear task → action → confirmation arc.
2. **Persona-appropriate.** Citizens get conclusions, DReps get workspaces, SPOs get identity tools. Same data, radically different presentation.
3. **Progressive depth.** Every summary has a path to more detail. But the default experience is conclusive, not exploratory.
4. **Action-connected.** Every insight connects to an action the user can take. Dead-end pages are journey failures.

---

## Phase 1: Citizen Journeys

The anchor persona (80%+ of users). Source spec: `docs/strategy/personas/citizen.md`

### J-C1: First Visit → Understanding Value (The "Front Door")

**Task:** An anonymous visitor arrives at drepscore.io. Within 60 seconds, they understand what Cardano governance is, why it matters to them, and what they can do about it.

Walk the actual flow:

1. Land on `/` — Is the value proposition immediately clear? Is it an invitation, not a dashboard?
2. Are the two paths visible? **Stake** (find a pool) and **Govern** (find a DRep)
3. Is there free intelligence visible without wallet? (DRep browse, SPO browse, proposals, GHI)
4. Is education woven into surfaces, not isolated at `/learn`?
5. Is there a persistent, gentle wallet-connect prompt?
6. Is jargon explained in context or absent entirely?

**Friction check:**

- Seconds until value proposition is understood (target: <15s)
- Clicks to reach first meaningful content without wallet (target: ≤2)
- Jargon terms visible before explanation (target: 0)

**Rate:** TIME_TO_VALUE (seconds), CLARITY (1-5), MOTIVATION_TO_CONTINUE (1-5)

### J-C2: Anonymous → Quick Match → Delegation

**Task:** A new visitor completes Quick Match and delegates to a DRep, all in one session.

Walk the actual flow:

1. Find the Match entry point from homepage — how many clicks?
2. Start the questionnaire — is it clear what's being asked?
3. Answer all questions — how many? How long per question? Any confusing wording?
4. View results — are recommendations trustworthy? Is confidence communicated?
5. Select a DRep — can they see enough to decide? (score, philosophy summary, match %)
6. Drill into a DRep profile — does it confirm their choice?
7. Initiate delegation — is wallet connection smooth? Is the transaction clear?
8. Confirmation — do they know it worked? Is there a celebration?

**Friction check:**

- Total clicks, anonymous → delegation complete (target: <12)
- Total time (target: <3 minutes)
- Decision points where the user might abandon (identify each one)
- Error recovery if wallet connection fails mid-flow

**Edge cases:**

- User has no wallet extension installed → what happens?
- User's wallet has insufficient ADA for the transaction → error message quality?
- User is already delegated → does the flow acknowledge this?
- Quick Match returns no strong matches → what happens?

**Rate:** COMPLETION_FEASIBILITY (1-5), FLOW_CONTINUITY (1-5), ERROR_RECOVERY (1-5)

### J-C3: Returning Citizen → Epoch Briefing → Informed

**Task:** A returning authenticated citizen opens Civica at an epoch boundary and leaves feeling informed about governance within 30 seconds.

Walk the actual flow:

1. Open `/` while authenticated — what do they see? Is it a briefing or a dashboard?
2. Personal status — delegation health visible? (green/yellow/red) Staking rewards?
3. What happened — are there 2-4 headline cards summarizing this epoch?
4. Treasury update — is spending shown with "your proportional share" framing?
5. Your DRep this epoch — performance summary? One-line verdict?
6. What's coming — active proposals, upcoming deadlines?
7. Exit feeling — is the citizen confident they know "what's happening with my ADA in governance"?

**Friction check:**

- Time to feel informed (target: <30s)
- Scroll depth required to get the full picture (target: single screen or short scroll)
- Number of clicks needed for full briefing (target: 0 — it should be the landing experience)

**Edge cases:**

- Citizen has no delegation → does the briefing guide them to Quick Match?
- No notable governance activity this epoch → does it say "everything's fine" (calm is a feature)?
- Citizen's DRep was deregistered → clear alert with action path?
- First epoch after delegation → what's the briefing experience?

**Rate:** COMPREHENSION_SPEED (1-5), EMOTIONAL_CALIBRATION (1-5), ACTION_CLARITY (1-5)

### J-C4: Citizen → Treasury Understanding

**Task:** A citizen wants to understand where treasury money goes and whether it affects them.

Walk the actual flow:

1. Navigate to treasury/pulse surface — is it discoverable from the briefing?
2. Treasury balance and trend — is it clear whether treasury is growing or shrinking?
3. What got funded — are descriptions plain-English? Is delivery status shown?
4. "Your proportional share" — is it personalized? Does it feel real?
5. Accountability — can they see which DReps voted for what spending?
6. Historical trends — is spending trajectory visible?

**Friction check:**

- Clicks from home to "I understand treasury" (target: ≤2)
- Jargon in treasury explanation (target: 0 — "ADA" and "treasury" only)
- Connection to personal holdings made (target: yes, personalized)

**Edge cases:**

- No wallet connected → can they still see aggregate treasury data?
- Treasury had no activity this epoch → appropriate empty state?
- Large controversial withdrawal → is it highlighted appropriately?

### J-C5: Citizen → Civic Engagement → Voice Heard

**Task:** A citizen wants to express an opinion on an active proposal without becoming a governance expert.

Walk the actual flow:

1. Find an active proposal — from briefing? from `/engage`? from `/discover`?
2. Understand the proposal — is there a plain-English summary?
3. Express sentiment — is the mechanism clear? (Yes / No / Not sure)
4. See aggregate results — do they see how others feel?
5. Optional deeper engagement — concern flags, impact tags, endorsements available?
6. Confirmation — do they know their voice was counted?

**Friction check:**

- Clicks from home to "I expressed my opinion" (target: ≤4)
- Governance knowledge required (target: none — the summary provides context)
- Time to complete (target: <60s for basic sentiment)

**Edge cases:**

- No active proposals → empty state guides them?
- User already voted on this proposal → acknowledged gracefully?
- Citizen not connected → can they see engagement results? Prompted to connect to participate?

### J-C6: Citizen → Civic Identity → Pride

**Task:** A citizen checks their civic identity and feels a sense of belonging and growth.

Walk the actual flow:

1. Navigate to `/my-gov/identity` — discoverable from home/briefing?
2. "Citizen since" — is their history shown? Does it feel meaningful?
3. Delegation streak — visible and celebrated?
4. Governance footprint — total ADA governed, proposals touched, epochs participated?
5. Milestones — are they earned and displayed? Do they feel like achievements?
6. Shareability — can they share their civic identity externally?

**Friction check:**

- Clicks from home to identity (target: ≤2)
- Emotional response (target: pride, not confusion)

**Edge cases:**

- Brand new citizen with no history → encouraging empty state, not depressing?
- Citizen broke their streak → handled gracefully?
- Very long-tenured citizen → impressive display that rewards loyalty?

### J-C7: Citizen → DRep Evaluation → Redelegation

**Task:** A citizen suspects their DRep isn't performing well and wants to evaluate and potentially switch.

Walk the actual flow:

1. Trigger — from briefing ("your DRep missed 3 votes") or alert or curiosity?
2. View DRep profile `/drep/[id]` — is performance clearly communicated?
3. Score breakdown — does it tell the story? (not just 4 numbers)
4. Voting record — can they see what their DRep voted on?
5. Compare — can they find and compare alternative DReps?
6. Redelegate — is the flow smooth? Does it feel consequential but not scary?
7. Confirmation — clear success, new delegation acknowledged

**Friction check:**

- Clicks from "I'm concerned" to "I've redelegated" (target: <8)
- Information sufficiency to make a confident switch (target: yes, without external research)

---

## Phase 2: DRep Journeys

Source spec: `docs/strategy/personas/drep.md`

### J-D1: DRep → Inbox → "What Should I Do Right Now?"

**Task:** A DRep opens Civica and within 5 seconds knows what needs their attention, prioritized by urgency and impact.

Walk the actual flow:

1. Open `/my-gov/inbox` — is it the default DRep landing?
2. Urgent votes — proposals expiring soon, clearly marked?
3. New proposals — recently submitted, awaiting review?
4. Citizen questions — aggregated questions from delegators?
5. Delegation changes — notable shifts?
6. Score alerts — what drove score changes?
7. Each item → direct action path (click → do the thing)

**Friction check:**

- Time to answer "what should I do right now?" (target: <5s)
- Items that are informational-only with no action path (target: 0)

**Edge cases:**

- Inbox empty (no pending items) → celebratory or informative, not "nothing to see"?
- Many items (>10) → prioritized, not overwhelming?
- DRep not yet registered on-chain → guides them to register?

### J-D2: DRep → Proposal → Vote + Rationale → Submitted

**Task:** A DRep reviews a proposal, casts a vote, writes a rationale, and submits both on-chain in under 2 minutes.

Walk the actual flow:

1. Open proposal from inbox → proposal workspace `/proposal/[tx]/[i]`
2. Read AI summary — is it accurate and sufficient for a vote decision?
3. Review context — treasury impact, similar proposals, citizen sentiment, constitutional analysis
4. Cast vote — Yes / No / Abstain selection
5. Write rationale — rich-text editor, AI draft available?
6. Submit — vote + CIP-100 rationale bundled in one transaction
7. Confirmation — on-chain verification, rationale visible on profile

**Friction check:**

- Total time, open proposal → submitted (target: <2 minutes with AI draft)
- Steps between "I've decided" and "it's submitted" (target: ≤3 clicks)
- AI draft quality — useful starting point or generic filler?

**Edge cases:**

- Wallet not connected → smooth connection mid-flow?
- Transaction fails → clear error, easy retry?
- DRep wants to vote without rationale → allowed but score impact noted?
- Proposal is complex (multiple actions) → context handles complexity?
- DRep's governance key differs from payment key → wallet handling?

### J-D3: DRep → Reputation Management → Score Understanding

**Task:** A DRep wants to understand their governance reputation, identify weaknesses, and know how to improve.

Walk the actual flow:

1. View profile `/drep/[id]` — score prominent and clear?
2. Pillar breakdown — Engagement, Participation, Reliability, Identity — each explained?
3. Score trend — trajectory over time, momentum visible?
4. Strengths/weaknesses — "Your participation is top 10%, but rationale rate is below average"
5. Score simulator — "If you provide rationales on the next 5 proposals..."
6. Peer comparison — rank among active DReps, competitive context

**Friction check:**

- Time to identify their biggest improvement opportunity (target: <30s)
- Actionability of insights (target: every weakness links to what to do about it)

**Edge cases:**

- New DRep with minimal history → encouraging, not demoralizing?
- DRep at score ceiling → still useful insights?
- Score dropped significantly → clear explanation of why?

### J-D4: DRep → Delegator Communication → Constituents Informed

**Task:** A DRep wants to communicate with their delegators about their governance activity this epoch.

Walk the actual flow:

1. Navigate to communication tools — from inbox or profile?
2. View citizen questions — aggregated questions about specific votes?
3. Respond to questions — one response per cluster, publicly visible?
4. Write epoch update — AI-assisted draft from this epoch's votes?
5. Publish — update visible on profile and in delegator briefings?

**Friction check:**

- Time to respond to top citizen question (target: <2 minutes)
- Time to publish epoch update with AI assist (target: <5 minutes)

**Edge cases:**

- No citizen questions this epoch → empty state handles it?
- DRep has zero delegators → communication tools still useful for public profile?

---

## Phase 3: SPO Journeys

Source spec: `docs/strategy/personas/spo.md`

### J-S1: SPO → Governance Participation → Vote + Statement Published

**Task:** An SPO reviews proposals relevant to their governance authority, casts votes, and maintains their governance statement.

Walk the actual flow:

1. Open governance inbox — filtered to SPO-relevant proposals?
2. Review proposal with SPO-specific context — protocol parameter impact, inter-body context?
3. Vote + rationale — same integrated flow as DReps?
4. Governance statement — guided setup or update flow?
5. Statement visible on pool profile?

**Friction check:**

- Total governance time per epoch (target: <10 minutes)
- Steps to set up initial governance statement (target: <5 minutes with guided flow)

**Edge cases:**

- No proposals requiring SPO votes this epoch → clear indication?
- SPO has never voted → onboarding into governance?
- SPO is also a DRep → segment fluidity handles dual identity?

### J-S2: SPO → Pool Identity → "Share-Worthy Profile"

**Task:** An SPO builds a rich pool profile that tells their story and differentiates them from 3,000 other pools.

Walk the actual flow:

1. Navigate to pool profile `/pool/[id]` — is it rich or bare?
2. Identity: team, mission, story — editable? Guided setup?
3. Governance reputation — score, voting record, philosophy
4. Basic pool metrics — delegation, fee, pledge (not deep infrastructure)
5. Community signals — citizen endorsements, domain-specific trust
6. Shareability — can they link to this as their "home page"?

**Friction check:**

- Time to go from empty profile to share-worthy (target: <15 minutes with guided flow)
- Profile vs PoolTool differentiation clear?

**Edge cases:**

- Small pool with minimal delegation → profile still feels valuable?
- Pool with no governance activity → profile guides them to start?

### J-S3: SPO → Delegator Growth → "Governance Drives Delegation"

**Task:** An SPO wants to understand how governance participation helps them attract delegators.

Walk the actual flow:

1. View delegation analytics — trend, recent changes, sources?
2. Governance-growth connection — data showing correlation?
3. Competitive position — vs pools of similar size?
4. Governance-based discovery — can citizens find them through governance values?
5. Growth coaching — AI suggestions for improvement?

**Edge cases:**

- Pool losing delegation → empathetic insights, not just declining numbers?
- Pool not visible in discovery → guidance on why and how to improve?

---

## Phase 4: Secondary Persona Journeys (Quick Assessment)

These personas are less developed but should have at least a functional path.

### J-CC1: CC Member → Public Accountability Surface

1. CC member profile exists at `/committee/[ccHotId]`?
2. Transparency Index visible and explained?
3. Voting record with rationales?
4. Inter-body alignment context?
5. Term information and constitutional role explained?

**Rate:** BUILT / PARTIAL / STUB / NOT BUILT

### J-T1: Treasury Team → Proposal Reputation

1. Can a proposal author see their track record?
2. Is past delivery status visible to voters?
3. Can citizens report project impact?
4. Is there a "proposer profile" concept?

**Rate:** BUILT / PARTIAL / STUB / NOT BUILT

### J-R1: Researcher → Data Access

1. Is there a developer/API page at `/developers`?
2. Can they access governance data programmatically?
3. Is methodology documented for citation?
4. Are bulk exports / historical datasets available?

**Rate:** BUILT / PARTIAL / STUB / NOT BUILT

---

## Phase 5: Cross-Journey Consistency

Patterns that should work identically across all journeys.

### 5.1 Shared Component Behavior

Test each pattern across at least 3 different pages:

- **Score displays** — does ScoreRing/HexScore/ScoreCard behave the same on DRep profile, discover cards, and pool profile?
- **Loading states** — are loading skeletons consistent in timing, layout, and animation?
- **Empty states** — do they follow the same guide + educate + motivate pattern everywhere?
- **Error states** — consistent error messaging and recovery actions?
- **Navigation** — can the user always get back to where they started?

### 5.2 Segment Fluidity

Test that overlapping personas work correctly:

- A DRep sees citizen experience + DRep workspace → both functional?
- An SPO who is also a DRep → both layers present?
- A CC member → citizen + CC accountability surface?
- An unauthenticated user → consistent reduced experience across all pages?

### 5.3 Cross-Page Data Consistency

Verify that the same data appears consistently:

- A DRep's score on their profile matches their score in discover cards
- A proposal's status on the proposal page matches its status in the DRep inbox
- Treasury figures on pulse match what's shown in the citizen briefing
- GHI on the homepage matches GHI on the pulse page

### 5.4 Navigation & Wayfinding

Test navigation patterns:

- Can the user always tell where they are? (breadcrumbs, active nav, page titles)
- Can they get to any major surface within 3 clicks from any other?
- Is the back button behavior predictable? (no unexpected state loss)
- Do deep links work? (sharing a DRep profile URL loads correctly)
- Command palette (`CommandPalette.tsx`) — does it provide fast access to key surfaces?

---

## Phase 6: Edge Case Matrix

Systematic testing of unusual states across all journeys.

### 6.1 User State Edge Cases

| State                                            | Test                                           |
| ------------------------------------------------ | ---------------------------------------------- |
| No wallet extension                              | All surfaces graceful, clear path to install   |
| Wallet connected, zero ADA                       | Can browse, can't transact, clear messaging    |
| Wallet connected, not staked                     | Guided to staking, not blocked from governance |
| Wallet connected, staked, no DRep delegation     | Guided to Quick Match                          |
| Wallet connected, delegated to deregistered DRep | Clear alert with action                        |
| Wallet connected, multiple wallets               | Segment detection works                        |
| DRep with zero votes                             | Encouraging, not empty                         |
| DRep with zero delegators                        | Still useful workspace                         |
| SPO with retired pool                            | Graceful handling, not error                   |
| SPO with zero governance activity                | Guided to first vote                           |

### 6.2 Data State Edge Cases

| State                                 | Test                                           |
| ------------------------------------- | ---------------------------------------------- |
| Epoch boundary (data refreshing)      | Loading state, not stale data shown as current |
| Sync failure (stale data)             | Staleness indicator visible, not hidden        |
| New DRep (just registered, no scores) | Progressive display as data populates          |
| DRep with perfect score (100)         | Handled correctly, not treated as error        |
| DRep with zero score                  | Displayed correctly, not hidden                |
| Proposal with zero votes              | Shown correctly                                |
| Proposal expired                      | Clear status, past-tense messaging             |
| Treasury with negative epoch change   | Displayed as spending, not error               |

### 6.3 Device & Browser Edge Cases

| State                     | Test                                            |
| ------------------------- | ----------------------------------------------- |
| Mobile Safari (iOS)       | Wallet connection flow, viewport, touch targets |
| Android Chrome            | Same checks as iOS                              |
| Desktop with 125% scaling | Layout doesn't break                            |
| Slow connection (3G)      | Progressive loading, not white screen           |
| JavaScript disabled       | Meaningful server-rendered content              |
| Browser back/forward      | State preserved correctly                       |

---

## Phase 7: Regression Baseline

This section creates a measurable baseline that can be re-run to catch regressions.

### 7.1 Critical Path Checklist

A fast-pass checklist for post-deploy verification. Each item is pass/fail:

**Citizen paths:**

- [ ] Homepage loads with meaningful content (anonymous)
- [ ] Quick Match questionnaire starts and completes
- [ ] DRep discovery page loads with sorted, scored results
- [ ] DRep profile page loads with score and breakdown
- [ ] SPO discovery page loads
- [ ] Pool profile page loads with governance data
- [ ] Proposal page loads with summary and vote data
- [ ] Pulse/treasury page loads with governance health data
- [ ] Civic identity page loads for authenticated user

**DRep paths:**

- [ ] DRep inbox shows pending items (or appropriate empty state)
- [ ] Proposal workspace shows analysis + action layer
- [ ] Vote casting flow initiates (wallet prompt)
- [ ] DRep profile shows own score and breakdown

**SPO paths:**

- [ ] Pool profile shows governance score and voting record
- [ ] SPO governance inbox shows relevant proposals

**Cross-cutting:**

- [ ] Dark mode renders correctly on all key pages
- [ ] Mobile responsive layout works on all key pages
- [ ] Navigation works (can reach any major surface from any other)
- [ ] Loading skeletons appear before data loads
- [ ] Error states display correctly (force one by disconnecting network)

### 7.2 Friction Metrics Baseline

Record current values. Compare in future audits to catch regression:

| Task                                  | Metric       | Current   | Target |
| ------------------------------------- | ------------ | --------- | ------ |
| Homepage → understand value           | Seconds      | _measure_ | <15s   |
| Quick Match → delegation              | Total clicks | _measure_ | <12    |
| Quick Match → delegation              | Total time   | _measure_ | <3min  |
| Authenticated home → informed         | Seconds      | _measure_ | <30s   |
| Citizen → express opinion             | Clicks       | _measure_ | ≤4     |
| DRep → "what do I do?"                | Seconds      | _measure_ | <5s    |
| DRep → vote + rationale submitted     | Total time   | _measure_ | <2min  |
| DRep → identify improvement area      | Seconds      | _measure_ | <30s   |
| SPO → complete governance for epoch   | Total time   | _measure_ | <10min |
| SPO → share-worthy profile from empty | Total time   | _measure_ | <15min |

---

## Phase 8: Scoring (5 dimensions, 10 pts each = 50 total)

### J1: Task Completion (10 pts)

| Score | Anchor                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Critical tasks cannot be completed end-to-end, broken flows, dead ends                                                                                               |
| 4-6   | Primary persona (citizen) tasks mostly completable, DRep/SPO flows partial, some dead ends                                                                           |
| 7-8   | All citizen, DRep, and SPO critical tasks completable end-to-end, each task has clear start → action → confirmation arc, secondary personas have at least stub paths |
| 9-10  | Every task for every persona completes flawlessly, zero dead ends, task arcs feel natural and satisfying, secondary personas have full functional paths              |

### J2: Friction & Efficiency (10 pts)

| Score | Anchor                                                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Tasks require excessive clicks/time, unclear next steps, frequent abandonment points                                                                                                   |
| 4-6   | Key tasks meet targets (Quick Match <3min, briefing <30s), but some flows have unnecessary steps or confusion                                                                          |
| 7-8   | All friction metrics at or below targets, abandonment points identified and mitigated, AI assistance reduces DRep rationale time measurably, zero unnecessary clicks in critical paths |
| 9-10  | Friction metrics significantly beat targets, flows feel effortless, AI assistance is genuinely useful (not gimmicky), user testing confirms "this was easy"                            |

### J3: Edge Case Resilience (10 pts)

| Score | Anchor                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Edge cases cause crashes, blank pages, or confusing states                                                                                                       |
| 4-6   | Common edge cases handled (no wallet, empty data), but some unusual states produce poor experiences                                                              |
| 7-8   | All user state and data state edge cases handled gracefully, empty states guide toward resolution, error states offer recovery, device edge cases work           |
| 9-10  | Every edge case in the matrix produces a thoughtful, persona-appropriate response, edge cases are tested automatically in CI, zero user-reportable broken states |

### J4: Cross-Journey Consistency (10 pts)

| Score | Anchor                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Components behave differently on different pages, data inconsistencies, navigation confusion                                                                                                      |
| 4-6   | Core components consistent, some data display differences between pages, navigation mostly predictable                                                                                            |
| 7-8   | All shared components behave identically, segment fluidity works correctly, data is consistent cross-page, navigation is predictable with working deep links, command palette covers key surfaces |
| 9-10  | Perfect consistency across all surfaces, segment fluidity tested for all role combinations, automated consistency checks in CI, navigation patterns documented in design system                   |

### J5: Progressive Disclosure & Depth (10 pts)

| Score | Anchor                                                                                                                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | One-depth-fits-all — either too simple or too complex for every persona                                                                                                                                                |
| 4-6   | Citizen surfaces are simplified, some drill-down paths exist, but depth is inconsistent                                                                                                                                |
| 7-8   | Every summary has a path to more detail, depth matches persona expectations (citizens: conclusions first, DReps: analysis available, researchers: raw data accessible), progressive disclosure tested for each persona |
| 9-10  | Depth transitions are seamless (never jarring), each depth level is independently useful, users at every expertise level report "this is designed for me"                                                              |

---

## Phase 9: Work Plan

For each journey gap, propose fixes following `docs/strategy/context/work-plan-template.md`.

Categorize each issue:

- **broken** — task cannot be completed (P0)
- **friction** — task completable but too slow/confusing (P1)
- **edge-case** — unusual state produces poor experience (P2)
- **consistency** — cross-journey inconsistency (P2)
- **depth** — progressive disclosure gap (P3)
- **missing** — journey not built yet (prioritize by persona importance)

**Key decision prompts for the user:**

- Which broken journeys block the most users? (fix those first)
- Are friction targets realistic given current build stage?
- Which edge cases are most likely to be encountered by real users?
- Should regression baseline be automated into CI (e.g., Playwright tests)?
- Which secondary persona journeys should be built next?

## Recommended Cadence

- **Post-deploy**: Run `/audit-journeys regression` — fast pass critical path checklist
- **Per build session**: If you touched a journey, re-walk it end-to-end before shipping
- **Monthly**: `/audit-journeys [persona]` — deep dive on the persona you're building for
- **Quarterly**: `/audit-journeys` full — all personas, all edge cases, update friction baseline
- **After major UX changes**: `/audit-journeys edge-cases` — verify nothing broke in unusual states
