# Seneca Unified Companion — Feature Exploration

> **Feature**: Seneca AI Companion — the persistent conversational governance guide
> **Date**: 2026-03-25
> **Focus**: SenecaDock as warm conversational entry point on anonymous homepage, unification with Intelligence Panel, futuristic-yet-warm character design
> **Benchmarks**: Perplexity, Apple Siri redesign, GitHub Copilot Chat, Intercom Fin, Claude.ai, Duolingo

---

## Phase 1: Current State Analysis

### What Exists Today

Seneca currently lives as **two separate surfaces** with related but disconnected UX:

**1. SenecaDock (`components/governada/home/SenecaDock.tsx`)**

- Fixed bottom-left glassmorphic card on the anonymous homepage
- Contains: Compass icon + "Ask Seneca" header, 3 rotating ghost prompts (10s interval), text input
- Ghost prompts are functional but generic: "Who should represent my ADA?", "What's happening in governance right now?", "How does Cardano governance work?"
- Clicking a prompt or typing fires `onStartConversation` which opens the Intelligence Panel
- Also shows a `narrativePulse` string (AI-generated governance narrative) as faint text
- **Problem**: Feels like a chatbot widget, not a warm persona reaching out. The "Ask Seneca" header + rotating prompts reads as utility, not character. No emotional hook. No communication of what Cardano governance IS or why the visitor should care.

**2. IntelligencePanel (`components/governada/IntelligencePanel.tsx`)**

- Right-side panel (280-320px), slides in from right edge
- Contains: ReadinessSignal, PanelRouter (briefing content), SenecaConversation (streaming AI chat), SenecaResearch (deep dive), SenecaMatch (4-question match quiz)
- Toggled via `]` keyboard shortcut or header button
- On mobile: MobileIntelSheet (bottom sheet with PeekBar)
- Modes: briefing, conversation, research, matching
- **Problem**: This is where all the substance lives, but anonymous users never see it unless they interact with the Dock first. The panel header says "Seneca" but there's no personality, no warmth — just a Compass icon and a close button.

**3. Persona System (`lib/intelligence/senecaPersonas.ts`)**

- Four personas: Navigator (hub), Analyst (proposals/dreps), Partner (workspace), Guide (default)
- Each has: accent color, ghost prompts, personality modifier for the system prompt
- Route-to-persona mapping is functional and well-designed
- **Problem**: Personas are invisible to users. They affect the system prompt but have zero visual expression. A user never knows they're talking to "Navigator Seneca" vs "Analyst Seneca." The personality exists only in the AI's tone, not in the UI.

**4. Globe-Seneca Bridge (`hooks/useSenecaGlobeBridge.ts`)**

- Bidirectional: globe clicks open Seneca with entity context; Seneca match flow highlights/flies-to globe nodes
- CustomEvent bridge for cross-component communication
- **This is already excellent** — the globe and Seneca have a working neural connection

**5. Advisor Backend (`lib/intelligence/advisor.ts`)**

- Full context-aware system prompt builder with epoch data, persona modifiers, visitor mode, wallet state, match state
- Onboarding mode with shorter responses, simpler language, celebration of first actions
- Post-match guidance based on wallet detection state
- **This is strong infrastructure** — the backend knows more about the user's state than the frontend expresses

### Architecture Summary

```
Anonymous Homepage Layout:
+--------------------------------------------------+
|  [header with navigation]                         |
|                                                   |
|            GLOBE (full viewport)                  |
|                                                   |
|  +--SenecaDock--+                                 |
|  | Ask Seneca   |              [IntelligencePanel]|
|  | ghost prompt |              | (hidden until   |
|  | ghost prompt |              |  triggered)      |
|  | [input____]  |              |                  |
|  +--------------+              +------------------+
|                                                   |
|           [Explore governance v]                  |
+--------------------------------------------------+
```

### Core Gaps

1. **No warm first impression**: The Dock says "Ask Seneca" but never says "Welcome to Cardano governance — you can participate by finding a representative for your ADA in 60 seconds." It assumes the visitor knows what to ask.

2. **Two disconnected entry points**: Dock (bottom-left, anonymous homepage only) and Panel (right-side, all pages) are separate components with separate visual languages. There's no sense that Seneca is one unified character who follows you.

3. **No character**: Seneca has a name, a compass icon, and four persona modifiers. But there's no visual identity, no emotional warmth, no sense of personality in the UI itself. Compare this to Duolingo's Duo (who has facial expressions, reactions, and emotional range) or Claude.ai's warm onboarding flow.

4. **The hero text problem**: The anonymous homepage has no hero text — the globe IS the hero. But a first-time visitor landing on a spinning globe with a small chatbot widget in the corner has no idea what this product does or why they should care. The SenecaDock needs to do the job that hero text traditionally does, but conversationally.

5. **Panel is utilitarian**: When Seneca opens (right panel), it's a functional chat interface. No visual personality, no ambient intelligence surfacing, no sense that Seneca knows you or is glad to see you.

