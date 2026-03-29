# Build Step: Studio Excellence — World-Class Author & Review (Layer 2)

**Status:** PHASE_3_COMPLETE
**Started:** 2026-03-29
**Current Phase:** 3 of 6 (Living Document Substrate)
**PR chain:** #700 (Phase 1) → #704 (Phase 2) → #708 (Phase 3)
**Predecessor:** `.claude/checkpoints/workspace-studio-upgrade.md` (Phases 1-5 DEPLOYED)

---

## Context: What Already Shipped (Don't Rebuild)

The `workspace-studio-upgrade.md` build shipped Phases 1-5 of the original plan. Before starting, you MUST read that checkpoint to understand what's already built. Here's the summary:

### Already deployed to production:

- **QualityPulse + ambient constitutional check** (PR #685) — `useAmbientConstitutionalCheck` hook, margin indicators
- **Review DecisionTable** replacing kanban (PR #688) — 8 cell components, sort/filter/search, keyboard nav
- **DecisionPanel** replacing Vote tab (PR #690) — always-visible right column, IntelligenceStrip, SenecaSummary
- **Reviewer suggestion annotations** (PR #690) — Supabase migration `069_annotation_suggestions.sql`, `suggested_text` JSONB + `status` column, `useSuggestionAnnotations` hook, `SelectionToolbar` "Suggest Change" button
- **Author DecisionTable** (PR #690) — `AuthorDecisionTable`, `useAuthorTableItems`, phase/quality/feedback cells
- **ProposalEditor extensions** (PR #685) — `AIDiffMark` extended for reviewer-sourced diffs, `SelectionToolbar` extended with suggest-change flow
- **Globe → Workspace bridge** (PR #695) — workspace pills on Seneca, WorkspaceCards overlay
- **Phase 6 (Design Language & Mobile) NOT YET DONE** — see workspace-studio-upgrade.md for scope

### What this means for our plan:

Several items from our 6-phase plan are **already partially or fully built**. The agent must read the current code before implementing to avoid duplication. Specifically:

| Our Plan Item                                   | Status                                                                      | What Remains                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Phase 1: Wire Tiptap to all proposals           | **DONE** — PR #700 merged 2026-03-29                                        | None                                                                                                                 |
| Phase 2: Persistent Intelligence Brief          | **DONE** — PR #704 merged 2026-03-29                                        | None — scrollable brief, stage transformations, role adaptation all shipped                                          |
| Phase 3: Tracked changes + reviewer suggestions | **PARTIALLY DONE** — suggestion annotations, AIDiffMark extensions deployed | Need: author suggestion resolution UI, version diff on return, lifecycle editor mode integration, margin refinements |
| Phase 4: Agent evolution                        | **NOT DONE**                                                                | Full implementation needed                                                                                           |
| Phase 5: Pre-computation pipeline               | **NOT DONE**                                                                | Full implementation needed                                                                                           |
| Phase 6: Mobile + polish                        | **NOT DONE** (also not done in predecessor build)                           | Full implementation needed                                                                                           |

---

## Plan Location

Full plan with all 6 phases, design philosophy, end-to-end lifecycle, and three-layer architecture:
`C:\Users\dalto\.claude-personal\plans\imperative-pondering-glade.md`

---

## Phase 1: Editor Foundation — Wire Tiptap to All Proposals

**This remains the single highest-ROI change and the foundation for everything else.**

### Goal

Replace `DraftForm.tsx` textareas with `ProposalEditor.tsx` (Tiptap) for all standard proposal types (InfoAction, TreasuryWithdrawals, ParameterChange, HardForkInitiation, NoConfidence, NewCommittee). NewConstitution already uses the amendment editor — no change needed there.

### Why First

The Tiptap editor infrastructure is fully built (ProposalEditor.tsx, all extensions). But standard proposals bypass all of it, using plain `<Textarea>` elements. Every Phase 2-6 feature (tracked changes between author/reviewer, agent edits as inline diffs, ghost text completions, margin decorations, slash commands, Cmd+K) depends on Tiptap being the editing substrate.

### Architecture Decision

`DraftEditor.tsx` currently:

1. Loads draft via `useDraft(draftId)` hook
2. For empty drafts with AI: shows `ScaffoldForm`
3. For NewConstitution + flag: redirects to amendment editor
4. **For everything else: renders `DraftForm` (textareas)** ← REPLACE THIS

Replace step 4 with rendering `ProposalEditor` wrapped in the `StudioProvider` shell:

- `content` prop from draft data `{ title, abstract, motivation, rationale }`
- `onContentChange` → `useUpdateDraft` mutation (debounced auto-save, same pattern as DraftForm)
- `mode` driven by `draft.status`: 'edit' for draft/response_revision, 'review' for community_review/final_comment
- Type-specific fields (TreasuryFields, ParameterChangeFields) render as form section beside/below editor
- Slash commands → existing AI skills
- Cmd+K → agent via `useAgent` hook
- Agent edits → `injectProposedEdit(editor, edit)` (same pattern as ReviewWorkspace)

### Key Files To Read FIRST

1. `.claude/checkpoints/workspace-studio-upgrade.md` — what's already been built (CRITICAL)
2. `components/workspace/author/DraftEditor.tsx` — THE file you're modifying
3. `components/workspace/editor/ProposalEditor.tsx` — the Tiptap editor you're wiring in
4. `components/workspace/author/DraftForm.tsx` — reference for auto-save, type-specific fields, provenance
5. `components/workspace/review/ReviewWorkspace.tsx` — BLUEPRINT for how ProposalEditor + useAgent are already wired together
6. `hooks/useDrafts.ts` — useUpdateDraft mutation
7. `hooks/useAgent.ts` — agent SSE hook
8. `hooks/useAmbientConstitutionalCheck.ts` — already built, wire to margin indicators
9. `components/workspace/author/QualityPulse.tsx` — already built, keep working

### Key Type Signatures

```typescript
// ProposalEditor props (components/workspace/editor/ProposalEditor.tsx)
interface ProposalEditorProps {
  content: { title?: string; abstract?: string; motivation?: string; rationale?: string };
  mode: EditorMode; // 'edit' | 'review' | 'diff'
  readOnly?: boolean;
  onContentChange?: (content: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  }) => void;
  onSlashCommand?: (command: SlashCommandType, section: ProposalField) => void;
  onCommand?: (instruction: string, selectedText: string, section: ProposalField) => void;
  onCommentCreate?: (comment: InlineCommentData, from: number, to: number) => void;
  onCommentDelete?: (commentId: string) => void;
  onDiffAccept?: (editId: string) => void;
  onDiffReject?: (editId: string) => void;
  onCompletionAccept?: (text: string) => void;
  onEditorReady?: (editor: Editor) => void;
  currentUserId?: string;
  marginIndicators?: MarginIndicator[];
  excludeFields?: ProposalField[];
}

// ProposedEdit (lib/workspace/editor/types.ts)
interface ProposedEdit {
  field: ProposalField;
  anchorStart: number;
  anchorEnd: number;
  originalText: string;
  proposedText: string;
  explanation: string;
}
```

### Patterns To Follow

**ReviewWorkspace.tsx is the blueprint.** It already wires ProposalEditor + useAgent:

- Captures editor instance via `onEditorReady`
- Watches `useAgent.lastEdit` → `injectProposedEdit(editor, edit)`
- Watches `useAgent.lastComment` → `injectInlineComment`
- Passes `onSlashCommand`, `onCommand` callbacks

### What NOT To Change

- ScaffoldForm flow — keep as-is, it feeds into the editor
- Amendment editor routing — keep as-is
- Submission ceremony, Monitor, Debrief pages — untouched in Phase 1
- Review side — untouched in Phase 1
- QualityPulse, ProactiveInsight — already built, keep working
- AuthorDecisionTable — already built, keep working

### Phase 1 Verification (COMPLETE — PR #700)

- [x] InfoAction draft → Tiptap editor loads with 4 section blocks
- [x] Auto-save works (500ms debounce)
- [x] Slash commands + Cmd+K → agent integration
- [x] Treasury draft → type-specific fields render below editor
- [x] ParameterChange draft → parameter select + value fields render
- [x] community_review/final_comment/submitted → read-only for all
- [x] response_revision → editable for owner/lead/editor
- [x] Team editor/lead roles can edit (via useTeam integration)
- [x] ScaffoldForm shows for empty drafts with author_ai_draft flag
- [x] Amendment draft → still routes to ConstitutionEditor (no regression)
- [x] Constitutional check → colored margin indicators
- [x] `npm run preflight` passes (842/842 tests)

### Phase 1 Key Decisions

- **ProposalEditor was already wired** via `app/workspace/editor/[draftId]/page.tsx`. The old `DraftEditor.tsx` + `DraftForm.tsx` were dead code — the author route already routed to the Tiptap workspace page.
- **Phase 1 scope was closing 5 gaps** vs building from scratch: type-specific fields, scaffold, lifecycle mode, team roles, margin indicators.
- **TypeSpecificFields extracted** to `components/workspace/editor/TypeSpecificFields.tsx` as a standalone component (not inline in the page).
- **Margin indicators map constitutional flags to sections** by keyword matching in flag concern text (abstract→1, motivation→2, rationale→3, default→2).

### Phase 1 Files Modified

- `components/workspace/editor/TypeSpecificFields.tsx` (NEW — 156 lines)
- `app/workspace/editor/[draftId]/page.tsx` (modified — added ~100 lines)

---

## Phase 2: Intelligence Architecture — COMPLETE (PR #704)

### What Was Built

Replaced the empty Intel tab (author) and DecisionPanel accordion (review) with scrollable, stage-driven Intelligence Briefs.

### Architecture: Section Registry Pattern

A `lib/workspace/intelligence/registry.ts` maps each `DraftStatus` to an ordered array of `SectionConfig` objects. Two orchestrators (`AuthorBrief`, `ReviewIntelBrief`) read the registry and compose from shared section primitives in `components/intelligence/sections/`.

### New Files (18)

**Infrastructure:**

- `lib/workspace/intelligence/types.ts` — `SectionConfig`, `SectionId`, `BriefStage`, `AuthorBriefContext`, `ReviewBriefContext`
- `lib/workspace/intelligence/registry.ts` — `getAuthorSections(stage)`, `getReviewSections(voterRole)`, stage→section mappings

**Shared components:**

- `components/intelligence/BriefShell.tsx` — scrollable container, iterates section configs, collapsible cards with PostHog analytics
- `components/intelligence/AuthorBrief.tsx` — orchestrator (takes `ProposalDraft`, reads `draft.status`, renders via BriefShell)
- `components/intelligence/ReviewIntelBrief.tsx` — orchestrator (takes `ReviewQueueItem` fields + `voterRole`)

**Author sections:**

- `ConstitutionalSection.tsx` — wraps `useAISkill('constitutional-check')`, accepts cached `ConstitutionalCheckResult`
- `ReadinessSection.tsx` — radial gauge using `computeConfidence()` from `lib/workspace/confidence.ts`
- `SimilarProposalsSection.tsx` — wraps `useAISkill('research-precedent')`
- `RiskRegisterSection.tsx` — aggregates constitutional flags + treasury + community concerns
- `ReviewSummarySection.tsx` — review count, dimensional scores, top concerns (uses `useDraftReviews`)
- `FeedbackTriageBoard.tsx` — card-based theme triage with status grouping + action buttons (uses `useFeedbackThemes` + `useAddressTheme`)
- `SubmissionChecklist.tsx` — 4 explicit gates with pass/fail status
- `MonitorEmbed.tsx` — embeds `VotingProgress` + `VoteActivity` + `DepositStatus`

**Review sections:**

- `ExecutiveSummary.tsx` — shows `aiSummary` from ReviewQueueItem
- `QuickAssessment.tsx` — key signals (treasury, urgency, consensus direction)
- `StakeholderLandscape.tsx` — VoteBar per body + citizen sentiment
- `ProposerProfileSection.tsx` — wraps `useProposerTrackRecord`
- `KeyQuestionsSection.tsx` — wraps `research-precedent` skill output

### Modified Files (3)

- `app/workspace/editor/[draftId]/page.tsx` — added `intelContent` prop to `AuthorPanelWrapper`, passes `<AuthorBrief>` with draft data + constitutional result + canEdit
- `components/workspace/review/ReviewWorkspace.tsx` — replaced both `<IntelPanel>` usages with `<ReviewIntelBrief>` (StudioPanel Intel tab + DecisionPanel intelContent)
- `components/workspace/review/DecisionPanel.tsx` — removed `IntelSection` accordion wrapper, renders `intelContent` in `overflow-y-auto` scroll container

### Key Type Signatures (for Phase 3 agent)

```typescript
// SectionConfig (lib/workspace/intelligence/types.ts)
interface SectionConfig {
  id: SectionId;
  title: string;
  priority: number;
  defaultExpanded: boolean;
  lazyAI?: boolean;
  icon: string;
}

// AuthorBrief props (components/intelligence/AuthorBrief.tsx)
interface AuthorBriefProps {
  draft: ProposalDraft;
  draftId: string;
  constitutionalResult?: ConstitutionalCheckResult | null;
  canEdit?: boolean;
}

// ReviewIntelBrief props (components/intelligence/ReviewIntelBrief.tsx)
interface ReviewIntelBriefProps {
  proposalId: string;
  proposalIndex: number;
  proposalType: string;
  proposalContent: { title; abstract; motivation; rationale };
  interBodyVotes?: { drep; spo; cc };
  citizenSentiment?: CitizenSentiment | null;
  aiSummary?: string | null;
  withdrawalAmount?: number | null;
  treasuryTier?: string | null;
  epochsRemaining?: number | null;
  isUrgent?: boolean;
  voterRole: string;
}
```

### Phase 2 Stage Behaviors (Author Brief)

| Stage               | Sections Shown                                                      |
| ------------------- | ------------------------------------------------------------------- |
| `draft`             | Constitutional + Readiness + Similar Proposals + Risk Register      |
| `community_review`  | ReviewSummary + Constitutional + Readiness + Similar + Risk         |
| `response_revision` | FeedbackTriage + Constitutional + Readiness                         |
| `final_comment`     | SubmissionChecklist + Constitutional + Readiness                    |
| `submitted`         | MonitorEmbed (VotingProgress + VoteActivity + DepositStatus inline) |

### Phase 2 Decisions

- **No feature flag gate** — the author Intel tab was empty ("coming soon"), so this is pure additive with zero regression risk. The review side replaces `IntelPanel` with the same data in a better container.
- **Section registry pattern** chosen over a single conditional component — makes adding/reordering sections a one-line change.
- **Separate orchestrators** (AuthorBrief vs ReviewIntelBrief) — the data models are fundamentally different (ProposalDraft vs ReviewQueueItem).
- **AI sections use `useEffect` for fetch** — not inline render calls, to satisfy React hooks lint (`react-hooks/refs` rule).
- **ConstitutionalSection accepts cached `ConstitutionalCheckResult`** — avoids re-running AI when the ambient check already ran. Maps the stored type (no `summary` field) to the skill output type.

---

## What Already Exists for Phase 3 (from workspace-studio-upgrade build)

Before building Phase 3, the next agent MUST understand these already-deployed components:

1. **Suggestion annotations** — Supabase migration `069_annotation_suggestions.sql` added `suggested_text` JSONB + `status` column to `proposal_annotations`. `AnnotationType` includes `'suggestion'`. `AnnotationStatus` is `'active' | 'accepted' | 'rejected'`.

2. **`useSuggestionAnnotations` hook** (`hooks/useSuggestionAnnotations.ts`) — filters/creates/accepts/rejects suggestion annotations.

3. **`SelectionToolbar` "Suggest Change" button** (`components/workspace/editor/SelectionToolbar.tsx`) — already shows in review mode. `showSuggestEdit` prop on `ProposalEditor` controls visibility.

4. **`AIDiffMark` extended for reviewer-sourced diffs** (`components/workspace/editor/extensions/AIDiffMark.tsx`) — supports diffs from agent, reviewer, or author sources.

5. **`showSuggestEdit` prop wired in editor page** — line ~699 of `app/workspace/editor/[draftId]/page.tsx`: `showSuggestEdit={!isOwner && mode === 'review'}`.

6. **Lifecycle-driven mode** — already implemented in editor page (lines 267-277): draft→edit, response_revision→edit, community_review/final_comment/submitted→review.

### Phase 3 Is Now COMPLETE (PR #708)

All three gaps have been closed:

1. **Author suggestion resolution UI** — `SuggestionResolutionBar` component with prev/next nav, accept/reject/batch actions. Suggestions loaded via `useSuggestionAnnotations` and injected as inline blue tracked changes using `applyProposedEdit` with `review-sug-{annotationId}` editIds. Tab/Escape keyboard shortcuts also sync annotation status via `suggestionMapRef` mapping.

2. **Version diff on return** — `ReReviewBanner` extended with "Show Changes" toggle. New GET endpoint `/api/workspace/drafts/[draftId]/version?versionNumber=N`. `ChangeSinceBadge` component shows field-level "Modified since your review" indicators by comparing previous version content with current.

3. **Ambient margin refinement** — Constitutional check debounce tightened from 5s to 2s. Hash dedup prevents redundant API calls.

### Phase 3 Files

**New:**

- `components/workspace/editor/SuggestionResolutionBar.tsx` (~190 lines)
- `components/workspace/editor/ChangeSinceBadge.tsx` (~60 lines)

**Modified:**

- `app/workspace/editor/[draftId]/page.tsx` — suggestion wiring (~100 lines added), version diff state + fetch (~30 lines), ReReviewBanner + ChangeSinceBadge rendering
- `components/workspace/editor/AIDiffMark.tsx` — exported `acceptDiff()` and `rejectDiff()` (were file-private)
- `components/workspace/author/ReReviewBanner.tsx` — added `onShowChanges` prop + "Show Changes" toggle button
- `app/api/workspace/drafts/[draftId]/version/route.ts` — added GET handler for version content by number
- `hooks/useAmbientConstitutionalCheck.ts` — debounce 5000ms → 2000ms

### Phase 3 Key Architecture Decisions

- **Used `applyProposedEdit` (field-relative offsets) not `applyReviewerEdit` (selection-based)** — because suggestion annotations store `anchorField`+`anchorStart`+`anchorEnd`, which maps directly to `applyProposedEdit`'s `ProposedEdit` interface.
- **editId format `review-sug-{annotationId}`** — the `review-` prefix triggers blue highlighting in AIDiffMark. The suffix is the annotation ID for Supabase mapping.
- **`suggestionMapRef` (Map<editId, annotationId>)** — bridges editor-level diffs to Supabase annotation mutations. Used by both SuggestionResolutionBar explicit actions AND Tab/Escape keyboard interception in `onDiffAccept`/`onDiffReject`.
- **Version diff is lazy-fetched** — only when reviewer clicks "Show Changes". Uses TanStack Query with 5-minute staleTime.
- **No new migrations** — all schema already deployed from predecessor build (migration 069).

---

## Context Window Protocol

If your context window is filling up:

1. Commit all work to feature branch, push
2. Create PR if ready, or note branch name
3. Update THIS checkpoint: what you completed, what's in progress, new type signatures, gotchas
4. Commit checkpoint to main:
   ```bash
   cd C:\Users\dalto\governada\governada-app
   git pull origin main
   git add .claude/checkpoints/build-step-studio-excellence.md
   git commit -m "checkpoint: studio excellence phase N progress"
   git push origin main
   ```
5. Include "Next Agent Prompt" section below with full context

---

## Next Agent Prompt

```
You are building Phase 4 of the Studio Excellence build for Governada — Agent Evolution (intent-to-draft, feedback synthesis, rationale co-generation).

## FIRST: Read the checkpoint (CRITICAL — it's on main, not in your worktree)

Your worktree was created from a branch. The checkpoint is on main. To access it:

  git fetch origin main
  git show origin/main:.claude/checkpoints/build-step-studio-excellence.md > /tmp/checkpoint.md
  cat /tmp/checkpoint.md

This checkpoint contains:
- Full inventory of what's already built (Phases 1-3 + predecessor build)
- Key type signatures you'll need
- Architecture decisions made in prior phases

## THEN: Read the full 6-phase plan

  cat "C:\Users\dalto\.claude-personal\plans\imperative-pondering-glade.md"

Phase 4 starts at line ~245 in the plan ("Phase 4: Agent Evolution").

## What's Already Deployed (DON'T REBUILD)

Phase 1 (PR #700): Tiptap wired to all proposal types
Phase 2 (PR #704): Stage-driven Intelligence Brief in both author + review studios
Phase 3 (PR #708): Living document substrate — suggestion resolution, version diff, responsive margins

## What Phase 4 NEEDS TO BUILD

From the plan (lines 245-284):

### Author side:
1. **Intent-to-Proposal-Plan** — Evolve ScaffoldForm into full Proposal Plan generator. Author describes idea → agent produces structured plan (draft, constitutional assessment, risk analysis, similar proposals, recommended improvements). Plan is structured with confidence scores and source citations.

2. **Proactive agent interventions** — Background analysis triggers margin notifications:
   - "Your motivation doesn't address treasury sustainability"
   - "A competing proposal was just submitted"
   - "Your revision improved compliance from Amber to Green"
   Implemented as margin decorations with expandable callout + "Fix" button triggering tracked change.

3. **Agent-synthesized feedback** — During `response_revision`, agent clusters reviews into themes. Presents as Critical/Important/Minor with pre-drafted tracked changes. Feeds the FeedbackTriageBoard from Phase 2.

### Review side:
4. **Personalized briefing narrative** — Executive Summary and "Your Quick Assessment" personalized to reviewer's voting history and governance philosophy.

5. **Structured rationale co-generation** — In Decision Panel, after reviewer selects vote and types bullet points, agent generates structured rationale with constitutional citations, precedent refs, proposal quotes.

6. **CC Member express lane** — Constitutional-only mode: article-by-article PASS/ADVISORY/FAIL. One-click accept with provenance (AI-assisted vs. human-judgment).

## Key Files to Read

- `lib/ai/skills/` — existing skills and skill engine
- `app/api/ai/skill/route.ts` — skill API
- `hooks/useAgent.ts` — SSE streaming, ProposedEdit/ProposedComment parsing
- `components/workspace/author/ScaffoldForm.tsx` — evolve into Proposal Plan generator
- `components/workspace/editor/ProposalEditor.tsx` — margin decorations, Tiptap extensions
- `components/workspace/editor/extensions/MarginDecorations.tsx` — extend for proactive notifications
- `components/intelligence/sections/FeedbackTriageBoard.tsx` — wire to agent synthesis
- `components/workspace/review/DecisionPanel.tsx` — rationale co-generation UI

## CRITICAL: Plan before building

Phase 4 is the most ambitious phase — 6 distinct features. Use EnterPlanMode to prioritize and scope. Consider:
- Which features have the highest standalone value?
- Which features share infrastructure (e.g., new AI skills)?
- What's the minimum viable version of each?

If you run low on context, follow the checkpoint protocol documented in the checkpoint file.
```
