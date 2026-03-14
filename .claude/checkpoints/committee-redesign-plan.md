# Committee Page World-Class Redesign — Work Plan

**Date:** 2026-03-11
**Scope:** Full MLE redesign of the Constitutional Committee feature surface
**Routes:** `/governance/committee`, `/discover/committee`, `/committee/[ccHotId]`
**Source:** MLE critique session — all findings, not just top 5

---

## Architecture Overview

The current committee feature is split across 3 disconnected views with no narrative intelligence, no information budget, and no persona adaptation. This plan consolidates everything into a cohesive, story-driven accountability surface.

### Target State

```
/governance/committee          → Unified CC Accountability Page (replaces both current views)
/governance/committee/[ccHotId] → Individual CC Member Profile (relocated, redesigned)
/discover/committee            → Redirect to /governance/committee
/committee/[ccHotId]           → Redirect to /governance/committee/[ccHotId]
/committee                     → Redirect to /governance/committee (already exists)
```

### Parallel Execution Map

```
Wave 0 (Scoring fix — DONE):
  └─ Chunk 0: Redistribute Pillar 5 weight ✅

Wave 1 (Foundation — no dependencies):
  ┌─ Chunk 1: Data layer + API enrichment
  ├─ Chunk 2: CC Health Verdict component (new)
  └─ Chunk 3: CC Narrative Intelligence helpers (new)

Wave 2 (depends on Wave 1):
  ┌─ Chunk 4: Unified /governance/committee page
  ├─ Chunk 5: Redesigned member profile page
  └─ Chunk 6: Route consolidation + redirects

Wave 3 (depends on Wave 2):
  ┌─ Chunk 7: Mobile card layout + responsive polish
  ├─ Chunk 8: Persona-gated content adaptation
  └─ Chunk 9: Craft & delight pass

Wave 4 (independent polish):
  └─ Chunk 10: UX constraints doc + cleanup
```

---

## Chunk 0: Scoring Recalibration (COMPLETED)

**Priority:** P0 (scores are wrong without this)
**Effort:** S (< 1 hour)
**Status:** DONE

### What was done

**Redistributed Pillar 5 (Community Engagement) weight.** The pillar's data sources (`questionsAnswered`, `endorsementCount`) are hardcoded to 0 in the sync pipeline, meaning every CC member's transparency score was artificially deflated by up to 10 points. Redistributed the 10% weight proportionally across the 4 active pillars:

- Participation: 0.35 → 0.39
- Rationale Quality: 0.30 → 0.33
- Responsiveness: 0.15 → 0.17
- Independence: 0.10 → 0.11
- Community Engagement: 0.10 → 0 (preserved in interface for future use)

**File modified:** `lib/scoring/ccTransparency.ts`

### Deferred from original Chunk 0 scope

1. **CIP-119 CC metadata sync** — Koios lacks a dedicated CC metadata endpoint (unlike `/drep_metadata` for DReps). CC identity data comes from CIP-136 rationale `author_name` fields, which is already captured. Deferred until Koios adds CC metadata support.

2. **Dual-role detection** — CC hot credentials and DRep/SPO IDs use incompatible formats (raw credential vs bech32-encoded). Cross-matching requires credential hash normalization. Deferred to Phase 2.

### Impact

Next sync run (every 6h) will recompute all CC member scores with corrected weights. Historical snapshots retain old weights — the trend chart may show a one-time calibration jump. This is acceptable and honest.

---

## Chunk 1: Data Layer & API Enrichment

**Priority:** P0 (critical path — blocks Chunks 4, 5)
**Effort:** M (1-3 hours)
**Audit dimension(s):** M2 (Narrative Intelligence), M3 (Info Architecture)
**Expected score impact:** Enables M2: 3→7, M3: 4→7
**Depends on:** None
**PR group:** A

### Context

The current data layer returns raw metrics without computed insights. The API route (`/api/governance/committee/route.ts`) returns vote counts and grades but no interpreted intelligence. The `getCCMembersTransparency()` function returns pillar scores but no comparative context (rank, percentile, trend direction). Individual member profiles make 6+ Supabase calls with no narrative metadata.

For the redesigned pages to show "conclusions first," the data layer must provide pre-computed narratives and health signals.

### Scope

**Modify `lib/data.ts`:**

