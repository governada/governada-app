# Build Step: Seneca Governance Brain — Full Realization

**Status**: Planning
**Created**: 2026-03-27
**PR chain**: #643 (foundation shipped) → Phase 1 → Phase 2 → Phase 3

## Context

Seneca + the Globe IS the app's brand. PR #643 shipped the governance brain (8 tools, enriched context, tool-use streaming loop, globe choreography architecture). But the audit reveals the brain has no body — the primary SenecaThread conversation mode doesn't actually stream responses. Globe commands aren't wired in conversation mode. The tool use system we built can't execute in the surface users interact with.

This plan fixes all wiring, completes the experience, then layers intelligence and polish to world-class.

---

## Phase 1: Wire the Foundation — Make Everything Work

**Goal**: When Phase 1 ships, every Seneca interaction works end-to-end: user types → AI streams with tool use → globe choreographs → entity links work → personas applied. On every page, every mode, desktop and mobile.

### Chunk 1A: Conversation Streaming in SenecaThread

**The core fix.** SenecaThread renders conversation UI but never calls `readAdvisorStream()`.

**File: `components/governada/SenecaThread.tsx`**

- Add a `useConversationStream` hook (or inline effect) that:
  1. Watches `mode === 'conversation'` + `pendingQuery` changes
  2. When pendingQuery is set: add user message via `onAddMessage()`, add empty assistant message
  3. Call `readAdvisorStream()` with the full message history from store
  4. Delta callback: accumulate content, call `onUpdateLastAssistant(accumulated)`
  5. Done callback: clear streaming state, clear pendingQuery in store
  6. Error callback: show error in the assistant message, offer retry
  7. Pass `onGlobeCommand` for inline globe markers
  8. Pass `onAction` for action markers (navigate, startMatch, research)
  9. Pass `onToolStatus` for tool execution indicators
  10. Support follow-up messages (user types again while conversation is active)
- Add streaming state tracking (isStreaming ref/state) to disable input during stream
- Add abort on unmount and mode change
- Context: pass epoch, daysRemaining, activeProposalCount, segment, panelRoute, entityId, persona

**Key references:**

- Working pattern: `components/governada/panel/SenecaConversation.tsx` lines 61-132
- Store methods: `onAddMessage`, `onUpdateLastAssistant` (already passed as props)
- Stream function: `lib/intelligence/streamAdvisor.ts` `readAdvisorStream()`
- Epoch context: `useEpochContext()` hook
- Segment: `useSegment()` from SegmentProvider

**Verification:**

- [ ] Type "What's happening in governance?" → streaming response appears
- [ ] Type follow-up question → conversation continues
- [ ] Press Escape during stream → aborts cleanly
- [ ] Navigate to different page during conversation → conversation persists
- [ ] Tool use works: "Tell me about the top DReps" → tool executes, results appear

### Chunk 1B: Globe Command Wiring

**Thread the `onGlobeCommand` callback from globe → SenecaThread → conversation streaming.**

**File: `components/governada/GovernadaShell.tsx`**

- In `SenecaOrbAndThread`, create a stable `onGlobeCommand` callback that dispatches the `senecaGlobeCommand` CustomEvent (same pattern as SenecaMatch)
- Pass `onGlobeCommand` to `<SenecaThread>` as a prop

**File: `components/governada/SenecaThread.tsx`**

- In the conversation streaming effect (from Chunk 1A), pass `onGlobeCommand` to `readAdvisorStream()`
- This enables both inline `[[globe:...]]` markers AND server-side tool choreography to reach the globe

**File: `components/hub/InhabitedConstellation.tsx`**

- Already has the CustomEvent listener (confirmed in audit). No change needed.

**Verification:**

- [ ] On authenticated homepage: "Tell me about DRep X" → globe flies to that DRep
- [ ] "Find DReps focused on decentralization" → globe highlights matching cluster
- [ ] "How did DReps vote on proposal Y?" → globe shows voteSplit
- [ ] Globe resets between conversations

### Chunk 1C: Tool Status UI

**Show what Seneca is thinking during tool execution.**

**File: `components/governada/SenecaThread.tsx`**

- Add `toolStatus` state (string | null)
- In `readAdvisorStream` `onToolStatus` callback: set the status
- On next `text_delta`: clear the status
- Render a subtle indicator below the last assistant message when toolStatus is set:
  - CompassSigil in `thinking` state (14px)
  - Status text (e.g., "Searching representatives...") in `text-[11px] text-muted-foreground/50`
  - Animate in/out with Framer Motion (opacity + y)

