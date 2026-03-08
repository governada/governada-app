# Civica Audit Rubric

> **Purpose:** Anchored scoring criteria for reproducible, comparable audits across sessions.
> **Usage:** Read by `/audit` command. Each dimension has specific criteria and a 1-10 scale with defined anchors.
> **Rule:** Never score without evidence. Every score must cite specific files, routes, or measurements.

---

## Scoring Dimensions (10 categories, 10 pts each = 100 total)

### 1. Intelligence Engine Quality (10 pts)

The scoring, alignment, GHI, and matching algorithms — accuracy, defensibility, and sophistication.

| Score | Anchor                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| 1-3   | Basic metrics, no normalization, no temporal tracking                                                          |
| 4-6   | Multi-pillar scoring with normalization, static alignment, basic matching                                      |
| 7-8   | PCA-based alignment with trajectories, calibrated scoring with size tiers, momentum tracking, snapshot history |
| 9-10  | Peer-reviewed methodology, Monte Carlo validation, published reproducibility, academic citations               |

**Evaluate:** Scoring model rigor, alignment math, GHI calibration, matching accuracy, snapshot compounding, methodology transparency. Compare against: academic governance indices, traditional democracy measurement tools.

### 2. Citizen Experience (10 pts)

The "30-second informed citizen" — does the product deliver its core promise to 80% of users?

| Score | Anchor                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Dashboard with charts. Requires governance knowledge. No personalization                                                  |
| 4-6   | Personalized home, basic briefing, some plain-English content                                                             |
| 7-8   | Epoch briefing as primary surface, civic identity, treasury "your share" framing, milestone celebrations, smart alerts    |
| 9-10  | Citizen tests show <30s comprehension, A/B optimized copy, progressive disclosure perfected, emotional resonance measured |

**Evaluate:** Briefing quality, onboarding flow, plain-English clarity, civic identity depth, alert relevance, treasury transparency for non-experts. Compare against: Robinhood (finance simplification), Duolingo (engagement), Apple Health (summary intelligence).

### 3. Governance Workspace (10 pts)

The DRep/SPO daily tool — vote, write rationales, communicate, manage reputation.

| Score | Anchor                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | View-only governance data                                                                                                                                             |
| 4-6   | Vote casting works, basic rationale editor, limited communication tools                                                                                               |
| 7-8   | Full CIP-95/CIP-100 pipeline (vote + rationale in one tx), AI-assisted drafting, governance statements, delegator communication, proposal workspace with full context |
| 9-10  | Sub-2-minute vote-to-rationale flow, AI drafts indistinguishable from hand-written, constitutional analysis integrated, workspace eliminates ALL context switching    |

**Evaluate:** Vote casting reliability, rationale flow friction, AI draft quality, CIP-100 compliance, proposal workspace completeness, communication tools. Compare against: GovTool (baseline), Snapshot (UX), Linear (workspace ergonomics).

### 4. Community Engagement Quality (10 pts)

Structured civic participation — signal quality, anti-gaming, data utility.

| Score | Anchor                                                                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Simple polls, no anti-gaming, no aggregation                                                                                                                           |
| 4-6   | Multiple mechanism types, basic stake-weighting, aggregated results                                                                                                    |
| 7-8   | 6+ mechanisms, stake-weighted with credibility scoring, quorum thresholds, precomputed signals feeding intelligence engine, anti-spam measures                         |
| 9-10  | Engagement data demonstrably improves DRep scores/matching/briefings, citizen assembly participation rates >20%, endorsement signals validated against voting outcomes |

**Evaluate:** Mechanism breadth, anti-gaming sophistication, signal-to-noise ratio, data flowing to intelligence engine, citizen participation rates. Compare against: Pol.is (structured deliberation), vTaiwan (civic tech), Loomio (cooperative decision-making).

### 5. Data Architecture & Compounding (10 pts)

The moat — historical data collection, snapshot discipline, data freshness, pipeline reliability.

