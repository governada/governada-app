# Work Plan: Governance Proposal Workspace

> **Spec**: `docs/strategy/specs/governance-workspace.md`
> **Created**: 2026-03-17
> **Execution model**: Phase 0 sequential → Phases 1A-1D parallel → Phase 2 integration → Phase 3 review → Phase 4 ship

---

## Execution Principles

1. **Phase 0 runs first and alone.** It produces the shared foundation (types, tables, Tiptap shell, layout) that all parallel agents depend on.
2. **Phase 1 agents own disjoint file sets.** No two agents modify the same file. Interfaces are defined in Phase 0 types.
3. **Phase 2 wires everything together.** A single integration pass connects the parallel outputs and resolves any interface mismatches.
4. **Phase 3 is a thorough review.** Spec compliance, UX walkthrough, gap analysis, opportunity scan — before any shipping.
5. **Phase 4 is autonomous deploy.** Preflight, commit, push, CI, merge, deploy, verify.

---

## Interface Contracts

> These types are created in Phase 0 and consumed by all Phase 1 agents. They define the boundaries between systems.

### Contract A: Editor ↔ Agent Communication

```typescript
// lib/workspace/editor/types.ts

/** Editor sends this to the agent endpoint with every message */
export interface EditorContext {
  selectedText?: string;
  cursorSection?: 'title' | 'abstract' | 'motivation' | 'rationale';
  currentContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  mode: 'edit' | 'review' | 'diff';
}

/** Agent proposes this edit — editor renders as inline diff */
export interface ProposedEdit {
  field: 'title' | 'abstract' | 'motivation' | 'rationale';
  anchorStart: number; // character offset in field
  anchorEnd: number;
  originalText: string;
  proposedText: string;
  explanation: string;
}

/** Agent proposes this comment — editor renders at anchor point */
export interface ProposedComment {
  field: 'abstract' | 'motivation' | 'rationale';
  anchorStart: number;
  anchorEnd: number;
  anchorText: string;
  commentText: string;
  category: 'note' | 'concern' | 'question' | 'suggestion';
}
```

### Contract B: Agent Endpoint Request/Response

```typescript
// lib/workspace/agent/types.ts

/** Client → Server */
export interface AgentRequest {
  proposalId: string; // draft ID or txHash
  conversationId: string;
  message: string;
  editorContext?: EditorContext;
  userRole: 'proposer' | 'reviewer' | 'cc_member';
}

/** Server → Client (SSE event types) */
export type AgentSSEEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call'; toolName: string; status: 'started' | 'completed' }
  | { type: 'edit_proposal'; edit: ProposedEdit }
  | { type: 'draft_comment'; comment: ProposedComment }
  | { type: 'tool_result'; toolName: string; summary: string; data: unknown }
  | { type: 'done' };
```

### Contract C: Governance Context Bundle

```typescript
// lib/workspace/agent/context.ts

export interface GovernanceContextBundle {
  proposal: {
    id: string;
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
    proposalType: string;
    status: string;
    metadata: Record<string, unknown>;
  };
  versions: Array<{
    versionNumber: number;
    versionName: string;
    createdAt: string;
    changeJustifications?: ChangeJustification[];
  }>;
  constitution: {
    relevantArticles: Array<{ article: string; section?: string; text: string }>;
  };
  voting: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
    deadline?: string;
    epochsRemaining?: number;
  };
  community: {
    themes: FeedbackTheme[];
    totalReviewers: number;
    totalAnnotations: number;
  };
  treasury?: {
    balance: number;
    recentWithdrawals: number;
    tier: string;
  };
  precedent: Array<{
    id: string;
    title: string;
    outcome: string;
    similarity: number;
  }>;
  personal: {
    role: string;
    alignment: Record<string, number>;
    recentVotes: Array<{ proposalTitle: string; vote: string }>;
    philosophy?: string;
  };
}
```

### Contract D: Feedback Theme Structure

```typescript
// lib/workspace/feedback/types.ts

export interface FeedbackTheme {
  id: string;
  summary: string;
  category: 'concern' | 'support' | 'question' | 'suggestion';
  endorsementCount: number;
  keyVoices: Array<{ reviewerId: string; text: string; timestamp: string }>;
  novelContributions: Array<{ reviewerId: string; text: string; timestamp: string }>;
  addressedStatus: 'open' | 'addressed' | 'deferred' | 'dismissed';
  addressedReason?: string;
  linkedAnnotationIds: string[];
}

export interface ThemeEndorsement {
  themeId: string;
  reviewerUserId: string;
  additionalContext?: string;
  isNovel: boolean;
}
```

