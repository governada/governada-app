Run a comprehensive audit of Civica by launching parallel subagents for all area audits and step verification. Each subagent gets its own full context window — no depth sacrificed.

## Scope

Argument: `$ARGUMENTS`

- If empty or "full": All 6 area audits + step bedrock verification + synthesis (maximum coverage)
- If "areas": Only the 6 area-specific audits in parallel
- If "steps": Only step completeness verification for shipped steps
- If "quick": Area audits only, abbreviated synthesis (fastest useful output)

---

## Architecture

Each audit runs as an independent subagent via the Agent tool. This means:

- **No context pressure** on this orchestrating conversation — each subagent has its own full window
- **Full audit depth** — subagents read their complete audit command and execute it without abbreviation
- **Maximum parallelism** — all independent audits launch simultaneously in a single message

---

## Phase 1: Launch All Subagents (Parallel)

Launch ALL of the following subagents simultaneously in a single message using the Agent tool. Do NOT use `isolation: "worktree"` — these are read-only audits.

Each subagent prompt tells the agent to read its audit command file and execute the full audit, but return only a structured summary.

### Area Audit Subagents (6 agents)

**1. Sync Pipeline Audit**

```
You are auditing the Civica sync pipeline. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `.claude/commands/audit-sync.md` for the full audit methodology
2. Read `docs/strategy/context/audit-rubric.md` for scoring anchor criteria
3. Execute every phase in the audit command with full evidence collection
4. For live data queries, use the Supabase MCP `execute_sql` tool

Key files to examine: `lib/sync/`, `inngest/functions/`, `utils/koios.ts`

Return your findings in this EXACT format:

AUDIT: Sync Pipeline
DIMENSIONS:
- S1 Pipeline Reliability: [score]/10 — [key evidence]
- S2 Data Freshness: [score]/10 — [key evidence]
- S3 Self-Healing: [score]/10 — [key evidence]
- S4 Performance: [score]/10 — [key evidence]
AVERAGE: [avg]/10

P0_GAPS:
- [gap] | [affected files/routes] | [why it's P0]

P1_GAPS:
- [gap] | [affected files/routes]

TOP_RECOMMENDATIONS:
1. [most impactful action]
2. [second]
3. [third]

RAW_EVIDENCE: [2-3 sentences of the most important specific findings — numbers, file paths, measurements]
```

**2. Data Integrity Audit**

```
You are auditing Civica's data integrity. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `.claude/commands/audit-data.md` for the full audit methodology
2. Read `docs/strategy/context/audit-rubric.md` for scoring anchor criteria
3. Execute every phase in the audit command with full evidence collection
4. Use Supabase MCP `execute_sql` for all database queries

Key files to examine: snapshot tables, `lib/data.ts`, `lib/scoring/`, migration files

Return your findings in this EXACT format:

AUDIT: Data Integrity
DIMENSIONS:
- D1 Completeness: [score]/10 — [key evidence]
- D2 Consistency: [score]/10 — [key evidence]
- D3 Freshness: [score]/10 — [key evidence]
- D4 Correctness: [score]/10 — [key evidence]
AVERAGE: [avg]/10

P0_GAPS:
- [gap] | [affected tables/queries] | [why it's P0]

P1_GAPS:
- [gap] | [affected tables/queries]

TOP_RECOMMENDATIONS:
1. [most impactful action]
2. [second]
3. [third]

RAW_EVIDENCE: [2-3 sentences of the most important specific findings]
```

**3. Scoring Methodology Audit**

```
You are auditing Civica's scoring methodology. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `.claude/commands/audit-scoring.md` for the full audit methodology
2. Read `docs/strategy/context/audit-rubric.md` for scoring anchor criteria
3. Execute every phase: methodology review, calibration analysis, gaming resistance, distribution health
4. Use Supabase MCP `execute_sql` for score distribution queries

Key files: `lib/scoring/`, `lib/alignment/`, `lib/ghi/`, `lib/matching/`, `lib/scoring/calibration.ts`

Return your findings in this EXACT format:

AUDIT: Scoring Methodology
DIMENSIONS:
- M1 Differentiation: [score]/10 — [key evidence]
- M2 Defensibility: [score]/10 — [key evidence]
- M3 Gaming Resistance: [score]/10 — [key evidence]
- M4 Calibration Quality: [score]/10 — [key evidence]
AVERAGE: [avg]/10

P0_GAPS:
- [gap] | [affected files] | [why it's P0]

P1_GAPS:
- [gap] | [affected files]

TOP_RECOMMENDATIONS:
1. [most impactful action]
2. [second]
3. [third]

RAW_EVIDENCE: [2-3 sentences of the most important specific findings — distribution stats, calibration issues, gaming vectors]
```