- Add `getCCHealthSummary()` function that returns:
  - Overall CC health verdict: `healthy | attention | critical` based on avg transparency + participation trends
  - One-line narrative summary (e.g., "All 7 members actively voting. Average transparency is strong at 73/100.")
  - Key tension count (proposals where CC diverged from DRep majority)
  - Trend direction: `improving | stable | declining` (compare current vs previous epoch snapshot)
  - Active member count, total members, avg transparency
- Add `getCCMemberVerdict(ccHotId)` function that returns:
  - Peer rank and percentile
  - One-line narrative verdict (e.g., "Above average. Strong participation but declining rationale quality.")
  - Strongest pillar and weakest pillar (name + score)
  - Trend direction from transparency snapshots
  - Whether they've voted on the most recent eligible proposals

**Modify `app/api/governance/committee/route.ts`:**

- Add `health` field to API response with the CC health summary
- Add `narrativeVerdict` field per member (one-line interpreted string)
- Add `rank` field per member
- Keep existing fields for backwards compatibility

**Create `lib/cc/narratives.ts`:**

- `generateCCHealthNarrative(members, tensions)` → string
- `generateMemberVerdict(member, allMembers)` → string
- `interpretMetric(name, value, context)` → string (e.g., "84% unanimous — healthy consensus with room for independent judgment")
- These are deterministic template functions, not AI-generated

### Decision Points

None — execute directly. These are additive data functions that don't change existing behavior.

### Verification

- `getCCHealthSummary()` returns a valid verdict, narrative, and trend for current production data
- `getCCMemberVerdict()` returns rank, narrative, strongest/weakest pillar for each member
- API response includes new fields without breaking `useCommitteeMembers()` hook
- Run `npm run preflight` — all existing tests pass

### Files to Read First

- `lib/data.ts` (lines 995-1088 — CC functions)
- `app/api/governance/committee/route.ts`
- `hooks/queries.ts` (lines 11-29 — CommitteeMemberQuickView type)
- `app/discover/committee/page.tsx` (lines 56-189 — tension calculation logic to extract)

---

## Chunk 2: CC Health Verdict Component

**Priority:** P0 (dominant element for the redesigned page)
**Effort:** M (1-3 hours)
**Audit dimension(s):** M1 (JTBD Clarity), M2 (Narrative Intelligence), M4 (Emotional Design)
**Expected score impact:** M1: 4→8, M2: 3→8, M4: 3→7
**Depends on:** None (can use mock data, will wire to Chunk 1 in Chunk 4)
**PR group:** B

### Context

The current page has no dominant element — it's a flat list. The 5-second test fails because there's no headline insight. Per UX constraints, every page needs "1 dominant element" that answers the core JTBD.

The CC Health Verdict is the dominant element for `/governance/committee`. It answers the citizen's JTBD ("Are my constitutional guardians trustworthy?") in one glance.

### Scope

**Create `components/cc/CCHealthVerdict.tsx`:**

- Server component (receives data as props)
- Visual design:
  - Health band indicator (like a credit score band — green/amber/red arc or bar)
  - Large verdict text: "Constitutional Committee: Healthy" (or "Needs Attention" / "Critical")
  - One-sentence narrative below: "All 7 members are actively voting. Average transparency is strong at 73/100."
  - Trend arrow: improving/stable/declining with context
  - Secondary stat: "2 proposals with CC-DRep tension this epoch" (links to tension section below)
- Must pass the 5-second test: a first-time user instantly understands CC accountability status
- Color system: emerald for healthy, amber for attention, rose for critical
- Must look purpose-built for Governada, not like a generic card (per product-vision.md: "Every screenshot must be unmistakably Governada")

**Design benchmark:** Apple Health cardio fitness score — one number, one interpretation, one trend, drill down for details.

### Decision Points

**Visual treatment for the health band:** Options include:

1. Arc/gauge visualization (like a credit score) — most distinctive, medium complexity
2. Horizontal bar with colored segments — simpler, still effective
3. Large letter grade with color halo — minimal, could pair with the arc

Recommend option 1 (arc) for distinctiveness but the agent should propose what works best and ask if needed.

### Verification

- Component renders with mock data covering all 3 states (healthy, attention, critical)
- Passes 5-second test: purpose and status are immediately clear
- Looks distinctive — not a generic shadcn Card
- Responsive: works on mobile (320px) through desktop (1440px)

### Files to Read First

- `docs/strategy/context/ux-constraints.md` (page constraint format and rules)
- `.claude/rules/product-vision.md` (visual identity standards)
- `components/cc/CCTransparencyTrend.tsx` (existing CC visualization style reference)
- Any existing "health" or "verdict" components in the codebase for pattern consistency

