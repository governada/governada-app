Craft elevation of a specific feature from good to irrefutably world-class. Not "what's wrong?" (audit) or "what else could this be?" (explore) — but "every decision here is right, now make each one sing." This is the master craftsman's final pass.

## Scope

Argument: `$ARGUMENTS`

- **Required**: Feature name (e.g., "Author Studio", "Quick Match", "DRep profile", "delegation flow")
- If empty: Ask user what feature to elevate
- **Prerequisite**: This skill assumes the feature's concept and architecture are settled. If the feature hasn't been audited or explored yet, suggest running `/audit-feature` or `/explore-feature` first. This skill is for features scoring 7+ that need to reach 10.

## The Craft Benchmark

Governada's craft standard varies by surface type. First identify which surface the feature belongs to, then draw from the matching benchmark set:

**Studio / Workspace** (authoring, review, action queues, workspace tools):

- **Cursor** — AI-first workflows, tab-to-accept, inline intelligence, keyboard mastery
- **Linear** — Opinionated information architecture, speed as a feature, status-driven workflows
- **Notion** — Content structure richness, composable blocks, AI as slash commands

**Intelligence & Briefing** (Hub, epoch briefings, governance health, score communication):

- **Perplexity** — AI briefing with cited sources, "show your work" trust model
- **WHOOP** — Single daily number + behavioral feedback loop, readiness framing
- **Arc Browser** — Compress/expand physical metaphors for AI summarization

**Personalization & Identity** (civic identity, Wrapped, alignment, profiles):

- **Spotify** (AI DJ, Daylist, Wrapped) — Behavioral inference, narrated curation, identity synthesis
- **Apple Health / Apple Intelligence** — Ambient intelligence at the right moment

**Domain-Specific Trust** (constitutional checks, treasury analysis, methodology):

- **Harvey AI / Clio** — Domain-grounded AI, authoritative source validation, provenance trails
- **Elicit** — Structured research output, sentence-level citations

**Citizen-Facing** (anonymous users, onboarding, match, landing):

- **Robinhood** — Complex domain made instantly comprehensible
- **Duolingo** — Adaptive personalized learning, progressive education

For the feature being elevated, identify which surface type it belongs to and select 1-2 primary benchmark products. Use those as the dominant craft lens. Other benchmarks inform secondary qualities.

## Phase 1: Craft Baseline

Light mapping (reuse recent audit data if available in `.claude/audit-results/`):

1. **Current score and recent audit findings** — what's already been identified
2. **What's already excellent** — list 3-5 specific things that should NOT be touched. Be precise: component names, interactions, visual treatments that are already at or near 10/10
3. **The craft ceiling** — what's the maximum quality this feature can reach WITHOUT changing its concept or architecture? If the ceiling is below 9, this feature needs `/explore-feature` instead — flag and stop
4. **The user's muscle memory** — how do power users currently interact with this feature? What patterns have they learned that we must preserve or enhance, never break?

## Phase 2: Craft Dimensions Deep-Dive

Evaluate the feature against each craft dimension below. For each dimension, produce:

