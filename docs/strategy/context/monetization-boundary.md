# Monetization Boundary — Free vs. Pro

> **Purpose:** Canonical reference for which features are free forever vs. Pro (paid). Every feature decision should consult this document to maintain a clear, consistent boundary.
> **Decision:** 2026-03-12 — Option C (Hybrid). See `docs/strategy/decisions/2026-03-12-monetization-boundary.md`.
> **Last updated:** 2026-03-12

---

## The Principle

**Free = everything needed to govern effectively.** Voting, delegation, basic intelligence, engagement, matching — the full citizen experience.

**Pro = competitive advantage, growth analytics, AI-powered efficiency.** Professional tools that help DReps, SPOs, and power users outperform peers. Pro makes you better at governance; free makes governance accessible.

**The line:** If removing this feature would prevent a citizen from understanding their governance or a DRep from doing their job, it's free. If removing it would make them less competitive but still functional, it's Pro.

---

## Gating Strategy: Option C (Hybrid)

### Existing features crossing the Pro line

**Soft-gated.** Accessible during the "Founding Access" period with a subtle `Pro` badge. Users see the feature, use it, and get anchored to "this is premium." When monetization activates (Phase 5), access requires a subscription.

### New features designed as Pro

**Hard-gated from day one.** Built behind `ProGate` component. Never available for free. Promotional preview periods may temporarily unlock them.

### Founding Access period

- Starts: public launch
- Ends: Phase 5 (monetization infrastructure ships)
- During this period: soft-gated features show a "Pro — free during founding period" badge
- Founding members who sign up during this period get preferential pricing locked in permanently

---

## Feature Map: All Personas

### Free Forever (never gate)

These features are core to the governance mission. Gating any of them would undermine trust, adoption, or the flywheel.

| Feature                                | Persona    | Rationale                                     |
| -------------------------------------- | ---------- | --------------------------------------------- |
| DRep scores + narratives + profiles    | All        | Core value prop — drives adoption             |
| SPO scores + profiles                  | All        | Core value prop                               |
| CC Transparency Index                  | All        | Public accountability                         |
| Vote casting (CIP-95)                  | DRep, SPO  | Essential governance operation                |
| Rationale submission (CIP-100)         | DRep       | Essential governance operation                |
| Governance statements                  | DRep, SPO  | Essential governance operation                |
| Quick Match (DRep + Pool)              | Citizen    | Acquisition funnel — drives signups           |
| 6D alignment profiles                  | Citizen    | Powers matching, core differentiator          |
| Delegation management                  | Citizen    | Essential governance operation                |
| Governance Coverage                    | Citizen    | Unique differentiator, retention driver       |
| All 7 engagement mechanisms            | Citizen    | Flywheel fuel — gating kills the moat         |
| Epoch briefing (standard)              | Citizen    | Return hook — gating kills retention          |
| GHI + governance health                | All        | Public good, ecosystem credibility            |
| Treasury transparency                  | All        | Accountability mission                        |
| Hub (persona-adaptive)                 | All        | Primary surface, first impression             |
| Governance section (all 6 pages)       | All        | Core navigation                               |
| Basic Workspace (action queue, voting) | DRep, SPO  | Essential operations                          |
| Basic Wrapped (annual summary)         | All        | Viral marketing — free drives sharing         |
| Civic Identity Card                    | Citizen    | Identity/belonging, free reinforces value     |
| Citizen milestones (basic)             | Citizen    | Engagement reinforcement                      |
| OG image generation                    | All        | Viral distribution — every share is marketing |
| API v1 (basic tier, rate-limited)      | Researcher | Ecosystem credibility, research access        |

### Pro: DRep Pro ($15-25/mo)

| Feature                                      | Status           | Gate Type | Rationale                                     |
| -------------------------------------------- | ---------------- | --------- | --------------------------------------------- |
| Delegation analytics (trends, growth, churn) | Partially exists | Soft gate | Competitive advantage, not essential ops      |
| Score simulator ("what if I vote X?")        | Not built        | Hard gate | Professional planning tool                    |
| Competitive intelligence (vs. other DReps)   | Not built        | Hard gate | Growth tool, not essential                    |
| AI rationale drafting                        | Not built        | Hard gate | Efficiency tool, manual drafting is free      |
| Advanced inbox prioritization                | Not built        | Hard gate | Convenience, not necessity                    |
| Constitutional alignment deep analysis       | Exists           | Soft gate | Basic alignment is free; deep analysis is Pro |
| Delegator communication tools                | Not built        | Hard gate | Professional relationship management          |
| Vote impact analysis                         | Not built        | Hard gate | Professional analytics                        |

### Pro: SPO Pro ($15-25/mo)

| Feature                                 | Status           | Gate Type | Rationale                                   |
| --------------------------------------- | ---------------- | --------- | ------------------------------------------- |
| Governance reputation analytics         | Partially exists | Soft gate | Growth analytics beyond basic score display |
| Competitive landscape (vs. other pools) | Not built        | Hard gate | Growth tool                                 |
| Growth coaching + recommendations       | Not built        | Hard gate | AI-powered, professional tool               |
| Rich pool profile customization         | Not built        | Hard gate | Branding beyond basic profile               |
| Delegation growth trends                | Not built        | Hard gate | Analytics                                   |
| Staking+governance combined analytics   | Not built        | Hard gate | Cross-domain intelligence                   |

