# Build Step: Studio Excellence — World-Class Author & Review (Layer 2)

**Status:** PHASE_6_COMPLETE ✅
**Started:** 2026-03-29
**Current Phase:** 6 of 6 — COMPLETE
**PR chain:** #700 (Phase 1), #704 (Phase 2), #708 (Phase 3), #715/#717/#721 (Phase 4A/B/C), #729/#732/#733 (Phase 5A/B/C), #737/#739 (Phase 6A/B)
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

| Our Plan Item                                   | Status                                                                          | What Remains                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Phase 1: Wire Tiptap to all proposals           | **DONE** — PR #700 merged 2026-03-29                                            | None — type fields, scaffold, lifecycle, team roles, margins all wired                                                      |
| Phase 2: Persistent Intelligence Brief          | **PARTIALLY DONE** — IntelligenceStrip + SenecaSummary + DecisionPanel deployed | Need: scrollable brief replacing tabbed sidebar, stage-driven transformation, Feedback Triage Board, role-adaptive ordering |
| Phase 3: Tracked changes + reviewer suggestions | **PARTIALLY DONE** — suggestion annotations, AIDiffMark extensions deployed     | Need: lifecycle-driven editor modes, author suggestion resolution UI, version diff on return, ambient margin updates        |
| Phase 4: Agent evolution                        | **NOT DONE**                                                                    | Full implementation needed                                                                                                  |
| Phase 5: Pre-computation pipeline               | **NOT DONE**                                                                    | Full implementation needed                                                                                                  |
| Phase 6: Mobile + polish                        | **NOT DONE** (also not done in predecessor build)                               | Full implementation needed                                                                                                  |

---

## Plan Location

Full plan with all 6 phases, design philosophy, end-to-end lifecycle, and three-layer architecture:
Original private plan file (path omitted from the repo copy).

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

## Context Window Protocol

If your context window is filling up:

1. Commit all work to feature branch, push
2. Create PR if ready, or note branch name
3. Update THIS checkpoint: what you completed, what's in progress, new type signatures, gotchas
4. Commit checkpoint to main:
   ```bash
   cd <shared-repo-root>
   git pull origin main
   git add .claude/checkpoints/build-step-studio-excellence.md
   git commit -m "checkpoint: studio excellence phase N progress"
   git push origin main
   ```
5. Include "Next Agent Prompt" section below with full context

---

## Phase 5 Complete (2026-03-29)

### What shipped:

**PR #729 — Pre-Computation Pipeline (Backend)**

- Migration 070: `proposal_intelligence_cache`, `reviewer_briefing_cache`, `review_sessions` tables
- Feature flags: `intelligence_precompute`, `batch_review_mode`, `passage_prediction` (all enabled)
- Passage prediction model: `lib/passagePrediction.ts` — rules-based, CIP-1694 thresholds, 8 weighted factors
- Shared AI functions: `lib/ai/shared/constitutionalAnalysis.ts`, `lib/ai/shared/researchPrecedent.ts`
- Inngest: `precompute-proposal-intelligence` (4h + on-demand), `update-passage-predictions` (after vote sync)
- APIs: `GET /api/workspace/intelligence-cache`, `GET/POST /api/workspace/reviewer-cache`
- Fixed engagement analytics API (real queries vs TODO placeholder)

**PR #732 — Cache-First Intelligence + Passage Prediction UI**

- `hooks/useIntelligenceCache.ts`, `hooks/useReviewerCache.ts` — TanStack Query wrappers
- `components/intelligence/sections/PassagePrediction.tsx` — probability gauge with factor breakdown
- `ConstitutionalSection` + `KeyQuestionsSection` — serve from cache, skip AI calls
- `ReviewIntelBrief` — orchestrates cache loading, tracks cache hit/miss analytics
- Added `passage-prediction` to section registry (`lib/workspace/intelligence/registry.ts` + `types.ts`)

**PR #733 — Batch Review UX**

- `]` keyboard shortcut in `useRegisterReviewCommands.ts` — next unreviewed (wraps around)
- `components/workspace/review/BatchProgressBar.tsx` — progress + time estimate
- `hooks/useReviewSession.ts` — session tracking + sendBeacon persistence
- `app/api/workspace/review-session/route.ts` — session persistence endpoint
- Wired into `ReviewWorkspace.tsx` — goNextUnreviewed callback, markReviewed on vote success

### Key decisions:

- Shared sections (constitutional, key questions) pre-computed in background; personalized briefing cached after first view (write-through)
- Passage prediction is deterministic (no AI) — uses CIP-1694 governance thresholds per proposal type
- `]` is "next unreviewed" distinct from `j` which is "next in list"
- `review_sessions` table has UNIQUE on `(voter_id, started_at)` for upsert support

---

## Phase 6 Complete (2026-03-29)

### What shipped:

**PR #737 — Phase 6A: Mobile UX, Keyboard Shortcuts, Role Adaptation**

