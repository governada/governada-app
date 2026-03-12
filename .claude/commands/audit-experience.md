Deep-dive experience audit for a single persona-state. Evaluates everything that persona sees, does, and feels — from first load to core JTBD completion.

## Purpose

Audit the complete end-to-end experience for ONE persona-state combination. This replaces `/audit-ux` and `/audit-journeys` by combining UX, journey, scoring impact, data quality, performance, and vision alignment into one holistic experience audit.

This audit answers: **What is it actually like to use Governada as this person today — and what would make it remarkable?**

---

## Scope

Argument: `$ARGUMENTS`

- If empty: Ask the user which persona-state to audit. Present the 9 options below and WAIT for input. Do not proceed without a selection.
- If a persona-state name (e.g., "citizen-anonymous", "drep", "spo"): Run the full audit for that persona-state.
- If a partial match (e.g., "citizen"): Clarify which citizen sub-state (anonymous, undelegated, delegated).

---

## Persona-State Reference

### 1. citizen-anonymous

- **JTBDs**: Understand governance health at a glance. Discover why delegation matters. Find a DRep worth trusting.
- **Primary routes**: `/` (Hub), `/governance/*`, `/match`, `/help`
- **Key emotions**: curiosity --> confidence --> "I should connect my wallet"
- **Benchmark**: Robinhood's "stocks at a glance" — instant value, zero friction. A first-time visitor understands the product's value and their personal stake within 15 seconds.

### 2. citizen-undelegated

- **JTBDs**: Find the right DRep quickly. Understand alignment before committing. Delegate with confidence.
- **Primary routes**: `/` (Hub), `/match`, `/governance/representatives`, `/delegation`
- **Key emotions**: overwhelm --> clarity --> decisive action
- **Benchmark**: Spotify's music discovery — personalized, progressive, low-commitment exploration. The user never feels lost or pressured, yet the system guides them toward a decision.

### 3. citizen-delegated

- **JTBDs**: Monitor delegate performance. Understand governance impact. Stay informed without effort.
- **Primary routes**: `/` (Hub), `/delegation`, `/governance/*`, `/you/*`
- **Key emotions**: trust validated --> informed --> "my voice matters"
- **Benchmark**: Robinhood portfolio — my governance at a glance, alerts when attention needed. The default experience is calm confidence, not data overload.

### 4. drep

- **JTBDs**: See what needs my vote. Cast informed votes efficiently. Build reputation through quality participation.
- **Primary routes**: `/workspace` (action queue), `/workspace/score`, `/governance/proposals/*`, `/you/*`
- **Key emotions**: clarity --> efficiency --> pride in craft
- **Benchmark**: Linear's inbox — zero-friction action queue, satisfying completion. Every visit starts with "here's what needs you" and ends with "done."

### 5. spo

- **JTBDs**: Understand governance obligations. See pool governance impact. Maintain governance score.
- **Primary routes**: `/workspace` (gov score default), `/governance/pools/*`, `/you/*`
- **Key emotions**: awareness --> action --> validated competence
- **Benchmark**: Vercel dashboard — status-at-a-glance, act only when needed. Quiet when everything is fine, loud when attention is required.

### 6. drep-spo

- **JTBDs**: Manage dual governance roles efficiently. See unified governance impact.
- **Primary routes**: `/workspace` (both tabs), all DRep + SPO routes
- **Key emotions**: balanced control --> efficient switching --> comprehensive view
- **Benchmark**: Notion workspace switching — seamless role context. Never confused about which hat they're wearing.

### 7. cc (constitutional committee)

- **JTBDs**: Review constitutional proposals. Provide authoritative governance input.
- **Primary routes**: `/governance/committee`, `/governance/proposals/*`
- **Key emotions**: authority --> thoroughness --> institutional trust
- **Benchmark**: Supreme Court opinion tracker — gravitas, completeness, public accountability.

### 8. treasury

- **JTBDs**: Evaluate treasury proposals. Track fund allocation. Assess proposal quality.
- **Primary routes**: `/governance/treasury`, `/governance/proposals/*`
- **Key emotions**: fiduciary responsibility --> informed judgment
- **Benchmark**: AngelList deal flow — structured evaluation, clear decision framework.

### 9. researcher

- **JTBDs**: Access governance data. Analyze voting patterns. Export datasets.
- **Primary routes**: `/governance/*`, API endpoints
- **Key emotions**: data access --> analytical power --> publishable insights
- **Benchmark**: Dune Analytics — powerful queries, shareable results, community-driven analysis.

---

## Phase 1: Context Loading

