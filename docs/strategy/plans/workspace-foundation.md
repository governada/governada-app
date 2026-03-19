# Workspace Foundation: Linear + Cursor Architectural Primitives

> **Status:** Complete — all sessions shipped to production
> **Created:** 2026-03-18
> **Prerequisite for:** Proposal lifecycle management, Author portfolio view, Submission ceremony, Post-submission monitoring
> **Estimated effort:** 4-6 sessions across Tier 0-2 + content authoring track

---

## Why This Exists

The Author and Review workspaces are converging on a specific archetype: a keyboard-driven, panel-composed, real-time professional workspace with embedded AI — what you get when you cross Linear's workflow engine with Cursor's intelligent editing surface.

The editor layer (Tiptap + AI inline diffs + agent chat) is already at Cursor quality. What's missing is the Linear-grade workspace SHELL: centralized keyboard handling, composable persistent panels, unified command palette, optimistic mutations, and shared workspace state.

Building proposal lifecycle features (portfolio view, submission ceremony, team approval gates) on top of the current ad-hoc component structure means retrofitting every piece later. This plan establishes the architectural primitives first.

---

## Current State

### What's solid (don't touch)

- **Tiptap editor** with 6+ custom extensions (SectionBlock, AIDiffMark, InlineComment, SlashCommandMenu, CommandBar, AICompletion) — Cursor-quality editing
- **Agent chat panel** with SSE streaming, tool call indicators, inline diff injection
- **Design token system** — Compass palette, spacing scale, three density modes via ModeProvider
- **TanStack Query** for data fetching with optimistic update patterns in engagement components
- **shadcn/ui component library** — 29 components, consistent styling

### What needs work

| Area                   | Current                                                                | Target                                                            |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Panel layout**       | Custom drag resize in WorkspaceLayout.tsx, no persistence, no snap     | `react-resizable-panels` with `autoSaveId`, collapse/restore      |
| **Keyboard shortcuts** | Scattered addEventListener in 5+ components, no registry               | Centralized CommandRegistry with chord support, help overlay      |
| **Command palette**    | `cmdk` installed but unused. CommandBar is AI-only Cmd+K               | Unified palette: navigation + actions + search + AI               |
| **Workspace state**    | StudioProvider (React Context, per-session) + scattered useState       | Zustand store, URL-synced, localStorage-persisted                 |
| **Optimistic UI**      | Only in engagement components (CitizenEndorsements, ProposalSentiment) | Every workspace mutation: save, archive, stage transition, review |
| **Focus management**   | Basic escape handlers, no restoration                                  | Focus graph: trap, restore, keyboard indicators                   |

### Key dependency status

| Package                   | Installed  | Notes                                     |
| ------------------------- | ---------- | ----------------------------------------- |
| `cmdk`                    | ✓ v1.1.1   | In package.json, no component scaffolded  |
| `framer-motion`           | ✓ v12.36.0 | In package.json, barely used in workspace |
| `react-resizable-panels`  | ✗          | Need to add                               |
| `zustand`                 | ✗          | Need to add                               |
| `react-hotkeys-hook`      | ✗          | Need to add (or custom ~50 lines)         |
| `@tanstack/react-virtual` | ✗          | Tier 2, not blocking                      |

---

## Tier 0: Foundation Primitives

**Goal:** Establish the three core primitives everything else builds on. Must complete before any proposal lifecycle feature work.

### 0.1 — Workspace State Store (Zustand)

Replace scattered `useState` + `StudioProvider` Context with a single Zustand store.

**File:** `lib/workspace/store.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelId = 'agent' | 'intel' | 'notes' | 'vote' | 'reviews' | 'team';
type ViewMode = 'kanban' | 'list';
type FocusLevel = 0 | 1 | 2; // 0=normal, 1=panel hidden, 2=zen

interface WorkspaceState {
  // --- Active entity ---
  currentDraftId: string | null;
  currentProposalId: string | null;

  // --- Panel state ---
  sidebarCollapsed: boolean;
  contextPanel: PanelId | null; // null = closed
  focusLevel: FocusLevel;

  // --- Author dashboard ---
  authorViewMode: ViewMode;
  authorFilter: string; // search text

  // --- Review workspace ---
  reviewQueueIndex: number;

  // --- Actions ---
  setCurrentDraft: (id: string | null) => void;
  setCurrentProposal: (id: string | null) => void;
  toggleSidebar: () => void;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelId) => void;
  setFocusLevel: (level: FocusLevel) => void;
  setAuthorViewMode: (mode: ViewMode) => void;
  setAuthorFilter: (filter: string) => void;
  setReviewQueueIndex: (index: number) => void;
}
```

