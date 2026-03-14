# Civic Identity Rings — Feature Plan

> **Origin**: `/explore-feature Civic Identity` (2026-03-13)
> **Concept**: Hybrid "Rings + Mirror Essence" — three governance rings as the persistent identity layer, Mirror narrative as the depth layer, Passport stamps for shareability.
> **Inspiration**: Apple Watch Activity Rings, Strava Social Fitness, Gitcoin Passport, Pol.is Opinion Landscape
> **Status**: Phase 1 SHIPPED (PR #319), Phase 2 SHIPPED (PR #320), Phase 3 planned

---

## The Concept

Replace the 15-metric Civic Identity dashboard with a single glanceable signal: "Am I governing well?" — expressed through three concentric rings that fill based on governance activity.

**Ring 1 — Delegation Health** (blue, weight 0.40): How well is your DRep performing? Derived from DRep composite score (0-100) normalized to 0-1.

**Ring 2 — Representation Coverage** (purple, weight 0.35): What % of proposals are covered by your delegation? Derived from impact coverage score (0-25) normalized to 0-1.

**Ring 3 — Civic Engagement** (amber, weight 0.25): Are you actively participating? Derived from impact engagement depth score (0-25) normalized to 0-1.

**Governance Pulse**: Weighted composite of all three rings → 0-100 number displayed centered inside the rings.

Below the rings: **Identity Narrative** (template sentence summarizing governance posture), **Governance Archetype** (personality label from alignment), and **Milestone Stamps** (compact collectible row).

Behind a toggle: all existing detail sections (stats grid, footprint, engagement, impact score card, full milestone gallery).

### What to Steal from Each Concept

| Source                   | Element                                        | Phase                                                     |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------- |
| **Rings (Concept A)**    | Three-ring visualization                       | 1 ✅                                                      |
| **Rings**                | Governance Pulse number                        | 1 ✅                                                      |
| **Rings**                | Epoch reset + history scroll                   | 2                                                         |
| **Rings**                | Ring-closing motivation mechanics              | 2                                                         |
| **Passport (Concept B)** | Per-milestone shareable stamp cards            | 1 ✅ (stamps exist, sharing exists via celebration modal) |
| **Passport**             | "Year in Governance" Wrapped event             | 3                                                         |
| **Passport**             | Citizenship Tier concept                       | 2                                                         |
| **Mirror (Concept C)**   | AI-generated identity narrative                | 2                                                         |
| **Mirror**               | Governance Archetype as primary identity label | 2                                                         |
| **Mirror**               | "Citizens Like You" landscape                  | 3                                                         |
| **Mirror**               | Values Discovery Cards                         | 3                                                         |

---

## Current State (post-Phase 1)

### What EXISTS

| Component                          | File                                                     | Status                                  |
| ---------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| GovernanceRings (3 SVG rings)      | `components/governada/identity/GovernanceRings.tsx`      | ✅ Shipped                              |
| GovernancePulse (0-100 score)      | `components/governada/identity/GovernancePulse.tsx`      | ✅ Shipped                              |
| IdentityNarrative (template)       | `components/governada/identity/IdentityNarrative.tsx`    | ✅ Shipped (template, not AI)           |
| MilestoneStamps (compact row)      | `components/governada/identity/MilestoneStamps.tsx`      | ✅ Shipped                              |
| Ring computation engine            | `lib/governanceRings.ts`                                 | ✅ Shipped                              |
| CivicIdentityProfile (rings-first) | `components/governada/identity/CivicIdentityProfile.tsx` | ✅ Shipped                              |
| Archetype system (4 labels/dim)    | `lib/drepIdentity.ts`                                    | ✅ Shipped (DRep-level only)            |
| Milestone sharing                  | `CitizenMilestoneCelebration.tsx` + OG routes            | ✅ Pre-existing                         |
| Governance Wrapped (epoch stats)   | `governance_wrapped` table + Inngest function            | ✅ Pre-existing (stats, not narrative)  |
| Anthropic SDK integration          | `lib/ai.ts`                                              | ✅ Pre-existing (not used for identity) |

### What DOES NOT EXIST

| Feature                           | Needed For                      | Dependency                                     |
| --------------------------------- | ------------------------------- | ---------------------------------------------- |
| Epoch-level ring snapshots        | Ring history, trajectory        | New DB table + Inngest function                |
| AI-generated identity paragraph   | Mirror depth layer              | Claude API prompt + caching                    |
| Citizen-level archetype surfacing | Identity label in UI            | Citizens need alignment scores or quiz results |
| Governance Pulse history chart    | Ring-closing motivation         | Ring snapshots table                           |
| Citizenship Tier system           | Progressive identity maturation | New tier computation logic                     |
| Citizen PCA clustering            | "Citizens Like You"             | New computation pipeline                       |
| "Year in Governance" Wrapped      | Annual identity event           | Aggregation across epochs                      |
| Values Discovery Cards            | Trade-off exploration           | New component + alignment data                 |
| Temporal alignment drift          | Mirror evolution view           | Historical alignment snapshots                 |

---

## Phase 1: Core Rings (COMPLETE ✅)

> **Status**: Shipped in PR #319 (2026-03-13)
> **Effort**: M | **Impact**: High — complete above-the-fold redesign

### Deliverables (all shipped)

1. **`lib/governanceRings.ts`** — Ring computation engine
   - `computeGovernanceRings(footprint, impact)` → `{ rings, pulse, pulseColor, pulseLabel }`
   - Weights: delegation=0.4, coverage=0.35, engagement=0.25
   - Pulse color thresholds: 75+ emerald, 50+ primary, 25+ amber, <25 muted
   - `RING_CONFIG` array with label, color, trackColor, description per ring

2. **`GovernanceRings.tsx`** — Three concentric SVG rings
   - Outer→inner: Delegation (blue), Coverage (purple), Engagement (amber)
   - Animated fill with 700ms CSS transition
   - Track + progress arc, strokeLinecap round, -90deg rotation for 12 o'clock start

3. **`GovernancePulse.tsx`** — Composite pulse number
   - Large numeral with color coding, /100 suffix, pulse label below

4. **`IdentityNarrative.tsx`** — Template sentence
   - "[Tier] citizen. Delegating to [DRep] for [duration]. [N] proposals influenced. Governance Pulse: [Label]."
   - Fallback for undelegated: "Connect your delegation to start building your governance identity."

5. **`MilestoneStamps.tsx`** — Compact horizontal stamp row
   - Up to 6 visible stamps with +N overflow badge
   - Recent milestones highlighted with amber ring
   - Icon-mapped from CITIZEN_MILESTONES definitions

6. **`CivicIdentityProfile.tsx`** — Refactored layout
   - Above fold: Rings + Pulse (centered inside) → Ring legend → Identity Narrative
   - Below: Milestone Stamps → Alignment Quick Match link
   - Behind toggle ("Detailed Breakdown"): Stats grid, Governance Footprint, Engagement Stats, Impact Score Card, Full Milestone Gallery

7. **`lib/drepIdentity.ts`** — Archetype taxonomy expansion
   - 4 labels per alignment dimension (was 3)
   - 4th tier for weak dominance (distance < 8 from center)

---

## Phase 2: Depth & Motivation (COMPLETE ✅)

> **Status**: Shipped in PR #320 (2026-03-13)
> **Effort**: M | **Impact**: Medium-High — adds identity depth, retention mechanics, and AI personality
> **Priority**: Build before public launch — this is what makes identity feel alive vs. static

### 2A. AI-Generated Identity Paragraph

**What**: Replace the template narrative with a Claude-generated paragraph that weaves together the citizen's governance story — archetype, ring strengths/weaknesses, milestones, trajectory.

**Why**: The template sentence is functional but flat. An AI narrative makes identity feel personal and surprising. Citizens discover things about their governance posture they hadn't noticed.

**Implementation**:

- New API route: `app/api/you/identity-narrative/route.ts`
  - Input: footprint data, impact scores, ring values, milestones, archetype
  - Output: 2-3 sentence narrative paragraph
  - Claude Haiku for speed, cached in Redis (TTL: 1 epoch / 5 days)
  - Regenerated when: ring values change by >10%, new milestone earned, delegation change
- Prompt template in `lib/identity/narrativePrompt.ts`
- Component update: `IdentityNarrative.tsx` — fetch from API, fallback to template during loading
- **Effort**: S-M (prompt engineering + API route + caching)

### 2B. Governance Archetype as Primary Identity Label

**What**: Surface the personality archetype (e.g., "The Sentinel", "The Pioneer") prominently in the identity UI — between the rings and the narrative.

**Why**: Archetypes already exist in `drepIdentity.ts` but aren't shown to citizens. This gives every citizen a memorable identity label derived from their DRep's alignment.

**Implementation**:

- Citizens inherit archetype from their delegated DRep's alignment scores
- Add archetype display above narrative in `CivicIdentityProfile.tsx`
- Visual: archetype name + identity color accent from the dominant dimension
- **Prerequisite**: Citizens who haven't taken the Quick Match quiz inherit their DRep's archetype. Citizens who HAVE taken the quiz get their own archetype from quiz responses.
- **Effort**: S (data exists, just needs UI wiring)

### 2C. Epoch-Level Ring Snapshots

**What**: Store ring values per citizen per epoch so we can show trajectory over time.

**Why**: Without history, rings are a static snapshot. With history, citizens see their governance participation evolving — creating motivation to "close the rings" each epoch.

**Implementation**:

- New table: `citizen_ring_snapshots`
  ```sql
  CREATE TABLE citizen_ring_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    epoch integer NOT NULL,
    delegation_ring numeric(4,3) NOT NULL,
    coverage_ring numeric(4,3) NOT NULL,
    engagement_ring numeric(4,3) NOT NULL,
    pulse integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, epoch)
  );
  ```
- New Inngest function: `snapshot-citizen-rings` — triggered by `drepscore/epoch.transition`, computes and stores ring values for all active citizens
- API route: `app/api/you/ring-history/route.ts` — returns last N epochs of ring snapshots
- **Effort**: M (migration + Inngest function + API route)

### 2D. Governance Pulse History Chart

**What**: Small sparkline or area chart below the rings showing pulse trend over the last 10-20 epochs.

**Why**: "Your pulse went from 42 to 67 over 5 epochs" is more motivating than a static 67.

**Implementation**:

- New component: `PulseHistoryChart.tsx` — mini area chart (Recharts or plain SVG)
- Data source: `citizen_ring_snapshots` from 2C
- Shows pulse value per epoch with color gradient matching pulse color thresholds
- Placed below rings in `CivicIdentityProfile.tsx`
- **Prerequisite**: 2C (ring snapshots) must exist first
- **Effort**: S (simple chart component once data exists)

### 2E. Richer Archetype Taxonomy

**What**: Expand personality labels to support combination archetypes (top-2 dimensions) for more specificity.

**Why**: With 6 dimensions × 4 labels = 24 archetypes, many citizens will share the same label. Combining top-2 dimensions (e.g., "The Sentinel-Pioneer") creates more unique identities.

**Implementation**:

- New function in `lib/drepIdentity.ts`: `getCompoundArchetype(alignments)` — returns primary + secondary dimension combination
- Format: "The [Primary Label] with [Secondary Tendency]" (e.g., "The Guardian with a Pioneer's curiosity")
- Only used when top-2 dimensions are both >10 distance from center (otherwise single label)
- **Effort**: S (logic only, no data changes)

### 2F. Milestone Stamp Cards with Per-Stamp Sharing

**What**: Individual milestone stamps expand into a detail card with share button.

**Why**: Each milestone tells a micro-story. Making them individually shareable turns achievements into social content.

**Implementation**:

- Click/tap a stamp → expands to card overlay showing: milestone icon (larger), label, description, earned date, and share button
- Share generates OG image via existing `/api/og/moment/milestone/` route
- Already partially exists: `CitizenMilestoneCelebration.tsx` does this for newly earned milestones
- Extend to work for any stamp tap, not just new celebrations
- **Effort**: S (extend existing pattern)

### Phase 2 Build Order

```
2C (Ring Snapshots) → 2D (Pulse History)  [data dependency]
2B (Archetype Label) → 2A (AI Narrative)  [label feeds into narrative]
2E (Compound Archetypes)                  [independent]
2F (Stamp Cards)                          [independent]
```

Parallel tracks:

- **Track 1**: 2C → 2D (backend + data visualization)
- **Track 2**: 2B → 2A (identity personality layer)
- **Track 3**: 2E + 2F (independent improvements)

---

## Phase 3: Social & Discovery (POST-LAUNCH)

> **Status**: Not started
> **Effort**: L | **Impact**: Medium — adds social proof, annual events, and deep self-discovery
> **Priority**: Post-launch — requires user base for meaningful peer comparison

### 3A. "Citizens Like You" Opinion Landscape

**What**: Visualization showing where the citizen sits relative to other citizens with similar governance alignment. Inspired by Pol.is opinion clusters.

**Why**: Self-discovery through context. "I'm a Security-focused citizen, and here are 847 others like me" creates community and belonging.

**Implementation**:

- Citizen-level PCA clustering based on: delegated DRep alignment, quiz responses (if taken), engagement patterns
- New computation pipeline in `lib/alignment/citizenClusters.ts`
- Inngest function to periodically re-cluster (weekly)
- Visualization: 2D scatter/cluster map showing citizen's position among cohort
- Privacy-safe: show cluster sizes and labels, not individual citizen identities
- **Prerequisites**: Meaningful user base (100+ active citizens minimum), citizen alignment data
- **Effort**: L (new computation pipeline + visualization + privacy considerations)

### 3B. "Year in Governance" Wrapped

**What**: Annual narrative summary — "Your 2026 in Cardano Governance" — aggregating a full year of ring history, milestones earned, proposals influenced, DRep changes, archetype evolution.

**Why**: Strava's Year in Review and Spotify Wrapped prove that annual summaries are the highest-shareability identity moment. This is our viral identity event.

**Implementation**:

- Aggregate `citizen_ring_snapshots` + `citizen_milestones` + `governance_wrapped` across a calendar year
- AI-generated narrative summary (Claude) highlighting growth arc, standout moments, and governance impact
- Shareable OG card with key stats + ring progression visualization
- Triggered manually or by Inngest at year-end
- Build on existing `governance_wrapped` infrastructure (currently epoch-level, extend to annual)
- **Prerequisites**: Phase 2C (ring snapshots) providing epoch-level history, at least 6 months of data
- **Effort**: L (aggregation + AI narrative + OG card design + event timing)

### 3C. Temporal Alignment Drift Visualization

**What**: Show how the citizen's governance alignment has shifted over time — which dimensions they've moved toward or away from.

**Why**: Mirror-style self-discovery. "You started as a Security-first citizen but have been drifting toward Innovation" is a powerful identity insight.

**Implementation**:

- Requires historical alignment snapshots per citizen (currently only DReps have these)
- New table or extension to existing snapshots for citizen-level alignment tracking
- Visualization: animated radar polygon showing shape change over epochs
- **Prerequisites**: Citizen alignment computation (via quiz or inherited from DRep delegation patterns), historical storage
- **Effort**: L (new data pipeline + visualization)

### 3D. Values Discovery Cards

**What**: Interactive card deck presenting governance trade-off scenarios. Each card asks: "If you had to choose, would you prioritize X or Y?" Builds the citizen's alignment profile through play rather than a quiz.

**Why**: The Quick Match quiz is effective but feels like a test. Cards feel like exploration and discovery. Citizens learn about governance dimensions through engaging with real trade-offs.

**Implementation**:

- Card content: curated trade-off pairs from real governance tensions (treasury spend vs. reserve, rapid innovation vs. security hardening, transparency vs. operational efficiency)
- Swiping or tapping interface (Tinder-style or Hinge-style)
- Results feed into citizen's personal alignment scores
- Can replace or complement Quick Match as the primary alignment discovery mechanism
- **Effort**: L (content curation + new component + alignment integration)

---

## Key Technical Dependencies

```
Phase 1 (DONE)
  └── lib/governanceRings.ts
  └── GovernanceRings + GovernancePulse + IdentityNarrative + MilestoneStamps
  └── CivicIdentityProfile refactor

Phase 2
  ├── 2C: citizen_ring_snapshots table (migration)
  │   └── 2D: PulseHistoryChart (needs 2C data)
  ├── 2B: Archetype surfacing (needs DRep alignment data, already exists)
  │   └── 2A: AI narrative (needs 2B archetype + lib/ai.ts)
  ├── 2E: Compound archetypes (independent)
  └── 2F: Stamp card sharing (independent)

Phase 3
  ├── 3A: Citizen clustering (needs user base + citizen alignment data)
  ├── 3B: Year Wrapped (needs 2C ring snapshots + 6mo data)
  ├── 3C: Alignment drift (needs citizen alignment history)
  └── 3D: Values cards (independent, but feeds into 3A/3C)
```

## Files Reference

| File                                                            | Purpose                     | Phase                          |
| --------------------------------------------------------------- | --------------------------- | ------------------------------ |
| `lib/governanceRings.ts`                                        | Ring computation engine     | 1 ✅                           |
| `components/governada/identity/GovernanceRings.tsx`             | SVG ring visualization      | 1 ✅                           |
| `components/governada/identity/GovernancePulse.tsx`             | Pulse number display        | 1 ✅                           |
| `components/governada/identity/IdentityNarrative.tsx`           | Template/AI narrative       | 1 ✅ (template), 2A (AI)       |
| `components/governada/identity/MilestoneStamps.tsx`             | Compact stamp row           | 1 ✅                           |
| `components/governada/identity/CivicIdentityProfile.tsx`        | Main identity layout        | 1 ✅                           |
| `lib/drepIdentity.ts`                                           | Archetype system            | 1 ✅ (4 labels), 2E (compound) |
| `lib/ai.ts`                                                     | Anthropic SDK wrapper       | Pre-existing, used by 2A       |
| `lib/citizenMilestones.ts`                                      | 20 milestone definitions    | Pre-existing                   |
| `components/governada/identity/CitizenMilestoneCelebration.tsx` | Celebration modal + sharing | Pre-existing, extended by 2F   |
| `app/api/you/identity-narrative/route.ts`                       | AI narrative API            | 2A (new)                       |
| `lib/identity/narrativePrompt.ts`                               | Claude prompt for narrative | 2A (new)                       |
| `app/api/you/ring-history/route.ts`                             | Ring snapshot history API   | 2C (new)                       |
| `components/governada/identity/PulseHistoryChart.tsx`           | Pulse trend sparkline       | 2D (new)                       |
| `lib/alignment/citizenClusters.ts`                              | Citizen PCA clustering      | 3A (new)                       |

## UX Constraints

Per `docs/strategy/context/ux-constraints.md`, the `/you` page JTBD is: **"Understand my governance identity at a glance."**

- Above the fold: Rings + Pulse (1 dominant element) + Narrative + Archetype (2-3 supporting)
- Details behind interaction (toggle, tap)
- Zero-sum information budget: adding Pulse History (2D) means the chart must be compact (sparkline, not full chart)
- Archetype label (2B) replaces nothing — it's 1 line of text, fits within budget
- AI narrative (2A) replaces the template narrative — same space, richer content