---

## Chunk 3: Narrative Intelligence Helpers

**Priority:** P1 (enables interpreted metrics across both pages)
**Effort:** S (< 1 hour)
**Audit dimension(s):** M2 (Narrative Intelligence)
**Expected score impact:** M2: 3→8
**Depends on:** None
**PR group:** A (ships with Chunk 1 — same data domain)

### Context

Every metric on the current pages is a raw number. "73" means nothing without context. "84% unanimous" could mean consensus or groupthink. Per the UX philosophy: "72 is not intelligence. 'Solid governance, but 3 missed votes' is intelligence."

This chunk creates reusable interpretation functions that translate raw metrics into one-line stories.

### Scope

**Create `lib/cc/interpretations.ts`:**

Functions that take a metric value and return an interpreted string:

- `interpretTransparencyScore(score, rank, total)` → "Strong transparency (73/100) — ranked 2nd of 7 members"
- `interpretParticipation(votescast, eligible)` → "Voted on 95% of proposals — only missed 2 this epoch"
- `interpretUnanimousRate(rate, count, total)` → "84% unanimous — healthy consensus, with 3 proposals showing independent judgment"
- `interpretAlignmentTension(tensions[])` → "The CC diverged from DRep majority on 2 proposals — a sign of independent constitutional review"
- `interpretRationaleQuality(score, provisionRate)` → "Provides rationales on 89% of votes with strong article citations"
- `interpretIndependence(score, unanimousRate)` → "Moderate independence — votes with the majority on 94% of proposals"
- `interpretTrend(current, previous, epochs)` → "Improving — up 5 points over the last 3 epochs"
- `interpretPillarStrengthWeakness(pillars)` → "Strongest: Participation (95/100). Weakest: Independence (42/100)"

Each function:

- Returns a plain-English string suitable for display below a metric
- Includes contextual framing (is this good? bad? unusual?)
- Uses specific numbers, not vague language
- Is deterministic (no AI calls)

### Decision Points

None — execute directly. These are pure utility functions with no side effects.

### Verification

- Each function returns sensible interpretations for edge cases: score of 0, score of 100, null inputs, single member
- No function returns just a number — every return value includes interpretive context
- Run `npm run preflight`

### Files to Read First

- `lib/data.ts` (lines 1033-1088 — CCMemberTransparency type for field names)
- `app/discover/committee/page.tsx` (lines 130-178 — existing tension/unanimous calculation as reference)

---

## Chunk 4: Unified `/governance/committee` Page

**Priority:** P0 (the core deliverable)
**Effort:** L (3-8 hours)
**Audit dimension(s):** M1, M2, M3, M4, M6 (all except M5)
**Expected score impact:** M1: 4→8, M2: 3→8, M3: 4→8, M4: 3→7, M6: 4→7
**Depends on:** Chunks 1, 2, 3
**PR group:** C

### Context

Currently the committee content is split across `/governance/committee` (thin member list) and `/discover/committee` (rich transparency index). This chunk consolidates everything into one strong, story-driven page at `/governance/committee`.

The new page structure follows the information budget strictly:

1. **Dominant element:** CC Health Verdict (from Chunk 2)
2. **Supporting element 1:** Key Insight Card (tension/independence story)
3. **Supporting element 2:** Member Accountability Rankings
4. **Below fold:** Methodology (collapsed)

### Scope

**Rewrite `app/governance/committee/page.tsx`:**

- Server component with `force-dynamic`
- Parallel data fetching: `getCCHealthSummary()`, `getCCMembersTransparency()`, tension data
- No longer renders `<CommitteeDiscovery />` — builds the full page inline or with new components

**Page sections (in order):**

**Section 1: CC Health Verdict (above fold — dominant)**

- Render `<CCHealthVerdict>` component (Chunk 2)
- This IS the 5-second answer: "The CC is healthy / needs attention"

**Section 2: Key Insight Card (above fold — supporting)**

- Create `components/cc/CCInsightCard.tsx`
- Dynamically selects the most interesting current story:
  - If alignment tensions exist: "CC Independence: X proposals where the committee exercised independent judgment" with mini-table
  - If a member's score changed significantly: "Notable change: [Member] transparency score dropped 15 points"
  - If all members have high scores: "Strong accountability: all members maintaining B grade or above"
  - Fallback: highest-impact recent CC vote with vote breakdown
