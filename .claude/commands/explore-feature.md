Generative exploration of a specific feature — not "what's wrong?" but "what could this become?" This is the creative counterpart to `/audit-feature` (diagnostic). Use when audit scores plateau or when you want to imagine bold alternatives.

## Scope

Argument: `$ARGUMENTS`

- **Required**: Feature name (e.g., "Quick Match", "DRep profile", "delegation flow", "treasury pulse")
- If empty: Ask user what feature to explore

## Phase 1: Current State Snapshot

Map the feature quickly (lighter than audit-feature Phase 1.1):

- Routes, key components, data sources, personas served
- Current score (reference most recent audit result in `.claude/audit-results/` if available)
- The core JTBD this feature serves (reference `docs/strategy/context/ux-constraints.md`)
- What's working well (don't reinvent what's strong)
- What's at its ceiling (where incremental improvement won't move the needle)

## Phase 2: Inspiration Research

WebSearch broadly for inspiration. Do NOT limit to governance or crypto. Search for:

1. **Best-in-class implementation** of this TYPE of experience anywhere in software — fintech, health tech, social, productivity, gaming, civic tech
2. **Adjacent domains** that solve similar problems differently. Examples:
   - For matching: dating apps (Hinge prompts), job platforms (LinkedIn suggestions), music discovery (Spotify Discover Weekly)
   - For scoring/reputation: credit scores (Credit Karma), fitness trackers (Whoop recovery score), gaming rank systems (chess ELO visualization)
   - For governance/voting: participatory budgeting (Decidim), structured deliberation (Pol.is), legislative tracking (GovTrack)
   - For dashboards: portfolio apps (Robinhood), health summaries (Apple Health), project status (Linear)
3. **Emerging patterns** or technologies that could apply — AI-generated summaries, spatial interfaces, ambient intelligence, real-time collaboration, generative UI
4. **Anti-patterns** — products that tried ambitious approaches and failed. What can we learn from their mistakes?

Read `docs/strategy/context/world-class-patterns.md` for previously cataloged patterns.

For each discovery worth noting, add it to `docs/strategy/context/world-class-patterns.md`.

## Phase 3: Data Opportunity Scan

Before generating concepts, understand the raw material:

1. **What data exists today** — check `lib/data.ts`, `lib/scoring/`, `lib/alignment/`, `lib/matching/`, `lib/ghi/`, database tables
2. **What data could exist** — new sources, new computations, new combinations:
   - On-chain data we're not yet ingesting
   - Off-chain signals (social media sentiment, forum activity, news)
   - Cross-entity relationships we're not computing
   - Temporal patterns we're not tracking (trends, momentum, seasonality)
   - AI-derived intelligence (classification, summarization, prediction)
   - Community-generated data (engagement signals, sentiment, endorsements)
3. **What new data would unlock** — for each potential data source, what experience would it enable that's currently impossible?

## Phase 4: Generate 3 Alternative Concepts

Design 3 fundamentally different approaches to this feature. Not variations — genuinely different concepts that reimagine how the JTBD could be served.

**Rules for concept generation:**

- At least one concept should be something no governance tool has ever attempted
- At least one concept should be dramatically SIMPLER than the current implementation
- At least one concept should leverage data or intelligence that doesn't exist yet (specify what's needed)
- Concepts should not be "current approach + more features" — they should rethink the approach

For each concept:

### Concept [A/B/C]: [Working Title]

- **Core Insight**: The one idea that makes this approach different (1 sentence)
- **Inspiration Source**: What product/pattern inspired this concept
- **The Experience**: Step-by-step what the user sees and does. Be specific — describe layout, visual hierarchy, information density, interaction model, what's above the fold, what's behind interactions
- **The Emotional Arc**: What the user feels at entry → during use → at completion
- **Data Requirements**: What backend capabilities are needed (tag each as EXISTS / NEEDS_COMPUTATION / NEEDS_NEW_DATA)
- **What It Removes**: What from the current implementation is NOT in this concept, and why
- **The Ceiling**: Maximum score this approach could achieve on F1-F6 (be honest — not everything can be 10)
- **What It Sacrifices**: Every design choice has trade-offs. Name them explicitly
- **Effort**: S/M/L/XL to build from current state
- **The Share Moment**: What would make someone screenshot this and share it

## Phase 5: Comparative Analysis

| Dimension         | Current       | Concept A       | Concept B | Concept C |
| ----------------- | ------------- | --------------- | --------- | --------- |
| JTBD Ceiling      | X/10          | X/10            | X/10      | X/10      |
| Emotional Impact  | X/10          | X/10            | X/10      | X/10      |
| Simplicity        | X/10          | X/10            | X/10      | X/10      |
| Differentiation   | X/10          | X/10            | X/10      | X/10      |
| Feasibility       | X/10          | X/10            | X/10      | X/10      |
| Data Requirements | [what exists] | [what's needed] | ...       | ...       |
| Effort            | —             | S/M/L/XL        | S/M/L/XL  | S/M/L/XL  |

**The Question**: Which concept has the highest ceiling AND is buildable within a reasonable timeframe? Consider hybrid approaches that cherry-pick the best elements.

## Phase 6: Recommendation

Recommend ONE concept (or a specific hybrid) with:

1. **Why this concept wins** — highest ceiling, best effort-to-impact ratio, strongest differentiation
2. **What to steal from the other concepts** — specific elements worth incorporating
3. **Implementation roadmap**: phases, dependencies, key technical decisions, migration path from current implementation
4. **What to REMOVE** from the current implementation to make room — subtraction plan
5. **New data requirements** — specific data sources or transformations needed, with feasibility assessment
6. **Risk assessment** — what could go wrong, what's the rollback plan, what needs user validation before committing
7. **Validation suggestion** — how to test the concept's core hypothesis before building the whole thing (prototype, A/B test, user interview prompt, analytics check)

## Rules

1. **Be genuinely creative.** This is not a diagnostic tool. Do not produce 3 variations of the current design. Produce 3 fundamentally different approaches. If all 3 concepts are incremental improvements, you've failed the exercise.
2. **Ground in data.** Creative doesn't mean unrealistic. Every concept must be buildable with current technology and reasonable effort. Specify data requirements honestly.
3. **Think removal first.** The best concept might be dramatically simpler than the current implementation. Complexity is not ambition.
4. **No safe choices.** At least one concept should make the user say "that's ambitious." Play to win, not to not lose.
5. **Reference real products.** Every concept should cite at least one real product that does something similar successfully. Don't invent patterns in a vacuum.
6. **Consider the whole journey.** This feature doesn't exist in isolation. How does each concept affect the persona's broader experience? Check `docs/strategy/context/navigation-architecture.md`.
7. **Respect the vision.** Read `docs/strategy/ultimate-vision.md` for the relevant sections. Concepts should advance the vision, not diverge from it. But they CAN challenge specific assumptions if the reasoning is strong.
8. **Update the pattern library.** Add any remarkable patterns discovered during research to `docs/strategy/context/world-class-patterns.md`.
