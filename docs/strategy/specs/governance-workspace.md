# Product Specification: Governance Proposal Workspace

> **Status**: Draft — awaiting founder review
> **Created**: 2026-03-17
> **Context**: Replaces the form-based proposal authoring/review experience with a purpose-built document workspace powered by an embedded AI agent. Each proposal becomes a workspace. The AI has full governance context. The experience should feel like Cursor/Claude Code for governance.

---

## 1. Product Vision

### The Problem

Today's proposal workspace is a web form with sidebar panels. Authors fill in textareas. Reviewers read text and leave annotations. AI analysis lives in collapsible accordions that users must click to open. The experience feels like filling out a government form, not doing governance work.

### The Vision

Each governance proposal is a **document workspace** — a focused, professional environment where the proposal text is the center of everything. An embedded AI agent has the full context of the proposal, the Cardano Constitution, community feedback, voting data, and the user's governance perspective. The agent assists both proposers and reviewers, but the humans own the decisions.

The experience should feel like:

- **Notion's editor**: block-based, clean, keyboard-first, inline controls
- **Cursor/Claude Code's AI**: conversational agent that can read and modify the document, answer questions, run analysis
- **A legal document review platform**: structured annotations, tracked changes, formal revision history, accountability trails

### The Moat

No governance tool in any blockchain ecosystem has:

- AI-consolidated community feedback with endorsement and deduplication
- Sealed-then-reveal annotation model preventing groupthink
- Per-proposal agent with full governance context (constitution, treasury, precedent, community sentiment)
- Human+AI provenance tracking on every edit

---

## 2. User Journeys

### Journey A: Proposer Creates a New Proposal

1. Proposer opens workspace, selects proposal type (Treasury Withdrawal, Parameter Change, etc.)
2. Agent greets them with the proposal context: "You're creating a Treasury Withdrawal. I have the current treasury balance, similar past proposals, and relevant constitutional articles loaded. How would you like to start?"
3. Proposer can:
   - **Talk to the agent**: "I want to request 500K ADA for a documentation project" → agent drafts the proposal sections
   - **Write directly**: type in the editor, use slash commands for AI assistance
   - **Hybrid**: write some sections, ask the agent to improve or expand others
4. As they write, the status bar shows live indicators: constitutional compliance, completeness checklist, word count
5. Agent proactively surfaces guidance: "Your rationale doesn't address how success will be measured — this is commonly flagged by reviewers"
6. Proposer saves named versions. Diff mode shows what changed between versions (word-level, inline).

### Journey B: Proposer Addresses Community Feedback

1. Proposer returns to an existing proposal that's been in community review
2. The feedback panel shows AI-consolidated themes: "Budget Concerns (23 endorsements)", "Timeline Specificity (12 endorsements)", etc.
3. Each theme has a distilled summary + key representative voices + [Address] [Defer] [Dismiss with reason]
4. Proposer clicks "Address" on the budget theme → agent says "I can see 23 reviewers flagged the budget. The most common request is per-milestone cost breakdown. Want me to draft a budget table for the rationale section?"
5. Proposer confirms → agent proposes an edit as an inline diff in the editor → proposer accepts/modifies
6. Theme status updates to "Addressed" in the feedback panel. Reviewers who endorsed the theme can see it was addressed.

### Journey C: DRep Reviews a Proposal (First Visit — Sealed Mode)

1. DRep opens the proposal workspace in Review mode
2. **Sealed period active**: community annotations are hidden. DRep reviews independently.
3. DRep reads each section. The agent has full context pre-loaded.
4. DRep wants to flag a concern about the timeline. They can:
   - **Select text + inline comment**: highlight the vague timeline, type their concern (or ask the agent to draft it)
   - **Ask the agent**: "Is this timeline realistic compared to similar proposals?" → agent responds with precedent data in the chat panel
   - **Use a slash command**: `/check-constitution` on a specific passage
5. DRep leaves 3 annotations and asks the agent several questions about the treasury impact
6. Conversation and annotations are saved (private to this DRep, persisted across sessions)

