Run before pushing to verify the code is ready. Fix any issues found before proceeding.

## Checks

1. **Type check**: `npx tsc --noEmit`
2. **Lint**: `npm run lint`
3. **Tests**: `npx vitest run`
4. **Force-dynamic audit**: Any new/modified `app/` file importing `@/lib/supabase` or `@/lib/data` MUST have `export const dynamic = 'force-dynamic'` (unless it's a `route.ts`)
5. **Staged files review**: `git diff --cached --name-only` — no `.cursor/`, `COMMIT_MSG.txt`, `.env*`, or workspace artifacts staged
6. **New Inngest functions**: If created, verify registered in `app/api/inngest/route.ts` `serve()` array
7. **Registry staleness**: `npm run registry:index:check` — warns if structural index is stale (new routes, hooks, or files not captured). If stale, regenerate and update `product-registry.md`.
