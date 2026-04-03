# Platform Architecture Review

This folder is the durable operating record for the platform architecture review series.

## Purpose

- Keep one source of truth for review order, status, and decisions.
- Let multiple agents continue the work without rebuilding context from scratch.
- Convert architecture findings into PR-sized execution chunks instead of letting audits drift into notes.

## File Map

- `series-index.md`: master sequence, current status, decisions, cross-cutting risks, progress log.
- `execution-backlog.md`: PR-sized chunks using the repo's work plan format.
- `deep-dive-XX-*.md`: one document per architecture area with evidence, findings, and a handoff block.

## Operating Rules

1. Update `series-index.md` when a deep dive starts, changes status, or closes.
2. Update the relevant `deep-dive-XX-*.md` before and after any substantial analysis or fix batch.
3. Promote validated findings into `execution-backlog.md` as soon as they become actionable.
4. Keep the "Next agent starts here" section current in every active deep-dive file.
5. Treat these docs as operational state, not polished marketing copy.

## Deep Dive Statuses

- `Planned`: not started.
- `In progress`: active investigation or fix planning.
- `Needs execution`: findings are stable and ready to convert into implementation chunks.
- `Done`: review area closed for this series pass.

## Required Handoff Block

Each deep-dive file should end with:

- `Current status`
- `What changed this session`
- `Evidence collected`
- `Validated findings`
- `Open questions`
- `Next actions`
- `Next agent starts here`
