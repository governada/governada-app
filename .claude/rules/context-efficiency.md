---
paths:
  - '**'
---

# Context Window Efficiency Rules

These rules prevent agents from wasting context on repetitive CI/deploy output. Context is finite — treat it like a scarce resource.

## CI Watching

**NEVER** stream `gh pr checks --watch` in the foreground. It polls every 10 seconds and dumps the full status table each time, consuming thousands of tokens for zero new information.

**Instead, use this pattern:**

```bash
# Run in background — you'll be notified when it completes
gh pr checks <N> --watch
```

Set `run_in_background: true` on the Bash call. When the notification arrives, only read the final few lines:

```bash
gh pr checks <N>  # Single snapshot of final status
```

If CI fails, then read the failed logs:

```bash
gh run list --branch <branch> --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view <run-id> --log-failed 2>&1 | tail -50
```

## Deploy Verification

**ALWAYS** run the `deploy-verifier` subagent in the background after merge. Do NOT wait for its result before continuing other work or responding to the user.

```
Agent(subagent_type="deploy-verifier", run_in_background=true, ...)
```

When the notification arrives, report the result in 1-2 sentences. Do not dump the full output.

## Research & File Reading

When a checkpoint or plan file lists the specific files to modify for a phase:

- Read those files directly with the Read tool
- Do NOT spawn an Explore agent to re-discover them
- Only use Explore for genuinely unknown territory

When you need type signatures or component props from files you've already read:

- Note them in the checkpoint for the next agent
- Don't re-read files you've already summarized

## Checkpoint Enrichment

When writing checkpoint files for handoff, include:

- Key type signatures and hook return shapes the next agent will need
- Component prop interfaces for files being modified
- Any non-obvious patterns discovered during the session

This saves the next agent from re-reading 10+ files to rediscover the same information.
