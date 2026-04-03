---
paths:
  - 'app/**'
  - 'components/**'
  - 'lib/**'
  - '.claude/launch.json'
---

# Dev Preview in Worktrees

Rules for running the local dev server via Claude Preview tools. The `sync-worktree.ps1` session-start hook auto-provisions `.env.local` and `node_modules`, so agents can usually start previewing immediately.

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

The dev server supports mock auth via `/api/auth/dev-mock` (requires `DEV_MOCK_AUTH=true` in `.env.local`, which is set by default).

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

| Symptom                                                  | Cause                                      | Fix                                                                                          |
| -------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `MODULE_NOT_FOUND` errors                                | `node_modules` missing or junction broken  | Run `npm install` in the worktree                                                            |
| Missing env var errors                                   | `.env.local` not copied                    | Re-run `powershell -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/sync-worktree.ps1` |
| Port already in use                                      | Another dev server running                 | `autoPort: true` handles this automatically                                                  |
| Turbopack panic: "Symlink points out of filesystem root" | `turbopack.root` not set in next.config.ts | Confirm `next.config.ts` sets `turbopack.root`                                               |
| Browser hangs / all preview calls timeout                | Globe/Three.js page loaded first           | Stop server, restart, navigate to `/governance` first                                        |
| Stale build cache                                        | `.next/` has bad state                     | `Remove-Item -Recurse -Force .next` then restart                                             |
| Auth mock returns 401                                    | `DEV_MOCK_AUTH` not set                    | Verify `.env.local` contains `DEV_MOCK_AUTH=true`                                            |
| Junction `node_modules` won't create                     | package.json differs from main             | Run `npm install` - the hook only junctions when deps match                                  |

## Compilation Times (Turbopack)

- **Server ready**: about 4s (port bound, accepting connections)
- **First route compile**: 10-40s depending on route complexity
- **Subsequent route compiles**: 2-10s (incremental)
- **Hot reload after edit**: under 1s

The server accepts connections immediately but holds requests until the route compiles. Use `npm run preview:ready -- http://localhost:<port>` to wait for that compile barrier without hand-rolled polling.

## Prerequisites (Auto-Handled)

The `sync-worktree.ps1` hook runs on session start and handles:

- Fetching and rebasing onto `origin/main` (skips with warning if the working tree is dirty)
- Copying `.env.local` from the main checkout if missing
- Junctioning `node_modules` from the main checkout, with `npm install` fallback when linking is not possible
- Running `gh auth setup-git` to configure HTTPS push credentials

Read the session-start output carefully. Warnings require manual action before starting work.

If the hook did not run, do these manually:

```powershell
git fetch origin
git rebase origin/main
Copy-Item C:\Users\dalto\governada\governada-app\.env.local .env.local
npm install
gh auth setup-git
```
