---
paths:
  - '.claude/commands/audit*'
  - '.claude/commands/fix*'
  - '.claude/commands/build*'
  - '.claude/commands/launch*'
  - '.claude/commands/adversarial*'
---

# Audit Integrity Rules

These rules apply to ALL audit, fix, and build commands. They prevent busywork and ensure agents only recommend changes that genuinely matter.

## Evidence Requirement

Every finding MUST include:

1. **Specific code path** — file and line number, not "the scoring module could be improved"
2. **Concrete user impact** — what real user action fails, degrades, or is missing. "A citizen searching for DReps by policy area sees no results if fewer than 3 DReps match" is valid. "Search could be enhanced" is not.
3. **Reproduction or measurement** — how you verified the gap exists. Did you read the code? Did you trace a user flow? Did you find a missing edge case? State it.

If you cannot provide all three, the finding is speculative. Mark it as `SPECULATIVE` and move it to a separate section. It must NOT appear in the priority stack or fix plan.

## Cost-Benefit Gate

Every recommendation MUST estimate:

- **Effort**: Small (< 1 hour), Medium (1-4 hours), Large (4+ hours)
- **Impact**: What measurably improves — a score dimension, a user flow, a failure mode eliminated
- **Risk**: What could break by making this change

If a recommendation is Large effort and the improvement is marginal (e.g., 7/10 → 7.5/10), it should be flagged as **LOW ROI** and excluded from the fix plan unless explicitly approved.

## The "Already Good" Requirement

Audits MUST explicitly list what is already strong and should NOT be changed. If an audit returns 20 findings and 0 "this is solid" callouts, the audit is biased and should be re-evaluated.

For each dimension scored 8+/10, state: "This is strong because [specific reason]. No changes recommended."

Changing working, well-built code always carries regression risk. The bar for modifying something that works well is HIGH.

## Score Calibration

- **10/10** — Best-in-class across all of crypto/web3, competitive with top Web2 products. Almost nothing scores here.
- **8-9/10** — Strong, polished, no meaningful gaps. Do NOT recommend changes unless there's a clear, high-impact reason.
- **6-7/10** — Functional but has specific, identifiable gaps that affect real users.
- **4-5/10** — Significant gaps that actively hurt the user experience or system reliability.
- **1-3/10** — Broken or missing functionality.

When scoring, ask: "Would I give this the same score if I wasn't looking for things to fix?" If the answer is no, you're score-deflating to justify recommendations. Stop.

## The "Would Anyone Notice?" Test

For every UX, journey, or frontend recommendation, answer: "If we shipped this change, would a real user notice the difference within their first 3 sessions?"

If the answer is no, the recommendation is LOW PRIORITY at best. It should not be in a fix plan unless all higher-impact work is done.

## Competitor Benchmark

Don't compare against an imaginary ideal. Compare against what actually exists in the Cardano governance ecosystem and adjacent Web3 tools. If Governada is already ahead of every competitor on a dimension, that dimension needs maintenance, not improvement.

Reference `docs/strategy/context/competitive-landscape.md` for the current landscape.

## Anti-Patterns to Reject

Agents MUST NOT recommend:

- **Refactoring working code for "cleanliness"** unless it's causing actual bugs or blocking a needed feature
- **Adding abstractions** for things that are only used once
- **Premature optimization** without evidence of a performance problem
- **Adding configuration/feature flags** for things that don't need to vary
- **Documentation improvements** as P0 or P1 items — docs are important but never urgent
- **"Modernizing" patterns** that work fine (e.g., replacing a working approach with a trendier one)
- **Any change justified only by "best practice"** without a concrete problem it solves in THIS codebase