**Persistence:** Panel preferences (sidebarCollapsed, contextPanel, authorViewMode, focusLevel) persist to localStorage via Zustand `persist` middleware. Entity selection (currentDraftId, currentProposalId) syncs to URL searchParams via a `useSyncToURL` hook, NOT persisted to localStorage.

**Migration path:**

- `StudioProvider` → read from Zustand store. Keep the Context wrapper as a thin adapter initially for backwards compatibility, then remove once all consumers migrate.
- `WorkspaceLayout` panel state (chatCollapsed, chatWidth, queueExpanded) → Zustand store.
- `ReviewWorkspace` selectedIndex → `reviewQueueIndex` in store.
- `AuthorWorkspace` → `authorViewMode` and `authorFilter` from store.

**Acceptance criteria:**

- [ ] Panel open/closed state survives page refresh
- [ ] Deep-linking: `/workspace/author?draft=abc` opens that draft
- [ ] `useWorkspace()` hook available from any workspace component
- [ ] StudioProvider consumers still work during migration (thin adapter)

---

### 0.2 — Command Registry + Palette

Centralize all workspace actions into a single registry that powers the Cmd+K palette, keyboard shortcuts, and context menus.

**File:** `lib/workspace/commands.ts`

```typescript
interface Command {
  id: string; // e.g. 'navigate.author', 'draft.archive'
  label: string; // e.g. 'Go to Author', 'Archive Draft'
  shortcut?: string; // e.g. 'g a', 'mod+shift+c', 'a'
  icon?: React.ComponentType; // Lucide icon
  section: 'navigation' | 'actions' | 'ai' | 'view';
  when?: () => boolean; // Context predicate (e.g. only show 'Archive' when a draft is selected)
  execute: () => void;
}

interface CommandRegistry {
  register: (command: Command) => () => void; // returns unregister fn
  getAll: () => Command[];
  getBySection: (section: string) => Command[];
  execute: (id: string) => void;
}
```

**Component:** `components/ui/command-palette.tsx` (scaffolded from cmdk)

```
┌─────────────────────────────────────┐
│ 🔍  Type a command...          ⌘K   │
├─────────────────────────────────────┤
│ Navigation                          │
│   Go to Author               G A   │
│   Go to Review               G R   │
│   Go to Home                 G H   │
│                                     │
│ Actions                             │
│   New Proposal               N     │
│   Archive Draft              A     │
│   Duplicate Draft            D     │
│   Save Version              ⌘S     │
│                                     │
│ AI                                  │
│   Improve Selection         ⌘K     │
│   Constitutional Check       /check │
│   Find Similar Proposals     /sim   │
│                                     │
│ View                                │
│   Toggle Agent Panel     ⌘⇧C      │
│   Toggle Sidebar         ⌘B        │
│   Switch to Kanban           V K   │
│   Switch to List             V L   │
└─────────────────────────────────────┘
```

**Keyboard engine:** `lib/workspace/keyboard.ts`

```typescript
// Chord support: 'g a' means press G, then A within 500ms
// Modifier support: 'mod+shift+c' (mod = Cmd on Mac, Ctrl elsewhere)
// Single key: 'a', 'escape', 'j', 'k'
// Context-aware: skip when focus is in input/textarea/contentEditable

function createKeyboardEngine(registry: CommandRegistry): {
  attach: () => () => void; // returns cleanup fn
  isChording: boolean; // true during chord sequence
  pendingChord: string; // first key of an active chord
};
```

**Migration path:**

- `WorkspaceLayout` Cmd+Shift+C handler → register as command `view.toggle-agent`
- `useKeyboardShortcuts` (review workspace Y/N/A/S) → register as commands `review.vote-yes`, etc.
- `CommandBar` Cmd+K → becomes the AI section of the unified palette (Cmd+K opens palette, typing `/` filters to AI commands)
- `SlashCommandMenu` → register slash commands into the same registry, render in palette when triggered from editor

**Acceptance criteria:**

