Audit the user experience against the standard: "best governance UX in crypto, competitive with best-in-class SaaS."

## Purpose

Evaluate whether Civica's UX is fully leveraging the intelligence engine to deliver persona-appropriate, retention-driving, emotionally resonant experiences. The engine is the moat — but the UX is what users see, feel, and come back for. A world-class backend behind a mediocre frontend is an invisible advantage.

This audit answers: **Is every surface earning the right to be called "best in industry"?**

## Scope

Argument: `$ARGUMENTS`

- If empty: Full UX audit (all personas, all surfaces)
- If a persona (e.g., "citizen", "drep", "spo"): Deep dive on that persona's journey
- If a surface (e.g., "home", "discover", "profile", "pulse", "match", "engage", "proposal"): Deep dive on that page/flow
- If "mobile": Mobile-specific audit across all surfaces
- If "competitive": Competitive UX benchmarking deep dive

## The Standard

Read `.claude/rules/product-vision.md` for design principles and UX rules. Every finding in this audit is measured against those principles, plus:

1. **The 30-second test.** Can each persona accomplish their primary task in 30 seconds? (Citizen: understand governance health. DRep: see what needs attention. SPO: check governance reputation.)
2. **The "why should I come back?" test.** For each persona, is there a compelling reason to return at the epoch boundary? Not "there's new data" — but "this data changes my understanding or requires my action."
3. **The "could this be any app?" test.** If you screenshot a page and remove the logo, would anyone know this is Civica? Every surface should be unmistakably a governance civic hub, not a generic dashboard.
4. **The storytelling test.** Does every number tell a story? Does every insight connect to an action? Does every status create an emotional response (pride, concern, curiosity)?

## Phase 1: Intelligence Leverage Audit

The most unique gap this audit fills. For each backend capability, check: is it surfaced? Is it surfaced well?

### 1.1 Score Intelligence

For each scoring system, trace from computation to user-facing surface:

| Backend Capability                                               | Expected Surface                                            | Check                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| DRep Score V3 (4-pillar composite)                               | Score ring + breakdown on profile, score in discovery cards | Does the breakdown tell a story or just show 4 numbers?                       |
| Pillar scores (Engagement, Participation, Reliability, Identity) | ScoreBreakdown, ScoreDeepDive                               | Can a citizen understand what each pillar means without governance knowledge? |
| Score momentum (trending up/down)                                | ScoreChangeMoment, profile trend                            | Is momentum visually prominent? Does it create an emotional response?         |
| Score tier (Exceptional/Strong/Developing/Emerging/Inactive)     | Discovery cards, profile hero                               | Do tiers feel meaningful or arbitrary? Is there a narrative for each tier?    |
| Percentile rank                                                  | Profile, compare view                                       | Does "top 15%" feel different from "72/100"? Is relative standing clear?      |
| SPO Score V3                                                     | Pool profile, SPO discovery                                 | Same depth as DRep scoring, or second-class?                                  |
| CC Transparency Index                                            | Committee page, CC member profile                           | Does it communicate accountability or just display data?                      |

### 1.2 Alignment & Matching Intelligence

| Backend Capability                                | Expected Surface                    | Check                                                                   |
| ------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| PCA 6D alignment space                            | Match page, alignment visualization | Is the alignment space intuitive to non-technical users?                |
| Alignment trajectory (drift over time)            | Profile alignment history           | Can a citizen see if their DRep's values are shifting?                  |
| Quick Match (questionnaire → DRep recommendation) | /match flow                         | Time to complete? Quality of recommendations? Does it feel trustworthy? |
| Matching confidence score                         | Match results                       | Does confidence communicate "we're 85% sure" or just show a number?     |
| DRep-to-DRep alignment comparison                 | Compare view, constellation         | Can a citizen compare two DReps side-by-side on values?                 |

### 1.3 Governance Health Intelligence

