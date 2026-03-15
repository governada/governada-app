# DRep Decision Engine — Implementation Plan

> **Status**: APPROVED — Ready for execution
> **Origin**: `/explore-feature DRep profiles` (2026-03-14)
> **Goal**: Transform the DRep profile from an information display into a personalized delegation decision tool with decomposed trust signals — targeting a 10/10 citizen experience.

---

## Vision Summary

The DRep profile's JTBD is "Decide if I should delegate to this DRep." Today it presents 8+ metrics across 5 chapters and asks citizens to synthesize their own answer. The Decision Engine makes the profile **viewer-relative**: alignment leads, decomposed score signals qualify, and the delegation decision is structured — not left as an exercise for the reader.

### Core Principles

1. **Alignment leads, score qualifies.** "87% aligned · votes on 85% of proposals, writes rationale on most votes" — not "Score: 74."
2. **Show WHERE, not just HOW MUCH.** Per-proposal agreement/disagreement cards beat a single percentage.
3. **No data → quiz IS the profile.** Visitors without alignment data get an inline 3-question Quick Match. The quiz isn't a detour — it's the entry experience.
4. **Decompose the score into legible trust signals.** Citizens never see "Score: 74." They see specific behaviors: participation rate, rationale quality, consistency streak, delegation momentum.
5. **Score stays the hero on the DRep dashboard.** Tiers, milestones, competitive positioning, and recommendations remain untouched on the owner-facing view. The accountability flywheel is preserved.
6. **Ranking uses blended sort.** Browse/discover sort: `alignmentScore × 0.7 + normalizedScore × 0.3` for users with alignment data. Fallback: score descending.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    DRep Profile Page                     │
│  (Server Component: data fetching + layout orchestration)│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Viewer has alignment data? ────────────────────┐    │
│  │                                                  │    │
│  │  YES                          NO                 │    │
│  │  ┌──────────────────┐   ┌──────────────────┐    │    │
│  │  │ Decision Engine   │   │ Discovery Mode   │    │    │
│  │  │ (alignment-first) │   │ (quiz-first)     │    │    │
│  │  └──────────────────┘   └──────────────────┘    │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Trust Signals (decomposed score — always shown)  │   │
│  │  Participation · Rationale · Reliability · Growth │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Evidence Layer (depth-gated progressive detail)  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Workstreams

### WS-1: Per-Proposal Alignment Engine (Backend)

**What**: Compute specific proposal-level agreement between a user's alignment profile and a DRep's actual votes. This powers the "biggest agreements / disagreements" cards — the Decision Engine's most powerful feature.

**Why**: Today `dimensionAgreement.ts` computes per-DIMENSION agreement (e.g., "you both lean treasury conservative") but not per-PROPOSAL agreement ("on Proposal #287, this DRep voted YES — aligned with your stance on innovation"). The exploration identified this as the single most differentiating capability.

**Files to create/modify**:

- **NEW**: `lib/matching/proposalAlignment.ts` — Core computation
- **MODIFY**: `lib/matching/dimensionAgreement.ts` — Export helpers for the new module
- **MODIFY**: `app/api/drep/[drepId]/route.ts` or NEW: `app/api/drep/[drepId]/alignment/route.ts` — API endpoint

**Implementation**:

```typescript
// lib/matching/proposalAlignment.ts

interface ProposalAlignmentResult {
  proposalId: string; // tx_hash#index
  proposalTitle: string;
  proposalType: string;
  drepVote: 'Yes' | 'No' | 'Abstain';
  predictedUserStance: 'Yes' | 'No' | 'Neutral';
  stanceConfidence: number; // 0-100 — how confident we are in the prediction
  agreement: 'agree' | 'disagree' | 'neutral';
  reason: string; // "You both prioritize treasury conservation"
  dimension: string; // Primary alignment dimension this touches
}

interface AlignmentSummary {
  overallAlignment: number; // 0-100 (dimension-weighted)
  confidence: number; // From user's progressive confidence
  confidenceLabel: string; // "Based on 3 quiz answers" / "Based on 12 votes"
  topAgreements: ProposalAlignmentResult[]; // Top 3 strongest agreements
  topDisagreements: ProposalAlignmentResult[]; // Top 2 strongest disagreements
  dimensionBreakdown: DimensionAgreement[]; // Per-dimension scores (existing)
  narrative: string; // AI-generated 1-2 sentence summary
}
```

**Algorithm**:

1. Get user's alignment scores (from `user_governance_profiles` or quiz-derived via `buildAlignmentFromAnswers`)
2. Get DRep's votes with proposal classifications (from `drep_votes` joined with `proposal_classifications`)
3. For each classified proposal the DRep voted on:
   - Identify the primary dimension(s) the proposal touches
   - Predict user stance: if user's alignment on that dimension is >65 → "Yes tendency", <35 → "No tendency", else "Neutral"
   - Compare with DRep's actual vote
   - Score confidence based on how extreme the user's alignment is on that dimension
