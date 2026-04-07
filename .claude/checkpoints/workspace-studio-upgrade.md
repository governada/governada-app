# Workspace Studio Upgrade — Handoff Document

> **Status**: Phases 1-5 DEPLOYED. Phase 6 (Design Language & Mobile) remains.
> **Branch**: Start a new worktree — `claude/nostalgic-shannon` was used for Phases 3b-5
> **Plan**: Original private plan file (path omitted from the repo copy)
> **Updated**: 2026-03-29

## CRITICAL: Handoff Instructions for Next Agent

1. **Read this entire document first** before writing any code.
2. **Read the plan** at the path above — it contains the full exploration, concepts, and implementation roadmap.
3. **Run `npm run preflight`** to verify the codebase compiles before starting work.
4. **Follow these same handoff practices**: If you begin to run out of context, pause to document and commit a proper handoff document for the next agent before stopping. Quality over quantity.
5. **Critical rules** (from founder):
   - Workspace = authoring + review studio ONLY (not performance/votes/rationales)
   - Globe is Seneca-driven, NOT directly clickable — users interact via Seneca widget
   - Legal-grade tracked changes are required (reviewer suggestions, version diffs, revision narratives)
   - AI feedback aggregation (theme clustering, endorsement, sealed period) must stay prominent
   - AI should BE the workspace — intelligence as annotations, columns, structured analysis, not a sidebar chatbot
   - Feature-flag Phases 2-4 behind `workspace_decision_table` for safe rollout

---

## What Was Completed

### Phase 1 (PR #685 — merged to main)

- QualityPulse + ambient constitutional check
- Tracked changes for all proposal types (reviewer suggestions as blue-tinted marks)
- Proactive Seneca insights in author editor
- Version diff from editor

### Phase 2 (PR #688 — merged to main)

- **DecisionTable** component replacing kanban in ReviewPortfolio
- **8 cell components**: ProposalCell, TypeBadgeCell, PhaseCell, UrgencyCell, ConstitutionalRiskCell, TreasuryImpactCell, CommunitySignalCell, StatusCell
- **DecisionTableFilters**: phase tabs (All/Feedback/Voting/Done) + urgency toggle + search
- **SortableColumnHeader**: clickable sort headers with direction indicators
- **DecisionTableRow**: responsive row with 4 mobile / 8 desktop columns
- **useDecisionTableItems**: normalizes ReviewQueueItem + ProposalDraft into unified DecisionTableItem[]
- **useDecisionTableState**: sort/filter/search local state
- Keyboard navigation (J/K/Enter) via existing focus system
- Feature flag `workspace_decision_table` enabled globally
- PostHog: `review_table_viewed` event

### Phase 3a (PR #690 — merged to main)

- **DecisionPanel** replaces Vote tab (always-visible right column)
- **IntelligenceStrip** replaces metadata strip (compact intelligence bar)
- **SenecaSummary** card above editor (AI-framed proposal summary)

### Phase 3b (this PR — code complete)

- **Supabase migration** (`069_annotation_suggestions.sql`): `suggested_text` JSONB column + `status` column on `proposal_annotations`
- **Type updates**: `'suggestion'` added to `AnnotationType`, `SuggestedText` interface, `AnnotationStatus` type
- **Schema updates**: Zod schemas extended for `suggestedText` and `status` fields
- **API route**: `rowToAnnotation()` maps new columns, POST supports `suggested_text`, PATCH supports `status`
- **Hook updates**: `useAnnotations` hooks support `suggestedText` and `status` fields
- **`useSuggestionAnnotations`** (NEW): specialized hook filtering/creating/accepting/rejecting suggestion annotations
- **Annotation component fixes**: `suggestion` type added to all `Record<AnnotationType, ...>` maps in AnnotatableText, AnnotationSidebar, PublicFeedbackSummary

### Phase 4 (this PR — code complete)

