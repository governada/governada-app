Comprehensive pre-launch readiness assessment covering both technical quality and business operations. Produces a go/no-go scorecard with evidence.

## Scope

Argument: `$ARGUMENTS`

- If empty or "full": Complete assessment (technical + business ops)
- If "technical": Technical readiness only (audits, security, performance, journeys)
- If "business": Business operations readiness only (branding, legal, monetization, community)
- If "blocker-check": Quick scan for launch blockers only (fastest — just critical items)

---

## Architecture

This command launches parallel subagents for maximum coverage, then synthesizes a single go/no-go decision.

---

## Phase 1: Technical Readiness (Parallel Subagents)

Launch all of the following simultaneously using the Agent tool.

### 1A. Security Launch Blockers

```
You are checking Governada's security posture for launch readiness. READ-ONLY — do not modify files.

Instructions:
1. Read `.claude/commands/audit-security.md` — focus on the Pre-Launch Checklist section
2. Check each of the 10 Critical (launch blocker) items against the actual codebase
3. Check each of the 7 Important items (fix within 30 days of launch)
4. For each item, determine: PASS, FAIL, or PARTIAL

Key files: `lib/nonce.ts`, `lib/supabaseAuth.ts`, `lib/adminAuth.ts`, `middleware.ts`, `next.config.ts`, `lib/api/handler.ts`, `lib/api/keys.ts`, `supabase/migrations/`

Return:

SECURITY_READINESS:
CRITICAL_BLOCKERS:
- [item]: [PASS/FAIL/PARTIAL] — [evidence]
(all 10 items)

IMPORTANT_ITEMS:
- [item]: [PASS/FAIL/PARTIAL] — [evidence]
(all 7 items)

LAUNCH_BLOCKED: [yes/no — yes if ANY critical item is FAIL]
SUMMARY: [1-2 sentence overall assessment]
```

### 1B. Critical Journey Regression

```
You are running the Governada regression baseline to verify all critical user journeys work. READ-ONLY — do not modify files.

Instructions:
1. Read `.claude/commands/audit-journeys.md` — focus on the Regression Baseline section
2. Walk through every pass/fail check in the regression checklist against the actual codebase
3. For each check, trace the full flow through code: route → page → components → data fetching → API
4. Verify that error states, empty states, and loading states exist for each critical flow

Return:

JOURNEY_READINESS:
CRITICAL_FLOWS:
- [flow name]: [PASS/FAIL] — [evidence]
(all items from regression baseline)

FRICTION_BASELINE:
- [task]: [estimated clicks/steps] vs [target] — [PASS/FAIL]
(top 10 most important tasks)

BROKEN_FLOWS: [count]
LAUNCH_BLOCKED: [yes/no — yes if any critical citizen or DRep flow is FAIL]
SUMMARY: [1-2 sentence overall assessment]
```

### 1C. Performance Baseline

```
You are assessing Governada's performance readiness for launch. READ-ONLY — do not modify files.

Instructions:
1. Check `next.config.ts` for image optimization, compression, caching headers
2. Check for proper code splitting: dynamic imports, lazy loading patterns in `app/` and `components/`
3. Check bundle size indicators: large dependencies, unnecessary imports
4. Check API route response patterns: are expensive queries cached? Is Redis used effectively?
5. Check `middleware.ts` for performance impact (runs on every request)
6. Check Inngest function timeouts and step patterns for background job reliability
7. Check for N+1 query patterns in data fetching (`lib/data.ts`)
8. Check static generation vs SSR decisions across routes

Return:

PERFORMANCE_READINESS:
STRENGTHS:
- [what's well-optimized] — [evidence]

CONCERNS:
- [performance risk]: [severity: blocker/warning/note] — [affected routes/files]

CACHING:
- Redis: [usage summary]
- HTTP headers: [cache-control patterns found]
- Static vs dynamic: [ratio and appropriateness]

LAUNCH_BLOCKED: [yes/no — yes only if there's a clear performance blocker like unbounded queries]
SUMMARY: [1-2 sentence overall assessment]
```

### 1D. Data & Sync Health