4. Rank by confidence × recency → pick top 3 agreements and top 2 disagreements
5. Generate narrative via `matchNarrative.ts` pattern (template-based, not AI — fast)

**Key decisions**:

- Prediction is probabilistic, not binary. Show confidence: "Likely aligned (high confidence)" vs. "Possibly aligned (based on limited data)"
- Only classify proposals where the dimension signal is strong (classification score > 60). Skip ambiguous proposals.
- Cache the alignment summary per (userId, drepId) pair with 1-epoch TTL

**Effort**: M (1-2 days)

---

### WS-2: Delegation Simulation (Backend)

**What**: "If you had delegated to this DRep 6 months ago, here's how your ADA would have voted." Shows each proposal with the DRep's vote, whether it was enacted, and delivery status.

**Why**: Makes the abstract delegation decision tangible. Transforms "I think I agree with this person" into "here's the concrete record of what would have happened."

**Files to create/modify**:

- **NEW**: `lib/matching/delegationSimulation.ts` — Core simulation
- **NEW or extend**: `app/api/drep/[drepId]/alignment/route.ts` — Include simulation data

**Implementation**:

```typescript
interface SimulatedVote {
  proposalId: string;
  proposalTitle: string;
  proposalType: string;
  drepVote: 'Yes' | 'No' | 'Abstain';
  outcome: 'Enacted' | 'Expired' | 'Dropped' | 'Pending';
  deliveryStatus?: 'delivered' | 'partial' | 'not_delivered' | 'in_progress';
  deliveryScore?: number;
  alignmentWithUser: 'agree' | 'disagree' | 'neutral';
  epoch: number;
}

interface DelegationSimulation {
  periodLabel: string; // "Last 6 months (Epochs 470-485)"
  totalProposals: number; // Proposals in period
  drepVotedOn: number; // How many DRep voted on
  participationRate: number; // drepVotedOn / totalProposals
  enactedCount: number; // Proposals that passed
  deliverySuccessRate: number; // % of enacted proposals that delivered
  alignedVoteCount: number; // Votes aligned with user
  totalClassifiedVotes: number; // Votes where alignment could be assessed
  simulatedVotes: SimulatedVote[]; // Full list (most recent first)
}
```

**Algorithm**:

1. Fetch last 6 months of proposals + DRep's votes on them
2. Join with proposal outcomes (delivery status, scores)
3. For each vote, compute alignment with user (reuse WS-1 logic)
4. Aggregate stats
5. Return chronological list + summary

**Effort**: M (1 day) — mostly composing existing data queries

---

### WS-3: Decomposed Trust Signals Component (Frontend)

**What**: Replace the composite score number with legible behavioral indicators. This is the score repositioning — from headline to contextual trust signals.

**Why**: "Score: 74" is opaque. "Votes on 85% of proposals · Writes rationale on most votes · Active 14 consecutive epochs · Growing delegation (+12% this epoch)" is legible and actionable.

**Files to create/modify**:

- **NEW**: `components/governada/profiles/TrustSignals.tsx` — The decomposed trust display
- **MODIFY**: `components/DRepProfileHero.tsx` — Replace score prominence with trust signals
- **REFERENCE**: `lib/scoring/calibration.ts` — Tier thresholds for badge

**Design**:

```
┌─────────────────────────────────────────────────────┐
│  Gold tier                                          │
│                                                     │
│  ✓ Votes on 85% of proposals    High participation  │
│  ✓ Rationale on 70% of votes    Transparent         │
│  ✓ Active 14 consecutive epochs Consistent          │
│  ↑ Delegation growing (+12%)    Gaining trust       │
│                                                     │
│  ── Methodology ──────────────────── [expand] ──    │
└─────────────────────────────────────────────────────┘
```

**Signal mapping from existing score pillars**:

| Signal           | Source Data                                      | Thresholds                                                                                                   | Display                           |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Participation    | `effectiveParticipation` (calibrated)            | ≥70: "Votes on most proposals", ≥40: "Votes regularly", <40: "Limited voting"                                | % + label                         |
| Rationale        | `engagementQuality` → `rationaleRate`            | ≥60: "Writes rationale on most votes", ≥30: "Sometimes provides rationale", <30: "Rarely provides rationale" | % + label                         |
| Reliability      | `reliability_streak` + `reliability_recency`     | streak ≥10: "Active X consecutive epochs", recency <7d: "Voted recently", gap >30d: "Inactive for X days"    | Streak + recency                  |
| Delegation Trend | `drep_power_snapshots` (epoch-over-epoch)        | Growing (>5%), Stable (±5%), Declining (<-5%)                                                                | Direction + % change              |
| Profile Quality  | `profileCompleteness` + `metadata_hash_verified` | ≥80: "Complete profile", verified: "Verified metadata"                                                       | Completeness + verification badge |

