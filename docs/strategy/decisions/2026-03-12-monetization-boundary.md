# Decision: Monetization Boundary Strategy (Option C — Hybrid Gating)

Date: 2026-03-12
Status: DECIDED

Context: Phase 1 closing, Phase 2 (Engagement Flywheel) about to start. Founder wants to establish the free/pro boundary now — before building Phase 2-4 features — to avoid "giving away the farm" and ensure smooth monetization transition in Phase 5. No competitor in Cardano governance charges for tooling yet (GovTool is free, backed by Intersect).

## Question

How should we handle the free/pro boundary before monetization infrastructure (Phase 5) is built? Gate features now, label them, or keep everything free until we charge?

## Options Considered

### Option A: Hard Gate Now

- Feature flag Pro features immediately, hide them behind ProGate
- Free tier is clean, focused, and clearly scoped
- Users never get used to having Pro features for free
- Risk: thinner experience at launch when we need maximum wow factor
- Risk: comparison to free GovTool makes us look restrictive

### Option B: Soft Gate (Label, Don't Hide)

- All features accessible, but premium ones show a "Pro" badge
- Maximum experience — users see everything we've built
- Clear expectation anchoring: "this will cost money eventually"
- Risk: some users feel bait-and-switched when features go paid
- Risk: no clear distinction between free and Pro quality levels

### Option C: Hybrid (Founding Access)

- Existing features crossing the Pro line: soft-gated (accessible + "Pro" badge + "free during founding period")
- New features designed as Pro: hard-gated from day one (never free)
- Founding members get preferential pricing locked in permanently
- Combines maximum initial experience with clear future expectations
- Promotional preview periods can temporarily unlock hard-gated features

## Decision

**Option C: Hybrid (Founding Access)**

## Rationale

1. **Maximizes launch impact** — users experience our best work during the critical adoption window
2. **Sets clear expectations** — Pro badges anchor users to "this costs money" from day one
3. **Avoids bait-and-switch** — founding period is communicated upfront, not a surprise removal
4. **New Pro features launch gated** — no precedent of "everything is free" for features built after this decision
5. **Creates urgency** — founding member pricing incentivizes early adoption
6. **Aligns with restraint-as-craft** — the free tier IS the product for 80% of users; Pro is depth for professionals
7. **Preserves flywheel integrity** — engagement mechanisms, the moat, remain free forever

## Consequences

- Every Phase 2-4 feature must be classified as free or Pro before building (consult `monetization-boundary.md`)
- ProGate component and useEntitlement hook should be built as lightweight infrastructure in Phase 2
- "Pro" badge design needed — subtle, not obtrusive, consistent across surfaces
- PostHog events for Pro feature usage must be instrumented (informs Phase 5 pricing)
- Phase 5 timeline becomes clearer: monetization activates when flywheels are visibly spinning + sufficient user base
- Founding Access end date is a future decision — do NOT commit to a specific date now

## Related

- `docs/strategy/context/monetization-boundary.md` — full feature map
- `docs/strategy/ultimate-vision.md` — Phase 5 monetization section
- `lib/featureFlags.ts` — existing feature flag infrastructure (ProGate is separate)
- `components/FeatureGate.tsx` — existing gate component (ProGate is different — shows CTA, not hides)