- `hooks/useRegisterEditorCommands.ts` (NEW) — 5 author shortcuts: s (save version), c (constitutional check), d (diff mode), r (respond to review), p (CIP-108 preview)
- `[` shortcut added to `useRegisterReviewCommands.ts` — previous unreviewed (mirrors `]` but backward)
- `components/workspace/review/MobileVoteBar.tsx` (NEW) — persistent bottom vote bar replacing FAB
- TypeSpecificFields: collapsible on mobile with summary preview
- Mobile padding optimization (px-4/py-4 mobile, px-6/py-6 desktop)
- `components/intelligence/sections/NetworkImpactSection.tsx` (NEW) — SPO-specific network impact for ParameterChange/HardFork proposals
- Role-adaptive section ordering in `getReviewSections()` — SPOs see network impact after executive summary
- `components/ui/collapsible.tsx` (NEW) — shadcn collapsible primitive wrapper

**PR #739 — Phase 6B: Motion, Spring Physics, Compass Typography**

- 4 CSS keyframe animations in globals.css: diff-accept, diff-reject, vote-celebrate, slide-up-enter
- Animation utility classes: `.animate-diff-accept`, `.animate-diff-reject`, `.animate-vote-celebrate`, `.animate-slide-up-enter`
- DecisionPanel: vote button spring bounce on selection, Fraunces heading
- StudioPanel: spring-eased open/close with `--ease-out-spring` + `--duration-enter` tokens
- SectionBlock: Fraunces display font for section labels
- StudioHeader: Fraunces display font for proposal title
- MobileVoteBar: slide-up entrance animation
- All animations wrapped in `@media (prefers-reduced-motion: no-preference)`

### Build status: ALL 6 PHASES COMPLETE

The Studio Excellence build is fully deployed. 11 PRs total across 6 phases.

---

## Next Agent Prompt

```
You are building Phase 6 of the Studio Excellence build for Governada — Polish, Mobile, and Role Adaptation.

## FIRST: Read the checkpoint

The checkpoint is on main. From your worktree:

  git fetch origin main
  HASH=$(git rev-parse origin/main) && git cat-file -p "$HASH:.claude/checkpoints/build-step-studio-excellence.md"

## THEN: Read the full 6-phase plan

Read the original private plan file if it is still available locally. The exact path is intentionally omitted from the repo copy.

Phase 6 starts at line ~328 ("Phase 6: Polish, Mobile, and Role Adaptation").

## What's Already Deployed (DON'T REBUILD)

Phase 1 (PR #700): Tiptap wired to all proposal types
Phase 2 (PR #704): Stage-driven Intelligence Brief in both studios
Phase 3 (PR #708): Living document substrate — suggestion resolution, version diff
Phase 4A (PR #715): Proposal Plan generator + rationale co-draft skills
Phase 4B (PR #717): Personalized briefing + feedback synthesis + CC express lane
Phase 4C (PR #721): Proactive insight stack with AI analysis
Phase 5A (PR #729): Pre-computation pipeline + passage prediction model
Phase 5B (PR #732): Cache-first intelligence sections + PassagePrediction UI
Phase 5C (PR #733): Batch review UX (] shortcut, progress bar, session tracking)

## Phase 6 Scope

This is the final polish phase. Scope from the plan:

1. **Mobile author studio**: Editor in single-column, Intelligence Brief as bottom sheet. Type-specific fields in collapsible section. Full Tiptap mobile support.
2. **Mobile review studio**: Brief as primary view, swipe to reveal full proposal. Decision Panel as fixed bottom bar. Annotation via long-press.
3. **Role adaptation polish**: Fine-tune brief sections per persona segment. SPO-specific network impact section. Community reviewer feedback rubric.
4. **Compass design language**: Enforce Fraunces/Space Grotesk typography, color tokens, spacing tokens, Governance Rings integration.
5. **Motion**: Smooth transitions between lifecycle stages. Tracked change accept/reject micro-animations. Decision Panel spring physics.
6. **Keyboard mastery**: Complete shortcut coverage — s (save version), c (constitutional check), p (CIP-108 preview), r (respond to review), d (diff mode), [ (previous unreviewed). Note: y/n/a (vote) and ] (next unreviewed) already shipped in Phase 5C.

## CRITICAL: Plan FIRST, then build

Use EnterPlanMode immediately after reading the checkpoint and plan. This phase touches many surfaces (mobile layouts, design language, animations). Plan the chunking carefully — likely 2-3 PRs.

Key files to explore:
- `components/workspace/review/ReviewWorkspace.tsx` — review layout to make responsive
- `app/workspace/editor/[draftId]/page.tsx` — author layout to make responsive
- `docs/strategy/design-language.md` — Compass design language spec
- `app/globals.css` — existing design tokens
- `hooks/useRegisterReviewCommands.ts` — add remaining keyboard shortcuts
- `components/studio/StudioPanel.tsx` — panel behavior on mobile

After plan approval, chunk into 2-3 shippable PRs and execute the full deploy pipeline per CLAUDE.md.
```