| Score | Anchor                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Current-state only, no history, manual syncs                                                                                                                      |
| 4-6   | Daily snapshots for core entities, automated sync, some historical analysis                                                                                       |
| 7-8   | 15+ snapshot tables, multi-frequency sync (30min/hourly/daily/epoch), freshness guards, data moat compression, integrity monitoring                               |
| 9-10  | Zero data gaps in snapshot history, sub-5-min freshness for critical data, automated anomaly detection, published data quality metrics, comprehensive audit trail |

**Evaluate:** Snapshot coverage, sync reliability (check `sync_log` for failures), data freshness (check `data_freshness_checks`), integrity monitoring, pipeline error rates. Compare against: Dune Analytics (data platform), The Graph (indexing reliability).

### 6. UX & Visual Design (10 pts)

Polish, consistency, accessibility, responsive design, micro-interactions, loading states.

| Score | Anchor                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Functional but inconsistent. Missing loading/error states. Desktop-only                                                                                                                  |
| 4-6   | Consistent design system, responsive, proper loading/error states, dark mode                                                                                                             |
| 7-8   | WCAG 2.1 AA compliant, polished animations, skeleton loaders everywhere, consistent micro-interactions, mobile-optimized, design system documented                                       |
| 9-10  | Lighthouse accessibility 95+, zero layout shifts, sub-100ms interaction response, animations at 60fps, design system rivals shadcn quality, visual identity is distinctive and memorable |

**Evaluate:** Lighthouse scores (performance, accessibility, best practices), layout consistency, loading states coverage, error state quality, animation smoothness, mobile experience, color contrast ratios. Compare against: Linear (polish), Vercel Dashboard (dark mode), Stripe Dashboard (data density).

### 7. Performance & Reliability (10 pts)

Core Web Vitals, bundle size, error rates, uptime, sync reliability.

| Score | Anchor                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | >3s LCP, large bundle, frequent errors, no monitoring                                                                                  |
| 4-6   | <2.5s LCP, code-split routes, Sentry error tracking, basic monitoring                                                                  |
| 7-8   | <1.5s LCP, <200ms FID, <0.1 CLS, optimized bundle with tree-shaking, <1% error rate, automated health checks, Redis caching layer      |
| 9-10  | Sub-1s LCP, zero CLS, <50ms TTFB from CDN, bundle <300KB initial, Sentry error budget <0.1%, automated incident response, 99.9% uptime |

**Evaluate:** Run Lighthouse on key pages (/, /discover, /drep/[id], /pulse, /match). Check Sentry error rates. Check bundle analysis output. Measure TTFB. Review Cloudflare analytics. Compare against: Vercel sites (performance baseline), crypto dashboards (industry standard).

### 8. Testing & Code Quality (10 pts)

Test coverage, type safety, linting discipline, CI reliability, code patterns.

| Score | Anchor                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1-3   | No tests, loose types, inconsistent patterns                                                                                                     |
| 4-6   | Unit tests for core logic, TypeScript strict, ESLint, CI pipeline                                                                                |
| 7-8   | >80% coverage on scoring/alignment/GHI, E2E for critical paths, type-safe API layer, pre-commit hooks, integration tests for sync pipeline       |
| 9-10  | >90% coverage, mutation testing, visual regression tests, contract tests for APIs, load tests for critical endpoints, zero flaky tests, CI <5min |

**Evaluate:** Run `npm run test:coverage`, check CI pass rate (last 20 runs), review test quality (not just quantity), check for untested critical paths. Compare against: Stripe (testing culture), Vercel (CI speed).

### 9. API & Integration Readiness (10 pts)

Public API quality, documentation, SDK readiness, widget system, partner enablement.

| Score | Anchor                                                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | No public API                                                                                                                                                   |
| 4-6   | Basic public endpoints, developer page, some documentation                                                                                                      |
| 7-8   | Versioned API (v1), rate limiting, embed routes, API explorer, typed responses, CORS configured                                                                 |
| 9-10  | OpenAPI spec auto-generated, TypeScript + Python SDKs, webhook system, sandbox environment, themeable widgets, partner onboarding docs, API versioning strategy |

