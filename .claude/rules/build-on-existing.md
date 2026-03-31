# Build on Existing — Anti-Rewrite Rule

This rule activates whenever an agent is about to create new files, functions, components, hooks, or utilities. It exists because agents repeatedly create new implementations when suitable ones already exist, producing two half-baked versions instead of one solid one.

## Hard Rule

Before creating ANY new file, function, component, hook, or utility, you MUST:

1. **Search for existing implementations** — Grep/Glob for similar functionality in the codebase. Search by concept, not just name (e.g., searching for "score breakdown" should also check for "score detail", "score explainer", etc.)
2. **Cite what you found** — List the existing implementations with file paths and a one-line description of what each does
3. **Propose extension first** — If something similar exists, the default recommendation MUST be to extend it. Only propose new code if extension is genuinely infeasible — and explain why.

## Why

Creating new code when suitable implementations exist produces:

- Two half-baked versions instead of one solid one
- Inconsistent patterns across the codebase
- Dead code that confuses future agents and increases maintenance burden
- Wasted context explaining why there are two implementations of the same thing

This is the single most common agent failure mode and the most expensive to fix — the founder ends up spending hours reconciling duplicate implementations.

## The Exception

Net-new ground-up work is appropriate ONLY when:

- `/explore-feature` explicitly instructs generative exploration
- The user explicitly requests a new implementation
- Existing code is fundamentally incompatible and you can articulate why in the PR
- There is genuinely nothing similar in the codebase (you searched thoroughly and found nothing)

## PR Enforcement

Every PR description MUST include an `## Existing Code Audit` section:

```markdown
## Existing Code Audit

- **Searched for**: [concepts/patterns you looked for]
- **Found**: [existing implementations with file paths, or "nothing similar exists"]
- **Decision**: [extended `path/to/file.ts` / created new because ...]
```

If the PR creates more new files than it modifies, the Existing Code Audit section must justify each new file individually.

## Common Violations

- Creating a new `useX` hook when an existing hook in `hooks/` does 80% of what's needed — extend the existing hook
- Creating a new component when an existing component in `components/` accepts the needed props or could be made to — extend the existing component
- Creating a new utility function in `lib/` when `utils/` or another `lib/` module already has similar logic — import and reuse
- Creating a new API route when an existing route could accept an additional query parameter — extend the existing route
- Creating a new Inngest function when an existing one could handle the new case with a parameter — extend the existing function