- **Current state**: What exists today (be specific — cite components, lines, behaviors)
- **10/10 target**: What world-class looks like for THIS feature on THIS dimension (not generic — specific to the feature's JTBD and persona)
- **The gap**: What specific changes close the distance (implementation-level detail)
- **Benchmark reference**: Which specific benchmark product behavior or pattern exemplifies the target (use surface-appropriate benchmarks from above)

### D1: Interaction Feel

The tactile quality of using the feature. Does every click, hover, drag, and keyboard action feel responsive, intentional, and satisfying?

- **Response latency**: Every interaction under 100ms? Optimistic updates where possible?
- **Micro-interactions**: Hover states, focus rings, active states, transitions between states — do they feel crafted or default?
- **Animation timing**: Are animations purposeful (guiding attention, showing relationships) or decorative? Duration, easing, and choreography
- **Keyboard flow**: Can a power user complete the entire workflow without a mouse? Tab order, shortcuts, command palette integration
- **Density responsiveness**: Does the feature honor the three density modes? Does compact mode feel like a power tool and comfortable mode feel like guided exploration?

_Benchmark lens: Does it feel as responsive and tactile as the primary benchmark? (Workspace → Cursor's editor. Briefing → Perplexity's streaming. Citizen → Robinhood's portfolio.)_

### D2: Information Hierarchy

Every pixel should earn its place. Is the right information at the right prominence at the right time?

- **Above the fold**: Is the single most important thing immediately visible? Does the user understand what to do within 2 seconds?
- **Progressive disclosure**: Is complexity revealed on demand, not on load? Are details available but not competing for attention?
- **Data storytelling**: Are numbers telling stories or just displaying values? Trends, comparisons, context, plain-English interpretation
- **Empty/zero states**: Do empty states educate, guide, and motivate — or just say "nothing here"?
- **Visual weight distribution**: Does the eye naturally flow through the intended reading order? Or do secondary elements compete with primary ones?

_Benchmark lens: Does information feel as precisely organized as the primary benchmark? (Workspace → Linear's project view. Briefing → WHOOP's daily readiness. Identity → Spotify's Wrapped. Trust → Elicit's structured tables.)_

### D3: Copy & Language

The words are the interface. Every label, tooltip, empty state message, error message, and heading should feel like a human who cares wrote it.

- **Heading hierarchy**: Do headings orient the user instantly? Could someone scan headings alone and understand the feature?
- **Action labels**: Are buttons and links verb-first, specific, and confident? ("Submit proposal" not "Continue", "Delegate 50K ADA" not "Confirm")
- **Help text and tooltips**: Do they answer the question the user actually has at that moment? Are they concise but sufficient?
- **Error messages**: Do they explain what went wrong, why, and what to do about it? Are they human?
- **Governance jargon**: Is domain terminology used precisely but accessibly? Is there a clear plain-English fallback for every technical term?
- **Emotional tone**: Does the language match the gravity of the action? Voting on governance should feel weighty and meaningful, not like clicking "Add to cart"

_Benchmark lens: Does the copy feel as thoughtful as the best in the surface category? (Workspace → Notion's empty states. Citizen → Robinhood's plain-English finance. Briefing → Perplexity's cited summaries. Identity → Spotify's personality labels.)_

### D4: Visual Craft

The visual execution — not the design system (that's settled), but how well this feature uses it.

- **Compass palette usage**: Is color used with purpose? Does it encode meaning (status, urgency, category) or just decorate?
- **Spacing rhythm**: Is there a consistent spatial rhythm? Are related elements grouped tightly and unrelated elements clearly separated?
- **Typography scale**: Are the right type sizes used for the right hierarchy levels? Does the feature feel typographically coherent?
- **Component quality**: Are purpose-built components genuinely purpose-built, or are they generic components with props? Do they feel crafted for this specific use?
- **Dark mode excellence**: Not just "works in dark mode" — does it look _better_ in dark mode? Glow effects, subtle gradients, contrast hierarchy that rewards the dark canvas?
- **The screenshot test**: If someone screenshots this feature, does it look impressive enough to share? What single visual moment would make someone want to show this to others?

_Benchmark lens: Would this feature look at home next to the primary benchmark product? Would a user of that product feel the same level of craft here?_

### D5: State Completeness

Every possible state the feature can be in — loading, empty, error, partial, stale, edge case — should feel intentionally designed, not like a fallback.

- **Loading states**: Skeleton loaders that match the content shape? Shimmer that indicates real progress, not just "please wait"?
- **Error recovery**: Can the user recover from every error without leaving the feature? Is the recovery path obvious?
- **Partial data**: When some data is available and some isn't, is the available data shown gracefully while missing data is handled elegantly?
- **Stale data**: When data might be outdated, is the user informed? Is there a clear refresh path?
- **Edge cases**: Extreme values (0 ADA, 1 billion ADA, 500 delegators, 1 delegator), boundary conditions (epoch boundary, first/last proposal), missing relationships (DRep with no votes, proposal with no reviews)
- **Transition states**: Between states (loading→loaded, empty→populated, success→next action), do transitions feel smooth or jarring?

### D6: AI-First Opportunity Scan

Evaluate whether AI can elevate the feature's craft — not as a checkbox, but as a genuine question about maximum user impact.

- **What intelligence exists**: What AI/ML capabilities are already wired into this feature? (Embeddings, similarity, classification, generation, consolidation)
- **What intelligence could exist**: For each user moment in the feature, ask: "Could AI make this moment dramatically more valuable?" Only flag moments where the answer is genuinely yes
- **Novel applications**: Could the vector DB, embeddings, or AI generation create an experience here that's impossible without AI? Something users couldn't get anywhere else?
- **The guardrail**: For each AI opportunity, answer honestly: "Is this higher-impact than the best non-AI alternative?" If no, discard it. AI for AI's sake is not craft

Rate each AI opportunity: **NOVEL** (no governance tool does this), **HIGH-IMPACT** (measurably better than alternatives), or **INCREMENTAL** (nice but not necessary). Only NOVEL and HIGH-IMPACT opportunities make the craft plan.

## Phase 3: The Elevation Map

Synthesize the dimension analysis into a single clear picture:

### What's Already World-Class (DO NOT TOUCH)

List every element that's at or near 10/10 with specific evidence. This section must be substantial — if this feature is 7+, most of it is already good.

### The Craft Gaps (Ranked)

For each gap, provide:

| #   | Gap            | Dimension | Current       | Target                  | Effort | Craft Impact                |
| --- | -------------- | --------- | ------------- | ----------------------- | ------ | --------------------------- |
| 1   | [specific gap] | D1-D6     | [what exists] | [what 10/10 looks like] | S/M/L  | [what changes for the user] |

**Ranking criteria**: Craft impact per unit of effort. A small animation timing fix that makes the whole feature feel 2x better ranks above a large copy rewrite that few users notice.

### The "Oh Wow" Moments

Identify 1-3 specific moments that, if elevated, would make someone say "oh wow" when using the feature. These are the highest-leverage craft investments — the moments that create emotional responses, shareability, and delight. For each:

- **The moment**: When exactly it happens in the user flow
- **Current experience**: What the user sees/feels today
- **Elevated experience**: What they'd see/feel at 10/10 (be vivid and specific)
- **Implementation sketch**: Enough detail for a build agent to execute

## Phase 4: Craft Plan

Structure as work plan chunks per `docs/strategy/context/work-plan-template.md`, but with craft-specific framing:

**Group A — Quick Wins (under 1 hour each)**
Changes that disproportionately improve feel: animation timing, copy polish, hover states, skeleton loader shapes, spacing fixes. These should be numerous — craft lives in the details.

**Group B — Craft Features (1-4 hours each)**
Substantive improvements that require real implementation: keyboard navigation systems, state machine completeness, AI intelligence integration, data storytelling components.

**Group C — "Oh Wow" Investments (4+ hours each)**
The 1-3 high-leverage moments that transform the feature from good to remarkable. These are the signature moments. Each must include a clear before/after description.

### The Subtraction List

Craft is also about removal. List anything in the current implementation that:

- Competes for attention with something more important
- Exists because it was easy to build, not because users need it
- Adds visual noise without adding meaning
- Could be combined with another element to create something stronger

For each removal: what it is, what it currently does, why removing it improves craft, and what (if anything) absorbs its value.

## Phase 5: Craft Verification Spec

Produce a checklist that a reviewer can use to verify the elevation achieved its goal:

```markdown
## Craft Checklist — [Feature Name]

### Interaction Feel

- [ ] Every primary action responds in <100ms
- [ ] Keyboard-only completion of full workflow verified
- [ ] All three density modes tested and feel intentional
- [ ] [feature-specific interaction checks]

### Information Hierarchy

- [ ] Core JTBD answerable within 2 seconds of page load
- [ ] No secondary element competes with primary element for attention
- [ ] [feature-specific hierarchy checks]

### Copy & Language

- [ ] All action labels are verb-first and specific
- [ ] All error messages explain what, why, and recovery path
- [ ] [feature-specific copy checks]

### Visual Craft

- [ ] Screenshot test: feature looks impressive in isolation
- [ ] Dark mode is the best version, not just an inversion
- [ ] [feature-specific visual checks]

### State Completeness

- [ ] All edge cases produce intentional, designed states
- [ ] All transitions between states are smooth
- [ ] [feature-specific state checks]

### AI Intelligence (if applicable)

- [ ] AI features are genuinely higher-impact than non-AI alternatives
- [ ] [feature-specific AI checks]
```

## Rules

1. **Respect what works.** The feature is already 7+. Most of the code should be unchanged. If your craft plan touches more than 30% of the feature's codebase, you're over-engineering — re-evaluate.
2. **Details over architecture.** This is not the skill for restructuring. If you find yourself wanting to change the component tree, data flow, or routing — that's an `/explore-feature` signal, not an elevation.
3. **Be specific, not aspirational.** "Improve the animation timing" is not a craft recommendation. "Change the panel slide-in from 300ms ease-in-out to 200ms cubic-bezier(0.32, 0.72, 0, 1) to match Linear's panel feel" is.
4. **Use surface-appropriate benchmarks.** Not abstract "best practices." Every recommendation should be traceable to a specific quality a benchmark product demonstrates — and the benchmark must match the feature's surface type. Don't compare a citizen briefing to Cursor's editor; compare it to Perplexity or WHOOP.
5. **AI opportunities must earn their place.** Only flag AI-first solutions that are NOVEL or HIGH-IMPACT. If a simple UI improvement does the job better, recommend that instead.
6. **The user already decided.** Don't second-guess the feature's concept, architecture, or existence. The only question is: "How do we make this execution irrefutable?"
7. **Craft is felt, not described.** For every recommendation, the test is: "Would a user FEEL this improvement?" If the answer is "only if they knew to look for it," it's low priority.
8. **Update the pattern library.** Add any remarkable craft patterns discovered during research to `docs/strategy/context/world-class-patterns.md`.
