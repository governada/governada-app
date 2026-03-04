# Project Catalyst Funding Proposal — Civica

> **Status:** Active — Drafting for Fund 16
> **Parent:** [monetization-strategy.md](monetization-strategy.md) — Section 3
> **Last updated:** March 2026 (Civica rebrand, expanded vision)
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

### Target Categories for Civica

1. **Cardano Open: Ecosystem** — Governance tooling, civic engagement, ecosystem growth. This is our primary fit.
2. **Cardano Open: Developers** — If we open-source the scoring engine / API. Secondary option.
3. **Midnight: Compact DApps** — For a separate Midnight-specific proposal (if we have a concrete ZK governance concept by then).

### Budget Guidance

- Up to 75K ADA: 2 milestones + final milestone
- 75K-150K ADA: 3 milestones + final
- 150K-300K ADA: 4 milestones + final
- Over 300K ADA: 5 milestones + final

**Recommended ask: 75K-150K ADA** — Large enough to fund meaningful development, small enough to be low-risk for voters. Sweet spot for a first-time Catalyst proposer.

---

## Proposal Draft: "Civica — The Civic Hub for the Cardano Nation"

### Problem Statement

Cardano's governance model (CIP-1694) created a decentralized nation with elected representatives (DReps), infrastructure governors (SPOs), a constitutional judiciary (CC), and a public treasury. But this nation has no civic infrastructure:

1. **No accountability metrics** — There's no standardized way to evaluate whether DReps or SPOs are doing their governance jobs (voting, providing rationale, staying active).
2. **Discovery is broken** — GovTool provides a list of DReps but no scoring, filtering by values, or comparison tools. Finding aligned representatives is needlessly difficult. SPO governance participation is completely invisible.
3. **Engagement is low** — Most ADA holders don't participate in governance because the tooling makes it feel inaccessible and opaque. Citizens have no civic hub.
4. **Representatives lack feedback loops** — DReps and SPOs who do their job well have no way to demonstrate accountability or differentiate themselves.
5. **No tri-body visibility** — No tool shows how DReps, SPOs, and CC vote on the same proposals, making checks-and-balances invisible.

This undermines the entire premise of delegated governance. If citizens can't evaluate their representatives, delegation becomes random — and governance quality suffers.

### Solution

Civica is the civic hub for the Cardano Nation:

1. **Scores every DRep and SPO (0-100)** based on transparent, verifiable metrics — participation, rationale quality, reliability, and governance identity. No subjective ratings; pure on-chain data.
2. **Matches citizens to aligned representatives** through a PCA-based value-preference system across 6 governance dimensions. 60 seconds to delegation.
3. **Provides representative dashboards** with performance analytics, governance inbox, and engagement tools — giving DReps and SPOs the feedback loop they need.
4. **Tracks governance health** through the Governance Health Index, Edinburgh Decentralization Index, treasury intelligence, inter-body alignment, and AI-powered epoch recaps — making the entire governance ecosystem transparent and accessible.
5. **Serves all three governance bodies** — DReps, SPOs, and Constitutional Committee with unified analysis, enabling citizens to see the full picture.

### What Already Exists (Traction)

Civica is not a concept — it's a live, functioning platform with 90+ API routes and 22 background sync functions:

- **Production URL:** https://drepscore.io (domain transition planned)
- **DRep Scoring V3** — 4-pillar model (Engagement Quality, Effective Participation, Reliability, Governance Identity) with percentile normalization
- **SPO Governance Scoring** — 3-pillar model scoring ~3,000 pool operators on governance participation
- **PCA Alignment System** — 6D alignment with AI proposal classification, temporal trajectories
- **Governance Health Index** — 6-component system health metric + Edinburgh Decentralization Index (7 mathematical metrics)
- **Inter-Body Alignment** — Tri-body analysis across DReps, SPOs, and Constitutional Committee
- **Treasury Intelligence** — Spending effectiveness, DRep treasury judgment, accountability polls
- **Quick Match** — 60-second DRep matching with confidence scores and dimension-level explanations
- **Full Wallet Integration** — Delegation via Eternl, Lace, Typhon, Vespr (MeshJS)
- **AI-powered narratives** — Claude-powered rationale analysis, epoch recaps, governance briefs
- **Real-time data pipeline** — 22 Inngest durable functions with 30-min to weekly sync schedules

