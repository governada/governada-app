Deep-dive audit of a specific feature examining it through all relevant dimensions (UX, journey, intelligence, craft, vision) and all persona lenses. Produces a Minimum Lovable Experience verdict with both ambitious improvement recommendations and explicit subtraction/deprecation candidates.

## Purpose

Audit a single page, route, or feature from a **Minimum Lovable Experience** perspective. This command answers: **Does this page tell a clear, compelling story that delights every persona who visits it — and what would make it world-class?**

Unlike `/audit-experience` (one persona, all their routes), this command is **page-first**: one page, all relevant personas. It evaluates whether the page earns its place in the product and whether everything on it earns its place on the page.

The MLE standard is:

- **Minimum**: What's the least this page must do brilliantly? Anything below that bar is P0.
- **Lovable**: Does interacting with this page create a moment of delight, clarity, or trust? Not just "it works" but "I want to come back."
- **Experience**: The complete journey — from arriving at the page, through understanding it, to taking action or leaving informed.

---

## Scope

Argument: `$ARGUMENTS`

- If empty: Ask the user which page or feature to audit. Present the main routes from the navigation architecture and WAIT for input.
- If a route path (e.g., "/governance/committee", "/delegation", "/match"): Audit that page and all sub-routes/related components.
- If a feature name (e.g., "committee", "matching", "treasury"): Find all relevant routes and audit them as a cohesive feature.
- If multiple routes share the same feature (e.g., `/governance/committee` + `/discover/committee` + `/committee/[id]`): audit them all as one feature surface.

---

## Phase 1: Context Loading

Read these files to build the evaluation framework. Do NOT skip any — they are essential for calibrated scoring.

1. `docs/strategy/context/persona-quick-ref.md` — all personas and their JTBDs
2. `docs/strategy/context/ux-constraints.md` — page-level JTBD constraints and information budget rules
3. `docs/strategy/context/navigation-architecture.md` — route structure and where this page fits
4. `docs/strategy/context/competitive-landscape.md` — what competitors offer for this feature area
5. `.claude/rules/product-vision.md` — UX execution standards
6. `.claude/rules/audit-integrity.md` — scoring calibration and evidence requirements

After loading context, identify:

**A) Which personas visit this page?** Cross-reference with navigation architecture. For each persona, state their JTBD on this specific page (not their global JTBD — their job on THIS page).

**B) Does this page have a constraint entry in ux-constraints.md?** If not, that is itself a finding — propose one.

**C) What is the page's single core JTBD?** State it in <8 words per the UX constraints format.

Confirm the scope and proceed to Phase 2.

---

## Phase 2: Launch 3 Parallel Sub-Agents

Launch ALL 3 simultaneously in a single message using the Agent tool. Each gets a different analytical lens on the same page. Do NOT use `isolation: "worktree"` — these are READ-ONLY audits.

### Sub-agent 1: Page Anatomy & Persona Walk-Through

```
You are performing a deep page anatomy and persona JTBD walk-through for the [PAGE/FEATURE] in Governada. This is a READ-ONLY audit — do not modify any files.

## Context Loading (MANDATORY — read these before analysis)
1. Read `docs/strategy/context/persona-quick-ref.md`
2. Read `docs/strategy/context/ux-constraints.md`
3. Read `docs/strategy/context/navigation-architecture.md`
4. Read `.claude/rules/product-vision.md`

## Part A: Full Page Anatomy

Read EVERY file involved in rendering this page:
- The route file(s): `app/[route]/page.tsx` and any layout.tsx
- Every component imported by the page (follow the import tree completely)
- Every data function called (trace into `lib/data.ts` and beyond)
- Any API routes that serve this page's client components
- Any hooks used (check `hooks/` directory)
- Database types relevant to the data shown

For each piece of visible UI, document:
1. What it shows (the data/content)
2. Where the data comes from (table, computation, API)
3. Which personas it serves (or "all")
4. Whether it tells a story or dumps data
5. Its visual weight (dominant / supporting / detail / buried)

Build a complete **Page Element Inventory**:
```

| Element | Data Source | Visual Weight | Story or Data? | Serves Persona(s) | Earns Its Place? |

