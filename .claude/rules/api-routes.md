---
paths:
  - 'app/api/**'
  - 'app/**/route.ts'
  - 'app/**/route.tsx'
---

# API Route Rules

- MUST export `const dynamic = 'force-dynamic'` if the route touches Supabase, Redis, or env vars
- NEVER export `const revalidate` on routes touching Supabase (causes build-time prerendering, crashes Railway)
- Next.js 16 strict exports: only HTTP handlers (GET, POST, PUT, DELETE, PATCH) + config fields allowed
- Helper functions must live in `lib/` -- not in route files
- JSX routes (e.g., `ImageResponse`) must use `.tsx` extension
- Rate limiting: use `@upstash/ratelimit` via `lib/redis.ts`
- Error pattern: try-catch with `NextResponse.json({ error }, { status })`
- `cookies()` returns a Promise in Next.js 16 -- must `await cookies()`
