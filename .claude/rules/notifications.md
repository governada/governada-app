---
paths:
  - '**'
---

# Agent Notification Rules

## When to Notify

Any orchestrator command (`/build-step`, `/fix-audit`, `/launch-readiness`, `/audit-all`) MUST send a notification via `bash scripts/notify.sh` at these moments:

1. **Decision gate reached** — When the plan is ready for user review and the agent is pausing for approval.
2. **Deploy blocked** — When a smoke test fails, pre-merge check is blocked, or a deploy error occurs.
3. **Edge case escalation** — When a chunk agent encounters an unexpected decision not covered by the approved plan.
4. **Build complete** — When all chunks are deployed and the post-build audit is done.

## How to Notify

Run via Bash tool before pausing:

```bash
bash scripts/notify.sh "Decision gate reached" "/build-step 7: Architecture plan ready for your review. 5 chunks, 2 decision points."
```

```bash
bash scripts/notify.sh "Deploy blocked" "Smoke test failed after merging PR #185. Remaining PRs paused. Check session for details."
```

```bash
bash scripts/notify.sh "Build complete" "/build-step 7 finished. 4/5 chunks deployed. Post-build audit: UX 8/10, Security 7/10."
```

## Notification Content

Keep messages actionable and concise:
- **Title**: What happened (decision gate, deploy blocked, complete)
- **Message**: Which command, what's needed, key numbers (chunk count, score, PR number)
- Do NOT dump the full plan into the notification — just enough to know whether to check now or later

## Channels

The script sends to all configured channels (Discord webhook, Telegram bot). No agent configuration needed — the script reads env vars automatically.
