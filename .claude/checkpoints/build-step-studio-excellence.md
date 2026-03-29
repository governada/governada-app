# Build Step: Studio Excellence — World-Class Author & Review (Layer 2)

**Status:** PHASE_4_COMPLETE
**Started:** 2026-03-29
**Current Phase:** 4 of 6 (Agent Evolution) — COMPLETE
**PR chain:** #700 (Phase 1) → #704 (Phase 2) → #708 (Phase 3) → #715 (Phase 4A) → #717 (Phase 4B) → #721 (Phase 4C)
**Predecessor:** `.claude/checkpoints/workspace-studio-upgrade.md` (Phases 1-5 DEPLOYED)

---

## What's Complete

| Phase    | Description                                                        | PRs  | Status      |
| -------- | ------------------------------------------------------------------ | ---- | ----------- |
| Phase 1  | Editor Foundation — Wire Tiptap to All Proposals                   | #700 | DEPLOYED    |
| Phase 2  | Intelligence Architecture — Persistent Brief + Decision Panel      | #704 | DEPLOYED    |
| Phase 3  | Living Document Substrate — Tracked Changes + Reviewer Suggestions | #708 | DEPLOYED    |
| Phase 4A | Proposal Plan Generator + Rationale Co-draft                       | #715 | DEPLOYED    |
| Phase 4B | Personalized Briefing + Feedback Synthesis + CC Express Lane       | #717 | DEPLOYED    |
| Phase 4C | Proactive Insight Stack                                            | #721 | DEPLOYED    |
| Phase 5  | Pre-Computation Pipeline + Batch Processing                        | —    | NOT STARTED |
| Phase 6  | Polish, Mobile, and Role Adaptation                                | —    | NOT STARTED |

---

## Phase 4 Summary — What Was Built

### 6 New AI Skills (all flag-gated)

| Skill                     | Category  | Model                                | Flag                      | File                                       |
| ------------------------- | --------- | ------------------------------------ | ------------------------- | ------------------------------------------ |
| `proposal-plan-generator` | authoring | DRAFT (8192 tokens)                  | `proposal_plan`           | `lib/ai/skills/proposal-plan-generator.ts` |
| `rationale-draft`         | review    | FAST (2048 tokens) + validation pass | `rationale_codraft`       | `lib/ai/skills/rationale-draft.ts`         |
| `personalized-briefing`   | review    | FAST (1536 tokens)                   | `personalized_briefing`   | `lib/ai/skills/personalized-briefing.ts`   |
| `feedback-synthesis`      | authoring | FAST (2048 tokens)                   | `feedback_synthesis`      | `lib/ai/skills/feedback-synthesis.ts`      |
| `cc-article-assessment`   | review    | FAST (3072 tokens) + validation pass | `cc_express_lane`         | `lib/ai/skills/cc-article-assessment.ts`   |
| `proactive-analysis`      | authoring | FAST (1024 tokens)                   | `proactive_interventions` | `lib/ai/skills/proactive-analysis.ts`      |

### New Components

| Component               | Purpose                                                                 | File                                                       |
| ----------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `ProposalPlan`          | Multi-section plan review (constitutional, risk, similar, improvements) | `components/workspace/author/ProposalPlan.tsx`             |
| `RationaleCitations`    | Clickable citation chips for rationale editor                           | `components/workspace/review/RationaleCitations.tsx`       |
| `PersonalizedSummary`   | AI-personalized executive summary with alignment signals                | `components/intelligence/sections/PersonalizedSummary.tsx` |
| `SynthesizedFeedback`   | Severity-ranked feedback clusters with "Apply Edit"                     | `components/intelligence/sections/SynthesizedFeedback.tsx` |
| `CCExpressPanel`        | Article-by-article constitutional assessment for CC members             | `components/workspace/review/CCExpressPanel.tsx`           |
| `CCArticleRow`          | Individual article verdict row with override controls                   | `components/workspace/review/CCArticleRow.tsx`             |
| `ProactiveInsightStack` | Multi-insight stack replacing single ProactiveInsight                   | `components/workspace/author/ProactiveInsightStack.tsx`    |

### New Hooks

| Hook                   | Purpose                                        | File                            |
| ---------------------- | ---------------------------------------------- | ------------------------------- |
| `useProactiveAnalysis` | 30s debounced proactive skill calls with dedup | `hooks/useProactiveAnalysis.ts` |

### Key Architecture Decisions (Phase 4)