```

The "Earns Its Place?" column is critical. For each element, ask: "If I removed this, would any persona's primary JTBD on this page be degraded?" If the answer is no, mark it as CANDIDATE FOR REMOVAL.

## Part B: Persona Walk-Through

For each persona who visits this page (reference the navigation architecture):

1. **Arrival context**: How do they get here? What were they doing before? What question are they carrying?
2. **5-second test**: What would this persona understand about the page in 5 seconds? Does it match their JTBD?
3. **Information scent**: Can they find what they need? Is the most important information the most prominent?
4. **JTBD completion**: Can they complete their job on this page? How many clicks? Any dead ends?
5. **Emotional delivery**: Does the page deliver the target emotion for this persona? (curiosity, trust, clarity, efficiency, etc.)
6. **What's missing**: What would this persona wish they could see/do here that they can't?
7. **What overwhelms**: What would this persona ignore or find confusing?

## Part C: Information Budget Analysis

Apply the zero-sum information budget from ux-constraints.md:
- Count elements above the fold: is it within the "1 dominant + 2-3 supporting" budget?
- Identify what's competing for attention (nothing should compete — hierarchy must be clear)
- Check progressive disclosure: are conclusions first, with data behind interactions?
- Check for anti-patterns: "surface all the intelligence," "show everything, let users filter," "but the data exists"

## Return Format

PAGE_ANATOMY:
[Complete element inventory table]

SUBTRACTION_CANDIDATES:
(Elements that don't earn their place — candidates for removal, collapse, or relocation)
- [element] | [reason it doesn't earn its place] | [where it could go instead, if anywhere] | [file:line]

PERSONA_WALKTHROUGHS:
For each persona:
- [Persona]: [JTBD on this page in <8 words]
  - 5-second test: [PASS/FAIL — what they'd understand]
  - JTBD completion: [COMPLETE/PARTIAL/BROKEN — clicks, friction]
  - Emotional delivery: [target emotion] → [delivered emotion] — [evidence]
  - Missing: [what they'd wish for]
  - Overwhelms: [what they'd ignore or find confusing]

INFORMATION_BUDGET:
- Above-fold element count: [N] (budget: 1 dominant + 2-3 supporting)
- Dominant element: [what it is, or "unclear — multiple elements compete"]
- Progressive disclosure: [present/absent/partial]
- Anti-patterns detected: [list, or "none"]

NARRATIVE_INTELLIGENCE:
(For every metric/number displayed on the page)
- [metric]: [INTERPRETED — "tells a story: ..." / RAW DATA — "just shows a number with no context"]

ALREADY_STRONG:
- [specific element that works well] — [why] — [file path]
```

### Sub-agent 2: Craft, Performance & Mobile

