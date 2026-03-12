Deep-dive audit of a specific feature examining it through all relevant dimensions (UX, journey, data, code, security) with a world-class lens that evaluates necessity, subtraction opportunities, and ambitious redesign potential.

## Scope

Argument: `$ARGUMENTS`

- **Required**: Feature name (e.g., "Quick Match", "DRep profile", "delegation flow", "treasury pulse", "proposal workspace")
- If empty: Ask user what feature to audit
- If prefixed with "refine:": Skip Phase 1, reuse previous feature map, focus on re-scoring + delta

## Phase 1: Feature Discovery

### 1.1 Map the Feature

Identify: pages/routes, components, data functions (`lib/data.ts`, API routes), backend logic (scoring, sync, alignment, matching), database tables, Inngest functions, entry points, personas served, upstream dependencies, downstream consumers.

### 1.2 Define World-Class (The Target)

WebSearch for the best implementation of this type of feature anywhere — crypto, fintech, SaaS, consumer apps, civic tech. Do NOT limit to governance tools. Answer: what product does it best? What makes it exceptional? What do competitors not even attempt? What emotion does it create?

Write a **10/10 spec** — specific to Governada's data and personas:

- **The Moment**: User's emotional arc (entry → use → completion)
- **The Experience**: Step by step what 10/10 looks and feels like (layout, information surfacing, micro-interactions, what makes it unmistakably Governada)
- **The Differentiator**: What no competitor has attempted (specific + buildable)
- **The Share Moment**: What would make someone screenshot this?

Update `docs/strategy/context/world-class-patterns.md` with any remarkable patterns discovered.

### 1.3 Delight Requirements

For features scoring 7+, identify up to 3 moments to go from functional to memorable. Each: current state → target experience → implementation sketch with enough detail for a fix agent to build.

## Phase 1.5: Existence & Necessity Test

Before evaluating quality, evaluate necessity:

1. **JTBD Justification**: Does this feature directly serve a persona's JTBD, or is it a "nice to have" that nobody asked for? Name the specific JTBD it serves.
2. **Alternative Analysis**: Could this JTBD be better served by enhancing an existing feature, merging with another feature, or a completely different approach?
3. **Absence Test**: If this feature disappeared tomorrow, would any persona notice within one week? If no: recommend removal or absorption into another feature.
4. **Information Budget**: Is this feature pulling its weight? Check `docs/strategy/context/ux-constraints.md` — does it fit within the page's information budget, or is it competing for attention with higher-priority elements?
5. **Complexity Audit**: Is this feature simpler than it could be? Could it achieve the same JTBD with fewer UI elements, fewer states, fewer interactions?

If the feature fails the existence test, stop the audit and recommend removal/absorption with a specific proposal for where its value migrates to. Do not spend 8 more phases evaluating something that shouldn't exist.

## Phase 2: Journey Audit

Walk the complete journey for each persona through this feature.

**Measure:** Steps to complete, time estimate, decision points (abandonment risk), dead ends (target: 0).

**Edge cases:** No wallet, zero ADA, missing on-chain state, first-time vs returning, data not synced, epoch boundary, extreme values, mobile/tablet/desktop.

## Phase 3: UX & Design Audit

- **Intelligence:** Backend capabilities surfaced? Numbers tell stories?
- **Emotional design:** Right emotional response? Empty states guide+educate+motivate? Successes celebrated?
- **Visual craft:** Purpose-built components? Matches app quality bar? Dark mode first-class? Pitch-deck worthy?
- **Interactions:** Loading skeletons? Error recovery? Responsive excellence? Smooth animations? Feels fast?
- **Simplicity:** Is every element earning its place? What could be removed without degrading the JTBD? What's showing data because it's available rather than because it's needed?

## Phase 4: Data & Backend Audit

