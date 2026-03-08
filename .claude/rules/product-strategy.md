---
paths:
  - 'docs/plans/**'
  - 'docs/strategy/**'
  - 'app/**/page.tsx'
  - 'components/**'
  - 'lib/matching/**'
  - 'lib/scoring/**'
  - 'lib/ghi/**'
  - 'lib/alignment/**'
---

# Product Strategy & First Principles

North star: `docs/strategy/ultimate-vision.md` (V2). All feature decisions align to this document.

## Context Efficiency -- Read the Right File

| Need                                    | Read This                                     | Lines    |
| --------------------------------------- | --------------------------------------------- | -------- |
| Build progress, what's shipped, gaps    | `docs/strategy/context/build-manifest.md`     | ~170     |
| Persona requirements (compact)          | `docs/strategy/context/persona-quick-ref.md`  | ~60      |
| Audit scoring criteria & benchmarks     | `docs/strategy/context/audit-rubric.md`       | ~180     |
| Work plan structure for parallel agents | `docs/strategy/context/work-plan-template.md` | ~80      |
| Full persona deep dive                  | `docs/strategy/personas/<persona>.md`         | ~200-400 |
| Updating vision / strategic audit       | `docs/strategy/ultimate-vision.md`            | ~950     |

**Default:** This rules file + manifest + persona-quick-ref are sufficient for 95% of feature decisions. Only read the full vision doc when doing strategic audits or updating the vision itself. Use the audit rubric when running `/audit`.

## Vision

Civica is the civic hub for the Cardano nation -- the one place where every ADA holder goes to understand what their stake is doing in governance, and where every governance participant goes to do their work.

## Principles (Non-Negotiable)

1. **Citizens first** -- Every feature ultimately serves the Cardano citizen. Other personas serve citizens or are accountable to them. Decision filter: "Does this make a citizen's life better?"
2. **Free core, paid power tools** -- Never gate: discovery, basic scores, delegation, Quick Match, basic alerts, essential governance operations (voting, rationale submission). Monetize competitive advantage and growth analytics.
3. **Data is the product** -- Open methodology builds trust. Historical data builds revenue. Citizen engagement data builds the moat no competitor can cross.
4. **Persona-appropriate depth** -- Citizens get summary intelligence. DReps get a workspace. SPOs get an identity platform. Different personas need different products, not different depths of the same product.
5. **Intelligence demands action** -- Every insight connects to something the user can do. Civica is where governance HAPPENS, not just where it is observed.
6. **Accountability is advantage** -- Transparency is rewarded, not imposed. DReps who provide rationales score higher. SPOs who participate get discovered. Treasury teams who deliver build reputation.
7. **Structured signal over open discourse** -- Civic engagement generates analyzable data, not noise. No forums, no threads, no moderation burden.
8. **DReps, SPOs, and Integration Partners are the sales force** -- Every shared score, every embedded widget is marketing.
9. **Ship fast, iterate faster** -- AI-assisted dev. Every step is achievable, not aspirational.
10. **Vertical depth over horizontal breadth** -- Be THE civic hub for Cardano governance.
11. **Build in public** -- Share roadmap, methodology, decisions. A governance platform that isn't itself transparent has no credibility.

## Engineering Principles

1. **Engine first, car second** -- Backend metrics/scoring must be trustworthy before surfaces consume them.
2. **Every data point feeds every other data point** -- The data flywheel. A DRep vote updates alignment, score, GHI, inter-body alignment, treasury tracking, and epoch recap simultaneously. Citizen engagement signals feed back into every surface.
3. **Scores = deterministic + transparent** -- AI for rationale quality assessment only, never the score itself. Reproducible, auditable.
4. **Voting power excluded from scoring** -- Conflicts with decentralization mission.
5. **Persona-agnostic infrastructure** -- Design APIs with `match_type`/`score_type` parameters from day one. DRep + SPO + CC flows share the same engine.
6. **Does it feed the flywheel?** -- Every feature must add to the compounding data engine, not be a dead end.

## Build Sequence

Steps 0-11 defined in `docs/strategy/ultimate-vision.md`. Foundation (Steps 0-3) is COMPLETE. Forward path: Step 4 (Citizen Experience), Step 5 (Governance Workspace), Step 6 (Community Engagement), Step 7 (Viral Growth), Step 8 (Monetization), Step 9 (API Platform), Step 10 (Advanced Intelligence), Step 11 (New Product Lines). When planning a feature:

1. Identify which step it belongs to -- don't build later steps before dependencies are solid
2. Check data dependencies -- what tables/APIs must exist first?
3. Plan snapshots -- if this creates new scores/metrics, snapshot them from day one
4. Consider all 6 personas -- does this feature serve one persona while enriching data for others?
5. Identify flywheel connections -- what other surfaces does this feature's data feed?
6. Pass the citizen test -- does this ultimately make a citizen's life better?

## Personas

6 personas served by one interconnected data flywheel: Citizens (anchor), DReps, SPOs, CC Members, Treasury Teams, Researchers. Plus Integration Partners as B2B distribution. See `docs/strategy/personas/` for detailed docs.

## Living Document

The vision doc is a living document. When completing build steps, discovering issues, or making architectural decisions that affect the vision:

1. Update status markers in `ultimate-vision.md`
2. Update checkboxes in `docs/strategy/context/build-manifest.md` (same commit)
3. Log the change in `docs/strategy/vision-changelog.md`
4. Increment minor version (2.1, 2.2...) for progress updates
5. Update persona docs if persona-specific learnings emerge