- **`AuthorDecisionTableItem`** type + `AuthorTablePhase` type
- **`useAuthorTableItems`** hook: normalizes `ProposalDraft[]` into `AuthorDecisionTableItem[]` with computed `fieldCompleteness`, `constitutionalRisk`, `nextAction`, `daysInPhase`
- **`useAuthorTableState`** hook: sort/filter/search state for author table (8 sort columns)
- **`AuthorDecisionTable`** component: full decision table with sortable columns, phase filter tabs, search, keyboard nav (J/K/Enter), PostHog tracking (`author_table_viewed`)
- **`AuthorDecisionTableRow`**: responsive row (4 mobile / 8 desktop columns)
- **`AuthorTableFilters`**: phase tabs (All/Drafts/In Review/On-Chain) + search
- **Cell components**: `QualityCell` (4-dot completeness), `NextActionCell` (AI-determined action with arrow), `FeedbackCell` (review count), `AuthorPhaseCell` (phase badge), `UpdatedCell` (relative time)
- **Reused from review**: `TypeBadgeCell`, `ConstitutionalRiskCell` (imported directly)
- **Feature-flagged**: `workspace_decision_table` gates table vs kanban fallback in AuthorWorkspace
- **AuthorWorkspace** wired with dynamic import, hides PortfolioSearch when table active

---

## Phase 3: Review Studio Intelligence — READY TO BUILD

### Founder Decisions (confirmed 2026-03-28)

1. **Decision panel REPLACES Vote tab entirely** — always-visible right column with vote buttons, rationale, position tracker, key assumptions
2. **Tracked changes persist via annotations table** — new `suggestion` annotation type + `suggested_text` JSONB column, reusing existing annotation infrastructure

### Architecture

**Current layout** (StudioReviewInner in ReviewWorkspace.tsx):

```
WorkspacePanels
  toolbar: StudioHeader (queue nav, panel toggles)
  main: SectionTOC + ProposalEditor (read-only)
  context: StudioPanelWrapper (tabs: Agent | Intel | Notes | Vote)
  statusBar: StudioActionBar (vote buttons Y/N/A, progress)
```

**Target layout**:

```
WorkspacePanels
  toolbar: StudioHeader (queue nav, panel toggle for Agent)
  main: IntelligenceStrip + ProposalEditor (read-only) + SectionTOC
  context: DecisionPanel (always visible, replaces Vote tab)
            + collapsible Agent drawer at bottom
  statusBar: StudioActionBar (progress only, vote buttons move to DecisionPanel)
```

### Key Changes

#### 1. IntelligenceStrip (NEW — in main content area, above editor)

A compact horizontal bar showing pre-computed intelligence at a glance:

- Constitutional: PASS/WARNING/FAIL badge (from section analysis skill)
- Treasury: ADA amount + % (for treasury proposals)
- Proposer: track record badge (X% ratified)
- Community: citizen sentiment (% support)
- Inter-body: DRep/SPO/CC vote tallies

**File**: `components/workspace/review/IntelligenceStrip.tsx`

Data sources:

- `interBodyVotes` already on ReviewQueueItem
- `citizenSentiment` already on ReviewQueueItem
- `withdrawalAmount`/`treasuryTier` already on ReviewQueueItem
- Constitutional check: NOT yet pre-computed for on-chain proposals. Show "—" placeholder.
- Proposer track record: NOT available in current API. Show "—" placeholder.

This replaces `ProposalMetaStrip` (currently renders type, epochs, urgency, treasury, references). The new strip is more intelligence-focused and compact.

#### 2. DecisionPanel (NEW — replaces Vote tab in context area)

An always-visible right panel for building your decision. Contains:

**Top section: Position Tracker**

- Current position: Undecided / Lean Yes / Lean No / Yes / No / Abstain (from DecisionJournal)
- Confidence gauge (segmented bar)
- Integrates with existing `DecisionJournal` component and `useSaveJournalEntry` hook

**Middle section: Vote Action**

- Three vote buttons (Yes / No / Abstain) — moved from StudioActionBar
- Rationale textarea with AI draft button — moved from VotePanel
- Key assumptions field
- "What would change your mind" field
- Submit button

**Bottom section: Intelligence Accordion**

- Constitutional detail (expandable)
- Proposer track record (expandable)
- Similar proposals (expandable)
- Citizen voices / sentiment breakdown (expandable)

**File**: `components/workspace/review/DecisionPanel.tsx`

This component combines elements from:

- `VotePanel` (components/studio/VotePanel.tsx) — vote buttons + rationale
- `DecisionJournal` (components/workspace/review/DecisionJournal.tsx) — position tracking
- `IntelPanel` (components/studio/IntelPanel.tsx) — intel content (moved to accordion)

#### 3. StudioPanel Tab Removal

Remove `vote` tab from StudioPanel. Keep `agent` and `intel` tabs, but `intel` content moves to the DecisionPanel's accordion. The StudioPanel becomes primarily the Agent chat panel.