**4. UX Quality Audit**

```
You are auditing Civica's UX quality. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `.claude/commands/audit-ux.md` for the full audit methodology
2. Read `docs/strategy/context/audit-rubric.md` for scoring anchor criteria
3. Read persona docs from `docs/strategy/personas/` for journey specifications
4. Read `.claude/rules/product-vision.md` for design principles
5. Execute every phase: intelligence leverage, persona journeys, emotional design, interaction quality, retention, visual design craft

Key files: `app/` (pages), `components/` (UI), `components/civica/` (persona-specific)

Return your findings in this EXACT format:

AUDIT: UX Quality
DIMENSIONS:
- U1 Intelligence Surfacing: [score]/10 — [key evidence]
- U2 Persona Journey Completeness: [score]/10 — [key evidence]
- U3 Emotional Design & Storytelling: [score]/10 — [key evidence]
- U4 Interaction Quality & Polish: [score]/10 — [key evidence]
- U5 Retention & Engagement Architecture: [score]/10 — [key evidence]
- U6 Visual Design Craft: [score]/10 — [key evidence]
AVERAGE: [avg]/10

P0_GAPS:
- [gap] | [affected components/routes] | [why it's P0]

P1_GAPS:
- [gap] | [affected components/routes]

TOP_RECOMMENDATIONS:
1. [most impactful action]
2. [second]
3. [third]

RAW_EVIDENCE: [2-3 sentences — specific components, missing states, persona coverage gaps]
```

**5. User Journey Audit**

```
You are auditing Civica's user journeys end-to-end. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `.claude/commands/audit-journeys.md` for the full audit methodology
2. Read persona docs from `docs/strategy/personas/` for task specifications and targets
3. Walk through every citizen task (J-C1 through J-C7), DRep task (J-D1 through J-D4), and SPO task (J-S1 through J-S3)
4. Test edge cases from the edge case matrix
5. Build the regression baseline

Key files: `app/` (routes/pages), `components/` (flows), `lib/` (data/logic)

Return your findings in this EXACT format:

AUDIT: User Journeys
DIMENSIONS:
- J1 Task Completion: [score]/10 — [key evidence]
- J2 Friction & Efficiency: [score]/10 — [key evidence]
- J3 Edge Case Resilience: [score]/10 — [key evidence]
- J4 Cross-Journey Consistency: [score]/10 — [key evidence]
- J5 Progressive Disclosure: [score]/10 — [key evidence]
AVERAGE: [avg]/10

P0_GAPS:
- [gap] | [broken flow / task ID] | [why it's P0]

P1_GAPS:
- [gap] | [affected flow / task ID]

FRICTION_BASELINE:
- [task ID]: [measured clicks/steps] vs [target] — [PASS/FAIL]
(include top 5 worst friction points)

TOP_RECOMMENDATIONS:
1. [most impactful action]
2. [second]
3. [third]

RAW_EVIDENCE: [2-3 sentences — broken flows, friction measurements, edge case failures]
```

**6. Security Audit**

```
You are auditing Civica's security posture. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `.claude/commands/audit-security.md` for the full audit methodology
2. Execute every phase: auth/session, authorization/RLS, API security, data protection, wallet security, infrastructure hardening, engagement anti-gaming
3. Check the pre-launch checklist (critical/important/recommended tiers)

Key files: `lib/nonce.ts`, `lib/supabaseAuth.ts`, `lib/adminAuth.ts`, `lib/api/handler.ts`, `lib/api/withRouteHandler.ts`, `lib/api/keys.ts`, `middleware.ts`, `next.config.ts`, `supabase/migrations/`

Return your findings in this EXACT format:

AUDIT: Security
DIMENSIONS:
- SEC1 Auth & Session: [score]/10 — [key evidence]
- SEC2 Authorization & RLS: [score]/10 — [key evidence]
- SEC3 API Security: [score]/10 — [key evidence]
- SEC4 Data Protection: [score]/10 — [key evidence]
- SEC5 Infrastructure: [score]/10 — [key evidence]
AVERAGE: [avg]/10

LAUNCH_BLOCKERS:
- [blocker] | [severity] | [affected files]

P0_GAPS:
- [gap] | [affected files] | [why it's P0]

P1_GAPS:
- [gap] | [affected files]

TOP_RECOMMENDATIONS:
1. [most impactful action]
2. [second]
3. [third]

RAW_EVIDENCE: [2-3 sentences — specific vulnerabilities, missing controls, risk levels]
```

