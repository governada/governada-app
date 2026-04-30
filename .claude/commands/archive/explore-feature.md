Generative exploration of a specific feature — not "what's wrong?" but "what could this become if we had no fear and all the technology?" This is the creative counterpart to `/audit-feature` (diagnostic). Use when audit scores plateau or when you want to imagine bold alternatives.

**The mandate**: Your job is to find the idea that makes the founder say "holy shit, we have to build that." Not incremental improvements. Not "best practices." The idea that, once heard, makes the current implementation feel like a placeholder. Think: what would make a Cardano whale pull out their phone to show someone? What would make a crypto-native developer say "I've never seen anything like this in governance"? The bar is: no other governance tool — no other _tool in any domain_ — does anything like this.

## Scope

Argument: `$ARGUMENTS`

- **Required**: Feature name (e.g., "Quick Match", "DRep profile", "delegation flow", "treasury pulse")
- If empty: Ask user what feature to explore

## Phase 0: Registry Check (MANDATORY)

Before any exploration, read `docs/strategy/context/product-registry.md`. For the feature domain being explored, also read the relevant `docs/strategy/context/registry/<domain>.md` file.

State explicitly in your output:

- **"Registry check: [feature] already exists at [files/routes]"** — cite what's shipped
- **"Related features in this domain: [list]"** — cite adjacent features from the registry
- **"Connections to other subsystems: [list]"** — cite cross-domain dependencies

Skipping this step invalidates all subsequent recommendations. You cannot explore "what could this become" without first knowing what it IS.

## Phase 1: Current State Snapshot

Map the feature quickly (lighter than audit-feature Phase 1.1), starting from the registry data:

- Routes, key components, data sources, personas served (registry gives you the starting list — verify in code)
- Current score (reference most recent audit result in `.claude/audit-results/` if available)
- The core JTBD this feature serves (reference `docs/strategy/context/ux-constraints.md`)
- What's working well (don't reinvent what's strong)
- What's at its ceiling (where incremental improvement won't move the needle)

## Phase 2: Technology Possibility Scan

Before seeking inspiration from other products, understand what's _technically possible_ that most products haven't attempted. This is where moonshots come from — not from copying existing products, but from asking "what could we build that nobody has built?"

### 2a: AI/ML Capability Audit

Inventory what's available and what's within reach:

1. **What we already have**: Check `lib/ai/`, `lib/matching/`, `lib/alignment/`, `lib/scoring/`, `lib/ghi/` — what AI capabilities exist today?
2. **Embeddings & vector search**: Could semantic embeddings transform this feature? Think:
   - Embedding governance proposals to find semantic similarity (not just keyword match)
   - Embedding DRep voting histories to create "governance fingerprints"
   - Embedding user preferences to enable conversational/natural-language interaction
   - Cross-entity semantic relationships that no table join could compute
3. **Generative AI**: Where could Claude transform passive data into active intelligence?
   - Real-time narrative synthesis ("Here's what this proposal means for YOU based on your delegation history")
   - Conversational interfaces that replace form-based workflows
   - AI-generated governance briefings personalized to the user's context
   - Classification and clustering that reveals hidden structure in governance data
4. **Predictive/temporal intelligence**: What patterns could we surface that humans can't see?
   - Voting trajectory prediction ("This DRep is trending toward X position")
   - Governance sentiment momentum ("Community opinion on treasury proposals is shifting")
   - Anomaly detection ("This voting pattern is unusual — here's why it matters")
5. **Real-time & ambient intelligence**: What if the feature was alive?
   - WebSocket-driven live updates (not polling)
   - Ambient awareness ("3 proposals affecting your delegations were just submitted")
   - Proactive intelligence that surfaces before the user asks

For each capability, note: EXISTS / BUILDABLE_NOW (we have the data, need the pipeline) / NEEDS_NEW_DATA (specify what).

### 2b: Spatial & Visual Computation

What if the feature was visual-first, not text-first?

- Could the constellation globe (our signature centerpiece) be integrated into this feature's experience?
- What would a spatial/3D representation of this feature's data look like?
- Could WebGL, canvas, or advanced SVG create an experience impossible with standard UI components?
- What data relationships would be instantly intuitive as visual/spatial relationships but are currently hidden in tables and lists?

### 2c: Cross-Feature Integration Opportunities

The most novel ideas often come from connecting features that currently exist in isolation:

- What if this feature drew from or fed into 2-3 other features in surprising ways?
- What data computed for one feature could transform the experience of another?
- Could this feature become a "surface" that unifies intelligence from across the platform?