```
You are verifying Governada's data layer is healthy and ready for public traffic. READ-ONLY — do not modify files.

Instructions:
1. Check sync pipeline health: read `lib/sync/` and `inngest/functions/` for all sync types
2. Verify all sync functions have onFailure handlers
3. Check freshness guard coverage: does every sync type have a staleness threshold?
4. Query production data via Supabase MCP: check v_sync_health for recent failures
5. Check snapshot table coverage: are all entity types getting daily snapshots?
6. Verify hash verification is in place for score integrity

Return:

DATA_READINESS:
SYNC_HEALTH:
- [sync type]: [status: healthy/degraded/failing] — [last success, error rate]

SNAPSHOT_COVERAGE:
- [entity type]: [covered/missing] — [table name]

INTEGRITY:
- Hash verification: [enabled/disabled]
- Freshness guard: [all types covered / gaps]
- onFailure handlers: [all functions / gaps]

LAUNCH_BLOCKED: [yes/no]
SUMMARY: [1-2 sentence overall assessment]
```

---

## Phase 2: Business Operations Readiness (Parallel Subagents)

Launch all of the following simultaneously. These check non-code aspects that are equally critical for a successful launch.

### 2A. Brand & Identity Audit

```
You are auditing Governada's brand presence and visual identity for launch readiness. READ-ONLY — do not modify files.

Instructions:
1. Check `app/layout.tsx` for site title, description, metadata, OG defaults
2. Check `public/` for logo files, favicon (all sizes), apple-touch-icon, OG images
3. Check `app/api/og/` for dynamic OG image generation — are all entity types covered?
4. Verify brand consistency: is it "Governada" everywhere or does "DRepScore" or "Civica" still appear in user-facing text?
5. Check footer component for social links, branding, copyright
6. Check for a custom 404 page and error pages
7. Search for any placeholder text ("Lorem ipsum", "TODO", "Coming soon", "TBD") in user-facing components

Return:

BRAND_READINESS:
IDENTITY:
- Site title: [what it says]
- Meta description: [what it says]
- Favicon: [present/missing, all sizes?]
- OG images: [default + dynamic coverage]
- Brand name consistency: [Governada everywhere? / lingering "DRepScore" or "Civica" references]

POLISH:
- Custom 404: [yes/no]
- Custom error page: [yes/no]
- Placeholder text found: [list any]
- "Coming soon" sections: [list any]

SOCIAL_LINKS:
- [platform]: [URL or "missing"]

LAUNCH_BLOCKED: [yes/no — yes if favicon missing, brand name inconsistent, or placeholder text visible]
SUMMARY: [1-2 sentence assessment]
```

### 2B. Legal & Compliance Check

```
You are checking Governada's legal and compliance readiness for public launch. READ-ONLY — do not modify files.

Instructions:
1. Search `app/` for privacy policy, terms of service, cookie policy pages
2. Check for cookie consent banner/mechanism in components
3. Check for any GDPR-relevant data collection: analytics (PostHog), wallet data, user profiles
4. Check if data deletion/export mechanisms exist (GDPR right to erasure)
5. Check for age verification or restrictions if relevant
6. Check API terms of use for the public API
7. Search for any disclaimers (financial advice, investment advice — important for governance/delegation context)

Return:

LEGAL_READINESS:
PAGES:
- Privacy Policy: [exists at route X / missing]
- Terms of Service: [exists at route X / missing]
- Cookie Policy: [exists at route X / missing]
- API Terms: [exists / missing]

COMPLIANCE:
- Cookie consent mechanism: [exists/missing]
- Data collection disclosure: [PostHog, wallet data — disclosed?]
- Data deletion mechanism: [exists/missing]
- Governance disclaimer: [exists/missing — "not financial advice" type disclaimer]

DATA_HANDLING:
- What PII is collected: [list]
- Where it's stored: [Supabase tables]
- Who has access: [RLS policies summary]

LAUNCH_BLOCKED: [yes/no — yes if no privacy policy or terms of service]
SUMMARY: [1-2 sentence assessment]
```

### 2C. Monetization & Growth Infrastructure

```
You are assessing Governada's monetization and growth infrastructure readiness. READ-ONLY — do not modify files.

Instructions:
1. Check for any payment/subscription infrastructure: Stripe, payment pages, pricing page
2. Check for email collection: newsletter signup, waitlist, notification preferences
3. Check for referral/sharing mechanisms: share buttons, referral codes, viral loops
4. Check the governance wrapped/share card system: is it functional and shareable?
5. Check for any analytics conversion funnels (PostHog): onboarding completion, delegation, engagement
6. Check for push notification infrastructure (web push, service worker)
7. Check for any A/B testing framework setup
8. Check feature flags for monetization-related features

Return:

GROWTH_READINESS:
MONETIZATION:
- Payment infrastructure: [exists/not started — details]
- Pricing page: [exists/missing]
- Subscription tiers: [defined/not defined]
- Status: [ready / pre-revenue / not started]

EMAIL_COLLECTION:
- Newsletter/waitlist signup: [exists/missing]
- Email service integration: [provider or missing]
- Notification preferences: [exists/missing]

VIRAL_MECHANICS:
- Share buttons: [where they exist]
- Governance wrapped: [functional/broken/missing]
- OG cards for sharing: [coverage]
- Referral system: [exists/missing]

ANALYTICS_FUNNELS:
- Onboarding funnel: [tracked/not tracked]
- Delegation funnel: [tracked/not tracked]
- Engagement funnel: [tracked/not tracked]

LAUNCH_BLOCKED: [no — monetization isn't a launch blocker, but note readiness level]
SUMMARY: [1-2 sentence assessment with recommendations for post-launch priority]
```