**Modified**: `components/studio/StudioPanel.tsx` — remove vote tab
**Modified**: `components/workspace/review/ReviewWorkspace.tsx`:

- `StudioPanelWrapper`: remove `voteContent` prop, simplify to agent-only panel
- `StudioReviewInner`: replace `context` prop with DecisionPanel
- Remove vote-related state from StudioReviewInner (moved to DecisionPanel)
- Remove vote buttons from StudioActionBar (moved to DecisionPanel)

#### 4. SenecaSummary (NEW — above editor, below IntelligenceStrip)

A collapsible personalized AI summary that frames the proposal through the user's governance philosophy.

**File**: `components/workspace/review/SenecaSummary.tsx`

For MVP: uses `aiSummary` field already on ReviewQueueItem (pre-computed from CIP-108 metadata). If no aiSummary available, shows nothing (graceful degradation). Future: personalized via alignment data.

### Implementation Order

**Wave 1 — IntelligenceStrip + SenecaSummary** (lower risk, additive):

1. Create `IntelligenceStrip.tsx` — compact intelligence bar
2. Create `SenecaSummary.tsx` — AI summary card
3. Add both above ProposalEditor in ReviewWorkspace main content
4. Remove ProposalMetaStrip (replaced by IntelligenceStrip)

**Wave 2 — DecisionPanel** (bigger structural change): 5. Create `DecisionPanel.tsx` — always-visible decision workspace 6. Integrate DecisionJournal, vote state, rationale, intel accordion 7. Wire into ReviewWorkspace as the `context` prop

**Wave 3 — Rewire StudioPanel + ActionBar**: 8. Remove `voteContent` from StudioPanelWrapper 9. Remove vote buttons from StudioActionBar 10. Simplify StudioPanel for review mode (Agent only, Intel optional)

**Wave 4 — Tracked Changes Persistence** (annotation-based): 11. Supabase migration: add `suggestion` to annotation types, add `suggested_text` column 12. API: extend annotation create/read to support suggestions 13. Wire: on reviewer "Suggest Edit", persist as annotation + apply Tiptap mark 14. Wire: on editor load, hydrate Tiptap marks from persisted suggestion annotations

### Key Files to Read

| File                                                 | Purpose                                                        | Lines |
| ---------------------------------------------------- | -------------------------------------------------------------- | ----- |
| `components/workspace/review/ReviewWorkspace.tsx`    | Main review layout — StudioReviewInner renders WorkspacePanels | ~900  |
| `components/studio/StudioPanel.tsx`                  | Tab panel (Agent/Intel/Notes/Vote)                             | ~200  |
| `components/studio/VotePanel.tsx`                    | Vote buttons + rationale                                       | ~200  |
| `components/workspace/review/DecisionJournal.tsx`    | Position tracker + history                                     | ~300  |
| `components/studio/IntelPanel.tsx`                   | Intelligence blocks                                            | ~150  |
| `components/workspace/review/IntelligenceBlocks.tsx` | Constitutional + precedent + diversity                         | ~250  |
| `hooks/useSaveJournalEntry.ts`                       | Journal persistence                                            | ~60   |
| `lib/workspace/types.ts`                             | All shared types                                               | ~630  |

### Key Type Signatures

#### VotePanel props (from components/studio/VotePanel.tsx)

```typescript
interface VotePanelProps {
  selectedVote: 'Yes' | 'No' | 'Abstain' | null;
  onVoteChange: (vote: 'Yes' | 'No' | 'Abstain') => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  rationale: string;
  onRationaleChange: (text: string) => void;
  onAIDraft: () => void;
  isDraftingRationale: boolean;
  proposalTitle: string;
  drepId: string;
  voterRole: string;
}
```

#### DecisionJournalEntry (from lib/workspace/types.ts)

```typescript
interface DecisionJournalEntry {
  id: string;
  userId: string;
  proposalTxHash: string;
  proposalIndex: number;
  position: JournalPosition; // 'undecided' | 'lean_yes' | 'lean_no' | 'lean_abstain' | 'yes' | 'no' | 'abstain'
  confidence: number;
  steelmanText: string;
  keyAssumptions: string;
  whatWouldChangeMind: string;
  positionHistory: Array<{ position: JournalPosition; timestamp: string; reason?: string }>;
  createdAt: string;
  updatedAt: string;
}
```

