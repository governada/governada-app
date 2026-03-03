---
description: Non-negotiable rules. Every rule here has been violated at least once and caused real damage. Read these FIRST, honor them ALWAYS.
globs: ["**/*"]
alwaysApply: true
---

# Critical Rules (Non-Negotiable)

These override all other guidance when in conflict. Violations of these rules have caused production failures, wasted sessions, or security issues.

## 1. NEVER commit to `main` directly
Always create a feature branch (`feat/<name>`). The only exception is hotfixes when the user explicitly says "hotfix." Check `git branch --show-current` before any `git add`.

## 2. Ship It is part of the task, not a follow-up
Implementation is NOT complete until: branch created → committed → pushed → PR opened → merged → deploy verified healthy. Never report "all todos done" without shipping. Include Ship It steps in the FIRST `TodoWrite` call alongside implementation tasks.

## 3. Railway, NOT Vercel
This project deploys on Railway via Docker. Never reference `VERCEL_URL`, `VERCEL_ENV`, any `VERCEL_*` env var, `vercel.json`, or `@vercel/*` packages. Use `BASE_URL` from `lib/constants.ts` for all server-side URL construction.

## 4. `force-dynamic` on all server routes
Any `app/**/page.tsx` or `app/**/route.ts` that touches Supabase, env vars, or any runtime service MUST export `const dynamic = 'force-dynamic'`. Railway's Docker build has no env vars — static prerendering crashes the build. NEVER use `export const revalidate` on these routes.

## 5. PowerShell syntax only
This is Windows/PowerShell. Use `;` not `&&` to chain commands. Write multi-line strings to files (e.g., `commit-msg.txt`) instead of heredocs. Use `git commit -F <file>` and `gh pr create --body-file <file>`. No `grep`/`cat`/`head`/`tail` — use the Read/Grep tools.

## 6. Feature-flag risky features
Controversial, untested, or costly features ship behind a flag. Use `getFeatureFlag()` (server) or `<FeatureGate>` (client). Every flag needs a category and a row in the `feature_flags` table via migration.

## 7. Register every Inngest function in `serve()`
Creating an Inngest function file without adding it to `app/api/inngest/route.ts` `serve()` array means it will never run. Do both in the same commit.

## 8. Database-first, Supabase-only reads
All frontend reads go through Supabase via `lib/data.ts`. No direct external API calls from pages or components. Koios/Tally/SubSquare calls only happen inside sync functions.

## 9. No `git add -A` without review
Use targeted `git add <files>`. `git add -A` picks up `.cursor/`, `commit-msg.txt`, and workspace artifacts. Always run `git diff --cached --name-only` after staging.

## 10. Admin pages follow the standard pattern
All admin pages: `app/admin/*` route, client-side auth via `POST /api/admin/check`, write endpoints validate `address` against `ADMIN_WALLETS`, linked in Header + MobileNav Admin section.

## 11. Read `tasks/lessons.md` at session start
Before doing anything, read lessons for patterns that prevent repeat mistakes.

## 12. Verify deploy, don't assume it
After merge, poll deployment status until `success` is confirmed. Hit the affected page on `drepscore.io` to smoke-test. Deploy failures from your changes are your responsibility — fix and re-push immediately.