Read these files before launching sub-agents. This context informs the audit framing and is required for accurate scoring.

1. Read `docs/strategy/context/persona-quick-ref.md` — persona mental models and JTBDs
2. Read the full persona doc from `docs/strategy/personas/` for the selected persona (e.g., `citizen.md`, `drep.md`, `spo.md`)
3. Read `docs/strategy/context/ux-constraints.md` — page-level JTBD constraints
4. Read `docs/strategy/context/navigation-architecture.md` — route structure and nav design
5. Read `docs/strategy/context/audit-rubric.md` — scoring anchors and calibration
6. Read `docs/strategy/context/competitive-landscape.md` — competitor benchmarks
7. Read `docs/strategy/context/world-class-patterns.md` — inspiration patterns library

After loading, confirm the persona-state and proceed to Phase 1.5.

---

## Phase 1.5: Analytics Context (if available)

Before launching sub-agents, check for real user data to ground the audit:

1. Check if PostHog analytics data is accessible (e.g., via API routes or exported data files)
2. If available, gather for this persona's primary routes:
   - Page view counts and bounce rates
   - Feature adoption rates (which elements get clicks vs. are ignored)
   - Funnel completion rates for key JTBDs
   - Session duration patterns
3. If NOT available, explicitly note: "This audit is code-based only. Findings about user behavior are inferred from code structure, not validated against real usage. Prioritize validating high-impact assumptions with analytics before building."

Pass any analytics context to all sub-agents.

---

## Phase 2: Launch 5 Parallel Sub-Agents

Launch ALL 5 simultaneously in a single message using the Agent tool. Each sub-agent gets a specific lens on the same persona-state experience. Do NOT use `isolation: "worktree"` — these are READ-ONLY audits.

### Sub-agent 1: JTBD Walk-Through

```
You are auditing the JTBD completion experience for [PERSONA-STATE] in Governada. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `docs/strategy/context/persona-quick-ref.md` for this persona's JTBDs
2. Read the full persona doc from `docs/strategy/personas/[PERSONA].md`
3. Read `docs/strategy/context/ux-constraints.md` for page-level JTBD constraints
4. Read `docs/strategy/context/navigation-architecture.md` for route structure

Walk through every JTBD for [PERSONA-STATE] as that user would experience it.

For each JTBD:
- Start at the entry point (Hub or first relevant route)
- Trace the complete flow: read the page.tsx, identify what components render, what data loads, what the user sees
- Measure: clicks to completion, information scent (can they find what they need?), dead ends where the flow stops
- Check: empty states (new user with no data), loading states (what shows while data fetches), error states (what if data fails)
- Check: edge cases for this persona (e.g., citizen with no delegation, DRep with no votes, SPO with no governance activity)
- Verdict per JTBD: COMPLETE (works well) / PARTIAL (what specifically is missing) / BROKEN (what specifically fails)

Key files to examine:
- `app/` — page.tsx files for every route this persona visits
- `components/` — UI components rendered on those pages
- `lib/data.ts` — what data powers each view
- `components/providers/SegmentProvider.tsx` — how persona detection works

Return your findings in this EXACT format:

JTBD_AUDIT:
- [JTBD name]: [COMPLETE/PARTIAL/BROKEN] — [clicks to complete] — [evidence: what works, what's missing, specific file paths]

FLOW_FRICTION:
(Top 5 friction points, ranked by severity)
- [description] | [file path] | [user impact]

DEAD_ENDS:
(Routes or states where the user gets stuck with no forward path)
- [route/state] | [what happens] | [file path]

EMPTY_STATES:
(Which views handle zero-data gracefully vs not)
- [component/route]: [GRACEFUL/MISSING/BROKEN] — [what happens with no data]

EXCESS_ELEMENTS:
(UI elements, sections, or data displays that don't serve this persona's JTBDs — candidates for removal or relocation)
- [element] | [route/component] | [why it doesn't earn its place for this persona]

ALREADY_STRONG:
(What works well — mandatory per audit-integrity.md)
- [specific thing that's good] — [why it's good] — [file path]
```

### Sub-agent 2: Intelligence & Data