| Backend Capability                                         | Expected Surface              | Check                                                                                    |
| ---------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| GHI (Governance Health Index)                              | Pulse page, home overview     | Does GHI feel like a "vital sign" or a random number?                                    |
| GHI components (participation rate, treasury health, etc.) | Pulse breakdown               | Are components explained in citizen-accessible language?                                 |
| GHI trend                                                  | Pulse history, home sparkline | Is the trend clearly up/down/stable? Does it provoke the right emotion?                  |
| Epoch briefing data (AI-generated summaries)               | Home/briefing surface         | Does the briefing exist? Is it the primary home experience for returning users?          |
| Treasury tracking (your proportional share)                | Pulse/treasury view           | Does "your share" feel personal and real? Does it connect spending to the citizen's ADA? |

### 1.4 Engagement & Community Intelligence

| Backend Capability                        | Expected Surface                  | Check                                                                           |
| ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| 7 engagement mechanisms                   | /engage page                      | Are all 7 built and accessible? Do they feel civic, not social media?           |
| Citizen credibility scoring               | Engagement weight, profile        | Does credibility incentivize quality participation?                             |
| Sentiment aggregation                     | Proposal page, DRep profile       | Do DReps/proposals show community sentiment?                                    |
| Civic identity (milestones, streaks)      | My Gov identity page              | Does identity feel like it's growing? Is there pride in progression?            |
| Citizen briefings (personalized per user) | Home page for authenticated users | Is the briefing personalized or generic? Does it reflect the user's delegation? |

### 1.5 Historical & Snapshot Intelligence

| Backend Capability                          | Expected Surface                               | Check                                              |
| ------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| 15+ snapshot tables                         | Score history, alignment trajectory, GHI trend | Is historical data prominently featured or buried? |
| Wrapped/reports (epoch or period summaries) | /wrapped, /pulse/report                        | Do these feel like premium, shareable content?     |
| Cross-epoch comparison                      | Trend charts, score change annotations         | Can a user see how things changed and why?         |

