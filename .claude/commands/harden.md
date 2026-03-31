Robustness pass on existing code. Takes a feature, component, route, or page and makes it production-grade.

This is NOT feature work. This skill strengthens what exists — it does not add new functionality, redesign UX, or refactor architecture. The goal is to close the gap between "it works on the happy path" and "it handles everything a real user will throw at it."

## Input

Argument: `$ARGUMENTS` — Required: what to harden (component name, route path, feature area, or "last" for the most recently shipped work).

## Phase 1: Inventory

Read the target code and produce an inventory of what exists:

1. **Components involved** — list every component file with its purpose
2. **Data sources** — what APIs/queries/hooks feed data to this feature
3. **User interactions** — what can users click, type, submit, toggle, navigate
4. **Conditional states** — what varies by persona, feature flag, data availability, auth status

Do NOT suggest improvements yet. Understand first.

## Phase 2: Robustness Audit

For each item in the inventory, evaluate against this checklist. Be specific — cite file:line for each finding.

### Error States

- [ ] What happens when the primary API call fails (500, timeout, network error)?
- [ ] What happens when the user has no data (new user, no votes, no delegations)?
- [ ] What happens when required data is null/undefined?
- [ ] Are error boundaries in place so a section failure doesn't crash the page?
- [ ] Do error messages help the user understand what happened and what to do?

### Loading States

- [ ] Are loading states meaningful (skeleton matching layout, not a generic spinner)?
- [ ] Do loading states appear quickly enough (no flash of empty content)?
- [ ] Is there a timeout/fallback if loading takes too long?

### Empty States

- [ ] Do empty states guide, educate, or motivate? (not just "No results")
- [ ] Do empty states suggest a next action? (e.g., "Connect your wallet to see your governance activity")
- [ ] Are empty states persona-appropriate? (citizen vs DRep vs SPO)

### Edge Cases

- [ ] What happens with 0 items? 1 item? 10,000 items?
- [ ] What happens with very long text (names, descriptions, rationales)?
- [ ] What happens with special characters or unicode?
- [ ] What happens if the user navigates away mid-action and comes back?
- [ ] What happens during epoch transitions (stale data, missing current epoch)?

### Mobile (375px)

- [ ] Does the layout work at 375px width? No horizontal overflow?
- [ ] Are all interactive elements reachable (not hidden behind other elements)?
- [ ] Are touch targets at least 44x44px?
- [ ] Does text remain readable (no truncation that hides critical info)?

### Type Safety

- [ ] Any `any` types? Any `as` type assertions that could fail at runtime?
- [ ] Are API response types validated (Zod schemas or runtime checks)?
- [ ] Are optional fields handled with proper null checks?

### Feature Gating

- [ ] Is this feature gated behind a feature flag if it's risky or incomplete?
- [ ] Does the feature degrade gracefully when the flag is off?

### Data Validation

- [ ] Are user inputs validated before submission?
- [ ] Are Supabase/API responses checked before use?
- [ ] Are URL parameters validated (malicious or malformed values)?

## Phase 3: Prioritized Fix Plan

Rank findings by severity:

- **P0 — Crashes or data loss**: Error that crashes the page, loses user data, or shows wrong information
- **P1 — Broken experience**: Feature doesn't work for a realistic user scenario
- **P2 — Degraded experience**: Feature works but poorly (bad empty state, generic error, spinner instead of skeleton)
- **P3 — Polish**: Minor improvements (text truncation, touch target size, type assertion cleanup)

Present the plan. Include:

- Finding count per priority
- Estimated effort (total)
- Files to modify

**Wait for user approval before fixing.** If only P3 items found, report "Feature is robust — no critical fixes needed" and present P3 items as optional.

## Phase 4: Fix

Fix findings in priority order (P0 → P1 → P2 → P3 if approved).

Rules:

- **Fix only what the audit found.** Do not refactor, redesign, or add features.
- **Search for existing patterns first.** If another component handles errors well, follow the same pattern. See `.claude/rules/build-on-existing.md`.
- **Minimal changes.** Add error handling, loading states, and edge case handling. Do not restructure the component.
- **Test each fix.** If fixing an error state, verify it renders correctly. If fixing mobile, verify at 375px.

## Phase 5: Verify

1. Run `npm run preflight` — all must pass
2. If UI changes: verify via Preview tools at desktop + mobile
3. Re-run the checklist from Phase 2 — all P0 and P1 items must be resolved
4. Report: items fixed, items remaining (with justification for any deferred)

## Rules

- **This is hardening, not feature work.** If you catch yourself adding new functionality, stop.
- **Existing patterns first.** Don't invent new error handling when the codebase has established patterns.
- **User approval before fixing.** The audit might reveal the feature is already robust.
- **P0/P1 always, P2/P3 with approval.** Don't gold-plate — fix what matters.
- **Report honestly.** If a feature is solid, say so. Don't manufacture findings to justify the skill.