## Phase 3: Inspiration Research

WebSearch broadly for inspiration. Do NOT limit to governance or crypto. Search for:

1. **Best-in-class implementation** of this TYPE of experience anywhere in software — fintech, health tech, social, productivity, gaming, civic tech
2. **Adjacent domains** that solve similar problems differently. Examples:
   - For matching: dating apps (Hinge prompts), job platforms (LinkedIn suggestions), music discovery (Spotify Discover Weekly)
   - For scoring/reputation: credit scores (Credit Karma), fitness trackers (Whoop recovery score), gaming rank systems (chess ELO visualization)
   - For governance/voting: participatory budgeting (Decidim), structured deliberation (Pol.is), legislative tracking (GovTrack)
   - For dashboards: portfolio apps (Robinhood), health summaries (Apple Health), project status (Linear)
3. **AI-native products** that are redefining their category — Perplexity (search → conversational research), Cursor (editor → AI pair programmer), Spotify AI DJ (playlist → narrated curation), NotebookLM (documents → podcast). What is the equivalent leap for this feature?
4. **Frontier tech demos** — WebSearch for recent demos, launches, and papers involving: semantic search UX, conversational AI interfaces, real-time data visualization, generative UI, spatial computing interfaces. What exists in demos/research that hasn't made it into production products yet?
5. **Anti-patterns** — products that tried ambitious approaches and failed. What can we learn from their mistakes?

Read `docs/strategy/context/world-class-patterns.md` for previously cataloged patterns.

For each discovery worth noting, add it to `docs/strategy/context/world-class-patterns.md`.

## Phase 4: Generate 3 Alternative Concepts

Design 3 fundamentally different approaches to this feature. Not variations — genuinely different concepts that reimagine how the JTBD could be served.

**Rules for concept generation:**

- **At least one concept MUST be AI-native** — an approach that is fundamentally impossible without AI/ML. Not "current feature + AI summary." An experience where AI is the core engine: semantic matching, conversational interaction, generative intelligence, embedding-powered discovery, or predictive awareness. Think: what would this feature look like if it were built by the Perplexity or Cursor team?
- **At least one concept MUST integrate with the constellation globe or another signature visual element** — Governada's visual identity is a differentiator. How could this feature live _inside_ or _alongside_ the spatial visualization rather than in a separate traditional UI?
- At least one concept should leverage data or intelligence that doesn't exist yet (specify what's needed)
- Concepts should not be "current approach + more features" — they should rethink the approach
- **Concepts MUST be specific enough to demo.** Describe the exact interaction sequence a user would experience. Vague concepts ("AI-powered governance intelligence") are worthless. Specific concepts ("User types 'show me DReps who care about developer funding' and the globe zooms to a cluster of 12 nodes, each glowing with match intensity, while the panel streams a plain-English comparison narrative") are what we need.

**The ambition test**: After writing each concept, ask yourself: "If I showed this to the CEO of Perplexity/Linear/Spotify, would they say 'that's clever' or would they say 'yeah, that's pretty standard'?" If the latter, throw it away and think harder.

For each concept:

### Concept [A/B/C]: [Working Title]

- **Core Insight**: The one idea that makes this approach different (1 sentence)
- **Why This Is Novel**: What specific combination of technology + domain + design makes this unlike anything that exists? Be honest — if it's not novel, say so
- **Inspiration Source**: What product/pattern inspired this concept — and how does this concept go BEYOND that inspiration?
- **The Experience**: Step-by-step what the user sees and does. Be specific — describe layout, visual hierarchy, information density, interaction model, what's above the fold, what's behind interactions. **Include the exact moment where the user thinks "wow."**
- **The Emotional Arc**: What the user feels at entry → during use → at completion → when telling a friend about it
- **The Technical Engine**: What makes this work under the hood? Be specific about: embeddings, vector search, AI generation, real-time pipelines, spatial computation, data transformations. Tag each as EXISTS / BUILDABLE_NOW / NEEDS_NEW_DATA
- **Cross-Feature Connections**: How does this concept connect to or enhance other features in the platform? (Globe, Hub, profiles, workspace, etc.)
- **What It Removes**: What from the current implementation is NOT in this concept, and why
- **The Ceiling**: Maximum score this approach could achieve on F1-F6 (be honest — not everything can be 10)
- **What It Sacrifices**: Every design choice has trade-offs. Name them explicitly
- **Effort**: S/M/L/XL to build from current state
- **The Share Moment**: What would make someone screenshot/screen-record this and share it? Be specific — "look at what Governada does when you..." is the sentence we want to complete
- **The "No One Else Does This" Statement**: Complete this sentence: "Governada is the only platform where you can \_\_\_."