### Step Bedrock Subagents (2 agents)

These verify that completed vision steps are truly "flawless bedrock" for future work.

**7. Engine Bedrock (Steps 0–2.5)**

```
You are verifying that Civica's engine foundation (Steps 0, 1, 2, 2.5) is flawless bedrock for all future features. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `docs/strategy/context/build-manifest.md` for the checkbox list
2. Read `docs/strategy/ultimate-vision.md` — find the sections for Steps 0, 1, 2, and 2.5
3. For every [x] checkbox in steps 0-2.5: verify the file/route/table exists AND functions correctly (read the code, check for TODO/FIXME/HACK markers, verify it's not a stub)
4. For every [ ] checkbox: assess whether it blocks this step from being "complete bedrock"
5. Check cross-step integration: does Step 1 (matching) properly consume Step 0 (scoring)? Does Step 2 (cross-body) integrate with both?

Return your findings in this EXACT format:

BEDROCK: Engine (Steps 0–2.5)

STEP_0_ENGINE:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any, with severity: blocks-bedrock | cosmetic]
- Quality: [code quality observations — stubs, TODOs, technical debt]

STEP_1_MATCHING:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any]
- Quality: [observations]

STEP_2_CROSSBODY:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any]
- Quality: [observations]

STEP_2_5_SPO:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any]
- Quality: [observations]

CROSS_STEP_INTEGRATION:
- [any integration issues between steps]

BEDROCK_BLOCKERS:
- [issues that MUST be fixed before building on this foundation]
```

**8. Frontend Bedrock (Steps 3–6)**

```
You are verifying that Civica's frontend and feature layers (Steps 3, 4, 5, 6) are solid enough to build Steps 7+ on. This is a READ-ONLY audit — do not modify any files.

Instructions:
1. Read `docs/strategy/context/build-manifest.md` for the checkbox list
2. Read `docs/strategy/ultimate-vision.md` — find the sections for Steps 3, 4, 5, and 6
3. Read relevant persona docs from `docs/strategy/personas/` for feature specifications
4. For every [x] checkbox: verify the file/route/component exists AND functions correctly
5. For every [ ] checkbox: assess severity — does this gap block future steps or is it a nice-to-have?
6. Check that Step 4 (citizen) properly surfaces Step 0-2.5 engine intelligence
7. Check that Step 5 (workspace) integrates with Step 6 (engagement) data

Return your findings in this EXACT format:

BEDROCK: Frontend (Steps 3–6)

STEP_3_FRONTEND:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any, with severity]
- Quality: [code quality, component organization, pattern consistency]

STEP_4_CITIZEN:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any — note which are explicitly deferred vs missed]
- Intelligence surfacing: [does the citizen experience properly leverage engine capabilities?]

STEP_5_WORKSPACE:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any]
- Integration: [does workspace properly consume engagement data?]

STEP_6_ENGAGEMENT:
- Status: [SOLID BEDROCK | MINOR GAPS | NEEDS WORK]
- Verified: [X]/[Y] checkboxes confirmed
- Gaps: [list any — note which are explicitly deferred vs missed]
- Feedback loops: [does engagement data flow back to scoring/intelligence?]

CROSS_STEP_INTEGRATION:
- [integration issues across steps 3-6]
- [gaps between persona specs and actual implementation]

BEDROCK_BLOCKERS:
- [issues that MUST be fixed before building Steps 7+]

DEFERRED_VS_MISSING:
- [distinguish between intentionally deferred items and genuinely missed ones]
```

---

## Phase 2: Synthesis (After All Subagents Return)

Once ALL 8 subagents return their results, synthesize into a unified report.

### 2.1 Unified Score Card

Present a single table combining all audit dimensions:

