You are updating documentation after code changes.

## 1. Identify Changes

- Check git diff or recent commits for modified files
- Identify which features/modules were changed
- Note any new files, deleted files, or renamed files

## 2. Verify Current Implementation

**CRITICAL**: DO NOT trust existing documentation. Read the actual code.

For each changed file:

- Read the current implementation
- Understand actual behavior (not documented behavior)
- Note any discrepancies with existing docs

## 3. Update Relevant Documentation

- **CHANGELOG.md**: Add entry under "Unreleased" section (Added, Changed, Fixed, Security, Removed)
- **AGENTS.md**: Update if architecture, key files, or workflows changed

## 4. Documentation Style Rules

- Concise — sacrifice grammar for brevity
- Practical — examples over theory
- Accurate — code verified, not assumed
- Current — matches actual implementation
- No enterprise fluff, no outdated information, no assumptions without verification

## 5. Ask if Uncertain

If you're unsure about intent behind a change or user-facing impact, ask the user — don't guess.