```
You are auditing how well Governada's intelligence engine serves [PERSONA-STATE]. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `docs/strategy/context/persona-quick-ref.md` for what intelligence this persona needs
2. Read the full persona doc from `docs/strategy/personas/[PERSONA].md`
3. Read `docs/strategy/context/ux-constraints.md` for what each page should surface

For this persona, evaluate:

A) Intelligence Needs — What intelligence does [PERSONA-STATE] need?
   - Scores (DRep, SPO, CC Transparency, GHI)
   - Alignment (PCA space, trajectory, drift detection)
   - Recommendations (matching, similar entities, action suggestions)
   - Health metrics (governance health, treasury health, delegation health)
   - Narratives (epoch summaries, trend explanations, score interpretations)

B) Intelligence Surfacing — For each intelligence need, check whether it appears on the persona's routes.
   - Read the actual page.tsx and component files for each route
   - Check: is the intelligence present? Is it prominent or buried? Is it interpreted or raw data?
   - Score communication: does the persona understand what scores mean and why they matter?

C) Data Freshness — Check sync schedules relevant to this persona's views.
   - Read `lib/sync/` and relevant Inngest functions to understand refresh cadence
   - Is data fresh enough for this persona's expectations? (DReps need near-real-time vote data; citizens can tolerate epoch-level staleness)

D) Computation Gaps — Check whether engine capabilities exist but aren't exposed.
   - Read `lib/scoring/`, `lib/alignment/`, `lib/matching/`, `lib/ghi/`
   - Cross-reference capabilities with what's rendered on this persona's routes

E) Data Opportunities — What NEW data sources or transformations would create intelligence that's currently impossible for this persona?
   - Think beyond what exists: social proof signals, cross-chain activity, off-chain reputation, AI-derived insights, community sentiment, temporal patterns
   - For each opportunity: what data source, what it would enable, and feasibility (available / requires partnership / requires research)

Key files to examine:
- `lib/scoring/` — scoring models and what they compute
- `lib/alignment/` — alignment space and trajectory
- `lib/matching/` — matching engine capabilities
- `lib/ghi/` — governance health index
- `lib/data.ts` — data access layer
- `app/` — pages this persona visits (check what data they fetch)
- `components/` — how intelligence is displayed

Return your findings in this EXACT format:

INTELLIGENCE_AUDIT:
- [capability]: [SURFACED/HIDDEN/MISSING] — [where it appears or should appear] — [quality: raw data / contextualized / interpreted / actionable]

DATA_FRESHNESS:
- [data type]: [sync schedule] — [adequate/too-slow for this persona] — [relevant Inngest function]

SCORE_COMMUNICATION:
- [score type]: [how it's displayed] — [does the persona understand what it means?] — [is it actionable?]

GAPS:
(Engine capabilities that exist in lib/ but this persona can't access through their routes)
- [capability] | [exists in file] | [missing from route/component] | [user impact]

DATA_OPPORTUNITIES:
(New data sources or transformations that would create currently impossible intelligence)
- [capability that doesn't exist yet]: [what data source would enable it] — [what persona experience it would unlock] — [feasibility: available/requires-partnership/requires-research]

ALREADY_STRONG:
- [specific intelligence surfacing that works well] — [file path] — [why it's effective]
```

### Sub-agent 3: Craft & Emotion