### 2D. Community & Communication Readiness

```
You are assessing Governada's community and external communication readiness for launch. READ-ONLY — do not modify files.

Instructions:
1. Check for social media links in the app (footer, about page, etc.)
2. Check for a Discord/Telegram integration or community link
3. Check for a feedback mechanism (bug reports, feature requests, contact form)
4. Check for an about/team page
5. Check for any blog or changelog infrastructure
6. Check for developer documentation quality (API docs, embed docs)
7. Check the `/api/v1/` routes: are they documented, versioned, rate-limited?
8. Check for any status page or uptime monitoring link

Return:

COMMUNITY_READINESS:
SOCIAL_PRESENCE:
- Twitter/X: [linked in app? / URL or missing]
- Discord: [linked / missing]
- Telegram: [linked / missing]
- GitHub: [linked / missing]

COMMUNICATION:
- Feedback mechanism: [exists/missing — what type]
- Contact form/email: [exists/missing]
- About/team page: [exists/missing]
- Blog/changelog: [exists/missing]

DEVELOPER_EXPERIENCE:
- API documentation: [quality assessment]
- API versioning: [v1 exists, patterns]
- Rate limiting: [implemented/missing]
- Embed system: [functional/missing]

SUPPORT:
- Status page: [exists/missing]
- Error reporting from users: [mechanism exists/missing]

LAUNCH_BLOCKED: [no — but note critical gaps]
SUMMARY: [1-2 sentence assessment]
```

### 2E. SEO & Discoverability

```
You are assessing Governada's SEO and web discoverability for launch. READ-ONLY — do not modify files.

Instructions:
1. Check `public/robots.txt` — does it exist? What does it allow/disallow?
2. Check for sitemap generation: `app/sitemap.ts` or `public/sitemap.xml`
3. Check meta tags across key pages: title, description, OG tags, canonical URLs
4. Check for structured data (JSON-LD) on key entity pages (DRep profiles, proposals)
5. Check URL structure: are routes clean and descriptive? (`/drep/[id]` vs `/d?id=123`)
6. Check for proper heading hierarchy (h1 → h2 → h3) on main pages
7. Check `next.config.ts` for redirects, rewrites, trailing slash config
8. Check for alt text on images, especially data visualizations

Return:

SEO_READINESS:
FUNDAMENTALS:
- robots.txt: [exists/missing — contents summary]
- Sitemap: [exists/missing — dynamic or static?]
- Canonical URLs: [set/missing]
- Trailing slash consistency: [configured/not]

PAGE_META:
- Homepage: [title, description — quality assessment]
- DRep profiles: [title, description, OG — quality]
- Proposal pages: [title, description, OG — quality]
- Discovery pages: [title, description, OG — quality]

STRUCTURED_DATA:
- JSON-LD: [exists on entity pages? / missing]
- Schema types used: [list]

TECHNICAL:
- URL structure: [clean/problematic]
- Image alt text: [good coverage / gaps]
- Heading hierarchy: [correct / issues]

LAUNCH_BLOCKED: [no — but note if robots.txt is blocking indexing]
SUMMARY: [1-2 sentence assessment]
```

---

## Phase 3: Synthesis — Go/No-Go Scorecard

After ALL subagents return, synthesize into a single launch readiness report.

### 3.1 Launch Blocker Summary

```
## Launch Blockers (MUST fix before public launch)

| # | Domain    | Blocker Description                    | Severity | Fix Effort |
|---|-----------|----------------------------------------|----------|------------|
| 1 | Security  | [from 1A]                              | Critical | [S/M/L]    |
| 2 | Journeys  | [from 1B]                              | Critical | [S/M/L]    |
...

Total blockers: [N]
Estimated fix effort: [total]
```

### 3.2 Launch Risks (acceptable but monitor)

