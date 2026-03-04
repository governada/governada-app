# Civica Coding Conventions

## TypeScript

- Strict mode, no `any` types, no `@ts-ignore`
- Use interfaces for object shapes, type aliases for unions/intersections
- Prefer `const` over `let`, never `var`
- Import alias: `@/*` maps to project root

## React / Next.js

- Server components by default — only use `"use client"` when interactivity is required
- App Router conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Keep client components small and focused
- Loading skeletons for every data-dependent component

## Data Access

- **All frontend reads go through `lib/data.ts`** — this queries Supabase
- **Never** add direct Koios API calls to frontend/server components
- Koios calls only in `utils/koios.ts` (used by sync scripts)
- Supabase client via `lib/supabase.ts`

## UI & Design

- **Custom visualizations over chart libraries** — if a charting library has it, we build our own. Governance data deserves purpose-built visual design
- shadcn/ui for structural components (dialogs, dropdowns, inputs) — never for data visualizations
- Tailwind CSS v4 utility classes — no custom CSS unless absolutely necessary
- Dark mode via `next-themes` — always support both themes
- Mobile-considered design throughout
- Every page's first viewport must be emotionally complete without scrolling

## Scoring

- **DRep Score V3** (0-100, percentile-normalized): Engagement Quality 35%, Effective Participation 25%, Reliability 25%, Governance Identity 15%
- **SPO Governance Score** (0-100): Participation 45%, Consistency 30%, Reliability 25% (4th pillar Governance Identity planned)
- **Score Tiers:** Emerging (0-39), Bronze (40-54), Silver (55-69), Gold (70-84), Diamond (85-94), Legendary (95-100)
- Voting power/influence explicitly excluded from scoring
- Size tiers: Small (<10k), Medium (10k-1M), Large (1M-10M), Whale (>10M ADA)

## File Naming

- Components: PascalCase (`DRepCard.tsx`)
- Utilities/libs: camelCase (`scoring.ts`, `data.ts`)
- API routes: `route.ts` inside App Router directories
- Types: `types/` directory, PascalCase for type/interface names

## Error Handling

- API routes: try-catch with `NextResponse.json({ error }, { status })` pattern
- Never swallow errors silently — log with context
- Wallet operations: phase callbacks for progress tracking

## Database

- Migrations in `supabase/migrations/` with sequential 3-digit prefix
- Table names: snake_case
- Always validate migration results before proceeding to application code

## Testing

- Vitest 3.x (v4 broken on Node 24)
- Test files: `*.test.ts` or `*.test.tsx` colocated with source
- Descriptive test names: "should [behavior] when [condition]"

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Build must pass (`npm run build`) before pushing
- No console.log in committed code — use proper logging
- No hardcoded secrets — environment variables only

## Post-Execution Review

- **Every completed plan** gets a structured review before shipping (see `.cursor/rules/workflow-procedures.md`)
- Covers: opportunities, bugs, dead code, open questions, and vision alignment
- Agent presents findings and asks which recommendations to execute before shipping
- Deferred items are tracked in plan docs or Linear — nothing is lost