```
You are auditing the emotional design and craft quality of Governada for [PERSONA-STATE]. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `docs/strategy/context/persona-quick-ref.md` for this persona's emotional journey
2. Read `docs/strategy/context/ux-constraints.md` for page-level JTBD and 5-second test criteria
3. Read `docs/strategy/context/navigation-architecture.md` for route structure

For each route this persona visits, evaluate:

A) First Impression (5-second test)
   - Read the page.tsx and its primary components
   - What is visually prominent above the fold?
   - Can a first-time user understand the page's purpose in 5 seconds?
   - Is the most important information the most visually prominent?

B) Visual Hierarchy
   - Does the page guide the eye from primary to secondary to tertiary information?
   - Is information density appropriate for this persona? (Citizens: spacious. DReps: dense but organized. Researchers: maximum density.)
   - Is whitespace used intentionally?

C) Emotional Arc
   - Does the page deliver the target emotion for this persona? (Reference the persona-state emotions above)
   - Is there a story being told, or just data being displayed?
   - Do numbers tell stories? ("72 — solid governance, but 3 missed votes" vs just "72")

D) Loading Experience
   - Are there skeleton states? Do they match content layout?
   - Is there progressive disclosure for complex pages?
   - Is perceived performance good? (Visible content within 500ms)

E) Micro-Interactions & Delight
   - Hover states, transitions, feedback on actions
   - Celebration moments (milestones, achievements, successful actions)
   - Anything that makes this experience memorable?

F) Accessibility
   - Keyboard navigation: can you reach all interactive elements?
   - Screen reader: meaningful aria-labels and landmarks?
   - Color contrast: WCAG 2.1 AA (4.5:1)?
   - Touch targets: 44x44px minimum on mobile?

G) Experience Coherence
   - Does this persona's journey feel like ONE product or a collection of features?
   - Is visual language consistent across all routes? (same card patterns, same spacing, same typography scale)
   - Is information density consistent? (or are some pages spacious while others are cramped)
   - Is tone of voice consistent? (does the Hub talk to you the same way the governance section does)
   - Are motion/animation patterns consistent? (same transition speeds, same easing, same loading patterns)

Key files to examine:
- `app/` — page.tsx files for persona's routes
- `components/` — UI components, especially hero sections, score displays, loading states
- `components/ui/` — base shadcn components and customizations
- Check for `LoadingSkeleton`, `EmptyState`, animation patterns

Return your findings in this EXACT format:

CRAFT_AUDIT:
- [route]: [emotion delivered: yes/no/partial] — [5-second test: pass/fail] — [craft highlights] — [craft gaps] — [key file paths]

DELIGHT_MOMENTS:
(Anything remarkable in this persona's experience — or "none found")
- [description] | [file path] | [why it's delightful]

ACCESSIBILITY:
- Keyboard navigation: [assessment]
- Screen reader: [assessment]
- Color contrast: [assessment]
- Touch targets: [assessment]
- Overall WCAG compliance estimate: [A / AA / AAA / partial]

COHERENCE:
- Visual language consistency: [consistent/inconsistent — specific examples]
- Information density consistency: [consistent/inconsistent — specific examples]
- Tone of voice consistency: [consistent/inconsistent — specific examples]
- Motion/animation consistency: [consistent/inconsistent — specific examples]
- Overall coherence verdict: [feels like one product / feels like a collection of features]

EMOTIONAL_ARC:
[2-3 sentences: Does the overall experience deliver the persona's target emotional journey? Be specific — reference actual routes and components.]

ALREADY_STRONG:
- [specific craft element that's well done] — [file path] — [why it's effective]
```

### Sub-agent 4: Performance & Resilience

```
You are auditing performance and resilience for [PERSONA-STATE]'s key routes in Governada. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `docs/strategy/context/navigation-architecture.md` for this persona's routes
2. For each primary route this persona visits, evaluate the following.

A) Component Architecture
   - Read the page.tsx: is it a server component or client component? (`'use client'` directive)
   - Count data fetch calls: how many Supabase/API calls does the page make?
   - Check client/server balance: are heavy components lazy-loaded? Is above-fold content server-rendered?
   - Check for `export const dynamic = 'force-dynamic'` where needed

B) Bundle Impact
   - Trace component imports: do any pages import large client-side libraries unnecessarily?
   - Check for dynamic imports (`next/dynamic`) on heavy components
   - Look for barrel exports that might pull in unused code

C) Data Fetching Strategy
   - Check TanStack Query usage: staleTime, cacheTime, prefetching
   - Check for waterfall fetches (sequential instead of parallel)
   - Check Redis caching in API routes (`lib/redis.ts`)
   - Check for unnecessary refetches on navigation

D) Resilience
   - What happens if Supabase is slow (>5s response)?
   - What happens if Koios is down? (check error handling in `lib/data.ts`)
   - What happens on slow network? (check loading states, timeouts)
   - Are there retry mechanisms? Circuit breakers?

E) Core Web Vitals Patterns
   - LCP: Is the largest contentful element above the fold server-rendered or waiting for client JS?
   - CLS: Are there layout shifts when data loads? (check for explicit dimensions on dynamic content)
   - INP: Are click handlers fast? Any heavy synchronous computation on interaction?

Key files to examine:
- `app/` — page.tsx files for persona's routes (check `'use client'`, `force-dynamic`, data fetching)
- `components/` — check for `dynamic()` imports, heavy client dependencies
- `lib/data.ts` — data fetching layer, error handling
- `lib/redis.ts` — caching strategy
- `components/Providers.tsx` — TanStack Query configuration

Return your findings in this EXACT format:

PERFORMANCE_AUDIT:
- [route]: [server/client component] — [data fetch count] — [lazy loading: yes/no] — [estimated load weight] — [specific issues]

RESILIENCE:
- Supabase slow/down: [what happens — graceful degradation or crash?] — [evidence from code]
- Koios down: [what happens] — [evidence]
- Network slow: [what happens] — [evidence]

CACHING:
- TanStack Query: [staleTime patterns, prefetch usage] — [adequate for this persona?]
- Redis: [which routes use Redis caching?] — [cache TTLs appropriate?]
- Server caching: [ISR/SSG usage, CDN headers]

CWV_RISKS:
(Specific code patterns that would hurt Core Web Vitals)
- [risk]: [file path] — [which CWV metric affected] — [severity: high/medium/low]

ALREADY_STRONG:
- [specific performance pattern that's well done] — [file path]
```