- This card makes users go "oh, that's interesting" — it's the editorial voice

**Section 3: Member Accountability Rankings (below fold — supporting)**

- Server-rendered table (not client-side TanStack Query — we have the data server-side)
- Each member row shows:
  - Rank number
  - Name (human-readable — never bare hex as primary. Truncated hex as secondary subtitle only)
  - Transparency grade (large colored letter)
  - One-line narrative verdict from `generateMemberVerdict()` (e.g., "Strong participation, improving rationale quality")
  - Status badge (authorized/expired)
  - Link to profile: `/governance/committee/[ccHotId]`
- Sorted by transparency score descending
- Search: keep `DiscoverFilterBar` for power users but make it secondary (collapsed or subtle)
- On mobile: member cards instead of table rows (see Chunk 7)

**Section 4: Methodology (below fold — collapsed)**

- Collapsible "How is this calculated?" section
- Brief 2-sentence explanation + link to `/methodology` for full details
- NOT the current 5-column grid taking up full viewport

**Remove from this page:**

- The 4 stat cards (Active Members, Total Votes, Unanimous Rate, Avg Transparency) — these are raw data dumps. The Health Verdict absorbs their purpose with interpretation.
- The detailed Alignment Tension table — absorbed into the Insight Card (summary) and available in full on individual profiles
- The full methodology grid — collapsed into a link

### Decision Points

1. **Should the member list use client-side search (current) or server-rendered with optional client search?** Recommendation: Server-render the full list (only ~7-10 members) and add client-side filtering as progressive enhancement. The data is small enough that SSR is better for LCP.

2. **Should the insight card be hand-crafted or use AI narratives?** Recommendation: Deterministic template-based (from Chunk 3). AI narratives can come later as a Phase 2 enhancement.

### Verification

- Page passes the 5-second test: a first-time anonymous user understands "this shows CC accountability" immediately
- CC Health Verdict is the dominant visual element above the fold
- Member list shows human-readable names with interpreted verdicts (not raw scores)
- The 4 stat cards are GONE — their information is absorbed into the verdict
- Methodology is collapsed, not competing for attention
- Mobile renders cleanly with stacked layout
- `npm run preflight` passes

### Files to Read First

- `app/governance/committee/page.tsx` (current thin page to replace)
- `app/discover/committee/page.tsx` (current rich page — absorb its data logic)
- `components/CommitteeDiscovery.tsx` (current member list — replace)
- `docs/strategy/context/ux-constraints.md` (information budget rules)
- `.claude/rules/product-vision.md` (visual standards)

---

## Chunk 5: Redesigned Member Profile Page

**Priority:** P0 (the depth view for accountability)
**Effort:** L (3-8 hours)
**Audit dimension(s):** M1, M2, M3, M4, M5
**Expected score impact:** M1: 5→8, M2: 3→8, M3: 3→8, M4: 3→7, M5: 5→7
**Depends on:** Chunks 1, 3
**PR group:** D

### Context

The current profile at `/committee/[ccHotId]` has 7 sections with equal visual weight, massive information overload, redundant data (alignment in stats grid AND inter-body section), and an unbounded voting record table. It violates "1 dominant + 2-3 supporting" and has zero narrative intelligence.

### Scope

**Rewrite `app/committee/[ccHotId]/page.tsx`** (or move to `app/governance/committee/[ccHotId]/page.tsx` if route changes in Chunk 6):

**New structure with progressive disclosure:**

**Hero (above fold — dominant):**

- Member name (large, human-readable)
- Transparency score + grade (prominent visual — keep the existing card style but larger)
- Rank badge: "2nd of 7"
- One-sentence narrative verdict from `generateMemberVerdict()`: "Above average. Strong participation with improving rationale quality. Independence score is notably low."
- Status + expiration badges
- Breadcrumb: Governance > Committee > [Name]

**Key Stats (above fold — supporting, max 3 cards):**

- Participation: "Voted on 42/44 proposals (95%)" with interpretation
- Rationale Quality: "Provides rationales on 89% of votes" with interpretation
- Independence: "Votes with CC majority on 94% of proposals" with interpretation
- Remove DRep Alignment and SPO Alignment from the stats grid — they appear in the Alignment tab

**Tab bar (below fold — progressive disclosure):**