- [ ] Cmd+K opens unified palette from anywhere in workspace
- [ ] Keyboard shortcuts display next to every command (passive learning)
- [ ] `?` key opens a keyboard shortcut help overlay
- [ ] Chord navigation works: G+A goes to Author, G+R to Review, G+H to Home
- [ ] J/K list navigation in Author portfolio and Review queue
- [ ] All existing shortcuts still work (backwards compatible)
- [ ] Commands respect focus context (no J/K capture in editor)

---

### 0.3 — Panel System (react-resizable-panels)

Replace custom drag resize with `react-resizable-panels` for persistence, collapse, keyboard resize, and accessibility.

**Package:** `react-resizable-panels` (by bvaughn, ~10KB)

**New component:** `components/workspace/layout/WorkspacePanels.tsx`

```typescript
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface WorkspacePanelsProps {
  sidebar?: ReactNode; // Left: navigation/queue rail
  main: ReactNode; // Center: editor/portfolio/content
  context?: ReactNode; // Right: agent/intel/notes panel
  toolbar: ReactNode;
  statusBar: ReactNode;
  layoutId: string; // autoSaveId for persistence (e.g. 'author', 'review', 'amendment')
}

// Layout:
// ┌──────────┬──────────────────────┬──────────────┐
// │ sidebar  │       main           │   context    │
// │ (collapse│  (flex, min 40%)     │  (collapse   │
// │  to 48px)│                      │   to 0)      │
// └──────────┴──────────────────────┴──────────────┘
```

**Key behaviors:**

- `autoSaveId={layoutId}` — panel sizes persist to localStorage automatically
- Sidebar collapses to icon rail (48px) via `collapsible` prop
- Context panel collapses to 0 (hidden) — restores to last width on reopen
- Resize handles: 4px wide, hover highlight, keyboard accessible (arrow keys)
- On mobile (<lg): sidebar becomes a Sheet, context panel becomes a bottom Sheet

**Migration path:**

- `WorkspaceLayout.tsx` → replace with `WorkspacePanels` composition. Keep the component signature compatible initially.
- `StudioPanel` → becomes the `context` slot content. Its internal tab switching stays.
- Queue rail → becomes the `sidebar` slot content in review workspace.
- Remove: custom drag handlers, manual width state, MIN_CHAT_WIDTH/MIN_EDITOR_WIDTH constants.

**Acceptance criteria:**

- [ ] Panel sizes persist across page refresh and navigation
- [ ] Sidebar collapse/expand animates smoothly (200ms)
- [ ] Context panel can be toggled via Cmd+Shift+C (registered as command)
- [ ] Keyboard resize: focus handle, use arrow keys to adjust
- [ ] Mobile: panels degrade to sheets
- [ ] Both Author and Review workspaces use the same panel primitive with different `layoutId`

---

## Tier 1: Interaction Quality

**Goal:** Make every interaction feel instant and keyboard-native. Build incrementally alongside feature work.

### 1.1 — Optimistic Mutation Pattern

**File:** `lib/workspace/mutations.ts`

```typescript
// Wrapper that standardizes optimistic update + rollback + toast feedback
function useOptimisticMutation<TData, TVariables>(options: {
  mutationFn: (vars: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  optimisticUpdate: (old: TData, vars: TVariables) => TData;
  successMessage?: string; // e.g. "Draft archived"
  errorMessage?: string; // e.g. "Failed to archive draft"
}): UseMutationResult;
```

**Visual feedback pattern:**

- Mutation starts → item updates immediately (optimistic)
- Background: subtle "Saving..." indicator in status bar (not a spinner on the item)
- Success → brief "Saved ✓" (auto-dismiss 1.5s)
- Error → toast with rollback: "Failed to save. Changes reverted." + retry action
- No loading spinners on individual items. Ever.

**Apply to:**

- `useUpdateDraft` — auto-save shows optimistic content
- `useCreateDraft` — new draft appears in portfolio immediately
- Archive/delete — card moves/disappears instantly
- Stage transitions — status badge updates instantly
- Review submission — review appears in list instantly
- Team operations — member added/removed instantly

**Acceptance criteria:**

- [ ] Every workspace mutation feels instant (<50ms perceived)
- [ ] Status bar shows save state (idle/saving/saved/error)
- [ ] Failed mutations rollback cleanly with user-visible error
- [ ] No loading spinners on mutation targets

---

### 1.2 — Focus Management

**File:** `lib/workspace/focus.ts`

