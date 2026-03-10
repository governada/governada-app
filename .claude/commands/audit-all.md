Comprehensive audit of Governada by launching parallel experience audits, engine audit, and security audit. Each subagent gets its own full context window.

## Scope

Argument: `$ARGUMENTS`

- If empty or "full": 3 experience audits (citizen-delegated, drep, spo) + engine + security + synthesis (max coverage)
- If "experiences": Only experience audits (citizen-delegated, drep, spo)
- If "systems": Only engine + security
- If "quick": Abbreviated — 1 experience (citizen-delegated) + engine, no work plan

---

## Phase 1: Launch Subagents

Launch ALL subagents simultaneously in a single message using the Agent tool. Do NOT use `isolation: "worktree"` — these are read-only audits.

### Subagent Return Format (shared by all)

```
AUDIT: [Name]
DIMENSIONS:
- [ID] [Name]: [score]/10 — [key evidence]
AVERAGE: [avg]/10
P0_GAPS:
- [gap] | [affected files] | [why P0]
P1_GAPS:
- [gap] | [affected files]
TOP_RECOMMENDATIONS:
1. [most impactful]  2. [second]  3. [third]
RAW_EVIDENCE: [2-3 sentences of specific findings]
```

### Experience Audit Subagents (3 agents)

For each, launch an Agent with the following prompt pattern:

> You are running an experience audit for **[persona-state]**. Read `.claude/commands/audit-experience.md` for full methodology. Read `docs/strategy/context/audit-rubric.md` for scoring anchors. Execute the full audit with all 5 sub-agents. Return results in the structured format above. Dimensions are E1-E6.

**1. Citizen Delegated**

- Persona-state: `citizen-delegated`
- Primary routes: `/`, `/delegation`, `/governance/*`, `/you/*`
- This is the core persona — the experience most users will have.

**2. DRep**

- Persona-state: `drep`
- Primary routes: `/workspace`, `/governance/proposals/*`, `/you/*`
- This is the power user — validates the workspace and action queue experience.

**3. SPO**

- Persona-state: `spo`
- Primary routes: `/workspace`, `/governance/pools/*`, `/you/*`
- This validates the SPO layer and governance coverage from the operator perspective.

### System Audit Subagents (2 agents)

**4. Engine**

```
Read `.claude/commands/audit-engine.md` for methodology. Execute the full audit. Return results in the structured format above. Dimensions are N1-N6.
```

Key files: `lib/scoring/`, `lib/alignment/`, `lib/sync/`, `lib/ghi/`, `lib/matching/`

**5. Security**

```
Read `.claude/commands/audit-security.md` for methodology. Execute the full audit. Return results in the structured format above. Dimensions are SEC1-SEC5.
```

Key files: `lib/nonce.ts`, `middleware.ts`, `lib/api/`, `lib/supabaseAuth.ts`, `lib/adminAuth.ts`

---

## Phase 2: Synthesis (After All Subagents Return)

### 2.1 Unified Experience Dashboard

| Audit             | Dimensions | Scores          | Average |
| ----------------- | ---------- | --------------- | ------- |
| Citizen Delegated | E1-E6      | [from subagent] | [avg]   |
| DRep              | E1-E6      | [from subagent] | [avg]   |
| SPO               | E1-E6      | [from subagent] | [avg]   |
| Engine            | N1-N6      | [from subagent] | [avg]   |
| Security          | SEC1-SEC5  | [from subagent] | [avg]   |
|                   |            | **COMPOSITE**   | [avg]   |

### 2.2 Cross-Experience Analysis

This is the primary value-add of the unified audit. Individual audits can't see patterns across personas and systems — that's what this command uniquely provides.

- **Systemic issues**: Are there problems that appear across 2+ persona experiences? If so, these are systemic — not persona-specific. Elevate priority.
- **Intelligence leverage gaps**: Does the engine audit reveal capabilities that aren't surfaced in the experience audits? These are missed opportunities where backend intelligence exists but the frontend doesn't expose it.
- **Root cause tracing**: Do experience friction points trace back to engine/data issues? Map frontend symptoms to backend root causes.
- **Flywheel health**: Which of the 5 flywheels (Accountability, Engagement, Content/Discourse, Viral/Identity, Integration/Distribution) are being activated by the current experiences? Which are stalled?

### 2.3 Unified Priority Stack

Merge ALL gaps from ALL audits into a single prioritized list:

- **P0 — Blockers**: Security critical + systemic experience failures. Must fix immediately.
- **P1 — This Sprint**: High-impact gaps reinforced by cross-experience analysis. Items found by 2+ audits get priority boost.
- **P2 — Next Sprint**: Important improvements that don't block progress but measurably improve quality.
- **P3 — Backlog**: Polish, deferred features, nice-to-haves.

For each item, note which audit(s) surfaced it.

### 2.4 Work Plan

Read `docs/strategy/context/work-plan-template.md` for the chunk format.

Convert the priority stack into executable chunks:

1. Group related findings into coherent PRs
2. Identify parallel opportunities — chunks touching different files/domains can run as simultaneous agents
3. Flag decision points where the user must weigh in
4. Sequence: infrastructure before consumers, foundation before polish

Present the work plan and ask: **"Which chunks should I start? I can run multiple agents in parallel on independent chunks."**

---

## Rules

- **Launch all subagents in a SINGLE message** to maximize parallelism. Never launch sequentially.
- **Each subagent operates at full depth.** The point of subagents is to avoid depth tradeoffs. Never tell a subagent to abbreviate.
- **Cross-experience analysis is the primary value-add.** Individual audits can't see cross-persona patterns — that's what this command uniquely provides.
- **For "quick" mode**: Skip DRep and SPO experience audits, skip security, no work plan. Just scorecard + P0s from citizen-delegated + engine.
- **For "experiences" mode**: Skip engine and security. Full synthesis on experience audits only.
- **For "systems" mode**: Skip experience audits. Full synthesis on engine + security only.
- **If a subagent fails or returns incomplete results**, note it in the synthesis and proceed with what you have.
- **Be brutally honest in the synthesis.** The unified view should surface hard truths that individual audits might soften.
