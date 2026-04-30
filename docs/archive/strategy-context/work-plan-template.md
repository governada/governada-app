# Work Plan Template

> **Purpose:** Consistent structure for audit-to-execution documents. Agents reference this when building the work plan after an audit.
> **Rule:** Every chunk must be self-contained enough for an independent agent to execute after its own deep-dive.

---

## Work Plan — [Audit Date] — [Scope]

### Execution Principles

1. **Chunks are PR-sized.** Each chunk = 1 PR. If a chunk would produce >500 lines changed, split it.
2. **Dependencies are explicit.** If chunk B requires chunk A to be merged first, say so and explain why.
3. **Decision points are flagged.** If a chunk requires a product decision, list the specific question(s) the executing agent should ask the user BEFORE building.
4. **Deep-dive expected.** Each chunk description provides enough context for an agent to research further (read relevant files, check current implementation, evaluate alternatives) before executing. The description is a starting point, not a complete spec.

---

### Chunk Format

```markdown
## Chunk [N]: [Short Name]

**Priority:** P0 (critical) | P1 (high) | P2 (medium) | P3 (nice-to-have)
**Effort:** S (< 1 hour) | M (1-3 hours) | L (3-8 hours) | XL (multi-session)
**Audit dimension(s):** [Which rubric dimensions this improves]
**Expected score impact:** [e.g., "UX & Visual Design: 6→8 (+2)"]
**Depends on:** [Chunk N, or "None"]
**PR group:** [Letter — chunks in same group ship in one PR]

### Context

[Why this matters. What the audit found. What the current state is.]

### Scope

[Specific files to modify/create. Specific behaviors to implement.]

### Decision Points

[Questions the executing agent should ask the user before building. If none, write "None — execute directly."]

### Verification

[How to confirm this chunk achieved its goal. Specific tests, measurements, or user-visible behaviors.]

### Files to Read First

[List of files the executing agent should read before starting work.]
```

---

### PR Grouping Rules

- **Same PR:** Changes that must be deployed atomically (e.g., migration + type gen + code using new columns)
- **Same PR:** Tightly coupled UI changes (e.g., new component + its integration into existing page)
- **Separate PR:** Independent improvements that happen to be in the same rubric dimension
- **Separate PR:** Changes touching different domains (e.g., scoring engine + UI polish)
- **Never same PR:** Risky changes with safe changes (keep blast radius small)

### Sequencing Rules

- **Infrastructure before consumers:** Database changes before API changes before UI changes
- **Foundation before polish:** Core functionality before animations/micro-interactions
- **Shared before specific:** Shared components before page-specific implementations
- **Critical path first:** Anything blocking other chunks gets highest priority regardless of effort