**Depth behavior**:

- `hands_off`: Tier badge only (single word: "Gold")
- `informed`: Tier badge + top 2 signals (participation + reliability)
- `engaged`: All 4-5 signals with labels
- `deep`: All signals + expandable methodology (how each is computed)

**Key rule**: The tier badge stays visible on ALL depth levels. It's the single-glance trust shorthand. The decomposed signals explain WHY they have that tier.

**Effort**: M (1-2 days)

---

### WS-4: Decision Engine Profile Layout (Frontend — Core)

**What**: Rebuild the DRep profile page layout to be viewer-relative. This is the largest workstream — the page restructuring.

**Why**: The current chapter-based layout presents the same content to everyone. The Decision Engine adapts based on whether the viewer has alignment data.

**Files to create/modify**:

- **HEAVY MODIFY**: `app/drep/[drepId]/page.tsx` — Server component restructure
- **NEW**: `components/governada/profiles/DecisionEngine.tsx` — Alignment-first view (viewer has data)
- **NEW**: `components/governada/profiles/DiscoveryMode.tsx` — Quiz-first view (viewer has no data)
- **NEW**: `components/governada/profiles/AlignmentCard.tsx` — Single agreement/disagreement card
- **NEW**: `components/governada/profiles/ComparisonStrip.tsx` — "vs. your current DRep" or "vs. #1 match"
- **NEW**: `components/governada/profiles/DelegationSimulationView.tsx` — Simulation results display
- **MODIFY**: `components/DRepProfileHero.tsx` — Slimmed hero with trust signals
- **MODIFY**: `components/governada/profiles/TrustCard.tsx` — Remove or repurpose (most content moves to trust signals + alignment cards)
- **KEEP**: `components/governada/profiles/RecordSummaryCard.tsx` — Moves below alignment section
- **KEEP**: `components/governada/profiles/TrajectoryCard.tsx` — Moves below alignment section
- **REMOVE from public profile**: `components/ScoreCard.tsx` usage (stays on DRep dashboard only)
- **REMOVE from public profile**: `components/governada/profiles/SimilarDReps.tsx` (replaced by comparison strip)

#### Layout: Decision Engine Mode (viewer has alignment data)