### Journey D: DRep Reviews a Proposal (Post-Sealed — Community View)

1. Sealed period ends. DRep returns to the proposal.
2. Community feedback is now visible — the same consolidated themes the proposer sees.
3. DRep's own 3 annotations are highlighted in a distinct color.
4. The system detects one of their annotations semantically overlaps with an existing theme (Budget Concerns): "Your note about budget breakdown is similar to feedback from 23 other reviewers. Endorse the existing theme?"
5. DRep endorses (+1) and adds a specific detail: "Especially the 200K 'operations' line — compare to Proposal #231"
6. AI evaluates: this is a novel addition (references a specific comparison) → it gets surfaced under the theme as a named sub-contribution
7. DRep leaves one more novel comment that starts a new theme
8. DRep votes and drafts their rationale (agent assists with context-aware first draft)

### Journey E: CC Member Evaluates Constitutional Compliance

1. CC member opens the proposal workspace in Review mode
2. Status bar shows "Constitutional: 2 potential concerns"
3. CC member asks the agent: "Walk me through the constitutional analysis"
4. Agent presents article-by-article analysis, citing specific passages in the proposal and specific constitutional clauses
5. CC member annotates sections where they see conflicts
6. CC member votes with detailed rationale explaining their constitutional interpretation

### Journey F: DRep/SPO Reviews a Proposal Revision (The Killer Feature)

> **Context**: This journey addresses the exact failure mode experienced during the Cardano constitutional amendment process — where a revised document was submitted with no clean diff, no change justifications, and reviewers had to re-read the entire document while mentally tracking what existed before. This must never happen on Governada.

**The notification**:

1. Proposer submits a revision (new version after addressing community feedback)
2. Every reviewer who previously commented on or voted on this proposal receives a notification: "Proposal #347 has been revised — 3 sections changed, 2 of your feedback themes were addressed"
3. The notification links directly to the **Revision Review** mode of the workspace

**The revision review experience**: 4. DRep opens the workspace. It auto-enters **Diff Mode** (not Edit, not Review — Diff is the default when a revision is pending review) 5. The editor shows the revised document with **every change highlighted inline**:

- ~~Removed text~~ in red strikethrough
- <ins>Added text</ins> in green highlight
- Unchanged text renders normally
- This is word-level — not line-level, not section-level. Individual word changes are visible.

6. The toolbar shows: `Reviewing revision: v2 → v3 (submitted 2 hours ago)` with version dropdown to compare any two versions

**The change justification layer** (this is what makes it "holy shit"): 7. Each changed section has a **change justification** from the proposer — a brief note explaining WHY the text changed. These are written by the proposer (or AI-assisted) during the revision process.

- Example: next to the revised budget section: _"Revised per community feedback (23 endorsements): added per-milestone cost breakdown and reduced operations budget from 200K to 150K ADA"_
- Justifications are anchored to the specific diffs they explain
- If the proposer used "Address" on a feedback theme, the justification auto-links to that theme

8. The DRep can see: the diff + the justification + which feedback theme prompted the change + the original community concern — all in one view, without leaving the document

**The review-of-changes flow**: 9. For each changed section, the DRep can:

- **Approve the change**: "This addresses my concern" (one click)
- **Flag for further revision**: leave a new comment on the changed text specifically
- **Ask the agent**: "Is this new budget breakdown realistic compared to Proposal #231?" — agent has full context including the previous version

10. The status bar updates: "Revision: 3/5 changes reviewed" — the DRep knows exactly how much is left
11. Previously approved annotations/endorsements carry forward — the DRep doesn't re-review sections that didn't change
12. After reviewing all changes, the DRep can update their vote or rationale if the revision changed their position

**What this replaces**:

- Opening two tabs side by side
- Mentally tracking what changed
- Re-reading unchanged sections
- Having no context for why something changed
- Treating every revision as a fresh document

---

## 3. Interaction Model

### The Editor (Left Panel)

**Foundation**: Tiptap/ProseMirror with custom extensions

**Block-based editing** (proposer in Edit mode):