```
## Launch Risks (acceptable for launch, monitor closely)

| # | Domain       | Risk Description                        | Mitigation              |
|---|--------------|----------------------------------------|-------------------------|
| 1 | Performance  | [from 1C]                              | [what to watch]         |
| 2 | Legal        | [from 2B]                              | [timeline to fix]       |
...
```

### 3.3 Readiness Scorecard

```
## Readiness Scorecard

| Domain                    | Status       | Blockers | Risks | Notes                    |
|---------------------------|-------------|----------|-------|--------------------------|
| Security                  | [GO/NO-GO]  | [N]      | [N]   | [key finding]            |
| User Journeys             | [GO/NO-GO]  | [N]      | [N]   | [key finding]            |
| Performance               | [GO/NO-GO]  | [N]      | [N]   | [key finding]            |
| Data & Sync               | [GO/NO-GO]  | [N]      | [N]   | [key finding]            |
| Brand & Identity          | [GO/NO-GO]  | [N]      | [N]   | [key finding]            |
| Legal & Compliance        | [GO/NO-GO]  | [N]      | [N]   | [key finding]            |
| Monetization & Growth     | [READY/NOT] | [N]      | [N]   | [key finding]            |
| Community & Communication | [READY/NOT] | [N]      | [N]   | [key finding]            |
| SEO & Discoverability     | [GO/NO-GO]  | [N]      | [N]   | [key finding]            |
```

### 3.4 Overall Verdict

Based on the scorecard:

- **GO**: Zero blockers across all domains. Risks are documented with mitigations.
- **CONDITIONAL GO**: Zero _technical_ blockers. Business ops gaps exist but can be fixed within first week post-launch. List the conditions.
- **NO-GO**: One or more blockers exist. List them with fix effort estimates.

### 3.5 Pre-Launch Action Plan

If NO-GO or CONDITIONAL GO, produce an action plan:

1. **Blocker fixes** — Convert each blocker into a chunk. Offer to run `/fix-audit` on them.
2. **Risk mitigations** — Steps to monitor or quick-fix risks before or shortly after launch.
3. **Business ops checklist** — Non-code items the founder needs to handle personally:

```
## Founder Action Items (non-code)

- [ ] **Social accounts**: Create/verify Twitter, Discord, Telegram for Governada
- [ ] **Legal review**: Have privacy policy and ToS reviewed by legal counsel
- [ ] **Announcement**: Draft launch announcement for Cardano community channels
- [ ] **Monitoring**: Set up Sentry alerts, Railway notifications, Cloudflare alerts
- [ ] **Support channel**: Establish where users report issues (Discord? GitHub Issues?)
- [ ] **Press/outreach**: Identify Cardano media outlets, community leaders to notify
- [ ] **Launch day plan**: Specific steps for launch day (DNS, feature flags, announcements)
```

### 3.6 Post-Launch First Week Plan

Regardless of verdict, outline the first week after launch:

```
## First Week Post-Launch

### Day 1 (Launch Day)
- Monitor Sentry error rates continuously
- Watch Railway resource usage (CPU, memory, connections)
- Check sync pipeline doesn't degrade under new traffic patterns
- Be available in community channels for immediate feedback

### Days 2-3
- Run `/audit-journeys regression` — verify no flows broke under real traffic
- Check PostHog funnels: are users completing onboarding? Delegating?
- Address any critical bug reports from community

### Days 4-5
- Run `/audit-all quick` — baseline scores under production conditions
- Review user feedback themes — what do people love? What confuses them?
- Prioritize first post-launch improvement cycle

### Week 1 Retrospective
- Run `/retro` with launch learnings
- Update deploy-config.md: change to `staging` mode for safer iteration
- Plan first post-launch `/build-step` based on user feedback
```

---

## Rules

- **Business ops are NOT optional.** A technically perfect app that has no privacy policy, broken OG images, or "DRepScore"/"Civica" in the title will damage credibility at launch. These are real blockers.
- **Monetization is NOT a launch blocker.** You can launch pre-revenue. But the readiness assessment should be honest about what's ready vs not.
- **Legal items ARE potential blockers.** No privacy policy = potential legal liability on day one. Flag these as blockers.
- **The founder action items are key output.** Some launch readiness items can't be fixed by agents (social accounts, legal review, community setup). Surface these clearly.
- **Be honest about the verdict.** A premature "GO" that leads to a bad launch is worse than a "NO-GO" that delays by a week.
- **The post-launch plan is mandatory.** Even with a clean "GO," the first week needs a plan. Launch is the beginning, not the end.