```
┌─────────────────────────────────────────────────────────┐
│  HERO (slimmed)                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [Name] · [Personality Label]        [Delegate CTA] │ │
│  │ [One-line philosophy from metadata/prompt]          │ │
│  │                                                     │ │
│  │ ┌─ Trust Signals (WS-3) ────────────────────────┐  │ │
│  │ │ Gold tier · 85% participation · Consistent     │  │ │
│  │ └───────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  ALIGNMENT SECTION (the Decision Engine core)           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ "87% aligned with you"                              │ │
│  │ Based on 12 poll votes (high confidence)            │ │
│  │                                                     │ │
│  │ ┌─ Where you agree ────────────────────────────┐   │ │
│  │ │ [AlignmentCard] Treasury: Both conservative   │   │ │
│  │ │ [AlignmentCard] Security: Both prioritize     │   │ │
│  │ │ [AlignmentCard] Proposal #287: Both voted Yes │   │ │
│  │ └──────────────────────────────────────────────┘   │ │
│  │                                                     │ │
│  │ ┌─ Where you differ ───────────────────────────┐   │ │
│  │ │ [AlignmentCard] Innovation: You support more  │   │ │
│  │ │ [AlignmentCard] Proposal #301: Voted opposite │   │ │
│  │ └──────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  COMPARISON STRIP (contextual)                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ "vs. Your Current DRep" [name]                      │ │
│  │ Alignment: 87% vs 72% | Participation: 85% vs 60%  │ │
│  │ [View full comparison →]                            │ │
│  └────────────────────────────────────────────────────┘ │
│  OR (if undelegated):                                   │
│  │ "vs. Your #1 Match" [name]                          │ │
├─────────────────────────────────────────────────────────┤
│  DELEGATION SIMULATION (depth: engaged+)                │
│  ┌────────────────────────────────────────────────────┐ │
│  │ "If you had delegated 6 months ago..."              │ │
│  │ 47 governance actions · DRep voted on 40 (85%)     │ │
│  │ 28 aligned with your values · 8 differed · 4 ??   │ │
│  │ Enacted: 23 · Delivered: 15 (65%)                   │ │
│  │ [Show all proposals ↓]                              │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  EVIDENCE LAYER (depth-gated, below fold)               │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Activity Heatmap (depth: informed+)                 │ │
│  │ Record Summary (depth: informed+)                   │ │
│  │ Trajectory (depth: engaged+)                        │ │
│  │ Detailed Analysis (depth: deep) — voting record,    │ │
│  │   alignment trajectory, DRep statements             │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Layout: Discovery Mode (viewer has NO alignment data)

```
┌─────────────────────────────────────────────────────────┐
│  HERO (same slimmed version)                            │
│  [Name] · [Personality] · Trust Signals · [Delegate]    │
├─────────────────────────────────────────────────────────┤
│  INLINE QUICK MATCH                                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │ "See how [Name] aligns with your governance values" │ │
│  │                                                     │ │
│  │ Q1: How should Cardano's treasury be managed?       │ │
│  │   ○ Conservative  ○ Growth  ○ Balanced              │ │
│  │                                                     │ │
│  │ Q2: Protocol changes should prioritize...           │ │
│  │   ○ Caution  ○ Innovation  ○ Case by case           │ │
│  │                                                     │ │
│  │ Q3: How important is DRep transparency?             │ │
│  │   ○ Essential  ○ Nice to have  ○ Doesn't matter     │ │
│  │                                                     │ │
│  │ [See my alignment with {Name} →]                    │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  SOCIAL PROOF (while no alignment data)                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │ X citizens have delegated · Growing this epoch      │ │
│  │ Y citizen endorsements                              │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  EVIDENCE LAYER (same as Decision Engine mode)          │
│  Activity Heatmap · Record Summary · Trajectory · etc.  │
└─────────────────────────────────────────────────────────┘
```

**After quiz completion**: Page transitions to Decision Engine mode (client-side state update, no reload). The alignment section appears with results, quiz section collapses.

**Depth gating on the Decision Engine profile**:

| Section                           | hands_off       | informed         | engaged        | deep                                    |
| --------------------------------- | --------------- | ---------------- | -------------- | --------------------------------------- |
| Hero + Trust Signals              | Tier badge only | Tier + 2 signals | All signals    | All + methodology                       |
| Alignment % + top agreement       | ✓ (if data)     | ✓                | ✓              | ✓                                       |
| Full agreement/disagreement cards | —               | Top 2 each       | Top 3+2        | All classified                          |
| Comparison strip                  | —               | ✓                | ✓              | ✓                                       |
| Delegation simulation             | —               | —                | Summary only   | Full with proposal list                 |
| Activity heatmap                  | —               | ✓                | ✓              | ✓                                       |
| Record summary                    | —               | ✓                | ✓              | ✓                                       |
| Trajectory                        | —               | —                | ✓              | ✓                                       |
| Detailed analysis tabs            | —               | —                | —              | ✓ (voting record, alignment trajectory) |
| Inline Quick Match                | ✓ (if no data)  | ✓ (if no data)   | ✓ (if no data) | — (assume has data)                     |

**DRep/SPO/CC viewer behavior**: These users always see `deep` depth. The Decision Engine still works for them (they have alignment data from their own voting). The comparison strip shows "vs. your own voting record" instead of "vs. your current DRep."

**Effort**: L (3-4 days)

---

### WS-5: Inline Quick Match Widget (Frontend)

**What**: A compact, inline version of the 3-question Quick Match quiz that lives directly on the DRep profile page for visitors without alignment data.

**Why**: Currently, to see alignment, a citizen must navigate to `/match`, complete the quiz, then come back to the DRep profile. This breaks flow. The quiz should be ON the profile — it IS the entry experience.

**Files to create/modify**:

- **NEW**: `components/governada/profiles/InlineQuickMatch.tsx` — Compact quiz widget
- **MODIFY**: `components/governada/match/QuickMatchFlow.tsx` — Extract quiz logic into reusable hook
- **NEW**: `hooks/useQuickMatch.ts` — Shared quiz state + API call logic

**Implementation**:

- Extract the core quiz logic (3 questions, answer mapping, API call) from `QuickMatchFlow.tsx` (1293 lines) into `useQuickMatch.ts` hook
- `InlineQuickMatch.tsx` renders a compact 3-question form (no intro screen, no loading screen — all inline)
- On submit: calls `/api/governance/quick-match`, saves profile to localStorage (existing pattern), and fires a callback (`onMatchComplete(alignmentData)`)
- Parent component (`DiscoveryMode`) receives the callback and transitions to `DecisionEngine` view
- PostHog event: `quick_match_completed_inline` with `{source: 'drep_profile', drepId}`

**Design constraints**:

- Must feel native to the profile, not like a popup or modal
- All 3 questions visible at once (no step-by-step) — this is a fast inline widget, not a flow
- Styled to match the profile's visual language (not the standalone match flow's style)
- "See my alignment with [DRep Name] →" as the CTA — personalized, not generic

**Effort**: M (1 day)

---

### WS-5a: Quiz Enhancement — Add Decentralization Question

**What**: Add a 4th question to the Quick Match quiz covering decentralization — the only unaddressed alignment dimension. This fills the blind spot where all decentralization-related proposals produce "Neutral" predictions for quiz-only users.

**Why**: The current 3-question quiz covers 5 of 6 dimensions. Decentralization defaults to 50 (neutral), making high-stakes proposals (NoConfidence, power distribution) invisible to the alignment engine for quiz-only users. One additional question gives complete 6-dimension coverage with minimal friction increase (~3 seconds).

**Files to modify**:

- **MODIFY**: `lib/matching/answerVectors.ts` — Add `decentralization` answer vector
- **MODIFY**: `components/governada/match/QuickMatchFlow.tsx` — Add Q4 to flow
- **MODIFY**: `components/governada/profiles/InlineQuickMatch.tsx` — Add Q4 to inline widget (built in WS-5)

**New question**:

> How should voting power be distributed in Cardano governance?
>
> - Spread widely — no single entity should have outsized influence (decentralization: 85)
> - Concentrated among the most active/qualified participants (decentralization: 20)
> - Current distribution is fine — focus on other issues (decentralization: 50)

**Effort**: S (< 1 hour) — answer vector mapping + UI addition

---

### WS-6: Comparison Strip Component (Frontend)

**What**: A contextual comparison bar that shows how this DRep compares to the viewer's current DRep or top match.

**Why**: Delegation decisions are inherently comparative — "Should I delegate to THIS one instead of my current one?" The comparison strip answers this without leaving the page.

**Files to create/modify**:

- **NEW**: `components/governada/profiles/ComparisonStrip.tsx`
- **NEW or extend**: `app/api/drep/[drepId]/alignment/route.ts` — Include comparison DRep data

**Implementation**:

```typescript
interface ComparisonStripProps {
  currentDrep: {
    drepId: string;
    name: string;
    alignment: number; // Viewer's alignment with current DRep
    participationRate: number;
    tier: string;
  };
  viewingDrep: {
    drepId: string;
    name: string;
    alignment: number; // Viewer's alignment with this DRep
    participationRate: number;
    tier: string;
  };
  comparisonType: 'current_drep' | 'top_match';
}
```

**States**:

- **Viewer is delegated**: "vs. Your Current DRep [Name]" — shows alignment %, participation, tier side-by-side
- **Viewer is undelegated**: "vs. Your #1 Match [Name]" — shows the alternative
- **Viewer is the DRep**: Hidden (no comparison needed)
- **No alignment data**: Hidden (quiz hasn't been completed)

**Link**: "View full comparison →" navigates to `/compare?dreps=current,viewing`

**Effort**: S (0.5 day)

---

### WS-7: Browse/Discover Sort Order Update (Frontend + Backend)

**What**: Update the default sort order on DRep browse/discover to use alignment-weighted scoring when viewer has alignment data.

**Why**: Currently DReps sort by score descending. With the Decision Engine, the most relevant DReps should surface first — highest alignment + quality.

**Files to modify**:

- **MODIFY**: `components/governada/discover/GovernadaDRepBrowse.tsx` — Sort logic (lines 454-481)
- **MODIFY**: `app/api/governance/leaderboard/route.ts` — API sort option
- **MODIFY**: `components/DRepTableClient.tsx` — Default sort key

**Implementation**:

- When user has alignment profile (localStorage or DB), compute blended sort:
  ```typescript
  const blendedScore = (alignmentPct / 100) * 0.7 + (normalizedDRepScore / 100) * 0.3;
  ```
- Default sort label changes from "Governance Score" to "Best Match" (when alignment data available)
- "Governance Score" remains as a selectable sort option
- DRep cards in browse show both: match badge + tier badge (existing `MatchContextBadge` pattern)

**Minimum score threshold**: DReps with score < 30 (Emerging, barely active) get a visual warning on the card: "Limited track record" — regardless of alignment score. This prevents ghost DReps from matching high.

**Effort**: S (0.5 day)

---

### WS-8: DRep Dashboard Preservation + Enhancement (Frontend)

**What**: Ensure the DRep owner dashboard retains score as the hero AND gets a new "How delegators see you" insight panel.

**Why**: The accountability flywheel depends on DReps caring about their score. The dashboard is where that motivation lives. But now we can also show DReps how the Decision Engine presents them to citizens.

**Files to modify**:

- **MODIFY**: `components/DRepDashboard.tsx` — Add delegator alignment insight panel
- **KEEP AS-IS**: `components/governada/identity/DRepScorecardView.tsx` — Score hero
- **KEEP AS-IS**: All tier celebrations, competitive context, milestones, recommendations

**New panel: "How Citizens See You"**:

- Shows the DRep their own Trust Signals as citizens would see them
- Shows aggregate alignment distribution: "X% of your delegators align with you on treasury, only Y% align on innovation"
- Actionable insight: "Your weakest alignment dimension with delegators is [innovation]. Consider writing a rationale on the next innovation proposal to clarify your stance."

**Effort**: M (1 day)

---

### WS-9: API Layer (Backend)

**What**: New API endpoint that returns viewer-specific alignment data for a DRep profile.

**Files to create**:

- **NEW**: `app/api/drep/[drepId]/alignment/route.ts`

**Implementation**:

```typescript
// GET /api/drep/[drepId]/alignment
// Query params: ?source=quiz|profile (where alignment data comes from)
// Auth: Optional (quiz data from localStorage, profile data from DB)