## Phase 5: Comparative Analysis

| Dimension            | Current       | Concept A       | Concept B | Concept C |
| -------------------- | ------------- | --------------- | --------- | --------- |
| JTBD Ceiling         | X/10          | X/10            | X/10      | X/10      |
| Emotional Impact     | X/10          | X/10            | X/10      | X/10      |
| Novelty              | X/10          | X/10            | X/10      | X/10      |
| Technical Ambition   | X/10          | X/10            | X/10      | X/10      |
| Differentiation      | X/10          | X/10            | X/10      | X/10      |
| Viral / Share Moment | X/10          | X/10            | X/10      | X/10      |
| Feasibility          | X/10          | X/10            | X/10      | X/10      |
| Data Requirements    | [what exists] | [what's needed] | ...       | ...       |
| Effort               | —             | S/M/L/XL        | S/M/L/XL  | S/M/L/XL  |

**The Question**: Which concept has the highest ceiling AND creates the strongest "I've never seen anything like this" reaction? Consider hybrid approaches that cherry-pick the best elements.

## Phase 6: Recommendation

Recommend ONE concept (or a specific hybrid) with:

1. **Why this concept wins** — highest ceiling, strongest differentiation, most likely to produce a "wow" reaction. Be explicit: what makes this unlike anything else that exists?
2. **What to steal from the other concepts** — specific elements worth incorporating
3. **The "wow" walkthrough** — describe the end-to-end user experience of the recommended concept as if you're demoing it to an investor. Make it vivid. This is the pitch.
4. **Implementation roadmap**: phases, dependencies, key technical decisions, migration path from current implementation. Call out which AI/ML infrastructure needs to be built first.
5. **What to REMOVE** from the current implementation to make room — subtraction plan
6. **New data/AI requirements** — specific data sources, embedding models, vector indices, AI pipelines, or transformations needed, with feasibility assessment
7. **Risk assessment** — what could go wrong, what's the rollback plan, what needs user validation before committing
8. **Validation suggestion** — how to test the concept's core hypothesis before building the whole thing (prototype, A/B test, user interview prompt, analytics check)

## Rules

1. **Think like a founder, not a consultant.** Consultants suggest improvements. Founders imagine what would make people switch from the competition overnight. If your concepts read like a McKinsey deck ("leverage AI to enhance user engagement"), you've failed. If they read like a pitch deck that would raise $10M ("imagine if governance felt like this"), you've succeeded.
2. **AI is a first-class creative material, not a feature to add.** Don't think "where can we add AI?" Think "what becomes possible when every governance entity has a semantic embedding, every user has an AI that understands their preferences, and every interaction generates intelligence?" Start from the capabilities and work toward the experience.
3. **The globe is sacred.** Governada's constellation globe is the visual signature. Every concept should at minimum consider: could this feature connect to or enhance the globe experience? The best concepts will find elegant ways to make the globe more alive, more useful, and more central.
4. **Be genuinely creative.** This is not a diagnostic tool. Do not produce 3 variations of the current design. Produce 3 fundamentally different approaches. If all 3 concepts are incremental improvements, you've failed the exercise.
5. **No safe choices.** Every concept should make someone say "that's ambitious." If you're hedging with safe, obviously-achievable ideas, push harder. The founder will scope down if needed — your job is to show what's possible, not what's safe.
6. **Reference real products, then surpass them.** Every concept should cite inspiration — but the concept must go beyond the inspiration. "Like Spotify Wrapped but for governance" is a starting point, not a concept.
7. **Specificity is everything.** "AI-powered matching" is not a concept. "You describe your governance priorities in plain English, the system embeds your statement against 500 DRep voting fingerprints, and the globe animates to show your top 10 matches as glowing constellation nodes with match-intensity brightness, while the Compass panel streams a personalized comparison narrative" IS a concept.
8. **Consider the whole journey.** This feature doesn't exist in isolation. How does each concept affect the persona's broader experience? Check `docs/strategy/context/navigation-architecture.md`.
9. **Respect the vision.** Read `docs/strategy/ultimate-vision.md` for the relevant sections. Concepts should advance the vision, not diverge from it. But they CAN challenge specific assumptions if the reasoning is strong.
10. **Update the pattern library.** Add any remarkable patterns discovered during research to `docs/strategy/context/world-class-patterns.md`.