---

## Phase 2: Data Opportunity Scan

### Untapped Data Seneca Could Surface

**Already available (backend has it, frontend doesn't show it):**

1. **Epoch context narrative** — The `narrativePulse` from `/api/homepage/narrative` returns a narrative string, health score, and urgency level. Currently shown as faint 10px text in the Dock. This should be Seneca's opening line, not footnote text.

2. **Visitor mode intelligence** — The advisor backend has `visitorMode: 'onboarding' | 'exploring' | 'returning' | 'authenticated'` but the frontend never detects or passes this. Returning anonymous visitors could get "Welcome back — ready to pick up where you left off?" instead of the generic prompts.

3. **Wallet detection state** — The advisor context supports `walletState: 'none_detected' | 'detected' | 'connected' | 'has_ada' | 'no_ada'` but the Dock doesn't detect wallets. If we detect a Cardano wallet extension, Seneca could say "I see you have a wallet — you're already halfway to participating."

4. **Match state persistence** — If a user completed the match quiz but didn't delegate, localStorage could persist this. Seneca could say "You matched with 3 representatives last time — want to see them again?"

5. **Active proposal urgency** — Epoch deadline proximity is computed for authenticated users but not surfaced for anonymous visitors. "There are 4 proposals being decided this week — your voice could matter" is more compelling than "What's happening in governance right now?"

6. **Governance temperature** — The `governance_temperature` feature flag exists. A warm Seneca opening like "Governance activity is high right now — 12 proposals competing for 45M ADA" grounds the conversation in reality.

**Could be computed with small effort:**

7. **Time-of-day awareness** — "Good morning" vs "Good evening" is trivial but humanizing. Combined with epoch context: "Good evening. Epoch 502 has 3 days left, and 4 proposals are heading to a vote."

8. **Referrer awareness** — If the visitor came from a Cardano forum, Twitter/X, or a specific proposal link, Seneca could acknowledge: "Looks like you came from a discussion about Proposal #487 — want me to explain what it means for you?"

9. **Globe interaction telemetry** — If the user has been hovering over globe nodes for 10+ seconds without clicking, Seneca could gently prompt: "Curious about who those nodes are? Each one represents a governance participant. Tap one, or ask me."

10. **Community intelligence from matching** — Aggregate match data (what governance priorities are most popular) could fuel Seneca's conversation: "Most visitors prioritize treasury transparency — where do you stand?"

### Data Seneca Should Never Surface to Anonymous Users

Per UX constraints: No raw numbers without context. No "423 active DReps" or "GHI: 72" — these mean nothing to someone who doesn't know what a DRep is. Every data point must be wrapped in a human sentence.

---

## Phase 3: Inspiration Research

### Benchmark Analysis

#### 1. Perplexity AI — Conversational Search UX

Perplexity processes 1.2-1.5B queries/month by treating search as conversation. Key patterns:

- **Follow-up suggestions are contextual and smart**: After every answer, Perplexity predicts the next question. Not generic "Tell me more" but specific: "How does this compare to X?" These maintain conversational flow.
- **Query refinement as care**: When a query is ambiguous, Perplexity asks for clarification rather than guessing. This reads as the AI caring about giving a good answer, not as friction.
- **Citations as trust architecture**: Every claim links to a source. This isn't just a feature — it's the core of why people trust Perplexity over ChatGPT for factual queries. For governance (high stakes), this is non-negotiable.
- **The empty state is an invitation**: Perplexity's landing page IS the search bar. No hero text, no feature lists. Just "Ask anything." The confidence of a single input field communicates "I can handle whatever you throw at me."

**Lesson for Seneca**: The Dock should feel like Perplexity's landing page — confident, singular, inviting. But warmer, because governance is personal. Perplexity is neutral and encyclopedic; Seneca should be warm and guiding.

#### 2. Apple Siri Redesign (2026)

Apple is building Siri into a standalone app with chat-style UI, conversation history, and visual personality:

- **Visual personality as lifelikeness**: Apple tested animated visual representations described as having a "visual personality to make it feel lifelike." Early designs resemble animated, expressive characters rather than abstract waveforms.
- **Standalone app with memory**: The redesigned Siri will have persistent conversation history, allowing users to review past interactions and continue threads. This transforms Siri from a stateless command interface to a relationship.
- **Voice + text interchangeability**: Users can switch between speaking and typing within the same conversation without friction.
- **On-screen awareness**: The new Siri understands what's on screen, can interact with visible content, and responds in context.

**Lesson for Seneca**: The move from "stateless command widget" to "persistent companion with memory and personality" is exactly the evolution Seneca needs. The visual personality element is critical — Seneca needs a face (or its equivalent: a visual presence that feels alive).

#### 3. Duolingo — Character-Driven Learning

Duolingo's characters are the product's emotional infrastructure:

- **Characters as emotional relationships**: Duo transforms abstract app notifications into emotional stakes. Users feel they're letting Duo down, not just skipping a lesson. This anthropomorphic connection drives 3.6x higher retention for 7-day streak maintainers.
- **Personality through reaction, not dialogue**: The characters express personality through animations, facial expressions, and reactions to user actions — not through long conversations. A slow sarcastic clap from Lily communicates more personality than 100 words of chat.
- **Value before signup**: Users complete a full lesson, earn XP, and start a streak BEFORE any account creation. The signup prompt is "save your progress" — loss prevention, not access granting.
- **Character as pedagogical framework**: Each character represents a different teaching style. Duo is encouraging, Lily is dryly witty, Oscar is dramatically serious. The character diversity means different users find different emotional hooks.

**Lesson for Seneca**: Seneca's persona system (Navigator/Analyst/Partner/Guide) has the right architecture but zero visual expression. A subtle animated sigil that reacts to user actions (brightens when they engage, pulses when governance is urgent, settles when things are calm) could create the same emotional hook without a literal face.

#### 4. Intercom Fin — AI Agent Onboarding

Intercom's Fin resolves complex queries across all channels with setup that takes under an hour:

- **Personality settings as first-class config**: Fin has workspace-level personality settings that affect tone, formality, and communication style. The personality isn't an afterthought — it's configured before deployment.
- **Preview before deploy**: Designers can see exactly how personality changes will appear to users before going live. This "what you see is what they get" approach ensures personality is intentional.
- **Day-one value**: Fin starts resolving conversations on day one. The onboarding emphasis is on immediate utility, not learning curve.
- **Multi-channel consistency**: Same personality across voice, email, chat, social. The companion is recognizable regardless of surface.

**Lesson for Seneca**: Multi-surface consistency is key. Whether the user encounters Seneca via the Dock, the Panel, mobile PeekBar, or a future command palette, it should feel like the same entity. Currently, the Dock and Panel feel like different products.

#### 5. Claude.ai — Onboarding Experience

Claude's onboarding focuses on getting to value in the first 10-15 seconds:

- **Guided structure over blank canvas**: Rather than dropping users into a blank chat, Claude provides structured guidance that helps new users understand what's possible.
- **The first 10 seconds**: If the first interaction feels generic or unfinished, most users never return. The cold-start problem is THE problem.
- **Warm, reflective tone**: Claude's communication style (described as "Sage") is warm, calm, honest, and reflective. It never feels robotic or corporate.
- **Capability demonstration through doing**: Rather than listing features, Claude demonstrates capability through the first interaction itself.

**Lesson for Seneca**: The SenecaDock's opening moment must demonstrate capability through warmth, not through a feature list. Instead of ghost prompts that list what Seneca CAN do, the Dock should show Seneca already doing it — already knowing something about the governance landscape, already having an opinion to share, already warm and ready.

#### 6. GitHub Copilot Chat — Persistent Sidebar

Copilot Chat's evolution from inline completions to a persistent sidebar companion:

- **Threaded conversations**: Users can branch off from a main thread to explore tangents without losing context. This is critical for governance exploration where one question naturally leads to another.
- **Rich preview in side panel**: Generated content can be previewed directly in the panel without switching context. For Seneca, this means entity cards, proposal summaries, and match results should render inline.
- **Context through @ references**: The `@workspace`, `@terminal`, `@vscode` system lets users explicitly pull context into conversation. Seneca's future `@proposal`, `@drep`, `@constitution` system mirrors this.
- **Always available, never intrusive**: The sidebar is a constant presence but never pops open uninvited. Users develop muscle memory for when to reach for it.

**Lesson for Seneca**: The sidebar model works, but only when the companion earns its presence through consistent utility. The Panel's current utilitarian design doesn't create the "I want to check in with Seneca" impulse that Copilot Chat creates.

### Cross-Benchmark Synthesis

The pattern across all six benchmarks is clear:

| Benchmark      | What They Got Right                                            | What Seneca Should Take                                                                |
| -------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Perplexity     | Trust through citations, smart follow-ups                      | Every governance claim must link to on-chain evidence                                  |
| Apple Siri     | Visual personality, persistent memory, standalone surface      | Seneca needs a visual presence that feels alive, not just an icon                      |
| Duolingo       | Character as emotional infrastructure, reactions over dialogue | Animated sigil that reacts to context, not a chatbot face                              |
| Intercom Fin   | Personality as first-class config, multi-surface consistency   | One Seneca across all surfaces, personality is designed not emergent                   |
| Claude.ai      | Warm capability demonstration, guided first moments            | First interaction should demonstrate governance knowledge, not ask what the user wants |
| GitHub Copilot | Persistent sidebar, threaded exploration, @ context            | Side panel should feel like a trusted colleague, not a tool drawer                     |

### Emerging Pattern: The Warm Welcome Paradigm

The strongest products in 2025-2026 share one trait: **they speak first**. They don't wait for the user to figure out what to ask. They arrive with knowledge, context, and warmth.

- Perplexity shows trending queries and curated collections
- Claude greets with structured guidance
- Duolingo's Duo waves and celebrates your return
- Intercom's Fin opens with a contextual greeting based on the page you're viewing

Seneca currently waits. It shows rotating ghost prompts and a text input. This is the chatbot paradigm, not the companion paradigm. The shift is: **Seneca should speak first, with something worth hearing.**

---

## Phase 4: Three Alternative Concepts

### Concept A: "The Living Overture" — Seneca as Animated Narrator

**Core idea**: Replace the SenecaDock with a cinematic Seneca presence that narrates the globe. Seneca's words appear as elegant typography overlaid on the globe, like opening titles in a film. The text is not in a box — it IS the hero content, floating in the space between the viewer and the globe.

**How it works on the anonymous homepage**:

1. **First 2 seconds**: Globe loads, slowly rotating. No UI except the header.
2. **Second 2-4**: A gentle glow appears at the bottom of the viewport. Seneca's words materialize — not in a card, but as typography floating over the dark background, like subtitles in an art film:

   > _"Cardano has a parliament of 700 representatives making decisions about a $2 billion treasury. One of them could represent you."_

3. **Second 4-6**: Below the text, two luminous entry points fade in:
   - **"Find my representative"** (primary, glowing compass accent)
   - **"Tell me more"** (secondary, opens conversation)

4. **Ongoing**: If the user doesn't interact for 8 seconds, the text gently transitions to a new narrative line:

   > _"Right now, 4 proposals are being decided. Your ADA could have a voice."_

5. **Interaction**: Clicking "Tell me more" or typing in the input that appears below the CTAs opens the conversation — but NOT in a separate panel. The conversation happens right there, overlaid on the globe. The globe subtly reacts to the conversation (nodes glow when discussed, camera slowly pans to relevant clusters).

**The Dock and Panel become ONE surface**: On the homepage, Seneca lives in the viewport space itself. When the user navigates to other pages, Seneca transitions to the right-side panel seamlessly — the same visual language (typography style, glow effects, compass sigil) but adapted to a panel form factor.

**Visual signature**: A small animated compass sigil that breathes (gently pulses with a warm glow). It sits at the origin point of Seneca's text. On other pages, this sigil appears in the panel header and the icon rail. It's Seneca's "face" — minimalist, geometric, but alive.

**Why this could be extraordinary**: It eliminates the chatbot-in-a-box paradigm entirely. Seneca isn't in a widget — Seneca is the narrator of the globe itself. The first impression is cinematic: a living visualization of democracy with an intelligent voice contextualizing what you're seeing. No product in governance, crypto, or civic tech does this.

**Risk**: Complex animation choreography. Text overlay on a 3D scene has readability challenges. The transition from "narrator mode" (homepage) to "panel mode" (other pages) needs to feel natural, not jarring.

---

### Concept B: "The Philosopher's Threshold" — Seneca as Conversational Gateway

**Core idea**: The anonymous homepage IS a conversation. Instead of globe + chatbot, the entire page is structured as a conversation between Seneca and the visitor. The globe is the backdrop, but the primary experience is Seneca speaking directly to you, with interactive choice points that guide you toward delegation.

**How it works on the anonymous homepage**:

1. **Opening**: Full-viewport globe in the background, slightly dimmed. In the center-bottom third of the screen, Seneca's opening message appears in a clean, warm typographic treatment:

   > _"Welcome. You're looking at the Cardano governance network — 700 representatives managing a $2 billion treasury for the ecosystem. Each dot is a real participant."_

2. **First choice point** (appears after 2s delay):
   Three capsule buttons:
   - "Who are they?" (educational path)
   - "Find one for me" (match path)
   - "What are they deciding?" (exploration path)

3. **Path branching**: Each choice triggers a Seneca response + globe interaction:
   - "Who are they?" → Globe zooms to a cluster, Seneca explains DReps: _"These are Delegated Representatives — DReps. ADA holders like you choose one to vote on proposals. Think of it as choosing a member of parliament."_ Globe highlights active DReps.
   - "Find one for me" → Transitions into the match flow, but IN the conversation. Questions appear as Seneca's dialogue, not as a separate quiz UI. Globe progressively filters as answers narrow matches.
   - "What are they deciding?" → Globe highlights active proposal nodes. Seneca narrates: _"Right now, there are 4 active proposals. The biggest asks for 12M ADA to fund developer tooling."_

4. **The thread continues**: Every response ends with a choice point. The conversation naturally funnels toward: understand governance → find alignment → connect wallet → delegate. But the user controls the pace and direction.

5. **Persistence**: If the user returns, Seneca remembers (via localStorage): _"Welcome back. Last time you were curious about treasury proposals. Shall we pick up there, or start fresh?"_

**Panel unification**: On non-homepage pages, Seneca transitions to the right panel, but the SAME conversation thread continues. The panel header shows "Continuing from: The Philosopher's Threshold" or similar, maintaining narrative continuity.

**Visual treatment**: The conversation isn't in a chat bubble UI. It's clean typography on the dark background with generous whitespace. Think of it as a guided meditation app meets a governance briefing. Warm, spacious, unhurried.

**Why this could be extraordinary**: It solves the hero text problem AND the cold-start problem simultaneously. The homepage doesn't need hero text because the CONVERSATION is the hero. Every visitor gets a personalized first impression. The globe becomes a living illustration of what Seneca is explaining, not a decorative backdrop.

**Risk**: Heavy reliance on AI response quality for the first impression. Latency on the first message is critical (must be <500ms, probably needs pre-computed opening). The "conversation as landing page" pattern is unproven at scale. Users who just want to browse might find it presumptuous.

---

### Concept C: "The Compass Sigil" — Unified Ambient Presence with Dock-Panel Merge

**Core idea**: Rather than reimagining the homepage structure, evolve the existing Dock + Panel into a single, unified Seneca surface with a distinctive animated identity element (the "Compass Sigil") that persists across all pages. The Sigil is Seneca's face — it reacts, it breathes, it communicates state. The Dock becomes warm and inviting. The Panel becomes an expansion of the Dock.

**How it works on the anonymous homepage**:

1. **The Sigil**: A small (48px) animated compass rose in the lower-left corner. Not a static icon — it's a living element:
   - Default state: gentle breathing glow, rotating needles pointing toward "north" (governance health direction)
   - Urgent governance: faster pulse, warmer color (amber tint)
   - Match mode: needles spin, searching
   - Idle/calm: slow, meditative breathing
   - Greeting: brief brightening when the page loads, like making eye contact

2. **The Dock reimagined**: The Dock is no longer a chat widget. It's Seneca's voice panel, anchored to the Sigil:

   **Opening state** (what the anonymous visitor sees first):

   ```
   [Compass Sigil]
   "Cardano runs on decentralized governance.
    700 representatives. $2B treasury.
    You can choose one to represent your ADA
    in about 60 seconds."

   [Find my representative]  [Ask Seneca anything...]
   ```

   This is warm, human, informative. It tells you what Cardano governance IS, why it matters, and what you can do — in 4 lines. The primary CTA is "Find my representative" (the match flow). The secondary is the free-form input.

3. **Dock-to-Panel transition**: When the user clicks "Find my representative" or types a question, the Dock doesn't disappear — it GROWS. On desktop, it expands rightward and upward into the full panel. On mobile, it expands upward into the bottom sheet. The Sigil stays in place as the anchor point, and the panel content flows from it. The Sigil moves to the panel header.

4. **Personality through the Sigil**: The Sigil's animation states communicate Seneca's "mood":
   - Answering: subtle pulse, like thinking
   - Presenting matches: compass needles point toward the globe (where matches are highlighted)
   - Error/uncertainty: slight wobble
   - Celebration (first match found, wallet connected): brief sparkle burst
   - Idle on non-homepage pages: gentle breathing, ambient presence

5. **Panel warmth**: When the conversation is active, Seneca's responses don't just appear as text. The Sigil visually reacts to each message — a small flourish when Seneca starts "speaking," a settle when the response is complete. This creates the illusion of a living entity, not a text generator.

6. **Multi-page persistence**: The Sigil appears on every page (in the icon rail or as a floating element). Clicking it opens the unified Seneca panel. The conversation thread persists across navigation. If you asked about a proposal on the homepage and then navigate to that proposal's page, Seneca acknowledges: "Ah, here's the proposal we were discussing."

**Why this could be extraordinary**: It's evolutionary rather than revolutionary — it builds on what exists (Dock + Panel) rather than replacing it. But the Compass Sigil as a living identity element, combined with the warm opening copy and the smooth Dock-to-Panel transition, transforms Seneca from "a chatbot feature" into "a character who lives in this product." The low risk and iterative nature mean it can ship quickly and be refined.

**Risk**: The Sigil animations need to feel premium, not gimmicky. The Dock opening copy needs to be perfect — it's doing the work of hero text, value proposition, AND conversation starter. The Dock-to-Panel transition needs to feel spatial and intentional, not just a panel opening.

---

## Phase 5: Concept Deep-Dive — Recommended: Concept C with Elements of A

### The Recommendation: "The Living Compass" (Concept C + A's Cinematic Opening)

After analyzing all three concepts against Governada's constraints, Concept C is the strongest foundation, enhanced with Concept A's cinematic text treatment for the homepage. Here's why:

**Why not pure Concept A (Living Overture)**:

- Floating text over a 3D scene has significant readability and accessibility challenges
- The transition from "narrator mode" to "panel mode" is a hard UX seam
- Requires heavy animation engineering for diminishing returns

**Why not pure Concept B (Philosopher's Threshold)**:

- Making the entire homepage a conversation is too radical a bet on AI response quality
- Users who want to browse without conversing (common in crypto) have no escape hatch
- The UX constraints document specifies the homepage's JTBD is "Understand what Governada does" — a conversation assumes the user already wants to engage

**Why Concept C + A's opening**:

- Evolutionary, shippable, low risk
- The warm opening copy solves the hero text problem without replacing the globe
- The Compass Sigil creates character without the complexity of a full animated persona
- The Dock-to-Panel merge creates unified Seneca without architectural rewrite
- Taking Concept A's cinematic text treatment for just the opening state gives premium feel

### Detailed Design: The Living Compass

#### 1. The Compass Sigil — Seneca's Visual Identity

The Sigil is a stylized compass rose rendered as an SVG animation. It lives in a 48x48px container but its glow extends slightly beyond. Design language:

- **Geometry**: Four cardinal points (N/S/E/W) as elegant tapered lines, with a central circle
- **Color**: Compass Teal (the primary brand color) with subtle gradient shifts based on state
- **Animation**: CSS + Framer Motion. No canvas or WebGL — must be lightweight
- **States**:
  - `idle`: Slow rotation (1 revolution per 30 seconds), gentle opacity breathing (0.7-1.0)
  - `greeting`: Brief brightening (1.0 opacity, slight scale to 1.1) when page loads, settles after 1s
  - `thinking`: Faster rotation, subtle pulse (like a heartbeat)
  - `speaking`: Glow intensifies, needles steady (pointing "at" the user)
  - `urgent`: Amber tint added, pulse frequency increases
  - `celebration`: Brief radial sparkle burst (compass points extend momentarily), returns to idle
  - `searching` (match mode): Needles spin freely, then progressively lock to cardinal directions as answers are given
  - `connected` (post-match): Warm golden tint, needles point toward the globe

The Sigil is Seneca's equivalent of Duo's face. It's abstract enough to feel futuristic and governance-appropriate (no cute mascot), but animated enough to feel alive.

#### 2. The Warm Dock — Homepage Opening State

The SenecaDock transforms from a chatbot widget into a narrative entry point. Two distinct states:

**State A: First Visit (no localStorage marker)**

```
+-----------------------------------------------+
|                                                |
| [Compass Sigil - greeting animation]           |
|                                                |
| "Cardano runs on decentralized governance.     |
|  700 representatives are making decisions      |
|  about a $2 billion treasury right now.        |
|                                                |
|  One of them could represent your ADA —        |
|  and finding them takes 60 seconds."           |
|                                                |
| [===== Find my representative =====]           |
|                                                |
| [Ask Seneca anything about governance...]      |
|                                                |
+-----------------------------------------------+
```

Typography: The message uses the display font (Fraunces) for the first line, body font (Space Grotesk) for the rest. Generous line-height (1.6). Text color: white/80 for body, white/95 for the key phrase "One of them could represent your ADA." The whole card has the same glassmorphic treatment but slightly larger (w-96 on desktop, full-width on mobile).

**State B: Returning Visit (localStorage marker present)**

```
+-----------------------------------------------+
|                                                |
| [Compass Sigil - greeting]                     |
|                                                |
| "Welcome back. [Governance is active right     |
|  now — 4 proposals heading to a vote with      |
|  3 days left in the epoch.]"                   |
|                                                |
| [Continue where I left off]  [Start fresh]     |
|                                                |
| [Ask Seneca anything...]                       |
|                                                |
+-----------------------------------------------+
```

The bracketed text is the dynamic `narrativePulse` from the API — already computed, zero latency. This makes Seneca feel aware and current, not generic.

**State C: Post-Match Return (match results in localStorage)**

```
+-----------------------------------------------+
|                                                |
| [Compass Sigil - connected glow]               |
|                                                |
| "You matched with ShelleyGov (87%),            |
|  CardanoGuardian (82%), and TreasuryWatch      |
|  (79%) last time. Ready to delegate?"          |
|                                                |
| [See my matches]  [Start over]                 |
|                                                |
| [Ask Seneca anything...]                       |
|                                                |
+-----------------------------------------------+
```

#### 3. The Dock-to-Panel Transition

When the user interacts with the Dock, it transitions into the full Seneca panel:

**Desktop (>=1280px)**:

- The Dock card's border dissolves
- Content slides/grows to the right side of the screen, becoming the IntelligencePanel
- The Compass Sigil moves from the Dock position to the panel header
- Duration: 300ms, spring physics (same as current panel animation)
- The globe is NOT occluded — panel compresses the main content (already implemented)

**Mobile (<1024px)**:

- The Dock card expands upward into the MobileIntelSheet
- Bottom sheet behavior is preserved (drag to expand/collapse)
- The Compass Sigil moves to the sheet header

**The key insight**: There is no "opening a separate panel." The Dock IS the panel's collapsed state on the homepage. On other pages, the Sigil in the icon rail is the panel's collapsed state. One surface, two form factors.

#### 4. Conversation Warmth Patterns

Seneca's conversation UI gets subtle personality upgrades:

**Seneca's messages**: Instead of just a small Compass icon + text (current), each Seneca message starts with the Sigil in its `speaking` state, with the message appearing with a slight typing delay (50ms per character for the first 20 chars, then instant). This creates the sensation of Seneca composing a thought, not dumping text.

**User's messages**: Current right-aligned bubble treatment is good. Keep it.

**Acknowledgement reactions**: When the user asks a question, before the response starts streaming, a brief Sigil animation plays (`thinking` state for 200-400ms). This fills the latency gap with character, not a loading spinner.

**Celebration moments**:

- First match completed: Sigil does its sparkle burst. Seneca says something warm: "There you go — your governance identity is taking shape."
- Wallet connected: Sigil shifts to its golden `connected` glow. "Now you can make it official. Your ADA, your voice."
- First delegation: Full celebration — Sigil sparkle + confetti particles (subtle, not childish). "Welcome to Cardano governance. You just gave your ADA a voice."

**Error states**: Sigil wobbles slightly. Seneca's tone remains warm: "I hit a snag there. Let me try again." Not "Error: request failed."

#### 5. Persona Visual Expression

The current four personas (Navigator, Analyst, Partner, Guide) get visual presence through the Sigil and the panel header:

| Persona   | Sigil Accent           | Panel Header         | Ghost Prompt Tone     |
| --------- | ---------------------- | -------------------- | --------------------- |
| Navigator | Compass Teal (default) | "Seneca - Navigator" | Warm, educational     |
| Analyst   | Amber shift            | "Seneca - Analyst"   | Precise, data-forward |
| Partner   | Violet shift           | "Seneca - Partner"   | Collaborative, direct |
| Guide     | Soft Teal              | "Seneca - Guide"     | Reflective, personal  |

The accent color shift is subtle (not jarring) — just the Sigil's glow color and a thin accent line at the top of the panel. Enough that a returning user subconsciously notices the panel feels different on a proposal page vs the homepage.

#### 6. The "Seneca Knows" Moments

These are the micro-interactions that make Seneca feel genuinely intelligent, not just responsive:

1. **Globe-to-Seneca narration**: When the user hovers on a globe node for 5+ seconds without clicking, the Dock (or PeekBar on mobile) updates its ghost prompt: "Curious about that DRep? Tap them, or ask me." The Sigil brightens slightly.

2. **Page-context greetings**: When opening Seneca on a proposal page for the first time, instead of showing the default panel, Seneca opens with a 1-line contextual greeting: "This proposal asks for 5M ADA for developer tooling. Want the full analysis?" This is pre-computed (ambient intelligence from Tier 1), not a live LLM call.

3. **Epoch urgency awareness**: When <24 hours remain in an epoch with active proposals, the Sigil shifts to its `urgent` state on all pages. The panel's opening line changes: "Voting closes in 18 hours. 3 proposals are still undecided."

4. **Cross-session memory**: "Last time, you were interested in treasury transparency DReps. Should I filter your matches for that?" (LocalStorage-backed, no auth required.)

5. **Sentiment acknowledgement**: After the match quiz, Seneca doesn't just show results. It acknowledges the user's governance identity: "You're a Treasury Guardian — you prioritize fiscal responsibility and transparency. That puts you in the 23% of Cardano holders who share that priority." This makes the user feel seen, not processed.

#### 7. Futuristic Warmth: The Visual Language

The challenge: feel cutting-edge (this is blockchain governance AI) without feeling cold or robotic. The solution:

**Warm elements**:

- Display font (Fraunces) for Seneca's key phrases — humanist serif, not monospace
- Generous whitespace in the Dock and panel — spacious, not cramped
- Rounded corners (2xl) on cards — approachable
- Text animations that feel like someone is forming a thought, not rendering output
- The Sigil's organic breathing animation — alive, not mechanical
- Color: Compass Teal has inherent warmth (it's not cold blue — it's ocean-teal with green undertones)

**Futuristic elements**:

- Glassmorphic surfaces with backdrop blur — depth and translucency
- The globe as a living data visualization behind every interaction
- The Sigil itself — a geometric, precise compass rose that pulses with data
- Streaming text responses with citations (Perplexity-style)
- Globe nodes reacting in real-time to conversation (highlighting, flying-to)
- Subtle particle effects during celebration moments

**The synthesis**: Think of it as the aesthetic of a very advanced planetarium — warm, dark, immersive, with precise, beautiful data visualization and a knowledgeable human guide narrating what you're seeing. Not a spaceship cockpit. Not a cozy coffee shop. A place of wonder and intelligence.

---

## Phase 6: Implementation Sketch

### Architecture Changes

**What changes**:

1. **SenecaDock** — Complete rewrite. New warm opening states (first visit / returning / post-match). Animated Compass Sigil component. Dock-to-Panel transition choreography.

2. **IntelligencePanel** — Minor changes. Accept Sigil component as header element. Add persona accent color to panel border. Add contextual greeting system.

3. **New component: CompassSigil** — Standalone animated SVG component with state machine (idle, greeting, thinking, speaking, urgent, celebration, searching, connected). Framer Motion for animations. Accepts `state` prop.

4. **New hook: useSenecaWarmth** — Manages first-visit detection, returning-visit detection, post-match state, wallet detection, and time-of-day awareness. Computes the appropriate Dock opening state and Seneca greeting.

5. **useIntelligencePanel** — Extend to support Dock-to-Panel transition (new `expandFromDock` mode). Add greeting system that delivers 1-line contextual openers per page.

**What doesn't change**:

- Advisor backend (already supports all needed context)
- SenecaConversation, SenecaMatch, SenecaResearch (internal panel components are fine)
- Globe-Seneca bridge (already works)
- Persona system (add visual accents, don't restructure)
- Mobile architecture (PeekBar + MobileIntelSheet are solid)

### Phased Delivery

**Phase 1: Warm Dock (3-4 hours)**

- Rewrite SenecaDock with warm opening copy (3 states: first visit, returning, post-match)
- Add `useSenecaWarmth` hook for state detection (localStorage-based)
- Use existing narrativePulse for returning visitor greeting
- CTA buttons: "Find my representative" (match) + text input
- No Sigil yet — use existing Compass icon with subtle breathing animation via Framer Motion

**Phase 2: Compass Sigil (2-3 hours)**

- Create `CompassSigil` component with SVG + Framer Motion
- State machine: idle, greeting, thinking, speaking, celebration
- Replace Compass icon in Dock, Panel header, and PeekBar
- Wire Sigil states to conversation lifecycle (thinking during latency, speaking during stream)

**Phase 3: Dock-to-Panel Transition (3-4 hours)**

- Implement the spatial transition from Dock to Panel on desktop
- Sigil moves from Dock to Panel header as anchor point
- On mobile: Dock expands into MobileIntelSheet (same logic, vertical direction)
- Remove the perception that Dock and Panel are separate surfaces

**Phase 4: Persona Accents + Contextual Greetings (2-3 hours)**

- Add subtle accent color to Sigil and panel border per persona
- Implement `panelGreeting` system: pre-computed 1-line openers per page type
- Wire page-context greetings to panel open event
- Add "Seneca - Navigator/Analyst/Partner/Guide" to panel header

**Phase 5: "Seneca Knows" Micro-interactions (2-3 hours)**

- Globe hover awareness (5s hover triggers ghost prompt update)
- Cross-session memory (localStorage for match history, conversation topics)
- Epoch urgency awareness (Sigil state change when voting deadline <24h)
- Celebration animations (match complete, wallet connect, first delegation)

**Phase 6: Wallet Detection + Referrer Awareness (1-2 hours)**

- Detect Cardano wallet extensions (Eternl, Nami, Vespr, Lace)
- Adjust Dock opening copy: "I see you have a wallet — you're halfway to participating"
- Detect referrer URL for contextual openers (optional)

### Total Estimated Effort: 13-19 hours across 6 phases

Each phase is independently shippable and adds value. Phase 1 alone transforms the anonymous homepage experience.

### Feature Flags

All behind existing `governance_copilot` flag. New sub-flags if needed:

- `seneca_warm_dock` — New Dock with warm opening states
- `seneca_sigil` — Animated Compass Sigil
- `seneca_dock_transition` — Dock-to-Panel spatial transition

### What This Unlocks Next

Once the unified Seneca presence exists with the Compass Sigil, several future capabilities become natural:

1. **Voice interaction** — The Sigil becomes the visual target for "Hey Seneca" voice activation
2. **Proactive notifications** — The Sigil can pulse/change state when something needs attention, without interrupting
3. **@ reference system** — Contextual entity referencing in conversation (`@proposal:487`, `@drep:ShelleyGov`)
4. **Cross-session threads** — "Continue our conversation from last time" with persistent thread storage
5. **Multi-language Seneca** — Same visual identity, persona system, and Sigil regardless of language
6. **Seneca on external embeds** — If Governada offers embeddable widgets, the Sigil becomes the recognizable brand element

---

## Summary

The Living Compass concept transforms Seneca from a chatbot feature into a persistent, warm, intelligent companion through three key moves:

1. **The Warm Dock** replaces generic ghost prompts with a human-readable explanation of what Cardano governance is and a clear 60-second path to participation. It speaks first, with something worth hearing.

2. **The Compass Sigil** gives Seneca a visual identity that breathes, reacts, and communicates state — abstract enough for governance gravitas, animated enough for emotional connection. It's Seneca's face without being a face.

3. **The Unified Surface** merges Dock and Panel into one expandable Seneca presence. There's no "opening a separate tool" — there's Seneca expanding to help you, then settling back when you don't need it.

The globe remains the hero. Seneca is its narrator, guide, and voice — complementing the visual spectacle with contextual intelligence and warm guidance. The combination is what no other governance product has: a living visualization of democracy with an AI companion who can explain every part of what you're seeing.