#### StudioPanel activeTab type

```typescript
type TabId = 'agent' | 'intel' | 'notes' | 'vote' | 'readiness';
```

#### WorkspacePanels layout props

```typescript
// From components/workspace/layout/WorkspacePanels.tsx
interface WorkspacePanelsProps {
  layoutId: string;
  toolbar: ReactNode;
  main: ReactNode;
  context?: ReactNode; // This is where DecisionPanel will go
  statusBar?: ReactNode;
}
```

---

## Phase 5 (PR #695 — merged to main)

- **Workspace pills** on hub Seneca: "Proposals to review" + "My drafts" with `navigate` action type
- **`workspace` intent** in GlobeIntentType with detection patterns for review/drafts/attention queries
- **GlobeLayout** handles workspace intent: warms proposals topic + shows WorkspaceCards overlay
- **WorkspaceCards** (`components/globe/WorkspaceCards.tsx`): glassmorphic overlay at z-28 with review queue + drafts sections
- PostHog: `globe_workspace_pill_clicked`, `globe_workspace_card_clicked`

## Phase 6: Design Language & Mobile — READY TO BUILD

### Scope

Full Compass design language enforcement + mobile optimization across the workspace studio surfaces built in Phases 1-5.

### What needs work

1. **Mobile-optimized review experience**: Bottom sheet panels for DecisionPanel on mobile, touch-friendly targets (min 44px), swipe gestures for queue navigation
2. **Mobile-optimized author experience**: Simplified form layout, expandable sections, responsive decision table (already has `hidden md:table-cell` responsive columns)
3. **Compass token enforcement**: Verify all workspace components use Compass CSS variables (`--compass-teal`, `--compass-gold`, etc.) and Compass typography (Fraunces for headings, Space Grotesk for body). See `docs/strategy/design-language.md` and `app/globals.css`
4. **Reduced motion support**: `useReducedMotion()` from framer-motion to disable animations for users with `prefers-reduced-motion`
5. **WorkspaceCards mobile**: The globe overlay cards should adapt to bottom sheet on mobile
6. **Three density modes**: Verify workspace surfaces respect ModeProvider density (focus/default/scan). See `components/providers/ModeProvider.tsx`

### Key files to read

| File                                                  | Purpose                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/strategy/design-language.md`                    | Full Compass spec (~590 lines)                                         |
| `app/globals.css`                                     | Compass palette, mode spacing CSS variables                            |
| `components/providers/ModeProvider.tsx`               | Density mode context                                                   |
| `components/workspace/review/ReviewWorkspace.tsx`     | Review studio layout (DecisionPanel, IntelligenceStrip, SenecaSummary) |
| `components/workspace/review/DecisionPanel.tsx`       | Vote panel — needs mobile bottom sheet                                 |
| `components/workspace/author/AuthorDecisionTable.tsx` | Author table — already responsive                                      |
| `components/workspace/author/AuthorWorkspace.tsx`     | Author portfolio — layout                                              |
| `components/globe/WorkspaceCards.tsx`                 | Globe overlay cards — needs mobile adaptation                          |

### Design language reference

- **Palette**: `--compass-teal` (primary action), `--compass-gold` (warning/emphasis), `--compass-coral` (danger), `--compass-navy` (background depth)
- **Typography**: Fraunces (serif, headings), Space Grotesk (sans, body/UI)
- **Density modes**: Focus (spacious), Default (balanced), Scan (compact)
- **Dark-only**: No light mode. Ever.

---

## User Feedback Summary

1. **Workspace = authoring + review studio only** — Performance, votes, rationales, delegators belong elsewhere
2. **Globe is Seneca-driven, not directly interactive** — Users interact via Seneca widget, Seneca choreographs globe
3. **Legal-grade tracked changes required** — Reviewer suggestions as tracked changes, version diffs, revision narratives
4. **AI feedback aggregation must be prominent** — Existing consolidation system (Inngest clustering, themes, endorsements, sealed period) is a first-class surface
5. **Author is a destination, not a compose action** — Full portfolio workspace, not a simple form
6. **AI should BE the workspace** — Intelligence surfaces as annotations, columns, structured analysis — not a sidebar chatbot
7. **Decision panel replaces Vote tab** — Always-visible right column (confirmed 2026-03-28)
8. **Tracked changes via annotations table** — Reuse existing annotation infrastructure with new `suggestion` type (confirmed 2026-03-28)