```
You are auditing the craft quality, performance characteristics, and mobile experience of [PAGE/FEATURE] in Governada. This is a READ-ONLY audit — do not modify any files.

## Context Loading (MANDATORY)
1. Read `.claude/rules/product-vision.md`
2. Read `docs/strategy/context/ux-constraints.md`

## Part A: Craft Quality

Read the page component(s) and evaluate:

1. **Visual hierarchy**: Does the eye flow naturally from primary → secondary → tertiary information? Or is everything at the same visual weight?
2. **Component identity**: Does this page look like it was purpose-built for Governada, or could it exist in any shadcn/Next.js app? (Per product-vision.md: "If a component could exist in any shadcn/Next.js app, it needs more work.")
3. **Loading states**: Are there skeleton states? Do they match the content layout? What does the user see for the first 500ms?
4. **Empty states**: What happens when there's no data? Is it graceful, guiding, and motivating — or just "no results found"?
5. **Error states**: What happens when data fails to load? Is there error handling?
6. **Micro-interactions**: Hover states, transitions, feedback on actions. What's delightful? What's missing?
7. **Color and typography**: Is the visual language consistent? Are colors semantic (green = good, amber = warning, red = problem)?
8. **Accessibility**: Check for aria-labels, semantic HTML, keyboard navigation paths, color contrast, touch target sizes (44x44px minimum).

## Part B: Mobile Experience

Evaluate the page's mobile rendering:

1. Read the responsive CSS/Tailwind classes (look for `sm:`, `md:`, `lg:` breakpoints)
2. What columns/elements are hidden on mobile? Does hiding them lose critical information?
3. Are tables replaced with card layouts, or do they just overflow-scroll?
4. Are touch targets large enough?
5. Does the page have a clear mobile-first story or is it desktop-first with responsive afterthoughts?

## Part C: Performance Patterns

1. **Server vs Client**: Is the page server-rendered or client-rendered? (Check for `'use client'`, `force-dynamic`)
2. **Data fetching**: Count Supabase/API calls. Are they parallelized (`Promise.all`) or waterfall?
3. **Bundle impact**: Are there heavy client-side imports that could be lazy-loaded? (D3, chart libraries, etc.)
4. **Caching**: Check TanStack Query staleTime, API route cache headers, Redis usage
5. **Core Web Vitals risks**: LCP (is above-fold content server-rendered?), CLS (explicit dimensions on dynamic content?), INP (heavy click handlers?)

## Return Format

CRAFT_ASSESSMENT:
- Visual hierarchy: [clear/unclear/competing] — [evidence]
- Component identity: [distinctive/generic] — [what makes it feel Governada or not]
- Loading states: [present/partial/missing] — [file paths]
- Empty states: [graceful/basic/missing] — [what happens]
- Error states: [handled/unhandled] — [evidence]
- Micro-interactions: [delightful/functional/missing] — [specifics]

MOBILE_ASSESSMENT:
- Strategy: [mobile-first/desktop-first/responsive-afterthought]
- Information loss on mobile: [what's hidden and whether it matters]
- Touch targets: [adequate/too-small] — [specific elements]
- Overall mobile experience: [brief verdict]

PERFORMANCE_ASSESSMENT:
- Rendering: [server/client/hybrid] — [force-dynamic present?]
- Data fetches: [count] — [parallel/waterfall] — [file path]
- Bundle risks: [list heavy imports, or "none"]
- Caching: [strategy summary]
- CWV risks: [list, or "none detected"]

ACCESSIBILITY:
- Keyboard nav: [assessment]
- Screen reader: [assessment]
- Color contrast: [assessment]
- WCAG estimate: [A/AA/AAA/partial]

ALREADY_STRONG:
- [specific craft element that's well done] — [file path] — [why]
```

### Sub-agent 3: Vision, Competitive & World-Class Blueprint

```
You are evaluating [PAGE/FEATURE] against the product vision, competitive landscape, and imagining what "world-class" would look like. This is a READ-ONLY audit — do not modify any files.

## Context Loading (MANDATORY — read ALL of these)
1. Read `docs/strategy/ultimate-vision.md` — the full vision (this audit warrants the full doc)
2. Read `docs/strategy/context/competitive-landscape.md`
3. Read `docs/strategy/context/persona-quick-ref.md`
4. Read `docs/strategy/context/ux-constraints.md`
5. Read `.claude/rules/product-vision.md`
6. Read `docs/strategy/context/navigation-architecture.md`

Also read the page/feature code so you understand what currently exists.

## Part A: Vision Alignment

1. What does the vision say this feature/page should be?
2. Is the current implementation faithful to the vision?
3. What vision elements are realized? What's missing? What diverges?
4. Is the page aligned with the correct phase of the build roadmap?

## Part B: Competitive Positioning

For this specific feature area:
1. What do competitors offer? (GovTool, DRep.tools, Tally, SubSquare, Snapshot, or any relevant tool)
2. Where is Governada ahead? Where behind? Where at parity?
3. What does the best non-crypto equivalent look like? (Robinhood, Linear, Apple Health, Stripe — pick the most relevant)
4. What would it take to be unambiguously the best in the ecosystem for this feature?

## Part C: Flywheel Analysis

Which of the 5 flywheels does this page activate (or could activate)?
- Accountability, Engagement, Content/Discourse, Viral/Identity, Integration/Distribution
- For each: [strong/weak/not activated] with specific evidence
- What one change would most strengthen flywheel activation?

## Part D: The World-Class Blueprint

This is the most important section. Imagine this page has been redesigned by the best product team in tech. What would it look like?

Write a detailed description of the IDEAL version of this page, considering:

1. **The Story**: What narrative does the page tell? What does the user feel and understand?
2. **The Dominant Element**: What is the ONE thing that commands attention and answers the core JTBD?
3. **The Supporting Cast**: What 2-3 elements support the story without competing?
4. **Progressive Disclosure**: How does depth unfold for users who want more?
5. **The Share-Worthy Moment**: What would make someone screenshot this and share it?
6. **The Subtraction**: What would be REMOVED compared to today? (This is as important as what's added.)
7. **Persona Adaptation**: How would the page adapt for different personas seeing it?
8. **The Delight Detail**: One specific micro-interaction or design detail that would make this page memorable.
9. **Narrative Intelligence**: How would every metric on the page "tell a story" instead of dump data?

Be ambitious but grounded — every element of the blueprint should be technically feasible with the current stack (Next.js 16, React 19, shadcn, Tailwind v4, D3 for custom viz).

## Part E: Deprecation & Simplification Candidates

Look at what currently exists and recommend what should be:
- **Removed entirely**: Elements that add cognitive load without serving any persona's JTBD
- **Collapsed/hidden**: Elements that serve edge cases but shouldn't occupy primary real estate
- **Relocated**: Elements that serve a JTBD but belong on a different page
- **Merged**: Redundant elements that show the same information in different forms
- **Simplified**: Complex elements that could be replaced with a simpler version without losing value

For each, explain WHY the subtraction improves the experience. The goal is maximum delight with minimum surface area.

## Return Format

VISION_ALIGNMENT:
- Overall: [faithful/partial/divergent]
- Realized: [list]
- Missing: [list]
- Divergent: [list]

COMPETITIVE_POSITIONING:
- vs [competitor]: [ahead/behind/parity] — [specific evidence]
- vs [web2 benchmark]: [assessment] — [what we can learn]
- Ecosystem verdict: [is this the best in Cardano governance for this feature?]

FLYWHEEL_ACTIVATION:
- [flywheel]: [strong/weak/not activated] — [evidence] — [one change to strengthen]

WORLD_CLASS_BLUEPRINT:
[The full blueprint as described in Part D — this should be 300-500 words of vivid, specific description that a designer or engineer could execute from]

SUBTRACTION_RECOMMENDATIONS:
- REMOVE: [element] — [reason] — [file:line]
- COLLAPSE: [element] — [reason] — [what trigger reveals it]
- RELOCATE: [element] — [from where] — [to where] — [reason]
- MERGE: [element A + element B] — [into what] — [reason]
- SIMPLIFY: [element] — [from what] — [to what] — [reason]

SHARE_WORTHY_MOMENT:
[1-2 sentences: The single most impactful opportunity to create a moment someone would share]

ALREADY_STRONG:
- [specific competitive advantage or well-executed element] — [evidence]
```