1. **Skills over agent extensions** — All 6 features use the declarative skill pattern (`POST /api/ai/skill`) rather than extending the agent SSE protocol. Simpler, testable, no new event types needed.
2. **No database migrations** — All features are stateless or use existing tables. CC assessments are generated on-demand, not cached.
3. **No new Inngest functions** — All features are on-demand skill calls. Feedback synthesis consumes existing `consolidate-feedback` output.
4. **Graceful degradation everywhere** — Every skill falls back cleanly: personalized briefing → static summary, rationale co-draft → legacy endpoint, proactive insights → original single insight.
5. **Validation passes on citation-heavy skills** — `rationale-draft` and `cc-article-assessment` use second AI calls to verify constitutional article references are real.
6. **CC Express Lane in review registry** — Added `cc-express` SectionId at priority 3 (top of brief) for CC members. Section registry pattern makes this a one-line change.
7. **ProactiveInsightStack is flag-toggled** — Editor page renders either `ProactiveInsightStack` (flag on) or original `ProactiveInsight` (flag off), not both.

### Phase 4 Deferred Items (→ Phase 6 Polish)

- Interactive margin decorations (clickable callouts with "Fix" buttons in gutter)
- Agent-initiated proactive SSE events (server push without user message)
- Competing proposal detection ("A competing proposal was just submitted")
- Batch tracked-change application (apply all suggested edits at once)
- Rationale quality scoring + community comparison
- "What if everyone voted like you?" counterfactual in personalized briefing
- Inter-CC consensus view in express lane

---

## What Remains: Phase 5 + Phase 6

### Phase 5: Pre-Computation Pipeline + Batch Processing

From the plan (lines 288-325 of `C:\Users\dalto\.claude-personal\plans\imperative-pondering-glade.md`):

- **Pre-computation pipeline** (Inngest functions): On new proposal → run constitutional check, compute embeddings, generate summaries. On draft save → update quality pulse. On vote cast → update inter-body tallies. Serve from cache.
- **Batch processing** for DReps reviewing 10-30 proposals: `]` keyboard shortcut → next proposal, pre-computed brief loads instantly, progress bar, session continuity.
- **Passage prediction**: Simple model using historical patterns → passage probability.
- **Reviewer attention heatmaps**: Aggregate `section_read` durations → margin heat indicators.

**Key files to read:**

- `inngest/functions/` — existing functions (add new pre-computation functions here)
- `app/api/inngest/route.ts` — register new functions
- `hooks/useReviewQueue.ts` — cache management for pre-computed data
- `components/workspace/review/ReviewWorkspace.tsx` — batch processing keyboard shortcuts

### Phase 6: Polish, Mobile, and Role Adaptation

- Mobile author/review studios (single-column, bottom sheets)
- Role adaptation polish (per-segment brief fine-tuning)
- Compass design language enforcement (Fraunces/Space Grotesk, color tokens)
- Motion/transitions (lifecycle stage animations, tracked change micro-animations)
- Keyboard mastery (complete shortcut coverage)

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
You are building Phase 5 of the Studio Excellence build for Governada — Pre-Computation Pipeline + Batch Processing.

## FIRST: Read the checkpoint (CRITICAL — it's on main, not in your worktree)

Your worktree was created from a branch. The checkpoint is on main. To access it:

  HASH=$(git rev-parse origin/main) && git cat-file -p "$HASH:.claude/checkpoints/build-step-studio-excellence.md"

This checkpoint contains:
- Full inventory of what's already built (Phases 1-4 complete)
- 6 AI skills deployed, 7 new components, 1 new hook
- Architecture decisions made in prior phases
- What Phase 5 needs to build

## THEN: Read the full 6-phase plan

  cat "C:\Users\dalto\.claude-personal\plans\imperative-pondering-glade.md"

Phase 5 starts at line ~288 in the plan ("Phase 5: Pre-Computation Pipeline + Batch Processing").

## What's Already Deployed (DON'T REBUILD)

Phase 1 (PR #700): Tiptap wired to all proposal types
Phase 2 (PR #704): Stage-driven Intelligence Brief in both author + review studios
Phase 3 (PR #708): Living document substrate — suggestion resolution, version diff
Phase 4A (PR #715): Proposal Plan generator + rationale co-draft skills
Phase 4B (PR #717): Personalized briefing + feedback synthesis + CC express lane
Phase 4C (PR #721): Proactive insight stack with AI analysis

## What Phase 5 NEEDS TO BUILD

1. Pre-computation Inngest functions (on new proposal, on draft save, on vote cast)
2. Cache layer in Supabase for pre-computed intelligence
3. Batch processing support (] keyboard shortcut, progress bar, session continuity)
4. Passage prediction model
5. Reviewer attention heatmaps

## Key Files

- `inngest/functions/` — add new pre-computation functions
- `app/api/inngest/route.ts` — register new functions (SAME COMMIT)
- `hooks/useReviewQueue.ts` — enhance for pre-computed cache serving
- `components/workspace/review/ReviewWorkspace.tsx` — batch processing UI
- `lib/workspace/intelligence/` — section registry and types

Continue from where Phase 4 left off. The studio now has the full AI skill layer —
Phase 5 makes it fast via pre-computation and batch-efficient via keyboard-driven review.
```
