# Strategic State — Governada

Last updated: 2026-03-12
Updated by: Strategy session (Phase 2+3 re-evaluation)

---

## Current Phase Focus

**Phase 1: Recompose & Activate** — ~95% complete. Remaining: `/you/inbox` notifications, dual-role sidebar.

**Phase 2: The Living Platform** — NOT STARTED. Launch Phase 1 of 2.
**Phase 3: The Growth Engine** — NOT STARTED. Launch Phase 2 of 2.

**PUBLIC LAUNCH** after Phase 3. Maximum buzz, not quiet rollout.

## Active Bets

1. **Hub-first architecture** — Persona-adaptive Hub replaces monolithic dashboard. Bet: users want a starting point, not a spreadsheet. Evidence: Hub card system shipped (Phase 0 MLE), coverage card wired.
2. **Intelligence over data** — Scores, narratives, and verdicts instead of raw numbers. Bet: citizens want conclusions, not charts. Evidence: GHI hero, score rings, narrative generation.
3. **Restraint as craft** — Fewer, better surfaces. Zero-sum information budget. Bet: removing features can improve the product. Evidence: V3 UX philosophy pivot, page-level JTBD constraints.
4. **DReps/SPOs as distribution channel** — Representatives share profiles to attract delegation, pulling their followers into the platform. Bet: supply-side activation markets the product for free. Phase 2d builds this.
5. **"Governance team" framing** — DRep + Pool = governance team. Coverage as differentiated concept. Bet: novel framing creates conversation and conversion. Runs through match, delegation, and Hub briefing — not a standalone card.

## Launch Strategy

- **Phases 2+3 are the launch product.** No MVP — V3 as MVP.
- **Maximum speed** with parallel execution. Phase 2 sub-phases (a-d) build simultaneously where possible.
- **Community Intelligence** (Citizen Mandate, Sentiment Divergence, Governance Temperature) feature-flagged until data volume is sufficient.
- **Email opt-in** for epoch digest — web3-first identity, email as notification channel only, never for auth.
- **Growth model:** DReps claim profiles → share → followers discover → connect wallets → engage → data enriches profiles → more sharing → compounding growth.

## Open Questions (Resolved)

1. ~~**When do we launch publicly?**~~ → After Phase 3. No shortcuts.
2. ~~**Monetization timing**~~ → Phase 4 (post-launch). Prove flywheels first.
3. ~~**SPO engagement**~~ → Phase 2d representative activation covers SPOs.
4. ~~**Mobile readiness**~~ → Phase 3d launch readiness includes mobile audit.

## Recent Decisions

| Date       | Decision                                       | Rationale                                                                                   | Ref                   |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------- |
| 2026-03-12 | Phase 2+3 strategic re-evaluation              | Old phases too narrow for launch. Merged engagement + viral/identity + rep activation.      | V3.1 vision update    |
| 2026-03-12 | Community Intelligence feature-flagged         | Not enough citizen data at launch. Collect from day one, surface when threshold is reached. | V3.1 strategy session |
| 2026-03-12 | Email opt-in for epoch digest                  | Web3-first identity. Email for notifications only, never for auth.                          | V3.1 strategy session |
| 2026-03-12 | Maximum buzz launch (not quiet rollout)        | Citizens get value without claimed DRep profiles. DReps will jump in if launch has buzz.    | V3.1 strategy session |
| 2026-03-10 | Consolidated audit suite from 11 to 6 commands | Reduce overlap, clearer ownership, persona-first auditing                                   | V3.0 vision update    |
| 2026-03-09 | V3.0 UX philosophy: "Restraint as Craft"       | Audit system was biased toward additive changes, producing clutter                          | `vision-changelog.md` |
| 2026-03-09 | Page-level JTBD constraints                    | Every page gets ONE job in <8 words, information budget is zero-sum                         | `ux-constraints.md`   |
| 2026-03-08 | Hub card system for persona adaptation         | Cards compose per persona instead of one-size-fits-all dashboard                            | Phase 0 MLE           |

## Audit Score History

Track scores across audits to measure progress over time.

| Date | Audit Type                          | Persona | Score | Notes                                                       |
| ---- | ----------------------------------- | ------- | ----- | ----------------------------------------------------------- |
| —    | No audits run yet against V3 rubric | —       | —     | Run `/audit-experience citizen-anonymous` as first baseline |

## Strategic Debt

Things we've deferred that need revisiting:

1. ~~**E2E testing**~~ — Addressed in Phase 3d launch readiness.
2. ~~**Mobile audit**~~ — Addressed in Phase 3d launch readiness.
3. ~~**Analytics instrumentation**~~ — PostHog funnel instrumentation in Phase 3a.
4. ~~**SEO**~~ — SEO foundation in Phase 3a + 3d.

Post-launch debt:

1. **Enhanced Wrapped** — Multi-role support deferred to Phase 6+.
2. **E2E journey tests** — Playwright exists but no full journey coverage. Risk: regression.

## Competitive Watch

Last landscape update: 2026-03-09 (see `competitive-landscape.md`)

Key signals to watch:

- GovTool feature additions (direct competitor backed by Intersect)
- Tally expanding to non-EVM chains
- New CIPs affecting governance tooling
- Cardano governance process changes (Conway era evolution)

---

_This file is updated after every `/strategy` session. It's the first thing the next session reads._
