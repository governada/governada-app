---
paths:
  - '**'
---

# Linear Account Guard

## Hard Rule

**NEVER create Linear issues using `mcp__b8948f82-e39a-43e5-b093-30d3a9d187c9__*` tools.**

That UUID-named MCP is connected to **BlueCargo's** Linear workspace — a completely different company. Using it for Governada work will create tickets in the wrong organization.

## Correct MCP

Always use `mcp__linear__*` tools for Governada Linear issues. If those tools are not available in the session, **stop** and tell the user:

> "The Governada Linear MCP (`mcp__linear__*`) is not active in this session. Only the BlueCargo connector is available. Please enable the Governada Linear integration in claude.ai → Projects → Governada → Settings → Integrations before I create any tickets."

Do NOT fall back to the UUID MCP as a workaround.

## How to identify which is which

| Tool prefix                                    | Workspace | Action                     |
| ---------------------------------------------- | --------- | -------------------------- |
| `mcp__linear__*`                               | Governada | ✅ Use this                |
| `mcp__b8948f82-e39a-43e5-b093-30d3a9d187c9__*` | BlueCargo | ❌ Never use for Governada |