- **Overview tab (default):**
  - 5-pillar breakdown (keep existing `PillarBar` component — it's good)
  - Transparency trend chart (keep existing `CCTransparencyTrend` — it's strong)

- **Voting Record tab:**
  - Paginated table: show 10 votes at a time with "Load more" or pagination
  - Keep existing columns but add the narrative interpretation per vote where rationale exists
  - Remove the "Votes by Proposal Type" stacked bars — they're interesting for researchers but occupy prime space. Move to a collapsed section within this tab if needed.

- **Alignment tab:**
  - Inter-body alignment (DRep + SPO consensus bars — keep existing, they're well-designed)
  - Alignment tension: proposals where this member diverged from DRep majority (elevated from the index page)
  - Votes by proposal type breakdown (relocated from overview)

**Remove/relocate:**

- DRep/SPO alignment from stats grid (redundant with Alignment tab)
- Votes by Proposal Type from main flow (moved to Alignment tab)
- Unbounded voting record (paginated to 10)
- Raw hex ID as primary display (name first, hex as subtle secondary)

### Decision Points

1. **Tab implementation:** Use simple client-side tabs (URL hash or state) or Next.js parallel routes? Recommendation: Simple client-side tabs with state — the data is already fetched server-side and can be passed as props. No need for additional server round-trips per tab.

2. **Route location:** Keep at `/committee/[ccHotId]` or move to `/governance/committee/[ccHotId]`? Recommendation: Move to `/governance/committee/[ccHotId]` for URL consistency (the parent is `/governance/committee`). Add redirect from old path in Chunk 6.

### Verification

- Hero answers the JTBD in 5 seconds: "This member is doing [well/poorly] because [reason]"
- Only 3 stat cards above the fold (not 5)
- Tabs work for switching between Overview, Voting Record, Alignment
- Voting record is paginated (10 per page)
- No redundant information between sections
- Narrative verdicts appear in hero and stat cards
- `npm run preflight` passes

### Files to Read First

- `app/committee/[ccHotId]/page.tsx` (current 616-line page to redesign)
- `components/cc/CCTransparencyTrend.tsx` (keep — just needs to be in Overview tab)
- `lib/data.ts` (CC data functions)
- `docs/strategy/context/ux-constraints.md`

---

## Chunk 6: Route Consolidation & Redirects

**Priority:** P1 (eliminates confusion, fixes broken links)
**Effort:** S (< 1 hour)
**Audit dimension(s):** M1 (JTBD Clarity), M3 (Info Architecture)
**Expected score impact:** M3: 4→7 (eliminates fragmented views)
**Depends on:** Chunks 4, 5 (the new pages must exist before redirecting)
**PR group:** E

### Context

The current setup has 3 entry points for committee content (`/governance/committee`, `/discover/committee`, `/committee/[id]`) with no clear hierarchy. The `CommitteeDiscovery` component has a self-referential "View full Transparency Index" link at line 140 that points to the page the user is already on. The `/discover/committee` page is the better page but is buried at an obscure URL.

### Scope

**Modify `app/discover/committee/page.tsx`:**

- Replace content with a redirect to `/governance/committee`
- Use `redirect()` from `next/navigation`

**Modify `app/committee/[ccHotId]/page.tsx`:**

- If member profile moved to `/governance/committee/[ccHotId]`: redirect to new location
- If kept at `/committee/[ccHotId]`: no change needed

**Add redirect in `next.config.ts`:**

- `/discover/committee` → `/governance/committee` (permanent redirect)

**Update `middleware.ts`:**

- Add redirect rule if not handled by next.config.ts

**Delete unused files:**

- `components/CommitteePageClient.tsx` (confirmed unused — not imported anywhere)
- `app/discover/committee/loading.tsx` (no longer needed if route redirects)

**Fix self-referential link:**

- Remove or repurpose the "View full Transparency Index →" link in any remaining component

### Decision Points

None — execute directly. Redirects are safe and reversible.

### Verification

- `/discover/committee` redirects to `/governance/committee` (HTTP 308)
- `/committee/[id]` redirects to `/governance/committee/[id]` (if moved)
- `/committee` still redirects to `/governance/committee` (existing)
- No 404s for any previously-working committee URLs
- `CommitteePageClient.tsx` is deleted
- `npm run preflight` passes

### Files to Read First

- `app/discover/committee/page.tsx`
- `app/committee/page.tsx` (existing redirect)
- `next.config.ts` (existing redirect rules)
- `middleware.ts` (existing redirect rules)
- `components/CommitteePageClient.tsx` (confirm unused before deleting)

---

## Chunk 7: Mobile Card Layout & Responsive Polish

**Priority:** P2 (better mobile experience)
**Effort:** M (1-3 hours)
**Audit dimension(s):** M5 (Craft & Polish)
**Expected score impact:** M5: 5→7
**Depends on:** Chunk 4 (needs the new page structure)
**PR group:** F

### Context

The current rankings table hides Participation, Rationale, and Response columns on mobile via responsive breakpoints. This means mobile users see only Rank, Name, Votes, and Transparency bar — losing the narrative that explains the score. Tables on small screens are an anti-pattern for this content.

### Scope

**Modify the member rankings section in `/governance/committee`:**

- Desktop (lg+): Keep table layout with full columns
- Tablet (sm-md): Simplified table with fewer columns
- Mobile (<sm): Replace table with stacked member cards:

**Mobile member card design:**

```
┌──────────────────────────────────┐
│  [A]  Member Name            #2 │
│       ■■■■■■■■■■░░ 73/100       │
│       "Strong participation,    │
│        improving rationales"    │
│       authorized · epoch 120    │
└──────────────────────────────────┘
```

Each card shows:

- Grade badge (large, colored)
- Name
- Transparency bar + score
- One-line verdict (from Chunk 3)
- Status + expiration
- Tappable — links to profile

**Also polish:**

- CC Health Verdict responsive layout (stack vertically on mobile)
- Insight Card responsive layout
- Touch targets: ensure all tappable elements are 44x44px minimum

### Decision Points

None — execute directly. This is a responsive enhancement.

### Verification

- Page renders cleanly at 320px, 375px, 768px, 1024px, 1440px widths
- Mobile shows cards not tables
- All touch targets are 44x44px minimum
- No horizontal scroll on any viewport
- Grade badges and verdict text are legible at all sizes

### Files to Read First

- The new `/governance/committee/page.tsx` (from Chunk 4)
- `components/governada/discover/DiscoverFilterBar.tsx` (responsive patterns)
- Tailwind breakpoint conventions used elsewhere in the app

---

## Chunk 8: Persona-Gated Content Adaptation

**Priority:** P2 (differentiated experience per persona)
**Effort:** M (1-3 hours)
**Audit dimension(s):** M1 (JTBD Clarity), M4 (Emotional Design), M6 (Vision & Ambition)
**Expected score impact:** M1: 7→9, M6: 7→8
**Depends on:** Chunk 4 (needs the new page structure)
**PR group:** G

### Context

The vision specifies: "Aggressive persona adaptation. Different personas see different content." Currently the committee page shows the same thing to everyone. Each persona has a different JTBD on this page:

- **Citizen:** "Are my constitutional guardians trustworthy?" → Verdict + simple rankings
- **DRep:** "Where does the CC disagree with us?" → Tension analysis elevated
- **SPO:** "How does the CC affect my governance?" → SPO alignment highlighted
- **CC Member:** "How am I performing vs peers?" → My rank + competitor comparison
- **Researcher:** "Deep data access" → Full table with export option

### Scope

**Modify the Insight Card selection logic:**

- Citizen (anonymous or delegated): Show the most citizen-relevant insight (general CC health, trust narrative)
- DRep: Show CC-DRep alignment tension as the primary insight ("The CC diverged from DRep majority on X proposals")
- SPO: Show CC-SPO alignment as the primary insight
- CC Member: Show "Your Ranking" as the primary insight (personalized if wallet connected and matches a CC member)
- Default/anonymous: Show the most broadly interesting story

**Modify member rankings emphasis:**

- For authenticated CC members: Highlight their own row in the rankings with a subtle "You" badge
- For DReps: Add a "CC-DRep Alignment" column showing agreement % per member
- For SPOs: Add a "CC-SPO Alignment" column

**Use the existing segment detection:**

- Read from `useSegment()` hook or `SegmentProvider`
- Server components: use wallet detection from cookies/headers if available, otherwise default to citizen view
- Client components: `useSegment()` for persona-aware rendering

### Decision Points

1. **How much persona variation?** Recommendation: Start with insight card adaptation (low effort, high impact) and defer column changes to a follow-up if needed. The insight card alone delivers 80% of the persona value.

### Verification

- Anonymous users see general CC health insight
- DRep segment sees CC-DRep tension insight
- SPO segment sees CC-SPO alignment insight
- If a connected wallet matches a CC member, they see their own rank highlighted
- View As admin tool can simulate each persona and see the correct adaptation
- `npm run preflight` passes

### Files to Read First

- `components/providers/SegmentProvider.tsx` (segment detection)
- `lib/admin/viewAsRegistry.ts` (View As registry — may need CC presets)
- `hooks/useSegment.ts` or equivalent
- The new `/governance/committee/page.tsx` (from Chunk 4)

---

## Chunk 9: Craft & Delight Pass

**Priority:** P3 (the difference between "good" and "I want to show someone")
**Effort:** M (1-3 hours)
**Audit dimension(s):** M4 (Emotional Design), M5 (Craft & Polish)
**Expected score impact:** M4: 7→9, M5: 7→9
**Depends on:** Chunks 4, 5, 7 (needs final page structure)
**PR group:** H

### Context

Per product-vision.md: "Default to the most visually distinctive option." and "If a component could exist in any shadcn/Next.js app, it needs more work." The committee pages should feel purpose-built for constitutional accountability, not like a generic data table.

### Scope

**CC Health Verdict enhancements:**

- Add a subtle animation to the health band on page load (spring physics via Framer Motion, not CSS)
- Pulsing glow on the verdict text color matching the health state

**Member profile hero:**

- Score ring or arc visualization for the transparency index (similar to Apple Watch rings)
- Subtle entrance animation for the pillar bars (staggered fill from 0 to actual value)

**Trend chart enhancements (`CCTransparencyTrend.tsx`):**

- Add a gradient fill under the line (matching the grade color)
- Smooth the line with curve interpolation if not already (check d3 curve type)
- Add a subtle dot pulse on the current epoch data point

**Loading states:**

- Create `app/governance/committee/loading.tsx` with skeleton matching the new layout (verdict skeleton + member card skeletons)
- Create loading state for member profile that matches the hero + tabs layout

**Empty states:**

- If no CC votes yet: Illustration + "The Constitutional Committee hasn't voted yet. Check back after proposals are submitted."
- If member has no data: Contextual message about what this member needs to do

**Micro-interactions:**

- Member row hover: subtle left-border accent in the grade color
- Tab switching: smooth content transition (no jarring swap)
- Grade badge: subtle scale pulse on hover

### Decision Points

1. **Framer Motion vs CSS animations?** Recommendation: Use Framer Motion for the verdict hero (it's already in the project for hero sections) and CSS for simpler micro-interactions (hover states, tab transitions). Lazy-load Framer Motion via `next/dynamic`.

### Verification

- Health verdict has entrance animation that feels polished, not flashy
- Pillar bars animate from 0 on page load
- Loading skeletons match the actual page layout
- Empty states are helpful and branded
- No layout shift (CLS) from animations
- Animations are disabled for `prefers-reduced-motion`
- `npm run preflight` passes

### Files to Read First

- The new components from Chunks 2, 4, 5, 7
- `components/cc/CCTransparencyTrend.tsx` (existing chart to enhance)
- Any existing Framer Motion usage in the project (search for `framer-motion` imports)
- `app/governance/committee/loading.tsx` (create if doesn't exist)

---

## Chunk 10: UX Constraints Doc + Cleanup

**Priority:** P3 (documentation + debt)
**Effort:** S (< 1 hour)
**Audit dimension(s):** M3 (Info Architecture) — prevents future drift
**Expected score impact:** Prevents regression
**Depends on:** Chunks 4, 5 (needs final page structure to document)
**PR group:** I

### Context

The committee page has no entry in `docs/strategy/context/ux-constraints.md`. This means future agents building on this page have no guardrails against information overload. Additionally, several files will be orphaned after the redesign.

### Scope

**Add to `docs/strategy/context/ux-constraints.md`:**

```markdown
### `/governance/committee` — CC Accountability

| Attribute               | Constraint                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| **Core JTBD**           | Judge if my constitutional guardians are trustworthy                    |
| **5-second answer**     | "The CC is [healthy/needs attention] — here's the story"                |
| **Dominant element**    | CC Health Verdict — interpreted status with trend                       |
| **Supporting elements** | Key insight card, member accountability rankings with verdicts          |
| **NOT on this page**    | Raw stat cards, full methodology, unbounded tables, individual profiles |
| **Benchmark**           | Apple Health cardio fitness: one number, one trend, one insight         |

### `/governance/committee/[id]` — CC Member Profile

| Attribute               | Constraint                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| **Core JTBD**           | Evaluate this CC member's accountability                                |
| **5-second answer**     | "This member is [above/below average] because [reason]"                 |
| **Dominant element**    | Verdict hero — name, score, grade, one-line narrative                   |
| **Supporting elements** | 3 key stats (participation, rationale quality, independence)            |
| **NOT in the hero**     | Full pillar breakdown, voting record, alignment data (tabs below fold)  |
| **Benchmark**           | LinkedIn profile: name, headline, key stats above fold. Details scroll. |
```

**Delete orphaned files:**

- `components/CommitteePageClient.tsx` (if not deleted in Chunk 6)
- Any unused imports or dead code from the old pages

**Update navigation if needed:**

- Verify governance sidebar/nav links point to `/governance/committee` (not `/discover/committee`)

### Decision Points

None — execute directly.

### Verification

- UX constraints doc has entries for both committee routes
- No orphaned files remain
- Navigation links are correct
- `npm run preflight` passes

### Files to Read First

- `docs/strategy/context/ux-constraints.md`
- `docs/strategy/context/navigation-architecture.md`
- Final versions of Chunks 4 and 5 pages

---

## Execution Summary

| Chunk | Name                     | Priority | Effort | Depends On | PR Group | Can Parallel With |
| ----- | ------------------------ | -------- | ------ | ---------- | -------- | ----------------- |
| 1     | Data Layer & API         | P0       | M      | None       | A        | 2, 3              |
| 2     | Health Verdict Component | P0       | M      | None       | B        | 1, 3              |
| 3     | Narrative Helpers        | P1       | S      | None       | A        | 1, 2              |
| 4     | Unified Committee Page   | P0       | L      | 1, 2, 3    | C        | 5                 |
| 5     | Member Profile Redesign  | P0       | L      | 1, 3       | D        | 4                 |
| 6     | Route Consolidation      | P1       | S      | 4, 5       | E        | —                 |
| 7     | Mobile Card Layout       | P2       | M      | 4          | F        | 8                 |
| 8     | Persona Adaptation       | P2       | M      | 4          | G        | 7                 |
| 9     | Craft & Delight          | P3       | M      | 4, 5, 7    | H        | 10                |
| 10    | UX Constraints + Cleanup | P3       | S      | 4, 5       | I        | 9                 |

### Optimal Parallel Execution

**Session 1 — Wave 1 (3 agents in parallel):**

- Agent A: Chunk 1 (Data Layer) + Chunk 3 (Narrative Helpers) → PR group A
- Agent B: Chunk 2 (Health Verdict Component) → PR group B

**Session 2 — Wave 2 (2 agents in parallel, after Wave 1 merges):**

- Agent C: Chunk 4 (Unified Committee Page) → PR group C
- Agent D: Chunk 5 (Member Profile Redesign) → PR group D

**Session 3 — Wave 3 (3 agents in parallel, after Wave 2 merges):**

- Agent E: Chunk 6 (Route Consolidation) → PR group E
- Agent F: Chunk 7 (Mobile Cards) → PR group F
- Agent G: Chunk 8 (Persona Adaptation) → PR group G

**Session 4 — Wave 4 (2 agents in parallel, after Wave 3 merges):**

- Agent H: Chunk 9 (Craft & Delight) → PR group H
- Agent I: Chunk 10 (UX Constraints + Cleanup) → PR group I

### Total Estimated Effort

| Effort    | Count         | Hours                    |
| --------- | ------------- | ------------------------ |
| S         | 3 chunks      | ~2 hours                 |
| M         | 5 chunks      | ~10 hours                |
| L         | 2 chunks      | ~10 hours                |
| **Total** | **10 chunks** | **~22 hours agent time** |

With parallel execution across 4 waves, wall-clock time is approximately **~10 hours**.

### Expected MLE Score Impact

| Dimension                  | Before     | After         | Delta      |
| -------------------------- | ---------- | ------------- | ---------- |
| M1: JTBD Clarity           | 4/10       | 8-9/10        | +4-5       |
| M2: Narrative Intelligence | 3/10       | 8/10          | +5         |
| M3: Info Architecture      | 4/10       | 8/10          | +4         |
| M4: Emotional Design       | 3/10       | 8-9/10        | +5-6       |
| M5: Craft & Polish         | 5/10       | 8-9/10        | +3-4       |
| M6: Vision & Ambition      | 4/10       | 8/10          | +4         |
| **Total**                  | **~23/60** | **~49-51/60** | **+26-28** |
