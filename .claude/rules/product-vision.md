---
paths:
  - 'components/**'
  - 'app/**/page.tsx'
  - 'app/**/layout.tsx'
---

# Product Vision & UX Execution Standards

Core thesis: Civica is the **civic hub for the Cardano nation**. Users are citizens, not dashboard consumers. The product makes citizenship in a digital nation feel real.

## Design Principles

1. **Story first, data second.** Every screen tells a story before showing a spreadsheet.
2. **Financial stakes are real.** Connect governance decisions to ADA holdings. Treasury spending is "your money."
3. **Emotional moments matter.** Design for celebration, warning, pride, and discovery -- not just information.
4. **Mobile is primary.** Design for phones, adapt for desktop.
5. **Viral by design.** Every feature should have a shareable output.
6. **Persona-appropriate depth.** Citizens get a briefing, not a dashboard. DReps get a workspace. SPOs get an identity platform. Don't give everyone the same product at different scroll depths.
7. **Return users != new users.** Epoch briefing for returning citizens. Simplified onboarding for anonymous visitors.

## Persona Experiences (NOT one-size-fits-all)

**Citizens (80%+):** Summary intelligence. Epoch briefing, delegation health (green/yellow/red), treasury transparency, civic identity. 30-second check-in. NOT dashboards, charts, or analytics. See `docs/strategy/personas/citizen.md`.

**DReps:** Governance workspace. Vote casting, rationale submission, proposal analysis, reputation management, delegator communication. Professional tooling on top of citizen experience. See `docs/strategy/personas/drep.md`.

**SPOs:** Identity platform. Governance reputation, rich pool profile, delegator communication, governance-based pool discovery. See `docs/strategy/personas/spo.md`.

**Anonymous visitors:** Simplified, unintimidating. Two paths: Stake (SPO discovery) or Govern (Quick Match). Education woven in, not separate. Gentle wallet connect prompts.

## UX Rules

- Never show marketing copy to a returning authenticated user
- Empty states must guide, educate, and motivate -- never just "no results found"
- Scores must tell stories: "72 means your DRep is solid but missed 3 recent votes" -- not just "72"
- Filter controls: progressive disclosure (search + sort visible, rest behind "Filters")
- Every shareable moment needs a beautiful, branded output image
- Citizens get conclusions, not charts. "Your DRep is doing well" beats a score trend graph.
- Smart alerts default to quiet. Most epochs: "Everything's fine." When something matters, the alert earns trust.
- Every alert, every insight connects to an action the user can take.

## Ambitious by Default -- Engineering Standard

Every user-facing surface should look purpose-built, not assembled from a component library.

1. **Default to the most visually distinctive option.** Custom SVG over Recharts, physics-based animations (Framer Motion/spring) over CSS transitions, bespoke visualizations over chart libraries. The user must explicitly request the simpler option.
2. **Performance is a constraint, not a goal.** Lazy-loading (`next/dynamic`, `ssr: false`), code splitting, and adaptive quality tiers handle bundle concerns. A 200KB lazy-loaded package with zero LCP impact is always acceptable for a premium result.
3. **Every screenshot must be unmistakably Civica.** If a component could exist in any shadcn/Next.js app, it needs more work.
4. **"Good enough" creates rework; "premium" ships once.** The constellation hero is React Three Fiber with WebGL bloom -- that's the baseline for hero-level visuals.

**Applies to:** hero sections, profile pages, data visualizations, OG images, share cards, onboarding.
**Exception:** admin tools, internal dashboards -- functional over beautiful.