### Sub-agent 5: Competitive, Vision & Switching

```
You are evaluating [PERSONA-STATE]'s experience against competitors and the V3 vision. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `docs/strategy/context/competitive-landscape.md` for competitor analysis
2. Read `docs/strategy/ultimate-vision.md` — focus on sections relevant to this persona
3. Read `docs/strategy/context/persona-quick-ref.md` for persona JTBDs
4. Read `docs/strategy/context/build-manifest.md` for current build status
5. Read `docs/strategy/context/world-class-patterns.md` for inspiration patterns

**WebSearch required:** Before evaluating, WebSearch for the current state of at least 2 direct competitors (GovTool, DRep.tools, Tally) AND at least 1 world-class non-crypto product relevant to this persona's primary JTBD. Update `docs/strategy/context/competitive-landscape.md` with findings.

A) Competitive Positioning
For each JTBD of this persona, evaluate:
- How does Governada compare to the best alternative? Consider: GovTool, DRep.tools, Tally, SubSquare, Snapshot
- Is Governada ahead, behind, or at parity? Be specific — name the feature or flow.
- What does the competitor do better? What does Governada do better?
- **Beyond crypto:** How does Governada compare to the best non-crypto product that solves this type of problem? (e.g., for delegation: how does this compare to Robinhood's portfolio management? For workspace: how does this compare to Linear's inbox?)

B) Vision Alignment
- Read the relevant sections of `docs/strategy/ultimate-vision.md`
- Is the current implementation faithful to the vision for this persona?
- Which vision elements are realized? Which are missing? Which diverge?

C) Flywheel Contribution
The 5 flywheels: Accountability, Engagement, Content/Discourse, Viral/Identity, Integration/Distribution
- Which flywheels does this persona's experience activate?
- How effectively? (Strong activation / Weak activation / Not activated)
- What would strengthen flywheel activation for this persona?

D) Switching Moment
- What is the single interaction that would make this persona say "I'm never going back to [current alternative]"?
- Does that moment exist in Governada today? If yes, where? If no, what would it be?
- Be specific — name the feature, the data, the emotional response, and why it creates lock-in.

E) Share-Worthy Moment
- What's the single biggest opportunity to create a remarkable moment for this persona?
- Something that would make them tell someone about Governada
- Something that would make them screenshot and share

Return your findings in this EXACT format:

COMPETITIVE_AUDIT:
- [JTBD]: [Governada vs best alternative] — [ahead/behind/parity] — [specific evidence — name features, flows, or capabilities]
- [JTBD]: [Governada vs best non-crypto product for this type of problem] — [how far from world-class] — [what's missing]

VISION_ALIGNMENT:
- Overall: [faithful/partial/divergent]
- Realized: [vision elements that are implemented well]
- Missing: [vision elements not yet built for this persona]
- Divergent: [places where implementation differs from vision intent]

FLYWHEEL_ACTIVATION:
- Accountability: [strong/weak/not activated] — [evidence]
- Engagement: [strong/weak/not activated] — [evidence]
- Content/Discourse: [strong/weak/not activated] — [evidence]
- Viral/Identity: [strong/weak/not activated] — [evidence]
- Integration/Distribution: [strong/weak/not activated] — [evidence]

SWITCHING_MOMENT:
[2-3 sentences: What is the single interaction that would make this persona say "I'm never going back to [alternative]"? Does it exist today? If not, what would it be? Be specific — name the feature, the data, and the emotional response.]

SHARE_WORTHY:
[1-2 sentences: What is the single biggest opportunity to create a remarkable, share-worthy moment for this persona? Be specific — name the feature, the flow, and why it would resonate.]

ALREADY_STRONG:
- [specific competitive advantage] — [evidence]
```

---

## Phase 3: Synthesis

After all 5 sub-agents return, synthesize their findings into a unified experience assessment.

### 3.1 "A Session in the Life"

**This is the most valuable paragraph in the audit.** Write a 5-8 sentence narrative of what it is actually like to use Governada as this persona today. Be specific and honest:

- Reference real routes, real components, real friction points
- Describe what loads, what's missing, where the user pauses or gets confused
- Capture the emotional arc: does the experience deliver the target emotions?
- Include at least one specific positive ("the score ring on the DRep profile immediately communicates quality") and one specific gap ("but clicking 'see voting record' leads to an empty section with no guidance")

This narrative should make the founder see through the persona's eyes. It is the audit's thesis statement — everything else supports it.

