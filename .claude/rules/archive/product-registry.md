---
paths:
  - 'docs/strategy/**'
  - 'docs/plans/**'
  - '.claude/commands/**'
---

# Product Registry — Hard Requirement for Planning Agents

## Rule

Before recommending, planning, auditing, or exploring any feature, agents MUST read `docs/strategy/context/product-registry.md`. For the specific domain being analyzed, also read the relevant `docs/strategy/context/registry/<domain>.md` file.

## The Existence Check (3 questions)

Every recommendation MUST answer these three questions. State them explicitly in your output:

1. **"What already exists in this domain?"** — Cite the registry. List features, routes, hooks, and key files.
2. **"What's the current implementation?"** — Read the actual code for any feature you're discussing.
3. **"What's genuinely new vs. enhancement of existing?"** — Distinguish between building something new and improving something that already exists.

## Anti-Patterns

**WRONG** (assumes feature doesn't exist):

> "Governada should build an engagement system where citizens can signal priorities and flag concerns about proposals."

This is wrong because 7 engagement mechanisms already exist (sentiment votes, priority signals, concern flags, impact tags, citizen questions, assemblies, endorsements). The agent didn't check.

**RIGHT** (cites registry, identifies actual gap):

> "Registry check: 7 engagement mechanisms shipped (sentiment, priorities, concerns, impact tags, questions, assemblies, endorsements) per `registry/engagement.md`. The gap is activation: these mechanisms exist in isolation on proposal pages but aren't surfaced on the Hub or in the DRep workspace intelligence feed. Recommendation: wire existing engagement data into Hub cards and workspace intel blocks."

## PR Maintenance

Any PR that adds a new feature, route, hook, or lib module MUST update `docs/strategy/context/product-registry.md` in the same commit. Same enforcement pattern as `view-as-registry.md`.

## Domain Files

| Domain     | File                            |
| ---------- | ------------------------------- |
| Scoring    | `registry/scoring.md`           |
| Engagement | `registry/engagement.md`        |
| Workspace  | `registry/workspace.md`         |
| AI/Seneca  | `registry/ai-features.md`       |
| Matching   | `registry/matching.md`          |
| Browse     | `registry/governance-browse.md` |
| Identity   | `registry/identity.md`          |
| Sync       | `registry/sync-pipeline.md`     |