---

## Phase 3: Synthesis

After all 3 sub-agents return, synthesize their findings. Read all results carefully — contradictions between sub-agents are valuable signals.

### 3.1 The MLE Verdict

Write a 2-3 paragraph assessment that a founder could read in 60 seconds and understand exactly where this feature stands:

**Paragraph 1: The Story Today.** What is the experience of visiting this page today? Be specific — name routes, components, friction points, and moments of clarity. This should make the reader see through the user's eyes.

**Paragraph 2: The Gap.** What's the distance between "today" and "world-class"? Is this a refinement gap (polish and narrative needed) or a structural gap (wrong information architecture, missing core functionality)? Be honest about severity.

**Paragraph 3: The Path.** What are the 2-3 highest-leverage changes that would close the gap? These should be concrete enough to brief an engineer.

### 3.2 Score Card

Score 6 MLE dimensions. Each dimension is 0-10. Total possible: 60.

Follow all scoring rules from `.claude/rules/audit-integrity.md`.

**M1: JTBD Clarity (10 pts)** — Can every relevant persona complete their job on this page? Is the page's core JTBD clear in 5 seconds?

| Score | Anchor                                                                               |
| ----- | ------------------------------------------------------------------------------------ |
| 1-3   | Core JTBD unclear. Users wouldn't know what this page is for.                        |
| 4-6   | JTBD identifiable but friction, missing edge cases, or competing elements dilute it. |
| 7-8   | JTBD clear, all personas can complete their job with minor friction.                 |
| 9-10  | Instant clarity. Every persona knows exactly what to do and can do it effortlessly.  |

**M2: Narrative Intelligence (10 pts)** — Does the page tell stories or dump data? Are conclusions first?

| Score | Anchor                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------- |
| 1-3   | Raw data dump. Numbers without context. No interpretation anywhere.                                 |
| 4-6   | Some metrics have context, but the page leads with data rather than conclusions.                    |
| 7-8   | Conclusions first, data supports. Most metrics are interpreted. Minor gaps.                         |
| 9-10  | Every metric tells a story. The page reads like a briefing, not a spreadsheet. Users leave smarter. |