### 3.2 Experience Coherence

Evaluate whether this persona's full journey feels like one product or a collection of features. Using Sub-agent 3's coherence findings:

- **Visual consistency**: Same card patterns, spacing, typography across all routes?
- **Density consistency**: Some pages spacious while others are cramped?
- **Tone consistency**: Hub talks differently than governance section?
- **Motion consistency**: Same transitions, loading patterns, animation timing?
- **Quality consistency**: Some pages polished, others rough? (A product with uneven quality feels worse than one that's uniformly moderate.)

**Coherence verdict**: One sentence. "This persona's experience feels like [one polished product / a collection of features at different quality levels / mostly coherent with specific breaks at X and Y]."

### 3.3 Score Card

Score 6 dimensions. Each dimension is 0-10. Total possible: 60.

Follow all scoring rules from `.claude/rules/audit-integrity.md`:

- Every score must cite specific files, routes, or measurements as evidence
- Apply the "Would I give this the same score if I wasn't looking for things to fix?" self-check
- For dimensions scored 8+: state what's strong and what would make it a 10
- For dimensions NOT evaluated (insufficient evidence): mark as NOT EVALUATED, do not guess

**E1: JTBD Completion (10 pts)**

| Score | Anchor                                                                              |
| ----- | ----------------------------------------------------------------------------------- |
| 1-3   | Core JTBDs broken or missing — user cannot accomplish primary goals                 |
| 4-6   | Core JTBDs work but with significant friction, partial flows, or missing edge cases |
| 7-8   | All core JTBDs complete with reasonable flow, minor gaps in edge cases              |
| 9-10  | Every JTBD is a polished, efficient flow with graceful edge case handling           |

**E2: Journey Friction (10 pts)**

| Score | Anchor                                                                                 |
| ----- | -------------------------------------------------------------------------------------- |
| 1-3   | Multiple dead ends, confusing navigation, high click counts for basic tasks            |
| 4-6   | Core paths work but friction points exist — unnecessary clicks, poor information scent |
| 7-8   | Smooth core flows, good information scent, minor friction in secondary paths           |
| 9-10  | Every flow feels effortless, progressive disclosure perfect, zero dead ends            |

**E3: Intelligence Leverage (10 pts)**

| Score | Anchor                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Engine capabilities exist but are not surfaced — data dump or missing entirely                                                              |
| 4-6   | Some intelligence surfaced but not interpreted — numbers without context                                                                    |
| 7-8   | Intelligence well-surfaced with context, scores communicated clearly, recommendations work                                                  |
| 9-10  | Intelligence feels like a superpower — the user knows MORE from Governada than any other source, every metric is interpreted and actionable |

**E4: Emotional Design (10 pts)**

| Score | Anchor                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | No emotional arc, generic or clinical presentation, no personality                                                          |
| 4-6   | Some emotional consideration but inconsistent — pages that delight next to pages that bore                                  |
| 7-8   | Consistent emotional arc, target emotions mostly achieved, some delight moments                                             |
| 9-10  | Every interaction reinforces the persona's emotional journey, multiple share-worthy moments, the experience has personality |

**E5: Craft & Polish (10 pts)**

| Score | Anchor                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Broken layouts, missing states, no loading feedback, accessibility failures                                               |
| 4-6   | Functional but rough — some missing states, inconsistent patterns, basic accessibility                                    |
| 7-8   | Polished core paths, good loading states, consistent patterns, WCAG AA compliance                                         |
| 9-10  | Every pixel intentional, delightful micro-interactions, excellent performance, WCAG AAA patterns, feels like a native app |

**E6: Vision Alignment (10 pts)**

| Score | Anchor                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Implementation diverges from vision — wrong navigation, wrong priorities, wrong mental model                                                  |
| 4-6   | Partially aligned — correct structure but missing vision's differentiating elements                                                           |
| 7-8   | Faithful to vision with minor gaps, flywheel contribution clear                                                                               |
| 9-10  | Fully realizes the vision for this persona, activates target flywheels, competitive advantage clear, experience would be remarkable in a demo |

Present as a summary table:

```
| Dimension              | Score | Key Evidence (1 sentence)                | Top Gap |
|------------------------|-------|------------------------------------------|---------|
| E1: JTBD Completion    | X/10  | [what sub-agent 1 found]                 | [gap]   |
| E2: Journey Friction   | X/10  | [what sub-agents 1+3 found]              | [gap]   |
| E3: Intelligence       | X/10  | [what sub-agent 2 found]                 | [gap]   |
| E4: Emotional Design   | X/10  | [what sub-agent 3 found]                 | [gap]   |
| E5: Craft & Polish     | X/10  | [what sub-agents 3+4 found]             | [gap]   |
| E6: Vision Alignment   | X/10  | [what sub-agent 5 found]                 | [gap]   |
|                        |       |                    **TOTAL**              | XX/60   |
```

### 3.4 What's Already Strong

**Mandatory section** (per audit-integrity.md). List 3-5 things this persona's experience does well today. For each:

- What it is (specific component, flow, or pattern)
- Why it's strong (evidence from sub-agents)
- File path(s)
- What would make it a 10/10 (if applicable — some things may already be excellent)

### 3.5 Subtraction Recommendations

**Mandatory section** (per audit-integrity.md). List elements in this persona's experience that should be REMOVED, simplified, or relocated. Draw from Sub-agent 1's EXCESS_ELEMENTS and Sub-agent 3's coherence findings. For each:

- What it is (specific component, section, data display, or route)
- Why it doesn't earn its place (doesn't serve this persona's JTBD, competes for attention with higher-priority elements, violates information budget)
- Where its value migrates to (another page, a deeper interaction, or nowhere — it just goes away)
- User impact of removing it (what improves by its absence)

If genuinely nothing should be removed, explicitly justify why. This requires more than "everything is useful" — name the specific constraint that makes every element essential.

### 3.6 Priority Stack

Merge ALL sub-agent findings into a single prioritized list. Every item must have all three evidence requirements from audit-integrity.md: specific code path, concrete user impact, reproduction/measurement.

**P0 — Broken or Blocking**
Broken JTBDs, dead ends, data not surfaced where critical, crashes or blank states.
These prevent the persona from accomplishing their primary goals.

**P1 — Friction & Gaps**
Friction reduction opportunities, intelligence surfacing gaps, emotional design gaps, missing edge case handling.
The persona can accomplish goals but the experience is significantly degraded.

**P2 — Polish & Parity**
Craft improvements, performance optimization, competitive parity items, accessibility improvements.
The persona's experience works but isn't polished or competitive.

**P3 — Delight & Vision**
Delight additions, share-worthy moment creation, vision stretch goals, flywheel strengthening.
The persona's experience is good but not remarkable.

For each item in the priority stack:

```
- [Title] | P[0-3] | Effort: [S/M/L] | Impact: [what improves]
  Code: [specific file path and line/component]
  User impact: [what the persona experiences today vs after fix]
  Evidence: [how this was verified — sub-agent number, specific finding]
  Risk: [what could break]
```

Apply the cost-benefit gate from audit-integrity.md:

- Large effort + marginal improvement = flag as LOW ROI, exclude from work plan unless approved
- For 7+ dimensions: apply the craft & delight exception (medium-effort delight work that makes the product demo-worthy IS high ROI)

Apply the "Would Anyone Notice?" test:

- If a real user wouldn't notice the change within 3 sessions, it is LOW PRIORITY at best
- Exception for 7+ dimensions: "Does this move the product from 'it works' to 'I want to show this to someone'?"

**Ambitious Redesigns** (per audit-integrity.md World-Class Exception):
If any dimension scores <7 and the current architecture has a ceiling below 9, present the redesign option separately with: current ceiling, redesign ceiling, effort, risk, what would change. Do not auto-exclude.

### 3.7 Data Opportunities

Consolidate Sub-agent 2's DATA_OPPORTUNITIES into a prioritized list of new data sources or transformations that would unlock currently impossible experiences for this persona. For each:

- What data source or transformation
- What experience it would enable
- Which dimensions it would improve (E1-E6) and estimated impact
- Feasibility: available / requires computation / requires new data source / requires partnership
- Priority: pursue now / pursue after foundation work / long-term opportunity

### 3.8 Work Plan

Read `docs/strategy/context/work-plan-template.md` for the chunk format.

Convert the priority stack into executable chunks:

1. Group related findings into coherent PRs (follow PR grouping rules from the template)
2. Identify parallel opportunities — chunks touching different files/domains can run as simultaneous agents
3. Flag decision points where the user must weigh in before an agent builds
4. Sequence: infrastructure before consumers, foundation before polish, shared before specific
5. Include subtraction items as first-class chunks — removals ship alongside additions

For each chunk, follow the template format:

```
## Chunk [N]: [Short Name]

**Priority:** P[0-3]
**Effort:** S/M/L/XL
**Audit dimension(s):** E[1-6]
**Expected score impact:** [e.g., "E1 JTBD Completion: 6->8 (+2)"]
**Depends on:** [Chunk N, or "None"]
**PR group:** [Letter]

### Context
[What the audit found. What the current state is. Why this matters for this persona.]

### Scope
[Specific files to modify/create. Specific behaviors to implement.]

### Decision Points
[Questions for the user, or "None — execute directly."]

### Verification
[How to confirm this chunk achieved its goal.]

### Files to Read First
[List of files the executing agent should read before starting.]
```

After presenting the work plan, ask:

**"Which chunks should I start? I can run multiple agents in parallel on independent chunks."**

---

## Phase 4: Plateau Detection

Check `.claude/audit-results/` for a previous audit of this persona-state.

- If a previous audit exists and the total score delta is ≤2 points: flag explicitly:

  > "This persona's scores have plateaued (previous: X/60, current: Y/60, delta: Z). Incremental diagnostic auditing is approaching its ceiling. Recommended next steps:
  >
  > 1. **Analytics validation**: Check PostHog data for this persona's routes to validate assumptions about user behavior
  > 2. **Generative exploration**: Run `/explore-feature` on the lowest-scoring feature to imagine fundamentally different approaches
  > 3. **Strategic reassessment**: Run `/strategy review` to check if the vision's priorities for this persona are still correct
  > 4. **User research**: Consider user interviews or session recordings for this persona to discover needs the audit can't see from code alone
  >
  > Running the same diagnostic audit again is unlikely to produce meaningful new findings."

- If no previous audit exists or delta is >2: proceed normally and note that plateau detection will be available in future runs.

Save audit results to `.claude/audit-results/[persona-state]-experience.md` for future comparison.

---

## Rules

1. **Persona-first.** Every finding must be grounded in what this specific persona experiences. Generic findings that apply to "all users" belong in `/audit` (product-level), not here. If a finding doesn't change based on which persona you're auditing, it's out of scope.

2. **Evidence from sub-agents must cite specific files, routes, and components.** Not "the homepage could be improved" but "HomeCitizen.tsx renders 4 cards but none address the undelegated citizen's primary JTBD of finding a DRep."

3. **The "A Session in the Life" narrative is mandatory.** It is the audit's thesis statement. Skip it and the audit fails its purpose. Write it AFTER reading all sub-agent findings so it reflects the complete picture.

4. **Do not score dimensions without evidence.** If a sub-agent returned incomplete results for a dimension, mark it as NOT EVALUATED with a reason. Do not guess or extrapolate.

5. **Be brutally honest.** The founder wants to see through the persona's eyes, not hear what they want to hear. A comfortable audit is a useless audit.

6. **Subtraction is mandatory.** Every audit must produce subtraction recommendations. If the agent can't find anything to remove, it's not looking hard enough — or it should explain why with specific evidence.

7. **WebSearch is mandatory for Sub-agent 5.** Competitive intelligence based solely on cached documents produces stale benchmarks. Update competitive-landscape.md and world-class-patterns.md with findings.

8. **Follow all rules from `.claude/rules/audit-integrity.md`:**
   - Evidence Requirement (code path + user impact + reproduction)
   - Cost-Benefit Gate (effort vs impact vs risk)
   - World-Class Exception (ambitious redesigns for dimensions stuck below 7)
   - The "Already Good" Requirement (list what's strong, not just what's broken)
   - Score Calibration (10 = best in class across crypto AND competitive with top Web2; 8-9 = strong, polished, don't recommend changes without clear reason)
   - The "Would Anyone Notice?" Test (real user, first 3 sessions)
   - Subtraction is a Finding (mandatory removal recommendations)
   - WebSearch Freshness Requirement (competitive intelligence must be current)
   - Anti-Patterns to Reject (no refactoring working code, no adding abstractions, no premature optimization)

9. **Sub-agents run in parallel.** Launch all 5 in a single message. Do not wait for one to finish before launching the next.

10. **Scope is one persona-state, not the whole product.** If you find issues that affect all personas, note them briefly but do not deep-dive. The priority stack should be 80%+ specific to the audited persona-state.

---

## Recommended Cadence

- **Per build session**: If you're building for a specific persona, run `/audit-experience [persona]` before and after to measure impact.
- **Monthly**: Deep audit of the persona you're actively building for.
- **Quarterly**: Cycle through all 9 persona-states. The order should reflect user base: citizen states first, then DRep, SPO, then secondary personas.
- **After major UX changes**: Run for the most-affected persona-state to verify improvement.
- **When scores plateau**: Switch to `/explore-feature` for generative alternatives or `/strategy review` for strategic reassessment. Don't keep running the same diagnostic loop.