### Contract E: Revision System Types

```typescript
// lib/workspace/revision/types.ts

export interface ChangeJustification {
  field: 'title' | 'abstract' | 'motivation' | 'rationale';
  justification: string;
  linkedThemeId?: string;
}

export interface RevisionNotification {
  id: string;
  proposalId: string;
  versionNumber: number;
  recipientUserId: string;
  recipientType: 'commenter' | 'voter' | 'endorser';
  sectionsChanged: string[];
  themesAddressed: string[];
  readAt: string | null;
  createdAt: string;
}

export interface RevisionReviewState {
  totalChanges: number;
  reviewedChanges: number;
  perField: Record<string, 'pending' | 'approved' | 'flagged'>;
}
```

---

## Phase 0: Foundation (Sequential)

> Must complete before any Phase 1 agent starts. Sets up shared types, database tables, Tiptap shell, and workspace layout.

### Chunk 0A: Database Migrations

**Priority**: P0 | **Effort**: M | **Depends on**: None | **PR group**: A

**Scope**:

- Create `proposal_feedback_themes` table
- Create `proposal_theme_endorsements` table
- Create `agent_conversations` table
- Create `proposal_revision_notifications` table
- Add `change_justifications` JSONB column to `proposal_draft_versions`
- Run `gen:types` to update TypeScript database types

**File ownership**: Supabase MCP migrations, `types/database.ts`

**Verification**: All tables exist, `gen:types` produces updated types, no RLS issues.

### Chunk 0B: Shared Types & Interface Contracts

**Priority**: P0 | **Effort**: M | **Depends on**: 0A | **PR group**: A

**Scope**:

- Create `lib/workspace/editor/types.ts` (Contract A)
- Create `lib/workspace/agent/types.ts` (Contract B)
- Create `lib/workspace/agent/context.ts` — type + stub for `assembleGovernanceContext()` (Contract C)
- Create `lib/workspace/feedback/types.ts` (Contract D)
- Create `lib/workspace/revision/types.ts` (Contract E)
- Add feature flag: `governance_workspace_v2`

**File ownership**: `lib/workspace/editor/`, `lib/workspace/agent/`, `lib/workspace/feedback/`, `lib/workspace/revision/`

**Verification**: All types importable, no circular dependencies, flag exists in DB.

### Chunk 0C: Tiptap Setup + Workspace Layout Shell

**Priority**: P0 | **Effort**: L | **Depends on**: 0B | **PR group**: A

**Scope**:

