---
paths:
  - '**'
---

# Response Calibration

Match compute to task complexity. Every response that overuses reasoning for a simple task wastes context and adds latency.

## Subagent Model Routing

When spawning subagents via the Agent tool, specify `model: "sonnet"` for bounded tasks. Reserve Opus (default) for complex reasoning and multi-file coordination.

| Use `model: "sonnet"`               | Use default (Opus)                   |
| ----------------------------------- | ------------------------------------ |
| File search, glob, grep exploration | Architecture planning, `/build-step` |
| Lint checks, type validation        | Multi-file feature implementation    |
| Deploy verification (smoke tests)   | Root cause analysis, `/diagnose`     |
| Pre-ship review (diff checks)       | Strategic audits, `/strategy`        |
| Performance evidence collection     | Complex bug investigation            |
| Simple content generation           | Cross-cutting refactors              |

The built-in agent definitions (`deploy-verifier`, `perf-auditor`, `pre-ship-reviewer`) already use `model: sonnet`. When spawning ad-hoc Explore agents for simple lookups, add `model: "sonnet"`.

## /fast Mode

Toggle `/fast` manually for exploration sessions, file reading, and simple Q&A. It is the same Opus 4.6 model optimized for faster output. Switch back to normal mode for multi-file implementation work, architecture decisions, and complex debugging.

When to use `/fast`:

- "What does this function do?"
- "Find all usages of X"
- "Read this file and summarize"
- Simple config questions

When to use normal mode:

- Implementing features across multiple files
- Debugging unexpected behavior
- Planning architecture
- Any `/build-step`, `/audit`, or `/strategy` session

## /context Auditing

Run `/context` periodically during long sessions to see what's consuming tokens — rules, MCP schemas, tool definitions, conversation history. If context utilization is high (>70%), consider `/clear` before switching to an unrelated task.
