Comprehensive pre-launch readiness assessment. Produces a go/no-go scorecard with evidence.

## Scope

Argument: `$ARGUMENTS`

- If empty or "full": Complete assessment (technical + business ops)
- If "technical": Technical readiness only
- If "business": Business operations only
- If "blocker-check": Quick scan for critical blockers only

## Phase 1: Technical Readiness (4 Parallel Subagents)

Launch ALL simultaneously. Each writes results to `.claude/audit-results/launch-<id>.md` and returns ONLY a 2-line summary (domain, LAUNCH_BLOCKED yes/no) to the orchestrator.

**1A. Security Launch Blockers** — "READ-ONLY. Read `.claude/commands/audit-security.md`, focus on Pre-Launch Checklist. Check each Critical (10 items) and Important (7 items) against codebase. **Write to `.claude/audit-results/launch-security.md`**: each item PASS/FAIL/PARTIAL with evidence, LAUNCH_BLOCKED yes/no."

**1B. Critical Journey Regression** — "READ-ONLY. Read `.claude/commands/audit-experience.md`, use the JTBD Walk-Through methodology. Walk every critical flow through code for citizen-delegated + drep personas. **Write to `.claude/audit-results/launch-journeys.md`**: each flow PASS/FAIL, top 10 friction measurements, LAUNCH_BLOCKED yes/no."

**1C. Performance Baseline** — "READ-ONLY. Check `next.config.ts` optimization, code splitting, bundle size, API caching, middleware perf, Inngest timeouts, N+1 queries. **Write to `.claude/audit-results/launch-performance.md`**: strengths, concerns (blocker/warning/note), LAUNCH_BLOCKED yes/no."

**1D. Data & Sync Health** — "READ-ONLY. Check sync pipeline in `lib/sync/` + `inngest/functions/`. Verify onFailure handlers, freshness guards, snapshot coverage, hash verification. Query `v_sync_health` via Supabase MCP. **Write to `.claude/audit-results/launch-sync.md`**: sync health per type, snapshot coverage, LAUNCH_BLOCKED yes/no."

## Phase 2: Business Ops Readiness (5 Parallel Subagents)

Launch ALL simultaneously. Each is READ-ONLY. Each writes to `.claude/audit-results/launch-<id>.md`, returns 1-line summary.

**2A. Brand & Identity** — Check `app/layout.tsx` metadata, `public/` assets (favicon, OG images), brand consistency ("Governada" everywhere), footer, 404 page, placeholder text. LAUNCH_BLOCKED if brand inconsistent or placeholders visible.

**2B. Legal & Compliance** — Search for privacy policy, ToS, cookie consent, GDPR mechanisms, governance disclaimers. LAUNCH_BLOCKED if no privacy policy or ToS.

**2C. Monetization & Growth** — Check payment infra, email collection, sharing mechanisms, analytics funnels. NOT a launch blocker but report readiness level.

**2D. Community & Communication** — Check social links, feedback mechanism, API docs, status page. Report gaps.

**2E. SEO & Discoverability** — Check `robots.txt`, sitemap, meta tags, structured data, URL structure, heading hierarchy. Flag if robots.txt blocks indexing.

## Phase 3: Synthesis

**Launch a synthesis subagent** with fresh context: "Read ALL `.claude/audit-results/launch-*.md` files. Produce the readiness report below. Write to `.claude/audit-results/launch-synthesis.md`."

### 3.1 Launch Blockers Table

| # | Domain | Blocker | Severity | Fix Effort |

### 3.2 Launch Risks (acceptable, monitor)

| # | Domain | Risk | Mitigation |

### 3.3 Readiness Scorecard

| Domain | Status (GO/NO-GO) | Blockers | Risks | Key Finding |

9 domains: Security, User Journeys, Performance, Data & Sync, Brand, Legal, Monetization, Community, SEO.

### 3.4 Overall Verdict

- **GO**: Zero blockers, risks documented
- **CONDITIONAL GO**: Zero technical blockers, business gaps fixable in first week
- **NO-GO**: Blockers exist, list with fix effort

### 3.5 Action Plans

If not GO: blocker fixes (offer `/fix-audit`), risk mitigations, founder action items (social accounts, legal review, announcement, monitoring, support channel).

### 3.6 Post-Launch First Week Plan

Day 1: Monitor Sentry/Railway/sync. Days 2-3: Journey regression, PostHog funnels, bugs. Days 4-5: Quick audit, user feedback. Week 1 retro.

## Rules

- Business ops are NOT optional — broken OG images or placeholder text damage credibility
- Legal items ARE potential blockers (no privacy policy = liability)
- Monetization is NOT a launch blocker
- Subagents write to files, return only LAUNCH_BLOCKED verdict to orchestrator
- Synthesis runs as separate subagent with fresh context
- Founder action items are key output (non-code items)
- Be honest about the verdict