- **Data integrity:** Complete? Fresh? Edge cases (NaN, null, Infinity)? Cross-table consistency?
- **Code quality:** Strict TypeScript? Error handling? Performance (N+1)? Follows project patterns? Test coverage?
- **API layer:** Input validation? Rate limiting? Auth? Response format consistent?
- **Data opportunity:** What data sources or transformations DON'T exist yet but would make this feature transcendent? What's impossible today that the right data would make trivial? Consider: social proof signals, cross-chain activity, off-chain reputation, AI-derived insights, real-time event streams, community sentiment aggregation. Be specific about what each new data source would unlock for the user experience.

## Phase 5: Security Audit (feature-scoped only)

Auth enforcement, RLS coverage, input handling, data exposure, wallet interaction security.

## Phase 6: Competitive Benchmark

Compare against direct competitors + category leaders + novel approaches for this feature type.

**WebSearch required** (per audit-integrity.md). Don't rely solely on cached competitive-landscape.md. Check what competitors are doing RIGHT NOW. Check what the best non-crypto product does for this type of experience.

Answer: "What would make someone using [best alternative] switch to Governada for this and never go back?"

## Phase 7: Scoring (6 dims × 10 pts = 60)

F1 **Journey Completeness** (10): All paths polished, zero dead ends, effortless flow.
F2 **UX & Intelligence** (10): Every number tells a story, page has ONE clear job (per `ux-constraints.md`), progressive disclosure. Penalize excess — showing everything available instead of what's needed.
F3 **Visual & Interaction Craft** (10): Purpose-built, polished dark mode, smooth animations, responsive, pitch-deck worthy.
F4 **Data & Code Quality** (10): Complete+fresh data, strict types, tested, performant, follows patterns.
F5 **Edge Case Resilience** (10): Every state produces a thoughtful, persona-appropriate response.
F6 **Security & Robustness** (10): Full auth/authz, input validated, RLS complete, rate-limited.

## Phase 8: Synthesis

1. **What's strong** — list what should NOT be changed
2. **Subtraction recommendations** — list what should be REMOVED, simplified, or relocated. For each: what it is, why it doesn't earn its place, where its value migrates to (if anywhere), and the user impact of removing it. If nothing should be removed, explicitly justify why — this is the exception.
3. **The story** — 2-3 sentences on feature state
4. **Composite score table** with key evidence
5. **Gap to world-class** — compare current vs 10/10 spec line by line, % achieved, single highest-impact change, which delight requirements are ready
6. **"Show it off" test** — would you demo this to impress someone? If no, what minimum changes flip to yes?
7. **Data opportunity summary** — top 2-3 new data sources or transformations that would unlock capabilities currently impossible

## Phase 9: Work Plan

Per `docs/strategy/context/work-plan-template.md`.

**Tier 1 (foundation, scores <7):** broken, journey, security, code. Standard cost-benefit gate.

**Tier 2 (world-class, scores 7+):** intelligence, delight, craft, edge-polish. Different lens — "does this advance the 10/10 spec?" Delight that makes it demo-worthy IS high ROI. Include implementation detail + 10/10 spec reference.

**Tier 3 (ambitious redesigns):** Per audit-integrity.md World-Class Exception. If the current approach has a ceiling below 9, present the redesign option with: current ceiling, redesign ceiling, effort, risk, and what would need to change. Do not auto-exclude — present to user for decision.

**Subtraction items:** Removals and simplifications get their own section in the work plan. They are first-class work items, not afterthoughts.

## Phase 10: Regression Baseline

Produce critical path checklist (entry → interaction → data display → outcome → exit), edge case checklist, friction measurements. Enables `refine:` mode.

Record score history: Date | F1-F6 | Total | Delta | Notes.

Map feature to user journeys — recommend `/audit-experience [persona-state]` for affected persona flows.

**Plateau detection:** If a previous audit exists for this feature and the delta is ≤2 points, flag: "Incremental auditing is approaching its ceiling for this feature. Consider `/explore-feature [feature]` for generative alternatives, or validate assumptions with user analytics before the next diagnostic cycle."