**Verification:**

- [ ] "Tell me about the top DReps" → "Ranking representatives..." appears briefly before results
- [ ] "What's the treasury balance?" → "Checking treasury..." appears
- [ ] Status disappears when text starts streaming

### Chunk 1D: Entity Linking

**Clicking a DRep or proposal name in Seneca's response should navigate or open a peek.**

**File: `components/governada/SenecaThread.tsx`**

- Implement `onEntityFocus` handler that:
  - For DReps: navigate to `/drep/<id>` OR dispatch globe flyTo + open peek drawer
  - For proposals: navigate to `/proposal/<hash>/<index>` OR dispatch globe pulse

**Decision**: Navigate is simpler and more reliable than peek integration. Recommend navigate.

**Verification:**

- [ ] Seneca mentions "**DRep: Alpha**" with a link → clicking navigates to DRep page
- [ ] Seneca mentions "[Proposal: Treasury Withdrawal]" → clicking navigates to proposal

### Chunk 1E: Persona Application

**Apply persona personality modifiers to the streaming context.**

**File: `components/governada/SenecaThread.tsx`**

- In the streaming effect, include `persona.id` in the context passed to `readAdvisorStream`
- The advisor route already reads `context.persona` and applies the modifier (lib/intelligence/advisor.ts line 298-303)

**File: `lib/intelligence/streamAdvisor.ts`**

- Ensure the `AdvisorContext` type includes `persona` field
- Pass it through to the API request body

**Verification:**

- [ ] On proposal page (analyst persona): response is data-driven, cites metrics
- [ ] On workspace page (partner persona): response is collaborative, references constitutional articles
- [ ] On hub page (navigator persona): response is warm, educational

### Chunk 1F: Action Handler Expansion

**Wire parameterized actions in SenecaThread conversation mode.**

**File: `components/governada/SenecaThread.tsx`**

- In the `onAction` callback passed to `readAdvisorStream`:
  - `startMatch` → call `onStartMatch()`
  - `navigate:/path` → `router.push(path)`
  - `research:query` → call `onStartResearch(query)`
- Import `useRouter` from `next/navigation`

**Verification:**

- [ ] Ask "find my match" in conversation → Seneca says "Let me help" + match flow starts
- [ ] Ask about treasury → Seneca uses tool, but if user says "show me the full dashboard" → navigates to /governance/treasury

---

## Phase 2: Intelligence Layer — Make It Smart

**Goal**: Seneca proactively pushes intelligence, remembers context, and adapts to the user's governance journey. The experience shifts from "chatbot that answers questions" to "ambient governance advisor."

### Chunk 2A: Proactive Whispers from Data

Extend the existing whisper system (SenecaOrb bubble) with data-driven alerts:

- DRep score change detection: "Your DRep dropped 5 points this epoch"
- Epoch transition: "New epoch 622 — 3 proposals need attention"
- Delegation drift: "Your delegation alignment shifted 12% from your stated values"
- Implementation: new `useSenecaProactiveWhispers` hook that queries lightweight endpoints on a timer

### Chunk 2B: Conversational Memory

Store conversation summaries in Supabase so Seneca can reference prior interactions:

- After each conversation: generate a 1-sentence summary, store with user + timestamp
- On new conversation start: fetch last 3 summaries, inject into system prompt
- "Last time we discussed your concerns about treasury spending. The proposal passed."

### Chunk 2C: Navigation-Aware Context

When the user navigates mid-conversation, Seneca notices and adapts:

- Navigation markers already exist in the store
- Inject the new page context into the next streaming call
- "I see you moved to a proposal page. Want me to check how your DRep voted on this?"

### Chunk 2D: Ambient Annotations (Non-Panel Intelligence)

Seneca insights appear outside the panel as subtle contextual annotations:

- DRep cards: "Alignment shifted since your last visit" badge
- Proposal pages: "Your DRep voted Yes — here's why" inline note
- Delegation page: coaching nudge if drift detected
- Implementation: new `<SenecaAnnotation>` component + lightweight annotation API

### Chunk 2E: Delegation Coaching

Comparative framing for delegation decisions:

- "Citizens with similar values who delegated to [DRep X] saw better coverage"
- Rebalancing suggestions with one-tap action
- Requires citizen cohort analysis (compute alignment clusters)

---

## Phase 3: Polish & World-Class — Make It Unforgettable

**Goal**: Every interaction feels crafted. The globe choreography is cinematic. Seneca's voice is distinctive. Shareable moments create viral loops.