- Install Tiptap packages: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-character-count`
- Create `components/workspace/editor/ProposalEditor.tsx` — basic Tiptap instance with StarterKit, 4 section blocks (title, abstract, motivation, rationale), auto-save on blur, loads content from `ProposalDraft`
- Create `components/workspace/layout/WorkspaceLayout.tsx` — resizable two-panel layout (editor left, placeholder right) using Radix primitives
- Create `components/workspace/layout/WorkspaceToolbar.tsx` — mode switcher (Edit | Review | Diff), version selector dropdown, back button
- Create `components/workspace/layout/StatusBar.tsx` — static placeholder indicators
- Create route: `app/workspace/editor/[draftId]/page.tsx` — feature-flagged, loads draft data, renders WorkspaceLayout + ProposalEditor
- Verify: can open a draft in the new editor, type, save

**File ownership**: `components/workspace/editor/ProposalEditor.tsx`, `components/workspace/layout/`, `app/workspace/editor/`

**Verification**: Draft loads in Tiptap editor, typing works, blur triggers save, layout is resizable, mode switcher renders.

**Files to read first**: `components/workspace/author/DraftForm.tsx` (current save pattern), `hooks/useDrafts.ts` (mutation hooks), `app/workspace/author/[draftId]/page.tsx` (current route pattern)

---

## Phase 1: Parallel Execution (4 agents, independent file sets)

### Chunk 1A: Editor Extensions

**Priority**: P0 | **Effort**: XL | **Depends on**: Phase 0 | **PR group**: B
**Agent assignment**: Editor specialist

**Scope**:

- `components/workspace/editor/SectionBlock.tsx` — custom Tiptap node: labeled sections with metadata header (section name, char count, health badge slot)
- `components/workspace/editor/AIDiffMark.tsx` — custom Tiptap mark: renders green/red inline diff with accept (Tab) / reject (Escape) actions. Uses `ProposedEdit` type from Contract A.
- `components/workspace/editor/AICompletionDecoration.tsx` — ProseMirror decoration plugin: renders ghost text after cursor, Tab to accept
- `components/workspace/editor/SlashCommandMenu.tsx` — slash command dropdown (/improve, /check-constitution, /similar-proposals, /complete, /draft). Triggers agent tool calls via callback.
- `components/workspace/editor/CommandBar.tsx` — Cmd+K overlay: inline text input for free-form AI instructions. On submit, sends to agent with selected text context.
- `components/workspace/editor/InlineComment.tsx` — custom Tiptap mark: text-anchored comments with popover (author, timestamp, category, text). Click to expand. Different colors for own vs others.
- `components/workspace/editor/MarginDecorations.tsx` — ProseMirror decoration plugin: left gutter (constitutional risk dots), right gutter (annotation count badges)
- `components/workspace/editor/VersionDiffView.tsx` — renders word-level diffs inline using existing `wordDiff.ts`. Consumes two `DraftContent` objects, renders as read-only editor with diff marks.
- Update `ProposalEditor.tsx` to register all extensions

**File ownership**: `components/workspace/editor/*` (all files except ProposalEditor.tsx which was created in Phase 0 — this agent EXTENDS it)

**Decision points**: None — execute per spec.

**Verification**:

- Type in section blocks, see char count update
- Select text → Cmd+K → type instruction → see callback fire (agent not connected yet, just the UI)
- Type `/` → see slash command menu
- Programmatically inject a `ProposedEdit` → see inline green/red diff → press Tab → text updates
- Programmatically inject an `InlineComment` → see comment mark → click → popover shows
- Toggle to Diff mode → see word-level changes between two version snapshots

**Files to read first**: Tiptap extension docs, `lib/workspace/wordDiff.ts`, `components/workspace/review/AnnotatableText.tsx` (existing annotation patterns)

---

### Chunk 1B: Agent Backend

**Priority**: P0 | **Effort**: XL | **Depends on**: Phase 0 | **PR group**: C
**Agent assignment**: Backend specialist

**Scope**:

- `lib/workspace/agent/context.ts` — implement `assembleGovernanceContext(proposalId, userId)`: fetches proposal, versions, constitutional articles, voting data, community themes, treasury state, precedent, personal profile. Caches with 60s TTL. Returns `GovernanceContextBundle`.
- `lib/workspace/agent/tools.ts` — define Claude tool_use tool definitions for all 11 agent tools (edit_proposal, draft_comment, check_constitution, search_precedent, get_voting_data, get_community_feedback, get_treasury_context, get_proposal_health, compare_versions, get_revision_context, draft_justification). Each tool implementation calls existing data functions or AI skills.
- `lib/workspace/agent/system-prompt.ts` — build system prompt from GovernanceContextBundle. Includes: role-specific instructions (proposer vs reviewer vs CC), full proposal text, relevant constitutional articles, personal governance context. Respects constraints (no external sources, cite data, propose diffs not auto-edit).
- `app/api/workspace/agent/route.ts` — POST endpoint, streaming SSE response. Authenticates user, loads conversation history, assembles context, calls Claude messages API with tools and streaming, emits `AgentSSEEvent` types, persists conversation to `agent_conversations` table.
- `hooks/useAgent.ts` — client hook: manages SSE connection, parses events, exposes `{ sendMessage, messages, isStreaming, lastEdit, lastComment }`. Reconnects on error. Persists `conversationId` per proposal.

**File ownership**: `lib/workspace/agent/*`, `app/api/workspace/agent/`, `hooks/useAgent.ts`

**Decision points**: None — execute per spec.

**Verification**:

- Call `/api/workspace/agent` with a test message → receive streaming SSE events
- Agent responds with governance-aware text (references proposal content)
- Agent invokes tools when appropriate (e.g., "check constitution" triggers check_constitution tool)
- `edit_proposal` tool returns a `ProposedEdit` structure
- `draft_comment` tool returns a `ProposedComment` structure
- Conversation persisted to `agent_conversations` table
- Second request with same conversationId includes previous messages

**Files to read first**: `lib/ai/provider.ts` (existing AI provider), `lib/ai/context.ts` (existing personal context), `lib/ai/skills/*.ts` (existing skills to reuse as tool implementations), `lib/data.ts` (data fetching), `app/api/ai/skill/route.ts` (existing skill endpoint pattern)

---

### Chunk 1C: Feedback Consolidation Engine

**Priority**: P1 | **Effort**: L | **Depends on**: Phase 0 | **PR group**: D
**Agent assignment**: Backend/AI specialist

**Scope**:

- `lib/workspace/feedback/consolidation.ts` — core logic: `consolidateFeedback(proposalTxHash, proposalIndex)`. Fetches all public annotations, clusters by semantic similarity (using Claude classification — send all annotations, ask for theme grouping), generates summaries, identifies key voices, computes endorsement counts. Upserts to `proposal_feedback_themes`.
- `lib/workspace/feedback/novelty.ts` — `classifyNovelty(newAnnotation, existingThemes)`: determines if a new annotation is novel or overlaps an existing theme. Returns `{ isNovel: boolean, overlappingThemeId?: string, confidence: number }`.
- `inngest/functions/consolidate-feedback.ts` — Inngest function triggered on annotation creation (debounced 30s). Calls `consolidateFeedback()`.
- `app/api/workspace/feedback/route.ts` — GET: returns consolidated themes for a proposal. POST `/endorse`: adds endorsement. POST `/address`: proposer addresses a theme.
- `hooks/useFeedbackThemes.ts` — client hook: fetches themes, exposes endorse/address mutations.
- `components/workspace/feedback/FeedbackStream.tsx` — renders consolidated themes list with endorsement counts, key voices, proposer actions (Address/Defer/Dismiss).
- `components/workspace/feedback/FeedbackTheme.tsx` — single theme card with expand/collapse, endorsement button, novel contribution sub-thread.
- `components/workspace/feedback/EndorsementPrompt.tsx` — shown when reviewer's annotation overlaps existing theme: "Similar to existing feedback — endorse?"
- `components/workspace/feedback/SealedOverlay.tsx` — shown during sealed period: "Community feedback hidden. Form your own opinion first."

**File ownership**: `lib/workspace/feedback/*`, `inngest/functions/consolidate-feedback.ts`, `app/api/workspace/feedback/`, `hooks/useFeedbackThemes.ts`, `components/workspace/feedback/*`

**Decision points**: None — execute per spec.

**Verification**:

- Create 10+ test annotations on a proposal → Inngest function fires → themes table populated with 2-3 clusters
- GET `/api/workspace/feedback?proposalTxHash=X` returns consolidated themes
- POST `/api/workspace/feedback/endorse` increments endorsement count
- FeedbackStream renders themes with correct counts
- EndorsementPrompt appears when overlap detected
- SealedOverlay hides themes during sealed period

**Files to read first**: `app/api/workspace/annotations/route.ts` (existing annotations), `hooks/useAnnotations.ts`, `lib/workspace/types.ts` (annotation types), `inngest/` (existing Inngest patterns)

---

### Chunk 1D: Revision System

**Priority**: P1 | **Effort**: L | **Depends on**: Phase 0 | **PR group**: E
**Agent assignment**: Full-stack specialist

**Scope**:

- `lib/workspace/revision/justifications.ts` — `computeChangedSections(oldVersion, newVersion)`: returns which fields changed + word-level diff summary per field. Uses `wordDiff.ts`.
- `lib/workspace/revision/notifications.ts` — `notifyReviewers(proposalId, versionNumber, changedFields, addressedThemes)`: queries for all users who previously commented/voted/endorsed on this proposal, creates `proposal_revision_notifications` rows.
- `app/api/workspace/revision/route.ts` — POST: proposer submits revision with justifications. Stores `change_justifications` on the new version, triggers reviewer notifications. GET: returns revision state for a proposal (changed sections, justifications, notification status).
- `app/api/workspace/revision/notifications/route.ts` — GET: returns unread revision notifications for current user. PATCH: marks as read.
- `hooks/useRevision.ts` — client hook: fetch revision state, submit justifications, mark notifications read.
- `hooks/useRevisionNotifications.ts` — client hook: fetch unread notifications, provides count for nav badge.
- `components/workspace/editor/RevisionJustificationFlow.tsx` — shown to proposer when saving a new version: per-section "Why did you change this?" prompt with AI draft assistance, theme linking.
- `components/workspace/editor/RevisionDiffView.tsx` — reviewer's revision review: inline word-level diffs with justification callouts, per-change [Approve] [Flag] actions, progress indicator.
- `components/workspace/editor/ChangeJustificationCallout.tsx` — small callout rendered in the gutter next to each diff block: shows proposer's justification + linked feedback theme.

**File ownership**: `lib/workspace/revision/*`, `app/api/workspace/revision/`, `hooks/useRevision.ts`, `hooks/useRevisionNotifications.ts`, `components/workspace/editor/RevisionJustificationFlow.tsx`, `components/workspace/editor/RevisionDiffView.tsx`, `components/workspace/editor/ChangeJustificationCallout.tsx`

**Decision points**: None — execute per spec.

**Verification**:

- Proposer saves new version → justification flow appears for changed sections
- Justification stored in `proposal_draft_versions.change_justifications`
- Reviewer notification created in DB
- Reviewer opens proposal → Diff mode auto-activates → word-level diffs visible with justification callouts
- Per-change Approve/Flag buttons work → progress indicator updates
- Unchanged sections collapsed by default

**Files to read first**: `lib/workspace/wordDiff.ts`, `hooks/useDrafts.ts` (version save flow), `app/api/workspace/drafts/[draftId]/version/route.ts` (version API), `lib/workspace/types.ts` (DraftVersion type)

---

## Phase 2: Integration (Sequential)

### Chunk 2A: Wire Editor ↔ Agent

**Priority**: P0 | **Effort**: L | **Depends on**: 1A, 1B | **PR group**: F

**Scope**:

- Build `components/workspace/agent/AgentChatPanel.tsx` — streaming chat UI, uses `useAgent` hook, renders messages with tool call indicators, renders `ProposedEdit` as "Apply to editor?" action.
- Update `ProposalEditor.tsx` — connect slash command callbacks to `useAgent.sendMessage()`, connect Cmd+K submit to agent, handle incoming `ProposedEdit` events by injecting AIDiff marks into the editor.
- Update `WorkspaceLayout.tsx` — render AgentChatPanel in right panel, connect to shared proposal state.
- Update `StatusBar.tsx` — wire to live data (constitutional status from agent context, completeness from proposal health, community counts from feedback).

**File ownership**: `components/workspace/agent/AgentChatPanel.tsx`, updates to `ProposalEditor.tsx`, `WorkspaceLayout.tsx`, `StatusBar.tsx`

**Verification**: Full end-to-end: type in editor → Cmd+K → agent responds → proposed edit appears inline → Tab to accept → text changes → status bar updates.

### Chunk 2B: Wire Feedback + Revision into Workspace

**Priority**: P0 | **Effort**: M | **Depends on**: 1C, 1D, 2A | **PR group**: F

**Scope**:

- Integrate FeedbackStream into the workspace layout (proposer view: in chat panel or dedicated tab)
- Integrate EndorsementPrompt into reviewer annotation flow
- Connect revision notifications to workspace entry (auto-open Diff mode)
- Wire RevisionJustificationFlow into the version save flow in the editor
- Wire RevisionDiffView as the Diff mode renderer when revision pending
- Integrate sealed overlay with the feedback visibility system

**File ownership**: Integration code in layout/editor components (modifications to Phase 1 outputs)

**Verification**: Full Journey B (proposer addresses feedback) and Journey F (reviewer reviews revision) work end-to-end.

---

## Phase 3: Post-Execution Review

> Before shipping. A thorough review pass that catches gaps and identifies polish opportunities.

### 3A: Spec Compliance Walkthrough

Walk through **every user journey (A-F)** step by step. For each numbered step, verify:

- Is it implemented?
- Does it work as described?
- Is the UX acceptable (not just functional but GOOD)?

Document any gaps as P0 (blocks launch) or P1 (follow-up).

### 3B: UX Refinement Pass

Open the workspace and use it as each persona:

- **Proposer**: create a new proposal from scratch using the agent
- **Reviewer**: review a proposal with annotations, use Cmd+K to ask questions
- **Revision reviewer**: review a revised proposal in Diff mode

Note anything that feels clunky, slow, confusing, or ugly. Fix the top 5 issues before shipping.

### 3C: High-Impact Opportunity Scan

After seeing the built product, identify 3-5 "quick wins" that weren't in the spec but would significantly improve the experience. Evaluate each for effort vs impact. Build only those that are S or M effort and high impact.

### 3D: Regression Check

Verify existing workspace features still work:

- Existing annotation system (until fully migrated)
- Voting flow
- Version history
- On-chain submission
- Feature flags (all new features behind `governance_workspace_v2`)

### 3E: Preflight

`npm run preflight` — all tests, lint, types, format must pass.

---

## Phase 4: Autonomous Ship

Use the canonical governed ship path from `AGENTS.md` and `.agents/skills/ship/SKILL.md`.

1. Run relevant local verification, including `npm run agent:validate`.
2. Stage files and commit with a conventional message.
3. Publish through `npm run github:ship`.
4. Create/update/ready the PR through `npm run github:pr-write`.
5. Poll CI with `npm run ci:watch` until green; fix failures and republish through `github:ship`.
6. Run `npm run pre-merge-check -- <PR#>`.
7. Run `npm run github:merge-doctor -- --pr <PR#> --expected-head <sha>`.
8. Pause for Tim's exact `github.merge` chat approval.
9. Merge only through `npm run github:merge`.
10. Let the merge wrapper complete synchronous production deploy verification.
11. Apply migrations, Inngest registration, production flag changes, or Railway deploy mutations only through explicit approval gates.
12. Clean up branches/worktrees after `npm run session:guard` is clean.

---

## File Ownership Map (Conflict Prevention)

| Agent               | Owns (creates/modifies)                                                                                                                                                                       | Does NOT touch                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Phase 0**         | `lib/workspace/*/types.ts`, `components/workspace/layout/*`, `components/workspace/editor/ProposalEditor.tsx` (shell), migrations, feature flag                                               | Everything else                                                                               |
| **1A: Editor**      | `components/workspace/editor/*` (all extensions)                                                                                                                                              | `lib/`, `app/api/`, `hooks/`, `components/workspace/agent/`, `components/workspace/feedback/` |
| **1B: Agent**       | `lib/workspace/agent/*`, `app/api/workspace/agent/`, `hooks/useAgent.ts`                                                                                                                      | `components/workspace/editor/`, `components/workspace/feedback/`, `inngest/`                  |
| **1C: Feedback**    | `lib/workspace/feedback/*`, `inngest/functions/consolidate-feedback.ts`, `app/api/workspace/feedback/`, `hooks/useFeedbackThemes.ts`, `components/workspace/feedback/*`                       | `components/workspace/editor/`, `lib/workspace/agent/`                                        |
| **1D: Revision**    | `lib/workspace/revision/*`, `app/api/workspace/revision/`, `hooks/useRevision*.ts`, `components/workspace/editor/Revision*.tsx`, `components/workspace/editor/ChangeJustificationCallout.tsx` | `lib/workspace/agent/`, `components/workspace/feedback/`, `inngest/`                          |
| **2A: Integration** | `components/workspace/agent/AgentChatPanel.tsx`, modifications to layout + editor + status bar                                                                                                | Creates new files only; modifies Phase 0/1 outputs minimally                                  |
| **2B: Integration** | Modifications to connect feedback + revision into workspace                                                                                                                                   | Same principle                                                                                |

---

## Complexity Estimates

| Chunk                 | Est. Lines  | Est. Time     | Agent Model |
| --------------------- | ----------- | ------------- | ----------- |
| 0A: Migrations        | ~50 SQL     | 30 min        | Sonnet      |
| 0B: Shared Types      | ~200 TS     | 30 min        | Sonnet      |
| 0C: Tiptap Shell      | ~400 TSX    | 2 hr          | Opus        |
| 1A: Editor Extensions | ~1500 TSX   | 4-6 hr        | Opus        |
| 1B: Agent Backend     | ~1200 TS    | 4-6 hr        | Opus        |
| 1C: Feedback Engine   | ~800 TS/TSX | 3-4 hr        | Opus        |
| 1D: Revision System   | ~700 TS/TSX | 3-4 hr        | Opus        |
| 2A: Wire Editor↔Agent | ~500 TSX    | 2-3 hr        | Opus        |
| 2B: Wire Feedback+Rev | ~300 TSX    | 1-2 hr        | Opus        |
| **Total**             | **~5650**   | **~20-25 hr** |             |

---

## Pre-Execution Checklist

Before launching Phase 0:

- [ ] Founder has approved the product spec (`governance-workspace.md`)
- [ ] Founder has approved this work plan
- [ ] Current `main` branch is stable (no in-flight PRs that could conflict)
- [ ] Supabase project is accessible for migrations
- [ ] Anthropic API key has sufficient quota for streaming agent endpoint development/testing
- [ ] Feature flag `governance_workspace_v2` strategy agreed (disabled by default, enabled for testing)