// Request body (POST for quiz-based alignment):
{
  userAlignment?: AlignmentScores;  // From localStorage quiz results
}

// Response:
{
  alignment: AlignmentSummary;        // From WS-1
  simulation: DelegationSimulation;   // From WS-2
  comparison?: ComparisonData;        // From WS-6 (if viewer is delegated)
  trustSignals: TrustSignal[];        // Decomposed score signals
}
```

**Caching**:

- Authenticated users: Cache per (userId, drepId) with 1-epoch TTL in Redis
- Quiz-based (unauthenticated): Compute on-the-fly (lightweight, <100ms)
- Trust signals: Computed from existing DB columns (no cache needed)

**Effort**: M (1 day)

---

## Execution Plan

### Phase 1: Foundation (WS-1, WS-2, WS-9) — Backend

**Parallel-safe**: All three can be built simultaneously by separate agents.

| WS   | Task                          | Dependencies                             | Effort       |
| ---- | ----------------------------- | ---------------------------------------- | ------------ |
| WS-1 | Per-proposal alignment engine | None                                     | M (1-2 days) |
| WS-2 | Delegation simulation         | None (shares data queries with WS-1)     | M (1 day)    |
| WS-9 | API endpoint                  | WS-1 + WS-2 outputs (can stub initially) | M (1 day)    |

**Deliverable**: API endpoint returns alignment summary, simulation data, and trust signals for any (viewer, DRep) pair.

**Validation**: Unit tests for alignment computation + API integration test.

### Phase 2: Components (WS-3, WS-5, WS-6) — Frontend Components

**Parallel-safe**: All three are independent components.

| WS   | Task                       | Dependencies                     | Effort       |
| ---- | -------------------------- | -------------------------------- | ------------ |
| WS-3 | Trust Signals component    | None (reads existing DB columns) | M (1-2 days) |
| WS-5 | Inline Quick Match widget  | Extract hook from QuickMatchFlow | M (1 day)    |
| WS-6 | Comparison Strip component | WS-9 API for comparison data     | S (0.5 day)  |

**Deliverable**: Three new standalone components, each tested independently.

### Phase 3: Page Assembly (WS-4) — Integration

**Sequential**: Depends on Phase 1 + Phase 2 components.

| WS   | Task                           | Dependencies                 | Effort       |
| ---- | ------------------------------ | ---------------------------- | ------------ |
| WS-4 | Decision Engine profile layout | WS-1, WS-2, WS-3, WS-5, WS-6 | L (3-4 days) |

**Deliverable**: The rebuilt DRep profile page with both Decision Engine and Discovery Mode layouts.

### Phase 4: Polish (WS-7, WS-8) — Ecosystem Integration

**Parallel-safe**: Independent from each other.

| WS   | Task                        | Dependencies                  | Effort      |
| ---- | --------------------------- | ----------------------------- | ----------- |
| WS-7 | Browse/discover sort update | WS-1 alignment data available | S (0.5 day) |
| WS-8 | DRep dashboard enhancement  | WS-3 trust signals component  | M (1 day)   |

**Deliverable**: Full ecosystem integration — browse sorts by alignment, DRep dashboard shows delegator perspective.

### Phase 5: Review & Refinement — Quality Gate

**MANDATORY PAUSE BEFORE SHIPPING.**

This phase exists to catch gaps, polish rough edges, and ensure the 10/10 target. Do NOT skip this phase to ship faster.

#### Step 5a: Self-Audit (automated)

Run `/audit-feature DRep profiles` against the rebuilt implementation. Score against:

- **F1 JTBD**: Does the profile directly answer "should I delegate?"
- **F2 Emotional Impact**: Does the viewer feel informed and confident?
- **F3 Simplicity**: Can a citizen who knows nothing about governance understand the profile?
- **F4 Differentiation**: Is this unlike anything in crypto governance?
- **F5 Data Leverage**: Are we using all available data effectively?
- **F6 Craft**: Is the visual quality, animation, and polish world-class?

Target: Every dimension ≥ 8/10.

#### Step 5b: Persona Walkthrough

Manually trace the experience for each persona × state:

| Persona | State                            | Expected Experience                                                            |
| ------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Citizen | Anonymous, no quiz data          | Discovery Mode: hero + inline quiz + social proof                              |
| Citizen | Has quiz data, undelegated       | Decision Engine: alignment + quiz confidence caveat + "vs. #1 match"           |
| Citizen | Has quiz data + votes, delegated | Decision Engine: alignment (high confidence) + "vs. current DRep" + simulation |
| Citizen | `hands_off` depth                | Minimal: tier badge + alignment % + delegate CTA                               |
| Citizen | `deep` depth                     | Full: all sections expanded + detailed analysis tabs                           |
| DRep    | Viewing own profile              | Score hero (dashboard) + "How citizens see you"                                |
| DRep    | Viewing another DRep             | Decision Engine (their alignment from voting) + "vs. your record"              |
| SPO     | Viewing a DRep                   | Decision Engine + governance-level signals                                     |
| CC      | Viewing a DRep                   | Decision Engine + constitutional fidelity context                              |

For each walkthrough, note:

- Does the 5-second test pass? (Can you answer "should I delegate?" in 5 seconds?)
- Is anything confusing, redundant, or missing?
- Are depth gates working correctly?
- Is the transition from Discovery → Decision Engine smooth?

#### Step 5c: Edge Cases

Test and fix:

- **DRep with 0 votes**: Trust signals show "No voting history yet" — alignment section shows "Not enough data to assess alignment. This DRep hasn't voted yet."
- **DRep with votes but no rationale**: Trust signal "Rarely provides rationale" + alignment still works from vote patterns
- **User with quiz data but very low confidence**: Show confidence caveat prominently: "Based on 3 quiz answers — vote on proposals to improve accuracy"
- **Inactive DRep**: Prominent "Inactive" badge on hero — alignment section includes warning "This DRep has been inactive for X epochs"
- **DRep viewing themselves as if a citizen**: View As switcher should show Decision Engine from citizen perspective
- **Mobile layout**: All sections must work on mobile. Comparison strip stacks vertically. Quiz renders cleanly.

#### Step 5d: Performance Check

- Profile page should load in < 2s (LCP)
- Alignment computation should be < 200ms for cached, < 500ms for cold
- No layout shift when quiz results load or when transitioning from Discovery → Decision Engine mode
- Suspense boundaries on alignment section (show skeleton while loading)

#### Step 5e: Gap Identification & Final Polish

After steps 5a-5d, create a gap list. Common areas that may need attention:

- **Transition animations**: Discovery → Decision Engine mode should feel smooth, not jarring
- **Empty states**: Every section needs a considered empty state, not "No data"
- **Confidence communication**: Is the citizen clear on WHY their alignment is "moderate confidence"?
- **Share moments**: Is there a shareable alignment card? ("I'm 91% aligned with DRep Maria — here's where we agree")
- **Accessibility**: Screen reader experience for alignment cards, trust signals, quiz
- **OG image update**: Social preview should reflect the new profile (alignment + trust signals, not just score)

Fix all gaps. Then ship.

---

## Files Summary

### New Files (10)

| File                                                         | Purpose                            | WS   |
| ------------------------------------------------------------ | ---------------------------------- | ---- |
| `lib/matching/proposalAlignment.ts`                          | Per-proposal alignment computation | WS-1 |
| `lib/matching/delegationSimulation.ts`                       | Delegation simulation engine       | WS-2 |
| `app/api/drep/[drepId]/alignment/route.ts`                   | Viewer-specific alignment API      | WS-9 |
| `components/governada/profiles/TrustSignals.tsx`             | Decomposed score display           | WS-3 |
| `components/governada/profiles/DecisionEngine.tsx`           | Alignment-first profile view       | WS-4 |
| `components/governada/profiles/DiscoveryMode.tsx`            | Quiz-first profile view            | WS-4 |
| `components/governada/profiles/AlignmentCard.tsx`            | Single agreement/disagreement card | WS-4 |
| `components/governada/profiles/ComparisonStrip.tsx`          | Contextual DRep comparison         | WS-6 |
| `components/governada/profiles/DelegationSimulationView.tsx` | Simulation results display         | WS-4 |
| `hooks/useQuickMatch.ts`                                     | Shared quiz state + API logic      | WS-5 |
| `components/governada/profiles/InlineQuickMatch.tsx`         | Compact inline quiz widget         | WS-5 |

### Modified Files (7)

| File                                                    | Change                                                                      | WS         |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ---------- |
| `app/drep/[drepId]/page.tsx`                            | Major restructure — Decision Engine vs Discovery Mode routing               | WS-4       |
| `components/DRepProfileHero.tsx`                        | Slim down — remove score prominence, add trust signals slot                 | WS-3, WS-4 |
| `components/governada/profiles/TrustCard.tsx`           | Remove or repurpose — most content moves to alignment cards + trust signals | WS-4       |
| `components/governada/discover/GovernadaDRepBrowse.tsx` | Alignment-weighted sort default                                             | WS-7       |
| `components/DRepTableClient.tsx`                        | Default sort key update                                                     | WS-7       |
| `components/DRepDashboard.tsx`                          | Add "How citizens see you" panel                                            | WS-8       |
| `components/governada/match/QuickMatchFlow.tsx`         | Extract quiz logic to shared hook                                           | WS-5       |

### Removed from Public Profile (kept in codebase, used elsewhere)

| Component             | Current Location         | New Location                   |
| --------------------- | ------------------------ | ------------------------------ |
| `ScoreCard.tsx`       | DRep profile + dashboard | Dashboard only                 |
| `SimilarDReps.tsx`    | DRep profile             | Replaced by ComparisonStrip    |
| Radar chart (in Hero) | DRep profile hero        | Match flow + compare page only |

### Unchanged (kept as-is)

| Component                       | Reason                                                  |
| ------------------------------- | ------------------------------------------------------- |
| `DRepScorecardView.tsx`         | DRep dashboard hero — score stays here                  |
| `TierCelebrationManager.tsx`    | Tier celebrations — accountability flywheel             |
| `CompetitiveContext.tsx`        | DRep competitive positioning — dashboard only           |
| All milestone/notification code | Drives engagement loop                                  |
| GHI computation pipeline        | Unchanged — measures ecosystem health                   |
| Scoring engine (`lib/scoring/`) | Unchanged — computes scores for ranking, GHI, dashboard |

---

## Success Metrics

| Metric                            | Current Baseline    | Target                             | How to Measure                                                      |
| --------------------------------- | ------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Profile → Delegation conversion   | Measure via PostHog | +25% lift                          | `drep_profile_viewed` → `delegation_started`                        |
| Quick Match completion on profile | N/A (new)           | 40%+ of visitors without alignment | `quick_match_completed_inline` / `drep_profile_viewed_no_alignment` |
| Time to delegation decision       | Unknown             | < 60 seconds                       | Session duration on profile before delegation                       |
| DRep dashboard engagement         | Measure current     | No regression                      | Score check frequency, competitive context views                    |
| Audit score (F1 JTBD)             | ~6/10               | 9+/10                              | `/audit-feature DRep profiles`                                      |

---

## Risk Registry

| Risk                                                             | Likelihood | Impact | Mitigation                                                                                          |
| ---------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| Per-proposal alignment predictions are noisy with quiz-only data | High       | Medium | Show confidence prominently; badge as "approximate" at <40% confidence                              |
| Page load time increases with alignment computation              | Medium     | High   | Cache alignment per (user, drep) in Redis; Suspense boundaries                                      |
| DReps feel their score is "hidden"                               | Medium     | Medium | Score still on dashboard; tier badge prominent on public profile; communicate change                |
| Citizens skip the quiz (Discovery Mode abandonment)              | Medium     | Medium | Make quiz feel native (inline, 10-second completion); show social proof below as alternative signal |
| Comparison strip loads slowly (needs 2nd DRep data)              | Low        | Medium | Preload comparison DRep data on server; skeleton loading                                            |
| Breaking change for external badge/embed API consumers           | Low        | High   | Keep badge API unchanged (still shows score + tier); add alignment option as new param              |

---

## Estimated Total Effort

| Phase               | Workstreams                             | Effort          | Parallelism                     |
| ------------------- | --------------------------------------- | --------------- | ------------------------------- |
| Phase 1: Foundation | WS-1, WS-2, WS-9                        | 3-4 days        | All parallel                    |
| Phase 2: Components | WS-3, WS-5, WS-6                        | 2-3 days        | All parallel                    |
| Phase 3: Assembly   | WS-4                                    | 3-4 days        | Sequential (depends on P1+P2)   |
| Phase 4: Polish     | WS-7, WS-8                              | 1-2 days        | All parallel                    |
| Phase 5: Review     | Audit + walkthrough + edge cases + gaps | 1-2 days        | Sequential                      |
| **Total**           |                                         | **~10-15 days** | With parallelism: **~7-9 days** |

---

## Decision Log

| Decision                                         | Rationale                                                              | Date       |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ---------- |
| Alignment leads, score qualifies                 | JTBD is delegation decision; alignment answers it directly             | 2026-03-14 |
| Score NOT blended into match %                   | Loses legibility; "match" should mean values alignment, not composite  | 2026-03-14 |
| Score used in sort ranking (0.3 weight)          | Differentiates among similar-alignment DReps without confusing display | 2026-03-14 |
| Decomposed trust signals replace composite score | "Votes on 85% of proposals" > "Score: 74" for citizen legibility       | 2026-03-14 |
| DRep dashboard unchanged (score stays hero)      | Accountability flywheel must be preserved                              | 2026-03-14 |
| Inline quiz on profile (not redirect to /match)  | Breaks flow to leave the profile; quiz IS the entry experience         | 2026-03-14 |
| Mandatory review phase before shipping           | 10/10 target requires deliberate quality gate                          | 2026-03-14 |
