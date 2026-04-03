---
paths:
  - '.claude/commands/**'
  - 'scripts/notify.js'
---

# Agent Notification Rules

## When to Notify

Any orchestrator command (`/build-step`, `/fix-audit`, `/launch-readiness`, `/audit-all`) MUST send a notification via `npm run notify -- ...` at these moments:

1. **Decision gate reached** - Plan is ready for user review. Agent MUST pause and wait.
2. **Deploy blocked** - Smoke test failure, pre-merge check blocked, or deploy error.
3. **Edge case escalation** - Agent hit an unexpected decision not covered by the approved plan.
4. **Build complete** - All chunks deployed and post-build audit done.

## How to Notify

The script takes 3 args: `<alert_type> <title> <details>`

Alert types: `decision_gate` | `deploy_blocked` | `escalation` | `complete` | `info`

Run via the repo script before pausing:

```powershell
npm run notify -- "decision_gate" "/build-step 7: Architecture plan ready" "5 chunks proposed (3 backend, 2 frontend). 2 migrations. 1 new Inngest function. Estimated ~45 min build. Review the plan in your Claude Code session and approve or request changes."
```

```powershell
npm run notify -- "deploy_blocked" "Smoke test failed after PR #185 merge" "/api/health returns 503. Error: connection refused on Supabase. Remaining 3 PRs paused. Check Railway logs and your Claude Code session."
```

```powershell
npm run notify -- "escalation" "Chunk 3 hit unexpected schema conflict" "build-step 7, chunk 3 (matching engine) needs drep_scores.composite_score column but chunk 1 renamed it to overall_score. Need your decision: rename back, or update chunk 3 to use new name."
```

```powershell
npm run notify -- "complete" "/build-step 7 finished" "4/5 chunks deployed successfully. 1 chunk descoped (wallet connect - needs MeshJS upgrade). Post-build audit: UX 8/10, Security 7/10, Data 9/10. See session for full report."
```

## Notification Content Rules

Be verbose and specific. The founder may be away from their computer and needs enough context to decide whether to act now or later:

- **Include the command name** that triggered the alert (e.g., `/build-step 7`, `/fix-audit scoring`)
- **Include counts and specifics** - chunk count, PR numbers, score values, error messages
- **Include what's blocking** - what the agent needs from the founder (approval, decision, error triage)
- **Include scope/impact** - what will happen once unblocked (how many PRs left, what deploys next)
- Do NOT dump the full plan - but DO give enough detail to triage priority from a phone notification

## Channels

The script auto-sources `.env.local` and sends to all configured channels:

- **Discord**: `DISCORD_AGENT_WEBHOOK_URL` (agent-alerts channel), falls back to `DISCORD_WEBHOOK_URL`
- **Telegram**: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_FOUNDER_CHAT_ID`

No agent configuration needed - just ensure the env vars are set in `.env.local`.
