# Project Catalyst Funding Proposal — DRepScore

> **Status:** Active — Drafting for Fund 16
> **Parent:** [monetization-strategy.md](monetization-strategy.md) — Section 3
> **Last updated:** February 2026
> **Target fund:** Fund 16 (estimated mid-2026, prepare proposal by May 2026)

## Fund Intelligence

### Fund 15 Reference (Most Recent)
- Total budget: 18.5M ADA + 250K USDM
- 4 categories
- Max 2 proposals per participant
- Milestone-based funding (min 2 milestones + final for grants up to 75K ADA)
- New in F15: Midnight: Compact DApps category, Quadratic Voting (cube root)
- Proposal submission: Nov 10-27, 2025 (closed)
- Community review: Dec 2 - Jan 8, 2026
- Voting: TBA

### Target Categories for DRepScore
1. **Cardano Open: Ecosystem** — Governance tooling, ecosystem growth, education. This is our primary fit.
2. **Cardano Open: Developers** — If we open-source the scoring engine / API. Secondary option.
3. **Midnight: Compact DApps** — For a separate Midnight-specific proposal (if we have a concrete ZK governance concept by then).

### Budget Guidance
- Up to 75K ADA: 2 milestones + final milestone
- 75K-150K ADA: 3 milestones + final
- 150K-300K ADA: 4 milestones + final
- Over 300K ADA: 5 milestones + final

**Recommended ask: 75K-150K ADA** — Large enough to fund meaningful development, small enough to be low-risk for voters. Sweet spot for a first-time Catalyst proposer.

---

## Proposal Draft: "DRepScore — Governance Accountability & DRep Discovery Platform"

### Problem Statement

Cardano's governance model (CIP-1694) relies on Delegated Representatives (DReps) to vote on behalf of ADA holders. But delegators face critical challenges:

1. **No accountability metrics** — There's no standardized way to evaluate whether a DRep is actually doing their job (voting, providing rationale, staying active).
2. **Discovery is broken** — GovTool provides a list of DReps but no scoring, filtering by values, or comparison tools. Finding a DRep aligned with your governance preferences is needlessly difficult.
3. **Engagement is low** — Most ADA holders don't participate in governance because the tooling makes it feel inaccessible and opaque.
4. **DReps lack feedback loops** — DReps who do their job well have no way to demonstrate accountability or differentiate themselves from inactive DReps.

This undermines the entire premise of delegated governance. If delegators can't evaluate DReps, delegation becomes random — and governance quality suffers.

### Solution

DRepScore is a governance accountability platform that:

1. **Scores every DRep (0-100)** based on transparent, verifiable metrics — participation rate, rationale quality, reliability, and profile completeness. No subjective ratings; pure on-chain data.
2. **Matches delegators to aligned DReps** through a value-preference system (Treasury Conservative, Treasury Growth, Decentralization, Security, Innovation/DeFi, Transparency).
3. **Provides DRep dashboards** with performance analytics, governance inbox, and engagement tools — giving DReps the feedback loop they need.
4. **Tracks governance health** through proposal analytics, vote breakdowns, and delegation patterns — making Cardano governance transparent and accessible.

### What Already Exists (Traction)

DRepScore is not a concept — it's a live, functioning platform:

- **Production URL:** https://drepscore.app (or current URL)
- **Scoring engine V3** — Iterated 3 times based on community feedback
- **Full DRep directory** with scores, voting history, rationale analysis
- **Wallet integration** — Delegation via Eternl, Lace, Typhon, Vespr (MeshJS)
- **Value-based matching** — 6-category preference system
- **DRep dashboards** — Claimed profiles with governance inbox
- **Automated data pipeline** — Daily full sync + 30-min fast sync from Koios API
- **AI-powered rationale summaries** — Claude-powered analysis of voting rationale

This proposal funds the **next phase** — turning a working MVP into the definitive Cardano governance platform.

### What Catalyst Funding Enables

#### Phase 1: Public API & Integrations (Months 1-3)
- Design and launch a public Governance Data API
- Create embeddable DRep Score widget for third-party sites
- Outreach to wallet providers (Lace, Eternl, Vespr) for integration partnerships
- API documentation and developer portal

#### Phase 2: DRep Engagement Tools (Months 3-5)
- DRep Pro features — enhanced analytics, smart governance inbox, AI rationale assistant
- Delegator engagement tools — polls, position statements, update notifications
- Score history and trend visualization
- Push notification system for governance events

#### Phase 3: Community & Education (Months 5-7)
- Governance education content integrated into the platform
- "State of Cardano Governance" data-driven reporting
- Onboarding flow improvements for first-time governance participants
- Community feedback integration and scoring methodology refinement

### Milestones (for 75K-150K ADA ask)

| Milestone | Deliverable | Verification | Timeline |
| --- | --- | --- | --- |
| M1 | Public API beta with documentation; embeddable widget deployed | API docs live, widget demo, 1+ integration partner in discussion | Month 3 |
| M2 | DRep Pro features launched; delegator engagement tools live | Feature demo, user metrics, DRep adoption numbers | Month 5 |
| M3 | Education content live; governance reporting published; onboarding optimized | Content published, traffic metrics, user feedback survey | Month 7 |
| Final | Full project report; open-source scoring engine; sustainability plan | Report published, GitHub repo, revenue/sustainability metrics | Month 8 |