- Each section (title, abstract, motivation, rationale) is a labeled document block
- Standard text editing within blocks
- Slash commands (`/`) anywhere for:
  - `/improve` — AI improves selected text
  - `/check-constitution` — constitutional analysis of current section
  - `/similar-proposals` — find precedent
  - `/complete` — AI suggests what's missing from this section
  - `/draft` — AI drafts content from a prompt
- `Cmd+K` / `Ctrl+K` — inline AI command bar (like Cursor) for free-form instructions

**Inline AI commands** (the Cursor moment):

- Select text → `Cmd+K` → type instruction ("make this more specific", "add budget breakdown", "simplify")
- AI proposes edit as inline diff: ~~removed text~~ + <ins>added text</ins>
- `Tab` to accept, `Escape` to reject, `Cmd+Z` to undo
- Edit is applied in-place in the editor, not in a popover or dialog

**Track changes / Diff mode**:

- Toggle in toolbar: Edit | Review | Diff
- Diff mode shows word-level changes between any two versions
- Changes rendered inline (same green/red as the improve diffs)
- Version selector dropdown in toolbar: `v1 → v3` with any two versions selectable
- **Auto-activates** when a reviewer opens a proposal with a pending revision

**Revision mode** (proposer submitting a revision):

- When the proposer saves a new version after addressing feedback, a **revision justification flow** activates:
  - For each section that changed, the editor highlights the diffs and prompts: "Why did you change this?"
  - Proposer writes a brief justification (or asks the agent: "summarize why I changed the rationale" → agent drafts from the feedback theme they addressed)
  - If the edit was triggered by "Address" on a feedback theme, the justification auto-links to that theme
  - Justifications are stored in the version metadata: `proposal_draft_versions.change_justifications` (JSONB: `{ field: string, justification: string, linkedThemeId?: string }[]`)
- This ensures every change to a proposal has a recorded reason — the governance accountability trail

**Margin decorations**:

- Constitutional risk indicators per paragraph (colored dot in left gutter)
- Community annotation count per paragraph (badge in right gutter)
- Completeness indicators per section header
- **Change justification indicators** in Diff mode: small callout icon next to each diff block, hover/click to read the proposer's justification

**Review mode** (reviewers):

- Text is read-only (no direct editing)
- Select text to leave inline comments
- Agent drafts the comment — reviewer confirms/modifies/cancels
- Comments anchored to specific text ranges
- Cmd+K still works for queries: select text → "what does this mean for treasury reserves?"

**Revision review mode** (reviewers reviewing a revision):

