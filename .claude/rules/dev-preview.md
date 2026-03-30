# Dev Preview in Worktrees

Rules for running the local dev server via Claude Preview tools. The `sync-worktree.sh` session-start hook auto-provisions `.env.local` and `node_modules` — in most cases, agents can start previewing immediately.

## Starting the Dev Server

1. **Start**: Use `preview_start` with name `"dev"` (configured in `.claude/launch.json`, port 3111 with autoPort)
2. **Wait for compilation**: The server binds the port immediately but routes compile on first request. After `preview_start`, wait ~10s then hit `/api/health` via curl or `preview_eval` before navigating the browser.
3. **Check logs**: Run `preview_logs` with level `"error"`. If you see missing module or env var errors, see Troubleshooting below.
4. **Navigate to a light page first**: Do NOT let the browser load the homepage (`/`) initially — it contains the Globe (Three.js/R3F) which can hang the headless browser on first compile. Navigate to `/governance`, `/pulse`, or `/api/health` first.

**Do NOT** run `npm run dev` via Bash — always use `preview_start` so the Preview MCP manages the server lifecycle.

## Critical: Avoid Globe on First Load

The homepage (`/`) renders a Three.js Globe via React Three Fiber. In the headless Chromium used by Preview tools, this can:

- Hang the browser during initial WebGL context creation
- Time out all preview_eval / preview_screenshot calls
- Appear as a completely black or unresponsive page

**Workaround**: After starting the server, immediately navigate to a non-Globe page:

```js
// via preview_eval after server is ready
window.location.href = 'http://localhost:<port>/governance';
```

Pages safe for initial load: `/governance`, `/pulse`, `/governance/proposals`, `/governance/treasury`, `/governance/leaderboard`, `/workspace`, `/you`, any `/api/*` route.

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

Always follow this order (text-first, screenshot last):

1. `preview_logs` — check for server errors
2. `preview_console_logs` — check for client errors
3. `preview_snapshot` — verify content structure and text
4. `preview_inspect` — verify specific CSS values if needed
5. `preview_screenshot` — capture visual proof only after confirming content is correct

For interactions: `preview_click` / `preview_fill` → `preview_snapshot` → `preview_screenshot`

For responsive: `preview_resize` with presets `"mobile"` (375x812), `"tablet"` (768x1024), `"desktop"` (1280x800)

## Troubleshooting

| Symptom                                                  | Cause                                      | Fix                                                                    |
| -------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `MODULE_NOT_FOUND` errors                                | `node_modules` missing or junction broken  | Run `npm install` in the worktree                                      |
| Missing env var errors                                   | `.env.local` not copied                    | Copy from main: re-run `bash .claude/hooks/sync-worktree.sh`           |
| Port already in use                                      | Another dev server running                 | `autoPort: true` handles this automatically                            |
| Turbopack panic: "Symlink points out of filesystem root" | `turbopack.root` not set in next.config.ts | Should be auto-configured; check `next.config.ts` has `turbopack.root` |
| Browser hangs / all preview calls timeout                | Globe/Three.js page loaded first           | Stop server, restart, navigate to `/governance` first                  |
| Stale build cache                                        | `.next/` has bad state                     | `rm -rf .next` then restart                                            |
| Auth mock returns 401                                    | `DEV_MOCK_AUTH` not set                    | Verify `.env.local` contains `DEV_MOCK_AUTH=true`                      |
| Junction `node_modules` won't create                     | package.json differs from main             | Run `npm install` — the hook only junctions when deps match            |

## Compilation Times (Turbopack)

- **Server ready**: ~4s (port bound, accepting connections)
- **First route compile**: 10-40s depending on route complexity
- **Subsequent route compiles**: 2-10s (incremental)
- **Hot reload after edit**: <1s

The server accepts connections immediately but holds requests until the route compiles. API routes compile faster than pages with heavy client components.

## Prerequisites (auto-handled)

The `sync-worktree.sh` hook runs on session start and handles:

- Rebasing onto latest `origin/main`
- Copying `.env.local` from the main checkout (if missing)
- Creating a `node_modules` directory junction to main checkout (if package.json matches)

If the hook didn't run (e.g., non-standard worktree setup), do these manually:

```bash
cp /c/Users/dalto/governada/governada-app/.env.local .
npm install
```