**Score each capability:** ✅ Surfaced well (tells a story, persona-appropriate) | ⚠️ Surfaced but weak (shows data, no narrative) | ❌ Not surfaced (capability exists but users can't see it) | 🚫 Backend not built yet

## Phase 2: Persona Journey Audit

For each persona, walk the complete journey described in their persona doc (`docs/strategy/personas/`). Score the journey against the spec.

### 2.1 Citizen Journey (read `docs/strategy/personas/citizen.md`)

Walk through in order:

1. **Anonymous landing** (`/`) — Is it an invitation, not a dashboard? Two paths: Stake and Govern?
2. **Quick Match** (`/match`) — 60-second flow? Recommendations feel trustworthy?
3. **Post-connection home** — Is it an epoch briefing or a dashboard? Does it pass the 30-second test?
4. **Delegation health** — Green/yellow/red at a glance? Can they see if their DRep is doing well?
5. **Treasury transparency** (`/pulse`) — "Your proportional share" framing? Spending feels real?
6. **Civic identity** (`/my-gov/identity`) — Does identity feel like citizenship? Milestones, streaks, growth?
7. **Engagement** (`/engage`) — Can they express opinions without becoming experts?
8. **Smart alerts** — Do they exist? Are they appropriately quiet most epochs?
9. **Shareable moments** — Can they share their civic identity, their DRep's score, a governance insight?

For each step: rate as EXCEPTIONAL / GOOD / NEEDS WORK / MISSING / NOT BUILT.

### 2.2 DRep Journey (read `docs/strategy/personas/drep.md`)

Walk through:

1. **Inbox / action queue** (`/my-gov/inbox`) — Does it answer "what should I do right now?" in 5 seconds?
2. **Proposal workspace** (`/proposal/[tx]/[i]`) — Full context: AI summary, citizen sentiment, treasury impact, constitutional analysis?
3. **Vote + rationale flow** — Sub-2-minute vote-to-rationale? CIP-95/CIP-100 in one transaction?
4. **Profile / reputation** (`/drep/[id]`) — Does score breakdown tell their governance story?
5. **Delegator communication** — Can they respond to citizen questions? See delegation changes?
6. **Score management** — Score simulator? Improvement suggestions?
7. **Competitive awareness** — Can they see how they compare to peers?

For each step: rate as EXCEPTIONAL / GOOD / NEEDS WORK / MISSING / NOT BUILT.

### 2.3 SPO Journey (read `docs/strategy/personas/spo.md`)

Walk through:

1. **Pool profile** (`/pool/[id]`) — Governance reputation as differentiator?
2. **Governance identity** — Rich governance statement, not just technical stats?
3. **Score + breakdown** — SPO Score V3 with same depth as DRep scoring?
4. **Delegator communication** — Governance stance visible to potential delegators?
5. **Discovery** — Can citizens find pools by governance values, not just rewards?

For each step: rate as EXCEPTIONAL / GOOD / NEEDS WORK / MISSING / NOT BUILT.

### 2.4 Cross-Persona Checks

- **Segment fluidity:** Does a DRep also see the citizen experience? Does an SPO?
- **Authenticated vs anonymous:** Are they genuinely different experiences, not just "connect wallet to see more"?
- **CC member / Treasury team / Researcher:** Quick assessment — are their surfaces built at all?

## Phase 3: Competitive UX Benchmarking

WebSearch for current state of governance UX competitors. For each competitor, evaluate on dimensions the user can feel:

### 3.1 Direct Competitors (governance-specific)

- **GovTool** (Cardano official): What's their current UX? Where do they beat us? Where are we ahead?
- **DRep.tools**: Any UX innovations we should study?
- **Tally** (Ethereum governance): What does their vote flow feel like? Profile pages? Data presentation?
- **Snapshot** (multi-chain): UX simplicity lessons? How do they handle complexity?
- **SubSquare** (Polkadot governance): Any novel governance UX patterns?

### 3.2 Benchmark Products (best-in-class UX)

For each, identify ONE specific UX pattern we should study or adopt:

- **Linear**: Task management polish, keyboard shortcuts, animations, information density
- **Vercel Dashboard**: Dark mode excellence, deployment status communication, error states
- **Stripe Dashboard**: Complex data made simple, progressive disclosure, documentation quality
- **Robinhood**: Financial simplification for non-experts, emotional design, milestone celebrations
- **Duolingo**: Engagement loops, streak mechanics, gamification that doesn't feel cheap
- **Apple Health**: Summary intelligence from complex data, "here's what matters" hierarchy

### 3.3 Crypto-Specific UX Patterns

WebSearch for emerging patterns in crypto UX:

- Wallet connection flows (best practices 2026)
- On-chain transaction UX (signing, confirmation, status)
- Data dashboard design in crypto
- Mobile-first crypto apps

## Phase 4: Emotional Design & Storytelling Audit

### 4.1 Number Storytelling

For every number visible in the product, answer:

- Does it tell a story? ("72 — solid governance, but 3 missed votes in the last epoch")
- Does it connect to the user's situation? ("Your DRep's score dropped because...")
- Does it suggest an action? ("Consider reviewing your delegation")
- Or is it just a number sitting there? ("72")

Sample at least 10 different numeric displays across different pages.

### 4.2 Empty States

For every empty state in the product:

- Does it guide? (tells the user what to do)
- Does it educate? (explains why this is empty and what it would look like with data)
- Does it motivate? (makes the user want to fill this state)
- Or does it just say "No data" / "Nothing here"?

Check: `/my-gov` without wallet, `/engage` without participation, `/discover` with filters that return nothing, profile pages for new DReps.

### 4.3 Status Communication

For each status indicator (score tiers, delegation health, governance health, sync status):

- Is it immediately understood? (green/yellow/red, up/down arrows)
- Does it create the appropriate emotional response? (concern for red, pride for green, curiosity for yellow)
- Is it consistent across surfaces? (does "good" look the same everywhere?)

### 4.4 Celebration & Delight

- Are milestones celebrated? (MilestoneCelebration component — is it used? Is it delightful?)
- Are positive changes highlighted? (score increase, new delegators, civic identity growth)
- Are there micro-interactions that make routine actions feel satisfying? (voting, completing match, connecting wallet)
- Does the Wrapped experience feel premium and shareable?

### 4.5 Brand Distinctiveness

Apply the "could this be any app?" test to each major surface:

- Homepage — unmistakably a governance civic hub?
- DRep profile — unmistakably about governance accountability?
- Pulse — unmistakably about collective governance health?
- Discover — unmistakably a governance-values-based directory?

Check: ConstellationHero, GovernanceImpactHero, DRepProfileHero — do these hero elements create a distinctive visual identity?

## Phase 5: Interaction Quality Audit

### 5.1 Loading States Coverage

For every route that fetches data, check:

- Skeleton loader present? (`LoadingSkeleton.tsx` or page-specific)
- Skeleton matches content layout? (not a generic spinner)
- No layout shift when data arrives?
- Streaming/progressive loading for complex pages?

Routes to check: `/`, `/discover`, `/drep/[id]`, `/pool/[id]`, `/proposal/[tx]/[i]`, `/pulse`, `/match`, `/engage`, `/my-gov`, `/committee`.

### 5.2 Error States

For each page, force an error scenario:

- Does it show a helpful error, not a crash?
- Does it offer a recovery action (retry, go back, contact support)?
- Does the `EmptyState.tsx` component handle all edge cases?
- Are Sentry errors informative for debugging?

### 5.3 Responsive Design

Check each major page at:

- Mobile (375px) — is it the primary design, not a cramped desktop?
- Tablet (768px) — graceful adaptation?
- Desktop (1440px) — uses space well, not just centered mobile?
- Ultra-wide (1920px+) — no content stretching, good max-widths?

Key pages: homepage, discover, DRep profile, proposal, pulse, match.

### 5.4 Accessibility

- Keyboard navigation: can you reach all interactive elements without a mouse?
- Screen reader: do key pages have meaningful aria-labels and landmarks?
- Color contrast: are all text/background combinations WCAG 2.1 AA (4.5:1)?
- Motion sensitivity: does `prefers-reduced-motion` disable animations?
- Focus indicators: visible and consistent?

### 5.5 Micro-Interactions & Animation Quality

- Are animations purposeful (guide attention, show state change) or decorative?
- Are they smooth (60fps, no jank)?
- Do they use the View Transitions API or Framer Motion spring physics?
- Is there a consistent animation language? (same easing, same durations for similar actions)
- Does the ConstellationHero perform well on mobile / low-end devices?

### 5.6 Performance Perception

Even if actual performance is good, does it _feel_ fast?

- Is there visible content within 500ms? (perceived LCP)
- Do interactions respond within 100ms? (perceived responsiveness)
- Are transitions smooth between routes? (no flash of white/loading)
- Is the initial app shell meaningful? (not a blank page with a spinner)

## Phase 6: Visual Design Craft Audit

This phase evaluates whether the product looks like it was designed by a world-class design team — not just whether it functions correctly. Functional polish (Phase 5) tells you the mechanics work. This phase tells you whether the product is _beautiful_, _distinctive_, and _intentionally crafted_.

### 6.1 Visual Identity System

Evaluate the coherence of the design language across all surfaces:

- **Color system:** Is there a deliberate palette beyond shadcn defaults? Does the palette evoke governance/civic themes? Is color used semantically (not just decoratively)?
- **Typography:** Is there a clear type hierarchy (display → heading → body → caption)? Does type feel intentional or default? Are font pairings distinctive?
- **Spacing & rhythm:** Is there a consistent spacing scale? Do pages have visual rhythm (alternating density/breathing room)?
- **Iconography:** Custom icons or generic Lucide throughout? Do icons reinforce the governance/civic identity?
- **Illustration/imagery:** Is there a visual language beyond components? Custom graphics, illustrations, or patterns that say "governance"?

For each element, rate: DISTINCTIVE / INTENTIONAL / DEFAULT / INCONSISTENT.

### 6.2 Component Design Quality

For each major component category, evaluate craft level:

| Component Type      | Key Examples                                             | Check                                                                               |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Cards               | DRep cards, proposal cards, pool cards                   | Are they purpose-built for governance data, or generic card with different content? |
| Score displays      | ScoreRing, HexScore, ScoreCard, ScoreBreakdown           | Do they feel premium and distinctive? Would you show them in a pitch deck?          |
| Data visualizations | Charts, constellation, alignment viz, GHI trend          | Custom D3/SVG or stock Recharts? Do they feel purpose-built?                        |
| Hero sections       | ConstellationHero, GovernanceImpactHero, DRepProfileHero | Do they set a visual bar the rest of the app matches?                               |
| Navigation          | Header, sidebar, breadcrumbs, tabs                       | Does navigation feel cohesive with the rest of the design?                          |
| Forms & inputs      | Match questionnaire, filters, search                     | Do form elements feel intentional or browser-default?                               |
| Badges & status     | Score tiers, milestone badges, health indicators         | Are they distinctive visual elements or text with a colored background?             |

For each: rate as WORLD-CLASS / CRAFTED / FUNCTIONAL / STOCK.

### 6.3 Information Hierarchy & Layout

For each major page, evaluate visual information architecture:

- **Visual weight:** Is the most important element the most visually prominent?
- **Eye flow:** Does the page guide the eye naturally from primary → secondary → tertiary information?
- **Density calibration:** Is information density appropriate for the persona? (Citizens: spacious and focused. DReps: dense but organized. Researchers: maximum density.)
- **Whitespace:** Is negative space used intentionally to create focus, or is the page either cramped or sparse?
- **Grid system:** Is there a consistent underlying grid, or does each page feel independently laid out?

Pages to evaluate: homepage, `/discover`, `/drep/[id]`, `/pool/[id]`, `/proposal/[tx]/[i]`, `/pulse`, `/match`, `/engage`, `/my-gov`.

### 6.4 Dark Mode Excellence

Dark mode is not just "invert the colors." Evaluate against the Vercel/Linear standard:

- **Contrast hierarchy:** Are there multiple levels of surface depth (not just one dark background)?
- **Color vibrancy:** Do accent colors pop against dark surfaces, or do they look washed out?
- **Borders & dividers:** Are they subtle (1px, low-opacity) or harsh lines?
- **Shadow system:** Are shadows replaced with luminance differences in dark mode?
- **Chart/viz adaptation:** Do data visualizations look as good in dark mode as light?
- **Image handling:** Are images, avatars, and graphics adapted for dark backgrounds?
- **Consistency:** Is dark mode a first-class experience or an afterthought with visual bugs?

### 6.5 Data Visualization Craft

Governance data is Civica's core differentiator. Visualizations must be exceptional:

- **Custom vs library:** What % of charts are custom D3/SVG vs Recharts/chart library defaults?
- **Governance-specific:** Do visualizations communicate governance concepts that generic charts can't? (e.g., constellation for alignment, score ring for multi-pillar assessment, GHI gauge for health)
- **Annotation & context:** Do charts have meaningful annotations (epoch boundaries, significant events) or just axes and data points?
- **Interactive quality:** Do hover states, tooltips, and click interactions feel premium?
- **Responsive:** Do visualizations degrade gracefully on mobile, or become unusable?
- **Printable/shareable:** Do key visualizations look good as static images (for share cards, OG images)?

### 6.6 Brand Distinctiveness Benchmark

The ultimate design test — screenshot each major page and evaluate:

- **Remove the logo.** Would anyone know this is Civica? What visual elements make it unmistakable?
- **Compare to shadcn templates.** How many components could exist unchanged in a generic shadcn/Next.js starter?
- **Compare to competitors.** Screenshot GovTool, Tally, Snapshot side-by-side. Where does Civica look clearly more polished? Where does it look generic by comparison?
- **The "pitch deck" test.** Would you put this screenshot in a presentation to investors/partners? If not, what's holding it back?

Score the product overall: if 10 screenshots were shared on X with no context, would the reaction be "this looks incredible" or "this looks like another crypto dashboard"?

## Phase 7: Retention & Engagement Architecture

### 7.1 Epoch Cadence Design

Cardano epochs are ~5 days. For each persona, answer:

- What changes at epoch boundary that makes them want to check in?
- Is that change prominently surfaced on their home experience?
- Does the epoch briefing (if built) create a natural "check-in" ritual?
- Would a push notification for epoch change be valuable and welcomed?

### 7.2 Progressive Engagement

Map the ladder from anonymous → engaged for each persona:

- **Anonymous → Wallet connected:** What's the incentive? How frictionless is it?
- **Connected → First action:** What's the first meaningful action? (Quick Match? First engagement vote? First delegation?)
- **First action → Regular user:** What creates the habit? (Briefings? Milestones? Alerts?)
- **Regular → Power user:** What unlocks with deeper engagement? (Civic identity? Influence? Premium features?)

For each transition, rate: COMPELLING / ADEQUATE / WEAK / MISSING.

### 7.3 Notification & Alert Strategy

- Smart alerts: Do they exist? What triggers them?
- Epoch briefing delivery: In-app only, or email/push?
- Alert fatigue: Is there a "most epochs, nothing to report" quiet mode?
- Urgency calibration: Do alerts differentiate "your DRep voted" from "your DRep was deregistered"?

### 7.4 Civic Identity as Retention

- Does civic identity (milestones, streaks, history) create investment that increases switching cost?
- Is identity visible to others? (social proof, shareable)
- Does identity progress feel achievable and rewarding?
- Is there a "civic identity" equivalent for DReps/SPOs? (reputation compounds)

### 7.5 Social & Viral Loops

- Can users share their governance involvement? (share cards, wrapped, civic identity)
- Do shared artifacts drive new users to the product?
- Is there a referral or advocacy mechanic?
- Do engagement mechanisms (sentiment votes, assemblies) create social proof?

## Phase 8: Scoring (6 dimensions, 10 pts each = 60 total)

### U1: Intelligence Surfacing (10 pts)

| Score | Anchor                                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Backend capabilities exist but users can't see or understand them                                                                                                                                             |
| 4-6   | Most capabilities surfaced, but as raw data without narrative or persona-appropriate framing                                                                                                                  |
| 7-8   | Every major capability has a well-designed surface, scores tell stories, insights connect to actions, persona-appropriate depth                                                                               |
| 9-10  | Every capability surfaced with emotional resonance, A/B tested for comprehension, users report feeling informed (not just seeing data), surfaces demonstrably drive behavior (delegation changes, engagement) |

### U2: Persona Journey Completeness (10 pts)

| Score | Anchor                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | One-size-fits-all experience, persona specs mostly unbuilt                                                                                                        |
| 4-6   | Primary persona (citizen) has a distinct experience, others are partial                                                                                           |
| 7-8   | Citizen, DRep, and SPO journeys substantially match their specs, segment fluidity works, authenticated vs anonymous are genuinely different experiences           |
| 9-10  | All persona journeys match specs at full quality, each journey passes the 30-second test, user testing validates the flows, CC/Treasury/Researcher surfaces exist |

### U3: Emotional Design & Storytelling (10 pts)

| Score | Anchor                                                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Numbers without context, generic empty states, no celebration moments                                                                                                                                          |
| 4-6   | Some scores tell stories, empty states guide, milestone celebrations exist                                                                                                                                     |
| 7-8   | Every number tells a story, every insight connects to an action, empty states guide + educate + motivate, celebrations feel genuine, brand is distinctive on every surface                                     |
| 9-10  | Users report emotional connection to civic identity, storytelling validated through engagement metrics, product feels unmistakably like "citizenship in a digital nation", viral sharing of governance moments |

### U4: Interaction Quality & Polish (10 pts)

| Score | Anchor                                                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Missing loading states, layout shifts, broken mobile, no accessibility                                                                                                                                |
| 4-6   | Loading skeletons on key pages, responsive works, basic accessibility, some animation                                                                                                                 |
| 7-8   | Every page has skeleton + error + empty state, WCAG 2.1 AA compliant, purposeful animations at 60fps, mobile feels primary not adapted, consistent animation language, performance perception is fast |
| 9-10  | Lighthouse accessibility 95+, zero layout shifts, View Transitions API, physics-based animations, prefers-reduced-motion respected, every interaction responds <100ms, feels like a native app        |

### U5: Retention & Engagement Architecture (10 pts)

| Score | Anchor                                                                                                                                                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | No reason to return, no notifications, no identity progression                                                                                                                                                                                     |
| 4-6   | Epoch briefing exists, basic milestones, some shareability                                                                                                                                                                                         |
| 7-8   | Epoch cadence creates natural check-in ritual, progressive engagement ladder for each persona, smart alerts with appropriate quiet mode, civic identity creates meaningful switching cost, share cards for key moments                             |
| 9-10  | Measured retention rates improve quarter-over-quarter, notification strategy validated by engagement data, civic identity cited as reason users stay, viral loops drive measurable acquisition, DAU/MAU ratios competitive with best consumer apps |

### U6: Visual Design Craft (10 pts)

| Score | Anchor                                                                                                                                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Stock shadcn components throughout, no visual identity, dark mode is just inverted colors, generic charts                                                                                                                                                                                                                                     |
| 4-6   | Some custom components (hero sections, score ring), basic color system, dark mode functional but not polished, mix of custom and stock visualizations                                                                                                                                                                                         |
| 7-8   | Coherent visual identity system (color, type, spacing, iconography), hero sections set a bar the app matches, dark mode is a first-class experience with depth and vibrancy, data visualizations are custom and governance-specific, most screenshots pass the "pitch deck" test, clear visual differentiation from competitors               |
| 9-10  | Every component feels purpose-built, visual identity is instantly recognizable (remove logo and you still know it's Civica), dark mode rivals Vercel/Linear, visualizations are category-defining, design system documented and maintained, screenshots consistently provoke "this looks incredible" reactions, brand design could win awards |

## Phase 9: Work Plan

For each gap, propose improvements following `docs/strategy/context/work-plan-template.md`.

Categorize each issue:

- **leverage** — backend capability not surfaced or poorly surfaced
- **journey** — persona journey gap (step missing or weak)
- **storytelling** — data presented without narrative or emotional context
- **polish** — interaction quality issue (loading, error, responsive, accessibility)
- **design** — visual craft issue (stock components, weak identity, dark mode gaps, generic visualizations)
- **retention** — missing engagement loop or return incentive

**Key decision prompts for the user:**

- Which persona journey should be perfected first? (recommendation: citizen, as 80%+ of users)
- Should the epoch briefing be the hard-default home for returning users?
- Which unsurfaced backend capabilities have the highest impact-to-effort ratio?
- Should we invest in push notifications / email briefings before perfecting in-app?
- Is the Wrapped/report format premium enough to be a shareable viral artifact?
- Which components should be upgraded from stock shadcn to custom governance-specific designs first?
- Should we invest in a formal design system (tokens, component library documentation) or continue ad hoc?

## Recommended Cadence

- **Per build session**: Quick check — does this change make the UX better or worse? Apply the 4 tests (30-second, comeback, distinctiveness, storytelling).
- **Monthly**: `/audit-ux [persona]` — deep dive on the persona you're actively building for
- **Quarterly**: `/audit-ux` full — all personas, all surfaces, competitive benchmarking
- **Post-launch of major surface**: `/audit-ux [surface]` — focused polish pass on what just shipped
