# Manifest

Slim shipped/not-shipped checklist consolidated from `docs/archive/strategy-context/build-manifest.md`.

Last auth-harness verification: 2026-04-30.

## Shipped

### Foundation Complete

- [x] DRep Score V3 with percentile normalization, momentum, and history.
- [x] SPO scoring, alignment, matching, and score snapshots.
- [x] CC Transparency Index.
- [x] Six-dimensional PCA alignment and AI proposal classification.
- [x] Governance Health Index with component metrics and snapshots.
- [x] PCA-based Quick Match and persona-agnostic matching.
- [x] Treasury intelligence APIs and treasury citizen surfaces.
- [x] Governance calendar, epoch recaps, proposal similarity cache.
- [x] SPO and CC vote fetching and sync.
- [x] Large Inngest sync surface for chain, entity, and snapshot jobs.
- [x] Public API v1 and embed surfaces.

### Phase 0 Complete: Architecture Reset

- [x] Hub at `/` as persona-adaptive control center.
- [x] Workspace at `/workspace` for governance work.
- [x] Governance section at `/governance` with proposals, representatives, pools, committee, treasury, and health.
- [x] Delegation page for citizen representation health.
- [x] You/account section for identity, settings, inbox, and public profile.
- [x] Match flow expanded toward DRep and pool representation.
- [x] Desktop sidebar, mobile bottom nav, section pill nav, and top bar.
- [x] Hub card renderer with action, status, engagement, discovery, representation, and health cards.
- [x] Persona-specific minimum lovable experiences for citizen, DRep, SPO, and anonymous users.

### Phase 1 Mostly Complete: Recompose and Activate

- [x] DRep, SPO, CC, and proposal detail pages recomposed into the new architecture.
- [x] Governance browse pages populated with active proposals, representatives, pools, committee, treasury, and health.
- [x] DRep workspace action queue, vote flow, rationales, delegators, and performance surfaces.
- [x] SPO workspace governance score, pool profile, delegators, and position surfaces.
- [x] Governance coverage calculation, Hub status card, delegation coverage, and gap/conflict alerts.
- [x] Anonymous and citizen polish: route cleanup, browse links, help page, score narratives, landing SSR, branded loader.
- [x] Anonymous conversion nudges and shareable match results.
- [x] Proposal Workspace: review queue, voting, intelligence blocks, journal, annotations, review templates.
- [x] Authoring Pipeline: drafts, lifecycle stages, review rubrics, collaboration, constitutional pre-check, preview, version diff.
- [x] Supporting infrastructure: AI provider abstraction, skills engine, diversity mechanisms, engagement provenance.

## Not Shipped

### Phase 1 Remaining

- [ ] `/you/inbox` notification pipeline wired to real governance events.
- [ ] Dual-role sidebar expansion for DRep+SPO users.

### Phase 2 Not Started: Living Platform

- [ ] Hub and entity-page engagement prompts.
- [ ] Anonymous engagement glass window and conversion loop.
- [ ] Citizen sentiment surfaced in DRep Workspace.
- [ ] Governance Impact Score and milestone system.
- [ ] Enhanced civic identity and governance resume.
- [ ] Milestone, profile, and governance-stat share cards.
- [ ] Claim-profile flows for DReps and SPOs.
- [ ] Delegator intelligence and representative sharing toolkit.

### Phase 3 Not Started: Growth Engine

- [ ] Anonymous conversion funnel instrumentation and SEO foundation.
- [ ] Epoch-boundary digest and email opt-in.
- [ ] Alert system and real `/you/inbox` events.
- [ ] Return-loop "what changed" summaries.
- [ ] Community intelligence surfaces: Citizen Mandate, Sentiment Divergence, State of Governance, Governance Temperature.
- [ ] Mobile launch audit, performance optimization, load testing, edge-case polish, legal/privacy baseline.

### Post-Launch

- [ ] Monetization layer: Stripe, subscriptions, Pro gates, paid DRep/SPO/delegator/project offerings.
- [ ] API v2, SDKs, rate limiting tiers, research exports, embeddable widgets, partner integrations.
- [ ] Advanced intelligence: delegation graph, simulation engine, Catalyst scoring, cross-ecosystem identity, enhanced Wrapped.

## Launch Posture

- Foundation is complete.
- Phase 1 is mostly complete, but notifications and dual-role navigation remain open.
- Phase 2 and Phase 3 are the public-launch product, not optional polish.
- Public launch waits until Phase 3 closes.