### Chunk 3A: Advanced Globe Choreography

- Tool "thinking" → neural mesh scanning effect (edges light up between related nodes)
- Progressive reveal: results dim → illuminate matching entities → camera sweeps
- Conversation flow: as Seneca discusses treasury, treasury-affected nodes warm; discussing a DRep, camera drifts
- Epoch transition animation: constellation reconfigures when switching epoch context

### Chunk 3B: Voice Deepening

- Each tool result narrated with Stoic character: "The treasury holds 1.24B ADA. A war chest that would make Crassus envious."
- Persona modes affect reasoning style, not just tone
- Few-shot examples in the system prompt for each persona
- Signature phrases and governance metaphors library

### Chunk 3C: Shareable Seneca Moments

- "Share this insight" button on notable analyses → generates branded OG card
- Insight cards: Seneca quote + key finding + user's governance identity
- Share to X/Twitter with Governada branding
- Implementation: new OG route `/api/og/seneca-insight/[id]`

### Chunk 3D: Streaming TTS (Stretch)

- Seneca's voice as actual audio narrating the briefing
- Streaming TTS API (ElevenLabs or similar) synchronized with text delivery
- Optional: toggle in settings, off by default
- The Stoic philosopher narrating your governance briefing while you watch the globe

### Chunk 3E: Real-Time Data Subscriptions (Stretch)

- Supabase Realtime for live vote notifications during conversation
- "Breaking — DRep X just voted No on this proposal" mid-conversation
- Globe node flashes in real-time as votes arrive

---

## Agent Execution Protocol

### How agents pick up work

Each chunk is independently shippable. Agents work from worktrees (`claude --worktree seneca-p1a`, etc.).

**Before starting a chunk:**

1. Read THIS checkpoint doc for context
2. Read the specific chunk description above
3. Read the "Key references" files listed
4. Check git log for any chunks already shipped (PRs may have landed since this doc was written)

**Before shipping a chunk:**

1. `npm run preflight` — 0 errors
2. Verify ALL checkbox items in the chunk's verification list
3. Test on both authenticated and anonymous flows
4. Test on mobile viewport (Chrome DevTools)
5. Update this checkpoint doc: mark chunk as SHIPPED with PR number

**Handoff protocol:**

- Each chunk updates this checkpoint doc with: status, PR number, any decisions made, any surprises found
- Next agent reads the updated checkpoint before starting their chunk

### Chunk dependencies

```
Phase 1 (all can run in parallel EXCEPT 1A must ship first):
  1A (streaming) → 1B (globe) → can parallel with 1C, 1D, 1E, 1F

Phase 2 (sequential within, parallel across):
  2A (whispers) — independent
  2B (memory) — independent
  2C (nav-aware) — depends on 1A
  2D (annotations) — independent
  2E (coaching) — depends on 2B, 2D

Phase 3 (all independent):
  3A, 3B, 3C — parallel
  3D, 3E — stretch, after 3A-C ship
```

---

## Shipped Chunks

| Chunk                               | Status  | PR   | Notes                                                                      |
| ----------------------------------- | ------- | ---- | -------------------------------------------------------------------------- |
| Foundation (tools, context, prompt) | SHIPPED | #643 | 8 tools, enriched snapshot, tool-use loop, globe choreography architecture |
| 1A: Conversation streaming          | PENDING | —    | —                                                                          |
| 1B: Globe command wiring            | PENDING | —    | —                                                                          |
| 1C: Tool status UI                  | PENDING | —    | —                                                                          |
| 1D: Entity linking                  | PENDING | —    | —                                                                          |
| 1E: Persona application             | PENDING | —    | —                                                                          |
| 1F: Action handler expansion        | PENDING | —    | —                                                                          |
| 2A: Proactive whispers              | PENDING | —    | —                                                                          |
| 2B: Conversational memory           | PENDING | —    | —                                                                          |
| 2C: Navigation-aware context        | PENDING | —    | —                                                                          |
| 2D: Ambient annotations             | PENDING | —    | —                                                                          |
| 2E: Delegation coaching             | PENDING | —    | —                                                                          |
| 3A: Advanced globe choreography     | PENDING | —    | —                                                                          |
| 3B: Voice deepening                 | PENDING | —    | —                                                                          |
| 3C: Shareable moments               | PENDING | —    | —                                                                          |
| 3D: Streaming TTS                   | PENDING | —    | Stretch                                                                    |
| 3E: Real-time subscriptions         | PENDING | —    | Stretch                                                                    |