**Evaluate:** API endpoint coverage vs. data available, documentation quality, rate limiting implementation, embed system flexibility, developer experience. Compare against: Stripe API (gold standard), CoinGecko API (crypto standard).

### 10. Product Completeness vs. Vision (10 pts)

How much of the vision is realized at the quality bar the vision demands?

| Score | Anchor                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------- |
| 1-3   | <30% of vision steps shipped                                                                         |
| 4-6   | Core steps shipped but with significant gaps in shipped steps                                        |
| 7-8   | Steps 0-6 shipped with minor gaps, Step 7 partial, Steps 8-11 not started but foundation exists      |
| 9-10  | Steps 0-7 fully polished, Step 8 revenue flowing, Step 9 partners integrated, Steps 10-11 prototyped |

**Evaluate:** Cross-reference `build-manifest.md` checkboxes against actual production behavior. Check each "verify" line. Identify gaps between "shipped" status and actual quality. Compare against: the vision's own "100/100 Wow Framework" scenarios.

---

## Audit Output Format

Every audit must produce:

```markdown
## Civica Audit — [DATE] — Scope: [full | step:N | area:NAME]

### Scores

| #         | Dimension           | Score      | Key Evidence | Top Gap |
| --------- | ------------------- | ---------- | ------------ | ------- |
| 1         | Intelligence Engine | X/10       | ...          | ...     |
| ...       | ...                 | ...        | ...          | ...     |
| **Total** |                     | **XX/100** |              |         |

### Critical Gaps (must fix before next step)

1. [gap] — [why it matters] — [evidence]

### High-Impact Opportunities (biggest improvement per effort)

1. [opportunity] — [expected score impact] — [effort estimate: S/M/L]

### State-of-the-Art Assessment

For each dimension, answer:

- What is the current best practice in crypto/SaaS?
- Are we using it? If not, what would it take?
- Specific technologies, patterns, or approaches to adopt.

### Work Plan

[See work-plan-template.md for structure]
```

---

## Competitive Benchmark Set

When evaluating "state of the art," compare against these specific products:

| Category               | Benchmark Products                         | What to Evaluate                                       |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------ |
| Governance UX          | Tally, Snapshot, GovTool, SubSquare        | Feature depth, UX flow, data presentation              |
| Data Platform          | Dune Analytics, The Graph, DefiLlama       | API quality, data freshness, query flexibility         |
| Dashboard UX           | Linear, Vercel Dashboard, Stripe Dashboard | Polish, information density, dark mode, responsiveness |
| Civic Tech             | Pol.is, vTaiwan, Decidim                   | Engagement mechanisms, structured deliberation         |
| Finance Simplification | Robinhood, Wealthfront, Apple Stocks       | Complex-to-simple translation, summary intelligence    |
| Developer Platform     | Stripe API, Twilio, Plaid                  | API docs, SDKs, developer experience                   |

---

## Tech Currency Checklist

Evaluate whether we're using current best practices:

- [ ] **React 19 features:** Are we using `use()`, `useActionState`, `useOptimistic`, server actions, RSC streaming?
- [ ] **Next.js 16 features:** Are we using PPR, server actions, streaming SSR, parallel routes, intercepting routes?
- [ ] **Tailwind v4:** Using the new engine, `@theme`, CSS-first configuration?
- [ ] **TypeScript 5.x:** Using satisfies, const type parameters, decorators where appropriate?
- [ ] **Database patterns:** Using Supabase Edge Functions, realtime subscriptions, Row Level Security optimally?
- [ ] **AI patterns:** Using structured outputs, tool use, streaming responses, caching?
- [ ] **Observability:** Using OpenTelemetry, structured logging, distributed tracing?
- [ ] **Build tooling:** Using Turbopack effectively, bundle analysis, tree-shaking verification?
- [ ] **Testing:** Using Vitest browser mode, component testing, visual regression?
- [ ] **Animation:** Using View Transitions API, CSS scroll-driven animations, FLIP technique?