**M3: Information Architecture (10 pts)** — Is the information budget respected? Progressive disclosure? Visual hierarchy?

| Score | Anchor                                                                                  |
| ----- | --------------------------------------------------------------------------------------- |
| 1-3   | Everything competing for attention. No clear hierarchy. Overwhelming.                   |
| 4-6   | Some hierarchy exists but too many elements above the fold or redundant sections.       |
| 7-8   | Clear dominant element, good progressive disclosure, minor budget violations.           |
| 9-10  | Perfect hierarchy. Every element at the right depth. Nothing could be added or removed. |

**M4: Emotional Design (10 pts)** — Does the page deliver delight, trust, or clarity — not just information?

| Score | Anchor                                                                             |
| ----- | ---------------------------------------------------------------------------------- |
| 1-3   | Clinical data display. No emotional consideration. Generic.                        |
| 4-6   | Functional but unremarkable. Correct information but no feeling.                   |
| 7-8   | Target emotions mostly delivered. Some moments of delight. Consistent personality. |
| 9-10  | The page has a "wow" moment. Users feel something. Share-worthy.                   |

**M5: Craft & Polish (10 pts)** — Loading states, empty states, mobile, accessibility, micro-interactions, visual identity.

| Score | Anchor                                                                         |
| ----- | ------------------------------------------------------------------------------ |
| 1-3   | Broken states, missing loading feedback, poor mobile, inaccessible.            |
| 4-6   | Functional but rough edges. Some missing states. Mobile is an afterthought.    |
| 7-8   | Polished core, good loading states, responsive works, WCAG AA.                 |
| 9-10  | Every pixel intentional. Feels like a native app. Distinctive visual identity. |

**M6: Vision & Ambition (10 pts)** — Does this page push boundaries? Is it the best version of this feature in the ecosystem?

| Score | Anchor                                                                                        |
| ----- | --------------------------------------------------------------------------------------------- |
| 1-3   | Below competitor parity. Doesn't reflect the vision.                                          |
| 4-6   | At parity with competitors but nothing distinctive. Vision partially realized.                |
| 7-8   | Ahead of competitors on most dimensions. Vision mostly realized. Clear differentiator.        |
| 9-10  | Unambiguously the best in the ecosystem. Competitors would study this. Vision fully realized. |

Present as:

```
| Dimension                 | Score | Key Evidence                    | Top Gap                    |
|---------------------------|-------|---------------------------------|----------------------------|
| M1: JTBD Clarity          | X/10  | [evidence]                      | [gap]                      |
| M2: Narrative Intelligence| X/10  | [evidence]                      | [gap]                      |
| M3: Info Architecture     | X/10  | [evidence]                      | [gap]                      |
| M4: Emotional Design      | X/10  | [evidence]                      | [gap]                      |
| M5: Craft & Polish        | X/10  | [evidence]                      | [gap]                      |
| M6: Vision & Ambition     | X/10  | [evidence]                      | [gap]                      |
|                           |       |                      **TOTAL**  | XX/60                      |
```

### 3.3 What's Already Strong

**Mandatory section.** List 3-5 things this page does well today. For each:

- What it is (specific component, pattern, or design choice)
- Why it's strong (evidence from sub-agents)
- File path(s)
- Recommendation: KEEP AS-IS or note what would make it a 10/10

### 3.4 The Subtraction Report

**This section is as important as the improvement recommendations.** List everything that should be removed, collapsed, relocated, merged, or simplified — from the sub-agent findings.

For each subtraction:

```
- [ACTION]: [element]
  Reason: [why removing/changing this improves the experience]
  User impact: [what the user gains by NOT seeing this]
  Code: [file:line]
  Risk: [what could break or be lost]
```

### 3.5 The Ambition Report

**This section pushes beyond "fix what's broken" into "what would be remarkable."** Pull from sub-agent 3's World-Class Blueprint and add your own synthesis.

For each ambitious recommendation:

```
- [Title] — [1 sentence description]
  Why it matters: [what user emotion or JTBD it serves]
  What it replaces: [what currently occupies this space, if anything]
  Effort: [S/M/L/XL]
  "Would anyone notice?": [Yes — because...] or [Power users only — because...]
  Share-worthy?: [Yes/No — why]
```

### 3.6 Priority Stack

Merge ALL findings (improvements, subtractions, ambitious ideas) into a single prioritized list. Every item must meet the evidence requirements from audit-integrity.md.