### Budget Breakdown (Estimated — Adjust Based on ADA Price)

| Category | % | Purpose |
| --- | --- | --- |
| Development | 60% | API, features, integrations, infrastructure |
| Infrastructure | 15% | Hosting, database, API costs, monitoring |
| Design & UX | 10% | UI improvements, education content, widget design |
| Community & Marketing | 10% | Wallet partner outreach, governance community engagement |
| Project Management | 5% | Milestone reporting, coordination |

### Impact & Success Metrics

| Metric | Target by Final Milestone |
| --- | --- |
| Monthly Active Users | 500+ |
| DReps with claimed profiles | 50+ |
| API integration partners | 2+ |
| Governance proposals analyzed | 100% of on-chain proposals |
| DRep coverage | 100% of registered DReps scored |
| Delegator satisfaction (survey) | 80%+ positive |

### Team

- **Lead:** Dalton (Product & Analytics lead, Cardano governance enthusiast)
- Full-stack development capability (Next.js, Supabase, Cardano APIs)
- Track record: Live production platform with V3 scoring engine, multiple wallet integrations

### Sustainability Plan

DRepScore is designed for long-term sustainability beyond Catalyst funding:
- **DRep Pro tier** — Premium features for DReps ($15-25/mo in ADA)
- **Governance Data API** — Paid API access for wallets and third-party tools
- **Ecosystem sponsorships** — Cardano projects supporting governance tooling
- Open-source scoring engine increases trust while proprietary data aggregation provides revenue moat

### Why This Matters for Cardano

CIP-1694 governance only works if delegators can make informed decisions. Without accountability tooling, delegation becomes random noise. DRepScore turns Cardano's governance experiment into a transparent, data-driven democracy — which is exactly what the ecosystem needs to prove to the world that on-chain governance can work.

---

## Proposal Optimization Checklist

Based on Catalyst scoring criteria (impact, feasibility, value for money, resources):

### Impact
- [ ] Clearly quantify how many users benefit
- [ ] Show how this improves governance participation rates
- [ ] Reference CIP-1694 and governance health metrics
- [ ] Demonstrate ecosystem-wide benefit (not just DRepScore users)

### Feasibility
- [ ] Highlight that the platform already exists and works (de-risks the proposal)
- [ ] Show technical architecture diagram
- [ ] Reference existing codebase and scoring iterations (V1-V3)
- [ ] Concrete, measurable milestones with clear verification

### Value for Money
- [ ] Budget is reasonable relative to deliverables
- [ ] Compare cost vs. building governance tooling from scratch
- [ ] Show sustainability plan (not a one-time spend)
- [ ] Milestone-based accountability (they only pay for delivered work)

### Resources
- [ ] Team capabilities clearly documented
- [ ] Technical stack is proven and production-tested
- [ ] No dependencies on unproven technology
- [ ] Verifiable references (live platform, GitHub, LinkedIn)

---

## Action Plan

Concrete pre-submission roadmap with deadlines. Monitor Fund 16 timeline via @Catalyst_onX and Catalyst Telegram; adjust dates if the submission window shifts.

### Phase 1: Community Presence — by March 15, 2026

- Join Catalyst Discord and Telegram (do not pitch — participate)
- Attend 1+ Catalyst Town Hall (schedule: check docs.projectcatalyst.io)
- Register on app.projectcatalyst.io as a proposer
- Publish 1 Cardano Forum post using DRepScore data to educate on governance (not a pitch)
- Reach out to 10-15 active DReps for feedback and relationship building

### Phase 2: Social Proof — by April 30, 2026

- Collect 5-10 written testimonials from DReps or delegators
- Pull and lock down platform metrics (MAU, DReps scored, proposals analyzed)
- Record 2-3 min demo video walkthrough of the platform
- Secure 2-3 community endorsements from recognized Cardano figures
- Make strategic decision: open-source scoring engine yes/no (resolve open question)

### Phase 3: Proposal Polish — by May 31, 2026

- Finalize proposal text based on community feedback
- Share draft in Catalyst Discord feedback channel
- Set exact ADA ask (price in USD first, ~$25-40K equivalent; convert at submission)
- Prepare architecture diagram and link to /methodology page
- Review 3-5 top-funded Fund 14/15 proposals — mirror their format and specificity
- Decide: solo proposer or add named team members with verifiable references
- Decide: one proposal or two (second for Midnight: Compact DApps category)

### Phase 4: Submit and Campaign — Fund 16 Submission Window (est. June-July 2026)

- Submit within first 48 hours of window opening
- Announce on X/Twitter, Cardano subreddit, Catalyst channels
- Respond to every community reviewer comment during review period
- Direct existing DRepScore users to vote for the proposal

## Open Questions

- [ ] Exact ADA amount to request (depends on ADA price at submission time)
- [ ] Should we open-source the scoring engine as part of the proposal? (builds trust, but reduces moat)
- [ ] Solo proposer vs. adding team members? (team = more credibility but need verifiable references)
- [ ] Should the sustainability plan include specific pricing? (shows business thinking but commits us early)
- [ ] What existing DRep tooling should we reference as competitors/complements?