- Default mode when reviewer opens a proposal with a pending revision
- Shows word-level inline diffs for all changed sections
- Change justifications visible next to each diff (proposer's explanation of why)
- Linked feedback themes visible (which community concern prompted the change)
- Per-change actions: [Approve] [Flag for further revision]
- Progress indicator: "3/5 changes reviewed"
- Unchanged sections collapsed by default (expandable) — focus on what changed
- Previous annotations/endorsements from this reviewer carry forward and remain visible
- After reviewing all changes: option to update vote/rationale or confirm existing position

### The Agent Chat (Right Panel)

**Foundation**: Streaming chat endpoint with Claude tool use

**Always present**, collapsible (drag divider or toggle button). Persists per user per proposal across sessions.

**Pre-loaded context** (the agent's "codebase"):

- Full proposal text + metadata
- Constitutional articles relevant to this proposal type
- Current voting data (DRep/SPO/CC tallies, voting power)
- Community feedback themes (consolidated, with endorsement counts)
- Similar past proposals and their outcomes
- Treasury state (balance, recent withdrawals, tier context)
- The user's governance profile (alignment, voting history, philosophy)
- The user's previous conversation with this agent (if returning)

**Agent capabilities** (tools):

| Tool                     | Input                                   | Output                                                   | Who           |
| ------------------------ | --------------------------------------- | -------------------------------------------------------- | ------------- |
| `edit_proposal`          | `{ field, instruction, selectedText? }` | `{ diff: InlineDiff }`                                   | Proposer only |
| `draft_comment`          | `{ anchorText, content, category }`     | `{ comment: InlineComment }`                             | Reviewer only |
| `check_constitution`     | `{ section?, fullProposal? }`           | `{ flags[], score, analysis }`                           | Both          |
| `search_precedent`       | `{ query }`                             | `{ proposals[], summary }`                               | Both          |
| `get_voting_data`        | `{}`                                    | `{ tallies, projections, deadline }`                     | Both          |
| `get_community_feedback` | `{}`                                    | `{ themes[], totalReviewers }`                           | Both          |
| `get_treasury_context`   | `{}`                                    | `{ balance, tier, recentHistory }`                       | Both          |
| `get_proposal_health`    | `{}`                                    | `{ completeness[], overallScore }`                       | Both          |
| `compare_versions`       | `{ oldVersion, newVersion }`            | `{ diffs: FieldDiff[] }`                                 | Both          |
| `get_revision_context`   | `{ versionNumber }`                     | `{ changedFields, justifications[], addressedThemes[] }` | Reviewer      |
| `draft_justification`    | `{ field, oldText, newText }`           | `{ justification: string }`                              | Proposer      |

**Agent constraints**:

- Only answers questions about the proposal and related governance data
- Cannot access external sources — all data comes from Governada's platform
- Cannot make edits without user approval (always proposes diffs, never auto-commits)
- Cites data sources (article numbers, proposal IDs, vote counts) — no unsupported claims
- Personalized to the user's governance perspective but presents multiple viewpoints
- Rate limited for cost management

**Conversation persistence**:

- Conversations stored per user per proposal in `agent_conversations` table
- Returning to a proposal resumes the conversation with full history
- Conversation is private (not visible to other reviewers or the proposer)
- Proposer and reviewers have separate conversation histories for the same proposal

### The Status Bar (Bottom)

Persistent footer showing live governance state.

For proposers:

```
[Constitutional: ✓ Pass | 2 info] [Completeness: 4/6] [Community: 47 reviewers, 3 themes] [Status: Draft] [Epoch 619]
```

For reviewers:

```
[Constitutional: ✓ Pass | 2 info] [Community: 47 reviewers, 3 themes] [Your review: 3 comments] [Your vote: Pending] [Deadline: 12 epochs]
```

Each indicator is clickable — opens relevant detail in the chat panel or a focused view.

---

## 4. Community Feedback Model

### The Consolidation Engine

**Input**: Raw inline comments from all reviewers on a proposal

**Process** (AI-powered, Inngest function triggered on annotation creation with 30s debounce):

1. Cluster annotations by semantic similarity
2. Generate distilled summary per cluster (the "theme")
3. Identify most representative/articulate comments as "key voices"
4. Detect when new comments are novel vs. restating existing themes
5. Compute endorsement counts per theme
6. Rank themes by endorsement count + recency

**Output**: Structured feedback stream with themes, summaries, endorsement counts, key voices, and novel additions

### Sealed-Then-Reveal Model

**During sealed period** (configurable per proposal, default: first 48 hours or until reviewer submits their first comment):

- Reviewer sees ONLY their own annotations
- No community feedback themes visible
- Agent cannot reveal what other reviewers have said

**After sealed period ends** (or after reviewer submits their first annotation):

- Community feedback themes become visible
- Reviewer's own annotations highlighted in distinct color
- System checks for overlap between reviewer's annotations and existing themes
- If overlap detected: prompt to endorse (+1) with optional additional context

### Endorsement Model

- One-click "+1" on any theme
- Optional: add context to your endorsement (free text)
- AI evaluates added context: if genuinely novel, surfaces as named sub-contribution under the theme. If redundant, counts as endorsement only (no visual noise)
- Every endorsement and novel contribution is timestamped with reviewer attribution

### Attribution & Transparency

**What reviewers see about other reviewers**:

- Theme endorsement counts (number only — "23 reviewers agree")
- Novel contributions show reviewer identifier + timestamp
- WHO endorsed is hidden until after the proposal is submitted on-chain (reduces groupthink)

**What proposers see**:

- Full endorsement counts with reviewer identifiers (accountability)
- Every individual comment that contributed to a theme (drill-down)
- Novel contributions with reviewer attribution

**What's always visible**:

- Your own annotations and endorsements
- Your own conversation with the agent

### Proposer's Feedback Flow

The proposer sees a consolidated feedback stream with actionable themes:

```
─── Community Feedback (47 reviewers) ───────────────

🔴 Budget Concerns (23 endorsements)
   "The 500K ADA request lacks a detailed breakdown.
   Reviewers want per-milestone cost allocation and
   justification for team compensation."

   Key voices:
   - Reviewer A (epoch 618): "The 200K for 'operations' needs specifics"
   - Reviewer B (epoch 618): "Compare to Proposal #231 — similar scope for 300K"

   [Address] [Defer] [Dismiss with reason]

🟡 Timeline Specificity (12 endorsements)
   "Timeline says 'Q3 2026' without milestone dates
   or deliverable checkpoints."

   [Address] [Defer] [Dismiss with reason]

🟢 Strong Support: Team Credentials (31 endorsements)
   "Team's track record on Proposal #189 cited as
   evidence of delivery capability."

   [Acknowledged]

💡 Novel Feedback (2 items, last 24h)
   - Reviewer C: "Consider partnering with the existing
     documentation working group to reduce scope overlap."
```

---

## 5. Information Architecture

### What Lives in the Editor

- The proposal document (title, abstract, motivation, rationale, references)
- Inline comments (anchored to text ranges)
- Margin decorations (constitutional indicators, annotation counts)
- Inline diffs (when AI proposes edits or in diff view mode)
- Type-specific fields rendered as structured blocks (treasury amount, parameter values)

### What Lives in the Chat Panel

- Agent conversation (queries, analysis, edit proposals)
- Slash command results that produce long-form output
- Precedent analysis, constitutional deep-dives, treasury context
- Proposer: feedback consolidation stream (addressable themes)

### What Lives in the Status Bar

- Constitutional compliance status
- Completeness checklist progress
- Community engagement summary (reviewer count, theme count)
- User's review/authoring status
- Proposal lifecycle stage + deadline
- Quick-access buttons to chat panel features

### What Gets Removed (from current implementation)

- ConstitutionalCheckPanel → agent capability
- ResearchAssistant sidebar → replaced by agent chat
- IntelligenceBlocks accordion → agent surfaces contextually + status bar
- ProposalNotes sidebar → write in the editor or tell the agent
- AuthorIntelligencePanel sidebar → agent + status bar
- ScaffoldForm → agent-guided first draft via conversation
- Separate version compare dialog → native diff mode in editor

### What Gets Kept / Evolved

- AnnotatableText selection + comment creation → evolves into Tiptap comment extension
- Annotation types (note, highlight, concern, citation) → become comment categories
- Word-level diff engine (`wordDiff.ts`) → used by editor diff mode
- AI skills (constitutional-check, section-analysis, text-improve, research-precedent) → become agent tools
- Feature flag system → gates workspace rollout
- Provenance tracking → every AI edit logged with model, tokens, edit distance
- Version system (proposal_draft_versions) → feeds diff mode

---

## 6. Technical Architecture

### Editor: Tiptap + Custom Extensions

**Core**: Tiptap v2 (ProseMirror wrapper)

| Extension                    | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| StarterKit                   | Basic formatting (bold, italic, headings, lists)      |
| Placeholder                  | Ghost text for empty blocks                           |
| CharacterCount               | Live character counts per section                     |
| Collaboration                | (Future) Real-time multi-user editing via Yjs         |
| **Custom: SectionBlock**     | Labeled document sections with metadata               |
| **Custom: InlineComment**    | Text-anchored comments with author/timestamp/category |
| **Custom: AIDiff**           | Inline diff marks (added/removed) with accept/reject  |
| **Custom: AICompletion**     | Ghost text completion suggestions                     |
| **Custom: SlashCommand**     | `/` menu for AI commands                              |
| **Custom: CommandBar**       | `Cmd+K` inline instruction input                      |
| **Custom: MarginDecoration** | Constitutional indicators + annotation counts         |

### Agent Backend: Streaming Tool-Use Endpoint

**Endpoint**: `POST /api/workspace/agent` (Server-Sent Events)

```typescript
// Request
{
  proposalId: string;           // draft ID or on-chain txHash+index
  conversationId: string;       // persistent conversation identifier
  message: string;              // user's message
  editorContext?: {              // current editor state (for context-aware responses)
    selectedText?: string;
    cursorSection?: string;
    currentContent?: { title, abstract, motivation, rationale };
  };
}

// Response: Server-Sent Events stream
// Event types:
//   text_delta      — streaming chat text
//   tool_call       — agent invoking a tool (show in chat as "Checking constitution...")
//   tool_result     — tool execution result (render inline)
//   edit_proposal   — proposed diff for the editor (rendered in-place)
//   draft_comment   — proposed inline comment (rendered at anchor point)
//   done            — stream complete
```

**Context Assembly** (per-request, cached with TTL):

```typescript
interface GovernanceContext {
  // Proposal
  proposal: { title; abstract; motivation; rationale; type; metadata };
  versions: DraftVersion[];

  // Constitutional
  constitution: { articles: ConstitutionalArticle[]; relevantArticles: string[] };

  // Community
  communityFeedback: ConsolidatedTheme[];
  annotationCount: number;
  reviewerCount: number;

  // Voting
  votingData: { drep: Tally; spo: Tally; cc: Tally; deadline: string };
  citizenSentiment: { support; oppose; abstain };

  // Treasury (for withdrawal proposals)
  treasuryState?: { balance; recentWithdrawals; tier };

  // Precedent
  similarProposals: { id; title; outcome; similarity }[];

  // Personal
  userProfile: { alignment; votingHistory; philosophy; role };

  // Conversation history
  previousMessages: Message[];
}
```

### Feedback Consolidation Engine

**Trigger**: Inngest function, debounced on annotation creation (30-second window)

**Process**:

1. Fetch all public annotations for the proposal
2. Classify and cluster by semantic similarity
3. For each cluster: generate summary, select key voices, count endorsements
4. Upsert to `proposal_feedback_themes` table
5. Detect overlap between new annotations and existing themes

**New database tables**:

```sql
-- Consolidated feedback themes
proposal_feedback_themes (
  id uuid PRIMARY KEY,
  proposal_tx_hash text,
  proposal_index integer,
  theme_summary text,
  theme_category text,          -- 'concern' | 'support' | 'question' | 'suggestion'
  endorsement_count integer,
  key_voices jsonb,
  novel_contributions jsonb,
  addressed_status text,        -- 'open' | 'addressed' | 'deferred' | 'dismissed'
  addressed_reason text,
  created_at timestamptz,
  updated_at timestamptz
)

-- Individual endorsements
proposal_theme_endorsements (
  id uuid PRIMARY KEY,
  theme_id uuid REFERENCES proposal_feedback_themes(id),
  reviewer_user_id uuid,
  additional_context text,
  is_novel boolean,
  created_at timestamptz
)

-- Agent conversations (persistent per user per proposal)
agent_conversations (
  id uuid PRIMARY KEY,
  proposal_id text,
  user_id uuid,
  messages jsonb,
  context_hash text,
  created_at timestamptz,
  updated_at timestamptz
)

-- Revision notifications (sent when proposer publishes a new version)
proposal_revision_notifications (
  id uuid PRIMARY KEY,
  proposal_tx_hash text,
  proposal_index integer,
  draft_id text,
  version_number integer,
  recipient_user_id uuid,           -- reviewer who previously interacted
  recipient_type text,              -- 'commenter' | 'voter' | 'endorser'
  sections_changed text[],          -- ['abstract', 'rationale']
  themes_addressed uuid[],          -- feedback themes the proposer addressed
  read_at timestamptz,              -- null until reviewer opens the revision
  created_at timestamptz
)
```

**Extended table: `proposal_draft_versions`** (existing, add column):

```sql
-- Add to existing proposal_draft_versions table
ALTER TABLE proposal_draft_versions
  ADD COLUMN change_justifications jsonb;
  -- Structure: [{ field: string, justification: string, linkedThemeId?: string }]
  -- Written by proposer during revision flow, anchored to each changed section
```

### Component Architecture

**Design system**: Radix primitives + custom workspace components

The workspace is a separate component tree — dense, focused, keyboard-driven.

```
components/workspace/
  editor/
    ProposalEditor.tsx              — Tiptap instance with all extensions
    SectionBlock.tsx                — Custom node: labeled proposal sections
    InlineComment.tsx               — Comment mark with popover
    AIDiffMark.tsx                  — Added/removed diff marks, accept/reject
    AICompletionDecoration.tsx      — Ghost text suggestions
    SlashCommandMenu.tsx            — Slash command dropdown
    CommandBar.tsx                  — Cmd+K inline instruction input
    MarginDecorations.tsx           — Gutter indicators (constitutional, annotations)
    EditorToolbar.tsx               — Mode switcher, version selector, formatting
    VersionDiffView.tsx             — Inline diff rendering mode
  agent/
    AgentChatPanel.tsx              — Chat interface with streaming SSE
    AgentMessage.tsx                — Single message (text, tool calls, diffs)
    AgentContextLoader.tsx          — Assembles governance context
    AgentToolResult.tsx             — Renders tool outputs inline in chat
  feedback/
    FeedbackStream.tsx              — Consolidated themes list
    FeedbackTheme.tsx               — Single theme with endorsement controls
    EndorsementPrompt.tsx           — "+1 or add novel feedback" prompt
    SealedOverlay.tsx               — Sealed period indicator
  layout/
    WorkspaceLayout.tsx             — Resizable panel layout (editor + chat + status)
    PanelDivider.tsx                — Drag handle for panel resizing
    StatusBar.tsx                   — Bottom governance state indicators
    WorkspaceToolbar.tsx            — Top toolbar (modes, versions, actions)
  shared/
    ProvenanceBadge.tsx             — AI provenance indicator (existing)
    SectionHealthBadge.tsx          — Constitutional/completeness dot (existing)
    WordDiffField.tsx               — Word-level diff rendering (existing)
```

### Panel Layout

```
┌─────────────────────────────────────────────────────────────┐
│  WorkspaceToolbar                                           │
│  [← Back] [Proposal Title] [Edit | Review | Diff] [v3 ▾]   │
├────────────────────────────┬────────────────────────────────┤
│                            │                                │
│  ProposalEditor            │  AgentChatPanel                │
│  (Tiptap/ProseMirror)     │  (Streaming, persistent)       │
│                            │                                │
│  ┌─ Abstract ────────────┐ │  Agent: I have this proposal   │
│  │ The Cardano ecosystem │ │  loaded with full context...   │
│  │ needs better docs...  │ │                                │
│  └───────────────────────┘ │  You: Is 500K reasonable for   │
│                            │  this scope?                   │
│  ┌─ Motivation ──────────┐ │                                │
│  │ Currently, developers │ │  Agent: Based on 3 similar     │
│  │ must rely on...    [!]│ │  proposals, the median ask     │
│  │                       │ │  was 320K ADA. Proposal #231   │
│  └───────────────────────┘ │  delivered similar scope for   │
│                            │  300K. [View details]          │
│  ┌─ Rationale ───────────┐ │                                │
│  │ This approach is...   │ │                                │
│  └───────────────────────┘ │  [Message input ⌘+Enter]       │
│                            │                                │
├────────────────────────────┴────────────────────────────────┤
│  [✓ Constitutional] [4/6 Complete] [47 reviewers, 3 themes] │
│  [Community Review] [12 epochs remaining]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Keyboard Shortcuts

| Shortcut           | Action                              | Context                     |
| ------------------ | ----------------------------------- | --------------------------- |
| `Cmd+K` / `Ctrl+K` | AI command bar (inline instruction) | Editor                      |
| `/`                | Slash command menu                  | Editor (start of block)     |
| `Tab`              | Accept AI suggestion / diff         | Editor (suggestion visible) |
| `Escape`           | Reject suggestion / close           | Global                      |
| `Cmd+D`            | Toggle diff mode                    | Global                      |
| `Cmd+Enter`        | Submit comment / send message       | Comment / Chat              |
| `Cmd+Shift+C`      | Toggle chat panel                   | Global                      |
| `Cmd+/`            | Toggle community feedback           | Review mode                 |
| `?`                | Keyboard shortcuts overlay          | Global                      |

---

## 8. Migration Plan

### Phase 1: Foundation (Editor + Layout)

- Set up Tiptap with SectionBlock, basic formatting
- Build WorkspaceLayout with resizable panels
- Build StatusBar with static indicators
- Replace DraftForm textareas with Tiptap editor
- Preserve existing auto-save behavior
- Feature-flag: `governance_workspace_v2`

### Phase 2: Agent Integration

- Build streaming agent endpoint (`/api/workspace/agent`)
- Assemble governance context from existing data functions
- Implement agent tools (reuse existing AI skills as tool implementations)
- Build AgentChatPanel with streaming UI
- Build conversation persistence (`agent_conversations` table)
- Connect Cmd+K and slash commands to agent

### Phase 3: Inline AI

- Build AIDiff extension (inline diff marks with accept/reject)
- Build AICompletion extension (ghost text)
- Build CommandBar extension (Cmd+K input)
- Build SlashCommandMenu extension
- Connect editor commands to agent tool calls

### Phase 4: Community Feedback

- Build feedback consolidation engine (Inngest function)
- Create `proposal_feedback_themes` + `proposal_theme_endorsements` tables
- Build FeedbackStream UI
- Implement sealed-then-reveal model
- Build endorsement + novelty detection
- Build proposer's feedback addressing flow

### Phase 5: Review Experience

- Build Review mode (read-only editor with comment creation)
- Agent-assisted comment drafting
- Community feedback visibility toggle

### Phase 6: Revision Review (The Killer Feature)

- Build Diff mode as default for pending revisions
- Build change justification flow for proposers (per-section "why did you change this?")
- Store justifications in `proposal_draft_versions.change_justifications`
- Build change justification rendering in Diff mode (callout icons next to diffs)
- Build per-change reviewer actions: [Approve] [Flag for further revision]
- Build revision progress indicator ("3/5 changes reviewed")
- Build revision notification system (`proposal_revision_notifications` table)
- Auto-collapse unchanged sections, focus on diffs
- Link justifications to addressed feedback themes
- Carry forward previous reviewer annotations/endorsements
- Vote/rationale update flow after revision review

### Phase 7: Polish & Teardown

- Remove redundant components
- Keyboard shortcuts + discoverability overlay
- Performance optimization (context caching, streaming)
- Mobile responsive layout
- Provenance tracking on all agent-generated content

---

## 9. Open Questions

1. **Real-time collaboration**: Should team members edit simultaneously? Tiptap supports this via Yjs. **Recommendation**: defer to post-launch.

2. **Agent model selection**: FAST for inline commands, capable for chat analysis. Adaptive based on query complexity.

3. **Cost management**: Rate limit per user per hour, cache context assemblies, track tokens in `ai_activity_log`.

4. **Offline support**: Defer to post-launch. Agent features require connectivity.

5. **Constitutional corpus maintenance**: Store in Supabase, update manually on ratification, version-track.

---

## 10. Success Metrics

**Adoption**:

- % of proposals created through the workspace (vs. external tools)
- Return rate: proposers who create a second proposal
- Time to first draft (conversation to complete first version)

**Quality**:

- Constitutional compliance rate of submitted proposals
- Completeness score at submission time
- Reviewer coverage (% of proposals with 5+ reviewers)

**Engagement**:

- Agent conversation length (questions per session)
- Feedback endorsement rate (% who +1 vs. create new)
- Novel feedback rate (% of comments that generate new themes)
- Edit acceptance rate for AI-proposed changes

**The Screenshot Test**:

- Are people sharing screenshots of the workspace on social media?
- Are other projects asking "how did you build this?"