### Pro: Premium Delegator ($5-10/mo)

| Feature                                   | Status           | Gate Type | Rationale                                  |
| ----------------------------------------- | ---------------- | --------- | ------------------------------------------ |
| AI Governance Advisor (deep briefings)    | Not built        | Hard gate | Basic briefing free; AI advisor is depth   |
| Advanced alerts (DRep behavior changes)   | Not built        | Hard gate | Basic notifications free; smart alerts Pro |
| Portfolio delegation management           | Not built        | Hard gate | Multi-wallet power tool                    |
| Enhanced Wrapped (multi-role, deep stats) | Partially exists | Soft gate | Basic Wrapped free; enhanced is Pro        |
| Coverage optimization recommendations     | Not built        | Hard gate | AI-powered suggestions                     |
| Historical delegation analytics           | Not built        | Hard gate | Deep data, not essential                   |

### Pro: Verified Project ($10-25/project)

| Feature                        | Status    | Gate Type | Rationale                       |
| ------------------------------ | --------- | --------- | ------------------------------- |
| Identity verification badge    | Not built | Hard gate | Trust signal, paid verification |
| Enhanced project page          | Not built | Hard gate | Branding beyond basic proposal  |
| Milestone management suite     | Not built | Hard gate | Professional project ops        |
| Proposal drafting intelligence | Not built | Hard gate | AI-powered efficiency           |
| Citizen impact dashboard       | Not built | Hard gate | Professional analytics          |

### Pro: Researcher API ($50-200/mo)

| Feature                   | Status           | Gate Type | Rationale                             |
| ------------------------- | ---------------- | --------- | ------------------------------------- |
| Bulk data exports         | Not built        | Hard gate | Infrastructure cost, professional use |
| Historical dataset access | Partially exists | Hard gate | Deep data, paid access                |
| Higher rate limits        | Not built        | Hard gate | Infrastructure cost tier              |
| Custom query endpoints    | Not built        | Hard gate | Professional tooling                  |
| SDK access                | Not built        | Hard gate | Developer convenience                 |

---

## ProGate UX Spec

The `ProGate` component is NOT the same as `FeatureGate`. Key differences:

| Aspect           | FeatureGate              | ProGate                         |
| ---------------- | ------------------------ | ------------------------------- |
| Purpose          | Binary on/off toggle     | Entitlement-based access        |
| When off         | Hides content completely | Shows upgrade CTA + preview     |
| Visual           | Invisible                | "Pro" badge, contextual CTA     |
| Data source      | `feature_flags` table    | `subscriptions` table (Phase 5) |
| Pre-monetization | N/A                      | Shows content + "Pro" badge     |

### ProGate behavior by phase

**Pre-monetization (now → Phase 5):**

- Soft-gated features: render normally with subtle "Pro" badge
- Hard-gated features: hidden (not yet built)
- Badge text: "Pro — free during founding period"

**Post-monetization (Phase 5+):**

- Soft-gated features: check subscription → render or show ProGate CTA
- Hard-gated features: check subscription → render or show ProGate CTA
- CTA: feature preview/description + pricing + subscribe button

### ProGate component requirements (build during Phase 2-3)

```
<ProGate tier="drep_pro" feature="delegation-analytics">
  <DelegationAnalytics />
</ProGate>
```

- `tier`: which Pro package this belongs to
- `feature`: specific feature identifier (for analytics)
- Pre-monetization: renders children + badge
- Post-monetization: checks entitlement, renders children or CTA
- Tracks `pro_gate_viewed` and `pro_gate_cta_clicked` PostHog events

### Infrastructure needed

| Component                       | When to Build   | Effort |
| ------------------------------- | --------------- | ------ |
| `ProGate` component (soft mode) | Phase 2 chunk 0 | Small  |
| `useEntitlement()` hook (stub)  | Phase 2 chunk 0 | Small  |
| "Pro" badge component           | Phase 2 chunk 0 | Small  |
| `subscriptions` table           | Phase 5         | Medium |
| Stripe integration              | Phase 5         | Large  |
| `ProGate` component (hard mode) | Phase 5         | Medium |

---

## Decision Rules for New Features

When building any new feature, answer these questions:

1. **Does removing this prevent someone from governing?** → Free
2. **Does this give a competitive advantage to a professional user?** → Pro
3. **Is this AI-powered efficiency (not AI-powered intelligence)?** → Pro
4. **Does this have significant infrastructure cost per user?** → Pro
5. **Would gating this hurt the flywheel?** → Free
6. **Is this viral/shareable?** → Free (sharing is marketing)

**When in doubt, make it free.** It's easier to monetize a large engaged user base than to grow a gated product. You can always move a feature from free to Pro later (with the founding access grace period), but moving Pro to free signals desperation.

---

## Metrics to Track (Phase 2+)

- `pro_badge_viewed` — how often users see Pro badges (awareness)
- `pro_gate_cta_clicked` — conversion intent before monetization exists
- `pro_feature_used` — usage of soft-gated features during founding period
- `pro_feature_value_ratio` — features most used by power users vs. casual users

These events inform pricing and packaging decisions in Phase 5.

---

_This document is the source of truth for the free/pro boundary. Update it when features are added, reclassified, or when monetization strategy evolves._