This proposal funds the **next phase** — transforming a robust governance intelligence engine into the definitive civic experience for Cardano citizens.

### What Catalyst Funding Enables

#### Phase 1: Civica Civic Experience (Months 1-3)

- Clean-sheet frontend redesign with citizen-centric UX (4-nav architecture, segment detection, action-first design)
- Score tier system with emotional design (Emerging → Bronze → Silver → Gold → Diamond → Legendary)
- Alignment drift detection and re-delegation intelligence for citizens
- SPO experience completion (claim flow, 4th scoring pillar, profile parity with DReps)

#### Phase 2: Growth & Engagement (Months 3-5)

- Governance Wrapped (per-epoch and annual shareable civic identity cards for all segments)
- DRep-to-citizen communication loop (position statements, notifications)
- Intelligent notification-driven civic life (epoch recaps, score changes, alignment drift)
- Embeddable governance badges for DRep and SPO websites

#### Phase 3: Monetization & API (Months 5-7)

- DRep Pro + SPO Pro tiers launched
- Public Governance Data API v2 with wallet and pool-tool integrations
- Developer documentation and embeddable Quick Match widget
- "State of Cardano Governance" data-driven reporting

### Milestones (for 75K-150K ADA ask)

| Milestone | Deliverable                                                                                | Verification                                                  | Timeline |
| --------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------- |
| M1        | Civica frontend launched with citizen-centric UX; score tiers live; SPO profiles at parity | Live platform demo, user metrics, DRep + SPO profiles live    | Month 3  |
| M2        | Governance Wrapped shipped; notification system live; growth loops operational             | Wrapped demo, sharing metrics, return visit data              | Month 5  |
| M3        | DRep Pro + SPO Pro launched; API v2 with 1+ integration partner                            | Revenue metrics, API docs, integration demo                   | Month 7  |
| Final     | Full project report; open-source scoring engine; sustainability plan                       | Report published, GitHub repo, revenue/sustainability metrics | Month 8  |

### Budget Breakdown (Estimated — Adjust Based on ADA Price)

| Category              | %   | Purpose                                                  |
| --------------------- | --- | -------------------------------------------------------- |
| Development           | 60% | API, features, integrations, infrastructure              |
| Infrastructure        | 15% | Hosting, database, API costs, monitoring                 |
| Design & UX           | 10% | UI improvements, education content, widget design        |
| Community & Marketing | 10% | Wallet partner outreach, governance community engagement |
| Project Management    | 5%  | Milestone reporting, coordination                        |

### Impact & Success Metrics

| Metric                             | Target by Final Milestone  |
| ---------------------------------- | -------------------------- |
| Monthly Active Citizens            | 500+                       |
| DReps with claimed profiles        | 50+                        |
| SPOs with claimed profiles         | 50+                        |
| API integration partners           | 2+                         |
| Governance proposals analyzed      | 100% of on-chain proposals |
| DRep + SPO coverage                | 100% scored                |
| Citizen satisfaction (survey)      | 80%+ positive              |
| Weekly return rate (authenticated) | 40%+                       |

### Team

- **Lead:** Dalton (Product & Analytics lead, Cardano governance enthusiast)
- Full-stack development capability (Next.js, Supabase, Cardano APIs)
- Track record: Live production platform with V3 scoring engine, 90+ API routes, 22 background functions, multi-wallet integration

### Sustainability Plan

Civica is designed for long-term sustainability beyond Catalyst funding:

- **DRep Pro + SPO Pro tiers** — Premium features for representatives ($15-25/mo in ADA)
- **Governance Data API** — Paid API access for wallets, pool comparison tools, and researchers
- **Verified Project badges** — Treasury proposal teams ($10-25/project)
- **Ecosystem sponsorships** — Cardano projects supporting governance tooling
- Open-source scoring engine increases trust while proprietary historical data provides revenue moat

### Why This Matters for Cardano

CIP-1694 created a decentralized nation but gave its citizens no civic infrastructure. Without accountability tooling, delegation becomes random noise. Without governance visibility for SPOs, staking and governance remain disconnected. Civica turns Cardano's governance experiment into a transparent, participatory democracy — the civic infrastructure the Cardano Nation needs to prove to the world that on-chain governance can work at scale.

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
- [ ] What existing governance tooling should we reference as competitors/complements? (gov.tools, DRep.tools, PoolTool — see competitive analysis in ultimate-vision.md)