```typescript
interface FocusManager {
  // Push/pop focus context (like a stack)
  pushFocus: (elementOrSelector: HTMLElement | string) => void;
  popFocus: () => void; // restores previous focus

  // Track active list for J/K navigation
  setActiveList: (id: string, length: number) => void;
  activeListId: string | null;
  activeIndex: number;
  moveUp: () => void;
  moveDown: () => void;
}
```

**Behaviors:**

- Modal/panel opens → focus pushed, trapped within
- Modal/panel closes → focus restored to previous element
- J/K in lists → active item gets `data-focused="true"` + visible ring
- Enter on focused item → navigate to detail
- Escape in detail → return to list, restore focus to previous item
- All focus indicators respect `data-mode` density (ring size adapts)

**Acceptance criteria:**

- [ ] Opening command palette, then pressing Escape, returns focus to editor cursor
- [ ] J/K navigation shows visible focus indicator on active list item
- [ ] Tab order is logical within each panel (doesn't escape to other panels)
- [ ] Screen reader announces focused items correctly

---

### 1.3 — Toast/Notification System

**File:** `components/ui/toast.tsx` (or adopt sonner)

Lightweight toast for mutation feedback. Not a full notification system — just transient status messages.

**Behaviors:**

- Appears bottom-right, auto-dismiss after 2s
- Stacks (max 3 visible)
- Types: success (green check), error (red X + retry), info (neutral)
- Keyboard: Escape dismisses all

**Consider:** `sonner` (by Emiliano Horcada, same author as vaul/drawer). Tiny, unstyled, great DX. Or shadcn/ui toast (Radix-based). Either works.

**Acceptance criteria:**

- [ ] Mutation success/error messages appear as toasts
- [ ] Toasts don't overlap workspace content
- [ ] Error toasts include a retry action

---

## Content Authoring Quality (Parallel Track)

**Goal:** Make content creation intuitive and visually beautiful in the editor, AND ensure visual consistency across the entire pipeline: author → reviewer → on-chain display. This is the "Notion-esque" layer on top of the "Linear + Cursor" workspace shell.

**Runs in parallel with:** Sessions 1-2 (touches editor + CSS, not workspace shell)

### Why It Matters

The content pipeline has a **markdown bottleneck**: Tiptap ProseMirror JSON → markdown string → `proposal_drafts` table → CIP-108 JSON-LD → `proposals.meta_json` → `MarkdownRenderer` (react-markdown). Whatever the author creates must:

1. Be intuitive to create (Notion-style block insertion, not raw markdown syntax)
2. Look beautiful in the editor while drafting
3. Look identical when reviewers read it
4. Serialize to standard GFM (GitHub Flavored Markdown) for CIP-108 compatibility — other governance tools will render this with their own markdown parsers

### CA.1 — Expand Slash Command Menu with Content Blocks

**File:** `components/workspace/editor/SlashCommandMenu.tsx`

The current menu has 5 AI commands only. Add content block commands:

| Command                           | Inserts                      | Tiptap Node                         |
| --------------------------------- | ---------------------------- | ----------------------------------- |
| `/heading` or `/h1`, `/h2`, `/h3` | Heading at cursor            | `heading` (already in StarterKit)   |
| `/bullet` or `/list`              | Bullet list                  | `bulletList` (StarterKit)           |
| `/numbered` or `/ordered`         | Ordered list                 | `orderedList` (StarterKit)          |
| `/checklist` or `/todo`           | Task list                    | `taskList` (already registered)     |
| `/quote` or `/blockquote`         | Blockquote                   | `blockquote` (StarterKit)           |
| `/code`                           | Code block                   | `codeBlock` (StarterKit)            |
| `/table`                          | 3×3 table                    | `table` (already registered)        |
| `/divider` or `/hr`               | Horizontal rule              | `horizontalRule` (StarterKit)       |
| `/image`                          | Image (URL prompt)           | `image` (already registered)        |
| `/callout`                        | Styled blockquote with emoji | `blockquote` with marker convention |

**Callout convention (GFM-compatible):**

```markdown
> **Note:** This proposal affects treasury parameters...
> **Warning:** Constitutional guardrail conflict detected...
> **Important:** Requires supermajority approval...
```

Renders as a regular blockquote in other tools. Governada's renderer detects the `**Note:**` / `**Warning:**` / `**Important:**` markers and applies distinctive styling (colored left border, icon, background tint).

**Command sections in the menu:**

```
┌──────────────────────────────────┐
│ Content                          │
│   Heading           /h1 /h2 /h3 │
│   Bullet List            /bullet │
│   Numbered List         /ordered │
│   Checklist               /todo  │
│   Quote                  /quote  │
│   Code Block              /code  │
│   Table                  /table  │
│   Divider                   /hr  │
│   Callout              /callout  │
│   Image                  /image  │
│                                  │
│ AI                               │
│   Improve Text          /improve │
│   Constitutional Check    /check │
│   Similar Proposals         /sim │
│   Complete Section     /complete │
│   Draft from Instructions /draft │
└──────────────────────────────────┘
```

**Acceptance criteria:**

- [ ] All 10 content block commands work from the slash menu
- [ ] Each inserts the correct Tiptap node at cursor position
- [ ] Menu shows content blocks first, AI commands second
- [ ] Commands filter as user types (e.g., `/ta` matches `/table`)
- [ ] Callouts use GFM-compatible blockquote+marker convention

---

### CA.2 — Shared Governance Prose Styling

**File:** `app/globals.css` (new `.governance-prose` class)

Create a single CSS class that defines the visual treatment of ALL content block types, used by both the Tiptap editor and the MarkdownRenderer.

```css
/* Shared prose styling for governance content */
.governance-prose h1 {
  /* ... */
}
.governance-prose h2 {
  /* ... */
}
.governance-prose h3 {
  /* ... */
}
.governance-prose p {
  /* ... */
}
.governance-prose ul {
  /* ... */
}
.governance-prose ol {
  /* ... */
}
.governance-prose blockquote {
  /* base blockquote styling */
}
.governance-prose blockquote:has(> p > strong:first-child) {
  /* Callout detection: blockquotes starting with **Note:**/
  **warning: * *; /**Important:** */
}
.governance-prose pre {
  /* code block with language header */
}
.governance-prose table {
  /* styled table with header row */
}
.governance-prose hr {
  /* styled divider */
}
.governance-prose img {
  /* responsive, rounded, caption support */
}
.governance-prose input[type='checkbox'] {
  /* styled task list checkboxes */
}
```

**Design direction (Compass language):**

- Headings: Space Grotesk, foreground color, graduated sizing (h1=1.5rem, h2=1.25rem, h3=1.1rem)
- Blockquotes: left border 3px `--compass-teal`, padding-left 1rem, slightly muted text
- Callout (Note): left border `--compass-teal`, teal-tinted background, info icon
- Callout (Warning): left border `--wayfinder-amber`, amber-tinted background, warning icon
- Callout (Important): left border `--meridian-violet`, violet-tinted background, alert icon
- Code blocks: `--muted` background, rounded corners, language badge top-right if specified
- Tables: border-collapse, header row with muted background, alternating row tint
- Horizontal rules: centered, 60% width, 1px `--border` with subtle gradient fade
- Task list checkboxes: custom styled (not browser default), compass-teal when checked

**Apply to:**

1. Tiptap editor — wrap `.ProseMirror` content area with `.governance-prose`
2. `MarkdownRenderer.tsx` — replace inline Tailwind component overrides with `.governance-prose` class
3. `ProposalContent.tsx` — review view inherits from the same class
4. `AnnotatableText.tsx` — annotatable view inherits from the same class

**Acceptance criteria:**

- [ ] A heading created in the editor looks identical to the same heading in the review view
- [ ] A callout created via `/callout` renders with distinctive styling in editor, review, AND on-chain display
- [ ] The `.governance-prose` class is the single source of truth — no duplicate styling
- [ ] All block types adapt to density modes (tighter spacing in Work mode)

---

### CA.3 — Formatting Toolbar

**File:** `components/workspace/editor/FormattingToolbar.tsx`

A compact toolbar above the editor content area for users who prefer clicking over typing. Think Notion's floating toolbar + a persistent block insertion bar.

```
┌──────────────────────────────────────────────────────────────────┐
│ B  I  S  ~  🔗  │  H1 H2 H3  │  • ① ☑  │  ❝  </>  ▤  ―  │  + │
│ (inline format)  │ (headings) │ (lists)  │ (blocks)        │add │
└──────────────────────────────────────────────────────────────────┘
```

- **Inline section** (left): Bold, Italic, Strikethrough, Link — toggle on selection
- **Heading section**: H1, H2, H3 — toggles at block level
- **List section**: Bullet, Ordered, Checklist
- **Block section**: Quote, Code, Table, Divider
- **Add button** (+): Opens the same command menu as `/` (content blocks + AI)
- Shows active states (bold button highlighted when cursor is in bold text)
- Collapses to essential items on narrow screens

**Acceptance criteria:**

- [ ] Every content block type is accessible without knowing markdown or slash commands
- [ ] Active formatting state is visually indicated (highlighted buttons)
- [ ] Toolbar is compact and doesn't compete with the content area
- [ ] Works alongside slash commands (both paths to the same result)

---

### CA.4 — Roundtrip Fidelity Verification

**Scope:** Verify that content survives the full pipeline without loss.

**Test matrix:**

| Content Type                 | Create in Tiptap | Save to DB | Load back in Tiptap | Render in MarkdownRenderer | CIP-108 output |
| ---------------------------- | ---------------- | ---------- | ------------------- | -------------------------- | -------------- |
| Headings (H1-H3)             | ✓                | Check      | Check               | Check                      | Check          |
| Bold/Italic/Strikethrough    | ✓                | Check      | Check               | Check                      | Check          |
| Bullet/Ordered lists         | ✓                | Check      | Check               | Check                      | Check          |
| Nested lists                 | ✓                | Check      | Check               | Check                      | Check          |
| Task lists                   | ✓                | Check      | Check               | Check                      | Check          |
| Blockquotes                  | ✓                | Check      | Check               | Check                      | Check          |
| Callouts (marker convention) | ✓                | Check      | Check               | Check                      | Check          |
| Code blocks (with language)  | ✓                | Check      | Check               | Check                      | Check          |
| Tables                       | ✓                | Check      | Check               | Check                      | Check          |
| Images                       | ✓                | Check      | Check               | Check                      | Check          |
| Horizontal rules             | ✓                | Check      | Check               | Check                      | Check          |
| Links                        | ✓                | Check      | Check               | Check                      | Check          |
| Mixed nesting                | ✓                | Check      | Check               | Check                      | Check          |

Write as a Vitest test suite that creates each content type in a headless Tiptap editor, serializes to markdown, parses back, and asserts structural equality.

**Acceptance criteria:**

- [ ] All content types roundtrip without loss
- [ ] CIP-108 output is valid GFM (parseable by any CommonMark/GFM renderer)
- [ ] Test suite runs as part of `npm run test`

---

## Tier 2: Polish & Performance

**Goal:** The final 20% that makes the workspace feel world-class. Non-blocking — ship after core features work.

### 2.1 — View Transitions

**Config:** `next.config.ts` → `viewTransition: true`

GPU-accelerated route transitions between workspace pages. Browser-native, zero JavaScript. Elements with matching `viewTransitionName` CSS properties animate position/size/opacity automatically.

**Apply to:**

- `/workspace/author` → `/workspace/author/[draftId]` (card expands into editor)
- `/workspace/review` proposal queue navigation
- Panel open/close animations (if browser supports)

**Acceptance criteria:**

- [ ] Route navigation within workspace has smooth morphing (no flash of white)
- [ ] Graceful degradation: browsers without View Transitions get instant navigation (no break)

---

### 2.2 — List Virtualization

**Package:** `@tanstack/react-virtual` (~5KB, fits TanStack ecosystem)

**Apply when:**

- Author portfolio > 50 proposals (unlikely near-term, but future-proof)
- Review queue > 100 proposals (more likely)
- Any scrollable list that could grow unbounded

**Not needed yet** — current proposal counts are small. Add when performance data justifies it.

**Acceptance criteria:**

- [ ] Lists of 500+ items render without jank
- [ ] Scroll position preserved on navigation/return
- [ ] Keyboard navigation (J/K) works with virtualized items

---

### 2.3 — Motion & Animation

**Library:** `framer-motion` (already installed as v12.36.0)

**Apply to:**

- Staggered card entry in portfolio view (cards fade+slide in sequence)
- Layout animation on status change (card moves between kanban columns)
- Panel resize spring physics (smoother than CSS ease-out)
- Skeleton shimmer/pulse on loading states

**Rules (from Linear's design philosophy):**

- Duration: 150-250ms maximum. Over 300ms feels sluggish.
- Only animate `transform` and `opacity`. Never width/height/top/left.
- Springs over easing: `type: "spring", stiffness: 300, damping: 30`
- Enter animations yes, exit animations minimal (fade out <100ms or instant)
- **No animation on keyboard navigation.** Focus changes must be instant.

**Acceptance criteria:**

- [ ] Portfolio view cards animate on entry (staggered fade+slide)
- [ ] Kanban column transitions animate card movement
- [ ] All animations respect `prefers-reduced-motion`

---

### 2.4 — Density Mode → Workspace CSS

Connect the existing `ModeProvider` (browse/work/analyze) to workspace-specific styling.

The `data-mode` attribute already renders on the root element. Add CSS custom property overrides:

```css
/* globals.css additions */
[data-mode='work'] {
  --workspace-gap: var(--space-xs); /* 4px — tighter in work mode */
  --workspace-card-padding: var(--space-sm); /* 8px */
  --workspace-font-size: 13px;
  --workspace-line-height: 1.4;
}

[data-mode='analyze'] {
  --workspace-gap: var(--space-2xs); /* 2px — maximum density */
  --workspace-card-padding: var(--space-xs);
  --workspace-font-size: 12px;
  --workspace-line-height: 1.3;
}
```

Workspace components consume these tokens instead of hardcoded spacing.

**Acceptance criteria:**

- [ ] Workspace visually tightens in Work mode, maximizes density in Analyze mode
- [ ] Mode switching is instant (CSS-only, no re-render)

---

## Execution Plan

### Session order and dependencies

```
Session 1a: Tier 0.1 + 0.3 (parallel-safe — workspace shell)
├── 0.1: Zustand store + useWorkspace hook + StudioProvider adapter
└── 0.3: Install react-resizable-panels + WorkspacePanels component + migrate WorkspaceLayout

Session 1b: CA.1 + CA.2 + CA.3 (parallel with 1a — editor + CSS, no overlap)
├── CA.1: Expand SlashCommandMenu with 10 content block commands
├── CA.2: Create .governance-prose shared CSS + apply to editor + MarkdownRenderer
├── CA.3: Formatting toolbar component
└── CA.4: Roundtrip fidelity test suite

Session 2: Tier 0.2
├── Command registry + keyboard engine
├── Scaffold command-palette.tsx from cmdk
├── Register all existing shortcuts as commands (including new content blocks from 1b)
└── Wire Cmd+K, chord navigation, ? help overlay

Session 3: Tier 1.1 + 1.3 (parallel-safe)
├── 1.1: useOptimisticMutation wrapper + apply to draft hooks
└── 1.3: Toast system (sonner or shadcn) + wire to mutations

Session 4: Tier 1.2 + 2.4
├── 1.2: FocusManager + J/K list navigation + focus restoration
└── 2.4: Density mode CSS tokens for workspace

Session 5: Tier 2.1 + 2.2 + 2.3
├── 2.1: View Transitions config
├── 2.2: @tanstack/react-virtual on largest lists (if needed)
└── 2.3: framer-motion staggered entry + layout animations
```

### What gets shipped per session

| Session | Deliverable                                 | PR scope                                                             |
| ------- | ------------------------------------------- | -------------------------------------------------------------------- |
| 1a      | Panel persistence + workspace state         | ~8-12 files (store, panels, layout migration)                        |
| 1b      | Beautiful content authoring                 | ~6-8 files (slash menu, prose CSS, toolbar, fidelity tests)          |
| 2       | Command palette + keyboard system           | ~6-10 files (registry, palette, help overlay, command registrations) |
| 3       | Optimistic mutations + toasts               | ~8-12 files (mutation wrapper, hook updates, toast component)        |
| 4       | Focus management + density CSS              | ~5-8 files (focus manager, list nav hook, CSS tokens)                |
| 5       | Polish: transitions, virtualization, motion | ~5-8 files (config, animation wrappers, CSS)                         |

### Parallel execution opportunities

Sessions 1a and 1b are fully parallel — 1a touches workspace shell (store, panels, layout), 1b touches editor internals (slash menu, CSS, toolbar). Zero file overlap. Both can run as separate worktree agents simultaneously.

Session 3's two items (mutations + toasts) can also parallelize. Session 2 is sequential (palette depends on registry). Sessions 4-5 are lightweight and can parallelize freely.

---

## Package Additions

| Package                  | Version | Size (gzip) | Purpose                                                 |
| ------------------------ | ------- | ----------- | ------------------------------------------------------- |
| `zustand`                | ^5.x    | ~2KB        | Workspace state management                              |
| `react-resizable-panels` | ^2.x    | ~10KB       | Panel layout with persistence                           |
| `react-hotkeys-hook`     | ^5.x    | ~3KB        | Keyboard shortcut engine (or custom)                    |
| `sonner`                 | ^2.x    | ~5KB        | Toast notifications (optional, shadcn toast also works) |

Total added: ~20KB gzipped. No heavy dependencies.

**Packages NOT needed (decided against):**

- `jotai` — Zustand is simpler for this use case (single store > atomic state)
- `@tanstack/react-virtual` — Tier 2, add only if perf data justifies
- `react-virtuoso` — Same, defer until needed

---

## Migration Checklist

Components that need updates during Tier 0:

| Component                                         | Change                                                            | Tier |
| ------------------------------------------------- | ----------------------------------------------------------------- | ---- |
| `components/studio/StudioProvider.tsx`            | Adapter: read from Zustand, keep Context API for backwards compat | 0.1  |
| `components/workspace/layout/WorkspaceLayout.tsx` | Replace with WorkspacePanels composition                          | 0.3  |
| `components/studio/StudioPanel.tsx`               | Becomes context slot content in WorkspacePanels                   | 0.3  |
| `hooks/useKeyboardShortcuts.ts`                   | Register commands instead of raw addEventListener                 | 0.2  |
| `components/workspace/editor/CommandBar.tsx`      | Becomes AI section of unified palette                             | 0.2  |
| `components/workspace/author/AuthorWorkspace.tsx` | Read viewMode/filter from store                                   | 0.1  |
| `app/workspace/editor/[draftId]/page.tsx`         | Sync draftId to store                                             | 0.1  |
| `app/workspace/review/page.tsx`                   | Sync selectedIndex to store                                       | 0.1  |

---

## What This Unblocks

Once Tier 0 is complete, the proposal lifecycle work from the exploration has a solid foundation:

| Feature                                                  | Depends on                                              |
| -------------------------------------------------------- | ------------------------------------------------------- |
| **Portfolio view** (3-column kanban)                     | WorkspacePanels (0.3) + Zustand viewMode (0.1)          |
| **Quick actions** (archive, duplicate, delete from list) | Command registry (0.2) + Optimistic mutations (1.1)     |
| **Keyboard-first portfolio** (J/K, Enter, D, A)          | Command registry (0.2) + Focus management (1.2)         |
| **Submission ceremony** (full-page flow)                 | WorkspacePanels (0.3) + Zustand context (0.1)           |
| **Post-submission dashboard**                            | WorkspacePanels (0.3) + Zustand currentProposalId (0.1) |
| **Team approval gates**                                  | Optimistic mutations (1.1) + Toast feedback (1.3)       |

---

## Risks

| Risk                                                     | Likelihood | Mitigation                                                                                                                                                |
| -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zustand migration breaks existing workspace flows        | Medium     | Keep StudioProvider as thin adapter during migration. Both old and new consumers work simultaneously. Remove adapter in a follow-up PR.                   |
| react-resizable-panels doesn't match current layout feel | Low        | Library is used by shadcn/ui, Vercel dashboard, and hundreds of production apps. Test in isolation first.                                                 |
| Command palette conflicts with editor Cmd+K              | Medium     | When editor is focused, Cmd+K routes to editor CommandBar (AI). When editor is NOT focused, Cmd+K opens palette. Clear priority rules in keyboard engine. |
| Session count underestimate                              | Medium     | Tier 2 items are explicitly deferrable. Ship Tier 0 + 1, assess if Tier 2 is needed before building.                                                      |

---

## What We Are NOT Doing

- **Real-time collaboration (CRDT/multiplayer editing)** — Not in scope. Team collaboration uses version-based editing, not real-time cursors.
- **Full sync engine (Linear-style IndexedDB + delta sync)** — Overkill for our scale. TanStack Query + Supabase is sufficient.
- **Custom animation engine** — framer-motion is already installed. Use it, don't build our own.
- **Replacing Tiptap** — Tiptap + custom extensions are the right foundation. We're extending (slash commands, toolbar, prose styling), not replacing.
- **Custom block format** — All content serializes to standard GFM markdown. No proprietary block syntax that breaks in other CIP-108 renderers.
- **Full Notion block system** — We're adding Notion-style block insertion UX, not Notion's database/page architecture. Blocks are markdown elements, not custom data types.
