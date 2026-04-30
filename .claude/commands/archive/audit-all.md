Run a comprehensive audit of Governada by launching parallel subagents for experience audits, engine audit, and security audit.

## Scope

Argument: `$ARGUMENTS`

- If empty or "full": 3 experience audits (citizen-delegated, drep, spo) + engine + security + synthesis
- If "experiences": Only the 3 experience audits in parallel
- If "systems": Only engine + security audits
- If "quick": 1 experience audit (citizen-delegated) + engine, abbreviated synthesis, no work plan

## Architecture

Each audit runs as an independent subagent (Agent tool). Subagents write structured results to `.claude/audit-results/` files, keeping the orchestrator lean. A final synthesis agent reads all result files with a fresh context window.

## Phase 1: Launch All Subagents

Launch ALL subagents simultaneously in a single message. Do NOT use `isolation: "worktree"` — read-only audits.

Each subagent **writes full results to `.claude/audit-results/<name>.md`** and returns ONLY a 3-line summary to the orchestrator: audit name, average score, P0 gap count.

### Result File Format (written by each subagent)

```
AUDIT: [Name]
DATE: [ISO date]
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
ALREADY_STRONG:
- [what's working well and should not change]
```

### Experience Audit Subagents (3 agents)

For each, launch an Agent with: "You are running an experience audit for [persona-state]. Read `.claude/commands/audit-experience.md` for full methodology. Read `docs/strategy/context/audit-rubric.md` for scoring anchors. Execute the full audit with all 5 sub-agents. **Write full results to `.claude/audit-results/experience-[persona].md`**. Return ONLY: audit name, average score, P0 count. Dimensions E1-E6."

1. **Citizen Delegated** — persona: `citizen-delegated`, routes: `/`, `/delegation`, `/governance/*`, `/you/*`
2. **DRep** — persona: `drep`, routes: `/workspace`, `/governance/proposals/*`, `/you/*`
3. **SPO** — persona: `spo`, routes: `/workspace`, `/governance/pools/*`, `/you/*`

### System Audit Subagents (2 agents)

4. **Engine** — command: `audit-engine.md`, key files: `lib/scoring/`, `lib/alignment/`, `lib/sync/`, dimensions N1-N6. **Write to `.claude/audit-results/engine.md`**.
5. **Security** — command: `audit-security.md`, key files: `lib/nonce.ts`, `middleware.ts`, `lib/api/`, dimensions SEC1-SEC5. **Write to `.claude/audit-results/security.md`**.

## Phase 2: Synthesis (Separate Subagent)

**Do NOT synthesize in the orchestrator.** Launch a synthesis subagent with fresh context: "Read ALL files in `.claude/audit-results/`. Produce the unified report below. Write final report to `.claude/audit-results/synthesis.md`."

### 2.1 Unified Experience Dashboard

| Audit             | Dimensions | Scores        | Average |
| ----------------- | ---------- | ------------- | ------- |
| Citizen Delegated | E1-E6      | [scores]      | [avg]   |
| DRep              | E1-E6      | [scores]      | [avg]   |
| SPO               | E1-E6      | [scores]      | [avg]   |
| Engine            | N1-N6      | [scores]      | [avg]   |
| Security          | SEC1-SEC5  | [scores]      | [avg]   |
|                   |            | **COMPOSITE** | [avg]   |

### 2.2 Cross-Experience Analysis

- **Systemic issues**: Problems found across 2+ experience audits
- **Intelligence leverage gaps**: Engine capabilities not surfaced in experiences
- **Root cause tracing**: Experience friction → engine/data root cause
- **Flywheel health**: Which flywheels are active, which are stalled

### 2.3 Unified Priority Stack

P0 (blockers) → P1 (this sprint) → P2 (next sprint) → P3 (backlog). Note source audit(s).

### 2.4 Work Plan

Read `docs/strategy/context/work-plan-template.md`. Convert to executable chunks. Ask: "Which chunks should I start?"

## Rules

- Launch all subagents in a SINGLE message for parallelism
- Subagents write full results to files, return only brief summaries to orchestrator
- Synthesis runs as a SEPARATE subagent with fresh context — reads result files
- Cross-experience analysis is the primary value-add
- For "quick": 1 experience + engine only, no work plan
- Be brutally honest in synthesis
