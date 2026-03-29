# Workspace Studio Upgrade — Handoff Document

> **Status**: Phase 1 + Phase 2 COMPLETE. Phases 3-6 remain.
> **Branch**: `claude/stupefied-raman`
> **Plan**: `C:\Users\dalto\.claude-personal\plans\glimmering-discovering-crescent.md`
> **Updated**: 2026-03-28

## CRITICAL: Handoff Instructions for Next Agent

1. **Read this entire document first** before writing any code.
2. **Read the plan** at the path above — it contains the full exploration, concepts, and implementation roadmap.
3. **Read the memory files** at `C:\Users\dalto\.claude-personal\projects\C--Users-dalto-governada-governada-app\memory\` — critical feedback from the founder:
   - `feedback_workspace_scope.md` — Workspace = authoring + review only
   - `feedback_globe_functional_nav.md` — Globe as functional navigation
   - `feedback_globe_interaction_model.md` — Globe is visual + Seneca-driven, NOT directly clickable
   - `feedback_legal_change_tracking.md` — Legal-grade tracked changes required
4. **Run `npm run preflight`** to verify the codebase compiles before starting work.
5. **Follow these same handoff practices**: If you begin to run out of context, pause to document and commit a proper handoff document for the next agent before stopping. Quality over quantity.
6. **Pause for decision gating** if you discover something that needs founder discussion/alignment.
7. **Critical rules** (from founder):
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

### Phase 2 (this commit — on branch)

- **DecisionTable** component replacing kanban in ReviewPortfolio
- **8 cell components**: ProposalCell, TypeBadgeCell, PhaseCell, UrgencyCell, ConstitutionalRiskCell, TreasuryImpactCell, CommunitySignalCell, StatusCell
- **DecisionTableFilters**: phase tabs (All/Feedback/Voting/Done) + urgency toggle + search
- **SortableColumnHeader**: clickable sort headers with direction indicators
- **DecisionTableRow**: responsive row with 4 mobile / 8 desktop columns
- **useDecisionTableItems**: normalizes ReviewQueueItem + ProposalDraft into unified DecisionTableItem[]
- **useDecisionTableState**: sort/filter/search local state
- Keyboard navigation (J/K/Enter) via existing focus system
- Feature-flagged behind `workspace_decision_table` (off by default)
- PostHog: `review_table_viewed` event
- Supabase migration applied for feature flag

**Files created**:

- `components/workspace/review/DecisionTable.tsx`
- `components/workspace/review/DecisionTableFilters.tsx`
- `components/workspace/review/DecisionTableRow.tsx`
- `components/workspace/review/SortableColumnHeader.tsx`
- `components/workspace/review/cells/` (8 files)
- `hooks/useDecisionTableItems.ts`
- `hooks/useDecisionTableState.ts`

**Files modified**:

- `components/workspace/review/ReviewPortfolio.tsx` — Added feature-flag branch
- `lib/workspace/types.ts` — Added DecisionTableItem, DecisionTablePhase, DecisionTableStatus, ConstitutionalRiskLevel
- `lib/featureFlags.ts` — Added workspace_decision_table to active flags docs

---

## What Remains

### Phase 3: Review Studio Intelligence (L effort)

Seneca summary as default view, persistent decision panel, structured analysis visible without tabs.

**Key files**:

- `app/workspace/review/page.tsx` — Review page router
- `components/workspace/review/ProposalContent.tsx` — Raw proposal display
- `components/workspace/review/ReviewWorkspace.tsx` — Studio layout (3-panel resizable)
- `components/studio/StudioPanel.tsx` — Panel system (already has headerContent support)

**What to build**:

1. `SenecaSummary` component — personalized AI summary framed through user's governance philosophy
2. `DecisionPanel` — persistent right panel replacing Vote tab: position tracker, vote buttons, rationale, assumptions
3. `IntelligenceStrip` — compact structured analysis (constitutional, treasury, proposer, community, inter-body)
4. Pre-chain mode: DecisionPanel adapts to show ReviewRubric + "Suggest Edit" instead of vote buttons
5. Revision diff: "What changed?" shows diff between community review version and current version

**Architecture decisions needed from founder**:

- Does the decision panel replace the Vote tab entirely, or sit alongside it?
- How do tracked changes from reviewers persist to the database? (Currently only in-document marks)

### Phase 4: Author Decision Table (M effort)

Replace author kanban with intelligent portfolio table. Same pattern as Phase 2 but for author's drafts. Columns: Draft, Status, Quality Signal, Community Feedback, Constitutional, Next Action.

### Phase 5: Globe-Workspace Bridge (M effort)

Seneca-mediated navigation from globe to workspace.

**Key constraint**: Globe is NOT directly clickable. Seneca choreographs globe via intents. Cards overlay focused nodes and ARE clickable.

### Phase 6: Design Language & Mobile (M effort)

Full Compass enforcement + mobile optimization.

---

## Key Type Signatures for Next Agent

### DecisionTableItem (from lib/workspace/types.ts)

```typescript
interface DecisionTableItem {
  id: string;
  phase: DecisionTablePhase;
  title: string;
  proposalType: string;
  epochsRemaining: number | null;
  isUrgent: boolean;
  daysInReview: number | null;
  treasuryAmount: number | null;
  treasuryTier: string | null;
  communitySignal: CitizenSentiment | null;
  constitutionalRisk: ConstitutionalRiskLevel | null;
  status: DecisionTableStatus;
  voteChoice: string | null;
  href: string;
}
```

### SortColumn type (from hooks/useDecisionTableState.ts)

```typescript
type SortColumn =
  | 'title'
  | 'type'
  | 'phase'
  | 'urgency'
  | 'risk'
  | 'treasury'
  | 'signal'
  | 'status';
```

### ReviewQueueItem (from lib/workspace/types.ts)

```typescript
interface ReviewQueueItem {
  txHash: string;
  proposalIndex: number;
  title: string;
  abstract: string | null;
  aiSummary: string | null;
  proposalType: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  epochsRemaining: number | null;
  isUrgent: boolean;
  interBodyVotes: InterBodyVotes;
  citizenSentiment: CitizenSentiment | null;
  existingVote: string | null;
  sealedUntil: string | null;
  motivation: string | null;
  rationale: string | null;
}
```

### AIDiffMark Extended Attributes (from Phase 1)

```typescript
// Both AIDiffAdded and AIDiffRemoved now support:
{
  editId: string | null; // 'ai-*' for AI, 'review-*' for reviewer tracked changes
  explanation: string | null;
  authorName: string | null;
}

// Public APIs:
applyReviewerEdit(editor, proposedText, explanation, authorName): string | null
scanAllTrackedChanges(editor): Array<{ editId, originalText, proposedText, explanation, authorName, isReviewer }>
```

---

## User Feedback Summary

1. **Workspace = authoring + review studio only** — Performance, votes, rationales, delegators belong elsewhere
2. **Globe is Seneca-driven, not directly interactive** — Users interact via Seneca widget, Seneca choreographs globe
3. **Legal-grade tracked changes required** — Reviewer suggestions as tracked changes, version diffs, revision narratives
4. **AI feedback aggregation must be prominent** — Existing consolidation system (Inngest clustering, themes, endorsements, sealed period) is a first-class surface
5. **Author is a destination, not a compose action** — Full portfolio workspace, not a simple form
6. **AI should BE the workspace** — Intelligence surfaces as annotations, columns, structured analysis — not a sidebar chatbot
