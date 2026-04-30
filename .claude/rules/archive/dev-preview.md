---
paths:
  - 'app/**'
  - 'components/**'
  - 'lib/**'
  - '.claude/launch.json'
---

# Dev Preview in Worktrees

Rules for running the local dev server via Claude Preview tools. Worktree sync links `node_modules` when possible, but it no longer copies plaintext `.env.local`. Use `npm run env:doctor` to inspect local env readiness and `npm run env:run -- <command>` for 1Password-backed local env injection.

## Starting the Dev Server

1. **Start**: Use `preview_start` with name `"dev"` (configured in `.claude/launch.json`, port 3111 with `autoPort`)
2. **Wait for readiness**: After `preview_start`, run `npm run preview:ready -- http://localhost:<port>`. It polls `/api/health` by default until the server is ready, so no manual curl loop is needed.
3. **Check logs**: Run `preview_logs` with level `"error"`. If you see missing module or env var errors, use the troubleshooting section below.
4. **Navigate to a light page first**: Do NOT let the browser load the homepage (`/`) initially. It contains the Globe (Three.js/R3F), which can hang the headless browser on first compile. Navigate to `/governance`, `/pulse`, or `/api/health` first.

**Do NOT** run `npm run dev` manually. Always use `preview_start` so the Preview MCP manages the server lifecycle.

## Critical: Avoid Globe on First Load

The homepage (`/`) renders a Three.js Globe via React Three Fiber. In the headless Chromium used by Preview tools, this can:

- Hang the browser during initial WebGL context creation
- Time out all `preview_eval` / `preview_screenshot` calls
- Appear as a completely black or unresponsive page

**Workaround**: After starting the server, immediately navigate to a non-Globe page:

```js
// via preview_eval after server is ready
window.location.href = 'http://localhost:<port>/governance';
```

Pages safe for initial load: `/governance`, `/pulse`, `/governance/proposals`, `/governance/treasury`, `/governance/leaderboard`, `/workspace`, `/you`, and any `/api/*` route.

Test Globe pages only after the rest of the app is confirmed working.

## Auth Mocking

The dev server supports mock auth via `/api/auth/dev-mock` when `DEV_MOCK_AUTH=true` is available through `npm run env:run -- <command>` or a local fallback env file.

Switch personas with `preview_eval`:

```js
fetch('/api/auth/dev-mock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ persona: 'citizen' }),
}).then(() => window.location.reload());
```

Available personas: `anonymous`, `citizen`, `citizen-delegated`, `drep`, `spo`, `cc`

## Verification Pattern

Always follow this order, text first and screenshot last:

1. `preview_logs` - check for server errors
2. `preview_console_logs` - check for client errors
3. `preview_snapshot` - verify content structure and text
4. `preview_inspect` - verify specific CSS values if needed
5. `preview_screenshot` - capture visual proof only after confirming content is correct

For interactions: `preview_click` / `preview_fill` -> `preview_snapshot` -> `preview_screenshot`

For responsive: `preview_resize` with presets `"mobile"` (375x812), `"tablet"` (768x1024), `"desktop"` (1280x800)

## Troubleshooting

| Symptom                                                  | Cause                                           | Fix                                                      |
| -------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `MODULE_NOT_FOUND` errors                                | `node_modules` missing or junction broken       | Run `npm install` in the worktree                        |
| Missing env var errors                                   | Local env references missing or fallback absent | Run `npm run env:doctor`                                 |
| Port already in use                                      | Another dev server running                      | `autoPort: true` handles this automatically              |
| Turbopack panic: "Symlink points out of filesystem root" | `turbopack.root` not set in next.config.ts      | Confirm `next.config.ts` sets `turbopack.root`           |
| Browser hangs / all preview calls timeout                | Globe/Three.js page loaded first                | Stop server, restart, navigate to `/governance` first    |
| Stale build cache                                        | `.next/` has bad state                          | `rm -rf .next` then restart                              |
| Auth mock returns 401                                    | `DEV_MOCK_AUTH` not set                         | Verify `DEV_MOCK_AUTH=true` through `npm run env:doctor` |
| `node_modules` link won't create                         | package.json differs from main                  | Run `npm install` - the hook only links when deps match  |

## Compilation Times (Turbopack)

- **Server ready**: about 4s (port bound, accepting connections)
- **First route compile**: 10-40s depending on route complexity
- **Subsequent route compiles**: 2-10s (incremental)
- **Hot reload after edit**: under 1s

The server accepts connections immediately but holds requests until the route compiles. Use `npm run preview:ready -- http://localhost:<port>` to wait for that compile barrier without hand-rolled polling.

## Prerequisites (Auto-Handled)

The `npm run worktree:sync` hook runs on session start and handles:

- Fetching and rebasing onto `origin/main` (skips with warning if the working tree is dirty)
- Reporting local env bootstrap status without copying `.env.local`
- Linking `node_modules` from the main checkout, with `npm install` fallback when linking is not possible
- Preserving the 1Password-backed SSH alias remote for Git operations

Read the session-start output carefully. Warnings require manual action before starting work.

If the hook did not run, start with the repo sync wrapper:

```bash
npm run worktree:sync
```

If the session still reports missing Git credentials afterward, run:

```bash
npm run auth:repair
```