```
| Domain            | Dimensions | Scores              | Avg    |
|-------------------|-----------|----------------------|--------|
| Sync Pipeline     | S1–S4     | [from subagent]      | [avg]  |
| Data Integrity    | D1–D4     | [from subagent]      | [avg]  |
| Scoring           | M1–M4     | [from subagent]      | [avg]  |
| UX Quality        | U1–U6     | [from subagent]      | [avg]  |
| User Journeys     | J1–J5     | [from subagent]      | [avg]  |
| Security          | SEC1–SEC5 | [from subagent]      | [avg]  |
|                   |           | **COMPOSITE AVERAGE** | [avg] |
```

### 2.2 Step Bedrock Status

```
| Step | Name              | Status         | Verified | Gaps | Blocks Future? |
|------|-------------------|----------------|----------|------|----------------|
| 0    | Engine            | [from agent]   | X/Y      | N    | [yes/no]       |
| 1    | Matching          | [from agent]   | X/Y      | N    | [yes/no]       |
| 2    | Cross-Body        | [from agent]   | X/Y      | N    | [yes/no]       |
| 2.5  | SPO Layer         | [from agent]   | X/Y      | N    | [yes/no]       |
| 3    | Frontend          | [from agent]   | X/Y      | N    | [yes/no]       |
| 4    | Citizen           | [from agent]   | X/Y      | N    | [yes/no]       |
| 5    | Workspace         | [from agent]   | X/Y      | N    | [yes/no]       |
| 6    | Engagement        | [from agent]   | X/Y      | N    | [yes/no]       |
```

### 2.3 Cross-Cutting Analysis

This is the unique value of the unified audit. Identify findings that appear across multiple subagents:

- **Reinforced findings:** A gap found by 2+ audits is confirmed, not speculative. Elevate priority.
- **Compound risks:** A security issue affecting data integrity compounds both risks. Flag explicitly.
- **Systemic patterns:** If 3+ audits flag similar root causes (e.g., missing error handling), it's a systemic issue deserving a horizontal fix, not per-area patches.
- **Intelligence leverage gaps:** Where engine capabilities (scoring, alignment, GHI, matching) exist but aren't surfaced in UX — cross-reference scoring audit with UX audit.

### 2.4 Unified Priority Stack

Merge ALL gaps from ALL audits into a single prioritized list:

- **P0 — Launch Blockers:** Security critical findings + bedrock gaps that block future steps. These must be fixed before public launch or before building Steps 7+.
- **P1 — This Sprint:** High-impact gaps from area audits + step gaps that actively degrade user experience. Cross-cutting findings get priority boost.
- **P2 — Next Sprint:** Important improvements that don't block progress but measurably improve quality.
- **P3 — Backlog:** Nice-to-haves, polish items, deferred features acknowledged as intentional gaps.

For each item in the stack, note:

- Which audit(s) surfaced it
- Which step(s) it affects
- Whether it was reinforced by cross-cutting analysis

### 2.5 Work Plan

Read `docs/strategy/context/work-plan-template.md` for the chunk format.

Convert the priority stack into executable chunks:

1. Group related findings into coherent PRs (follow PR grouping rules)
2. Identify parallel opportunities — chunks touching different files/domains can run as simultaneous agents
3. Flag decision points where the user must weigh in before an agent builds
4. Sequence following the template's rules: infrastructure before consumers, foundation before polish

Present the work plan and ask: **"Which chunks should I start? I can run multiple agents in parallel on independent chunks."**

---

## Rules

- **Launch all 8 subagents in a SINGLE message** to maximize parallelism. Never launch sequentially unless forced by a dependency.
- **Each subagent operates at full depth.** The point of subagents is to avoid depth tradeoffs. Never tell a subagent to abbreviate.
- **The orchestrator's job is SYNTHESIS.** Trust subagent findings. Don't re-audit what they already covered.
- **Cross-cutting analysis is the primary value-add.** Individual audits can't see patterns across domains — that's what this command uniquely provides.
- **If a subagent fails or returns incomplete results**, note it in the synthesis and proceed with what you have. Don't block the entire report on one failure.
- **For "quick" mode**: skip step bedrock agents (7 and 8), abbreviate synthesis to just the score card, P0 gaps, and cross-cutting risks. No work plan.
- **For "areas" mode**: skip step bedrock agents. Full synthesis on area audits only.
- **For "steps" mode**: skip area audit agents. Full synthesis on step verification only.
- **Be BRUTALLY honest in the synthesis.** The unified view should surface hard truths that individual audits might soften.
