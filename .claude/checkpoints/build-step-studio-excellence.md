# Build Step: Studio Excellence — World-Class Author & Review (Layer 2)

**Status:** PHASE_1_READY
**Started:** 2026-03-29
**Current Phase:** 1 of 6 (Editor Foundation)
**PR chain:** (none yet — this is a NEW build on top of the workspace-studio-upgrade work)
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
| Phase 1: Wire Tiptap to all proposals           | **NOT DONE** — DraftForm still uses textareas                                   | Full implementation needed                                                                                                  |
| Phase 2: Persistent Intelligence Brief          | **PARTIALLY DONE** — IntelligenceStrip + SenecaSummary + DecisionPanel deployed | Need: scrollable brief replacing tabbed sidebar, stage-driven transformation, Feedback Triage Board, role-adaptive ordering |
| Phase 3: Tracked changes + reviewer suggestions | **PARTIALLY DONE** — suggestion annotations, AIDiffMark extensions deployed     | Need: lifecycle-driven editor modes, author suggestion resolution UI, version diff on return, ambient margin updates        |
| Phase 4: Agent evolution                        | **NOT DONE**                                                                    | Full implementation needed                                                                                                  |
| Phase 5: Pre-computation pipeline               | **NOT DONE**                                                                    | Full implementation needed                                                                                                  |
| Phase 6: Mobile + polish                        | **NOT DONE** (also not done in predecessor build)                               | Full implementation needed                                                                                                  |

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

### Verification Checklist

- [ ] Create new InfoAction draft → Tiptap editor loads with 4 section blocks
- [ ] Type in each section → auto-save works ("Saved" indicator + DB verification)
- [ ] "/" → slash command menu with AI and content commands
- [ ] Cmd+K → command bar, instruction to agent, tracked change appears
- [ ] Tab accepts, Escape rejects AI diffs
- [ ] Treasury draft → type-specific fields render alongside editor
- [ ] community_review stage → editor is read-only
- [ ] response_revision stage → editor is editable
- [ ] Amendment draft → still routes to ConstitutionEditor (no regression)
- [ ] ScaffoldForm → generates content → loads into Tiptap (not textareas)
- [ ] QualityPulse still works with new editor
- [ ] Ambient constitutional check feeds margin indicators
- [ ] `npm run preflight` passes
- [ ] Mobile: editor usable on 375px (basic — full polish is Phase 6)

---

## Context Window Protocol

If your context window is filling up:

1. Commit all work to feature branch, push
2. Create PR if ready, or note branch name
3. Update THIS checkpoint: what you completed, what's in progress, new type signatures, gotchas
4. Commit checkpoint to main:
   ```bash
   # From main checkout (C:\Users\dalto\governada\governada-app):
   cd C:\Users\dalto\governada\governada-app
   git pull origin main
   # Copy updated checkpoint from worktree or edit directly
   git add .claude/checkpoints/build-step-studio-excellence.md
   git commit -m "checkpoint: studio excellence phase 1 progress"
   git push origin main
   ```
5. Include "Next Agent Prompt" section below with full context

---

## Next Agent Prompt

```
You are building Phase 1 of the Studio Excellence build for Governada — wiring the existing Tiptap rich editor to all standard proposal types.

FIRST: Read both checkpoint files. From your worktree run:
  git show main:.claude/checkpoints/build-step-studio-excellence.md
  git show main:.claude/checkpoints/workspace-studio-upgrade.md

THEN: Read the full 6-phase plan:
  cat "C:\Users\dalto\.claude-personal\plans\imperative-pondering-glade.md"

Phase 1 goal: Replace DraftForm.tsx textareas with ProposalEditor.tsx (Tiptap) for all standard proposal types. The Tiptap infrastructure is fully built — you're wiring it to the remaining 6 types.

CRITICAL: Other agents have already shipped significant workspace work (QualityPulse, DecisionPanel, DecisionTable, suggestion annotations, ambient constitutional check). The checkpoint documents exactly what exists. Read the current code before implementing to avoid duplication.

The checkpoint has: architecture decision, key type signatures, files to read, patterns to follow (ReviewWorkspace.tsx is your blueprint), verification checklist.

If you run low on context, follow the checkpoint protocol to hand off cleanly. Quality over speed — this is the foundation everything else builds on.
```