**P0 — MLE Failures**
The page fails its core JTBD or a primary persona can't accomplish their goal. These must be fixed for the page to earn its place.

**P1 — Story Gaps**
The page works but doesn't tell a story. Metrics without interpretation, missing narrative intelligence, information budget violations. These are the difference between "it works" and "it's good."

**P2 — Craft & Delight**
Polish, performance, mobile refinement, accessibility, micro-interactions. The difference between "it's good" and "I love this."

**P3 — World-Class Ambitions**
Ambitious improvements that would make this the best version of this feature in the ecosystem. Share-worthy moments. Flywheel activation. The difference between "I love this" and "I need to tell someone about this."

**SUBTRACT — Remove/Simplify**
Elements that should be removed or simplified regardless of priority. Subtractions often have the highest ROI because they improve the experience by reducing cognitive load — and cost nothing to maintain.

For each item:

```
- [Title] | [P0/P1/P2/P3/SUBTRACT] | Effort: [S/M/L] | Impact: [what improves]
  Code: [file:line]
  User impact: [today vs after change]
  Evidence: [sub-agent number + finding]
  Risk: [what could break]
```

### 3.7 Proposed UX Constraint Entry

If the page doesn't have an entry in `docs/strategy/context/ux-constraints.md`, propose one. If it does, propose updates based on findings.

```
### [route]

| Attribute               | Constraint                              |
| ----------------------- | --------------------------------------- |
| **Core JTBD**           | [<8 words]                              |
| **5-second answer**     | [what the user should understand]       |
| **Dominant element**    | [one thing]                             |
| **Supporting elements** | [2-3 things]                            |
| **NOT on this page**    | [what must be excluded or below fold]   |
| **Benchmark**           | [web2 or competitor reference]          |
```

---

## Rules

1. **Evidence from sub-agents must cite specific files, routes, and line numbers.** Not "the page could be improved" but "CommitteeDiscovery.tsx:140 has a self-referential link."

2. **The Subtraction Report is mandatory.** An audit that only recommends additions is incomplete. The best improvements often come from removing things. If the audit finds nothing to subtract, explicitly state why every element earns its place.

3. **The World-Class Blueprint is mandatory.** Don't just identify gaps — paint a vivid picture of what remarkable looks like. This is the aspirational target that makes the priority stack meaningful.

4. **Narrative intelligence is the highest-leverage dimension.** Most pages in most apps fail not because features are missing but because data is presented without interpretation. Check every number on the page: does it tell a story?

5. **Follow all rules from `.claude/rules/audit-integrity.md`:**
   - Evidence Requirement (code path + user impact + reproduction)
   - Cost-Benefit Gate (effort vs impact vs risk)
   - "Already Good" Requirement (mandatory — list what's strong)
   - Score Calibration (10 = best in class; 8+ = strong, don't recommend changes without clear reason)
   - "Would Anyone Notice?" Test (real user, first 3 sessions)
   - Anti-Patterns to Reject (no refactoring working code, no premature optimization)
   - Competitor Benchmark (compare against what exists, not imaginary ideals)

6. **Subtractions must pass the inverse "Would Anyone Notice?" test.** If removing an element and NO user would miss it within 3 sessions, the removal is clearly justified. If some users would miss it, specify which persona and whether a collapsed/relocated version serves them.

7. **Balance ambition with pragmatism.** The Ambition Report should be exciting but every recommendation must be technically feasible with the current stack. Wild ideas without implementation paths are not helpful.

8. **Page-first, not product-first.** Stay focused on this specific page. If you find systemic issues, note them briefly but don't deep-dive. The priority stack should be 90%+ specific to the audited page.

9. **Sub-agents run in parallel.** Launch all 3 in a single message. Do not wait for one to finish before launching the next.

---

## Usage Examples

```
/audit-feature /governance/committee
/audit-feature committee
/audit-feature /delegation
/audit-feature /match
/audit-feature /governance/proposals
/audit-feature treasury
/audit-feature hub (citizen home)
```

## Recommended Cadence

- **Before building/redesigning a page**: Run to establish baseline and identify priorities
- **After a major page update**: Run to verify improvements and catch regressions
- **Monthly rotation**: Cycle through the main pages to prevent quality drift
- **After adding content to any page**: Run to verify the information budget isn't violated
