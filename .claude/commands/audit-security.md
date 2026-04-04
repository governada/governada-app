Audit security posture for pre-launch readiness and ongoing hardening.

## Purpose

Verify that Governada is secure enough for public launch and ongoing operation. This is not a generic OWASP checklist — it's a Governada-specific audit that tests the actual authentication, authorization, data protection, API security, and infrastructure hardening patterns in this codebase.

A governance intelligence platform handling wallet connections, on-chain transactions, and civic engagement data has a unique threat profile. A breach doesn't just leak data — it destroys the trust that makes the entire product viable. Cardano community trust is the product's foundation; security is existential, not optional.

## Scope

Argument: `$ARGUMENTS`

- If empty: Full security audit (all dimensions)
- If "auth": Authentication & session security deep dive
- If "api": API security, rate limiting, input validation
- If "data": Data protection, RLS, exposure analysis
- If "infra": Infrastructure hardening, headers, dependencies
- If "wallet": Wallet integration & transaction security
- If "pre-launch": Pre-launch checklist only (critical items)

## Threat Model

Before auditing, understand what we're defending against:

### Adversary Profiles

| Adversary               | Motivation                                                                  | Capability                                           |
| ----------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Score manipulator       | Inflate DRep/SPO score to attract delegation                                | API abuse, fake engagement, automated voting         |
| Data scraper            | Harvest governance data for competitive intelligence                        | Bulk API calls, crawling, bot traffic                |
| Session hijacker        | Impersonate a user to cast votes or change delegation                       | XSS, session theft, MITM                             |
| Admin impersonator      | Access admin functions to manipulate data                                   | Wallet spoofing, auth bypass                         |
| Engagement spammer      | Flood engagement mechanisms to skew sentiment/signals                       | Bot accounts, automated voting                       |
| Infrastructure attacker | Deny service or compromise the platform                                     | DDoS, dependency supply chain, env var exfiltration  |
| Governance attacker     | Manipulate governance intelligence to influence Cardano governance outcomes | Data poisoning, scoring manipulation, fake briefings |

### Crown Jewels (in priority order)

1. **Scoring integrity** — If scores can be manipulated, the platform loses all credibility
2. **Session security** — Wallet-connected sessions control governance actions
3. **Admin access** — Admin can modify feature flags, trigger syncs, access internal data
4. **Engagement data integrity** — Fake engagement signals poison the intelligence engine
5. **User privacy** — Wallet addresses + governance behavior = sensitive behavioral data
6. **API availability** — Rate limiting failure = cost overruns + degraded service
7. **Sync pipeline integrity** — Corrupted sync data cascades to every surface

---

## Phase 1: Authentication & Session Security

### 1.1 Wallet Authentication Flow

Read and verify the complete auth flow:

- `lib/nonce.ts` — Nonce generation
- `app/api/auth/nonce/route.ts` — Nonce endpoint
- `utils/wallet.tsx` — Client-side wallet signing (CIP-30)
- `app/api/auth/wallet/route.ts` — Signature verification
- `lib/supabaseAuth.ts` — Session creation

**Test each step:**

| Check                    | File                           | What to Verify                                                                                            |
| ------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Nonce entropy            | `lib/nonce.ts`                 | Uses `crypto.randomUUID()`, not `Math.random()`. Nonce is signed (HS256) with `SESSION_SECRET`.           |
| Nonce expiry             | `lib/nonce.ts`                 | TTL is ≤5 minutes. Expired nonces are rejected.                                                           |
| Nonce replay             | `app/api/auth/wallet/route.ts` | Same nonce cannot be used twice. Nonces are consumed on use.                                              |
| Signature verification   | `app/api/auth/wallet/route.ts` | Uses `checkSignature()` from `@meshsdk/core`. Verifies against the claimed address.                       |
| Address resolution       | `app/api/auth/wallet/route.ts` | Properly resolves reward/stake addresses via `resolveRewardAddress()`.                                    |
| Session token generation | `lib/supabaseAuth.ts`          | JWT signed with `SESSION_SECRET` (HS256). Contains userId, walletAddress, expiresAt, jti.                 |
| Token storage            | Client                         | httpOnly cookie (`governada_session`) + localStorage. Cookie has Secure flag in production. SameSite=Lax. |

**Attack scenarios to test mentally:**

1. Replay attack: capture a valid nonce+signature, replay it → should fail (nonce consumed)
2. Forged signature: use a different wallet's address with your own signature → should fail (address mismatch)
3. Expired nonce: wait >5 min then submit → should fail (TTL check)
4. Stolen JWT: extract JWT from cookie, use from different client → should work (this is the session theft risk — mitigated by httpOnly + Secure + SameSite)

### 1.2 Session Management

Read `lib/supabaseAuth.ts` and verify:

- Session TTL (should be 7 days)
- Session refresh mechanism (50% lifetime threshold)
- Session revocation (Redis `revoked:{jti}` + `revoked_sessions` DB table)
- Revocation check on every authenticated request
- Logout flow: cookie cleared (maxAge=0), JWT revoked, localStorage cleared

**Critical checks:**

- [ ] Can a revoked session still be used? (check revocation propagation delay)
- [ ] Does session refresh invalidate the old token? (should revoke old jti)
- [ ] Is there a maximum session lifetime beyond which refresh is denied?
- [ ] Is `parseSessionToken()` (client-only) clearly marked as non-verifying?

### 1.3 Admin Authentication

Read `lib/adminAuth.ts` and verify:

- `ADMIN_WALLETS` env var parsed correctly (comma-separated payment/stake addresses)
- Stake address derivation from payment addresses uses proper bech32 decoding
- Admin check requires both valid session AND wallet in admin list
- `app/api/admin/check/route.ts` requires Bearer token

**Critical checks:**

- [ ] Can a non-admin wallet bypass the admin check? (test with unlisted address)
- [ ] What happens if `ADMIN_WALLETS` env var is empty or malformed?
- [ ] Is admin auth enforced server-side (not just client-side AdminAuthGate)?
- [ ] Are admin API routes (feature flags, integrity alerts) protected beyond AdminAuthGate?

---

## Phase 2: Authorization & Access Control

### 2.1 Row Level Security (RLS)

Read `supabase/migrations/022_rls_hardening.sql` and any subsequent RLS migrations.

**Verify table-level access:**

| Table                                          | Expected Access                             | Check                                                         |
| ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `dreps`, `proposals`, `drep_votes`             | Public read, no anon write                  | Confirm `USING (true)` + `WITH CHECK (false)`                 |
| `api_keys`, `api_usage_log`                    | Service role only                           | Confirm anon/auth SELECT blocked                              |
| `users`, `user_wallets`                        | Public read (addresses are public on-chain) | Verify no sensitive fields exposed                            |
| `notification_log`, `notification_preferences` | Service role write, public read             | Confirm anon INSERT/UPDATE/DELETE blocked                     |
| `citizen_sentiment`, `citizen_concern_flags`   | Write via service role only                 | Confirm engagement writes go through API, not direct Supabase |
| `revoked_sessions`                             | Service role only                           | Confirm anon cannot read or write                             |
| `sync_log`                                     | Public read (operational transparency)      | Confirm no write access for anon                              |

**Critical checks:**

- [ ] Are ALL tables covered by RLS? (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every table)
- [ ] Are views set to `SECURITY INVOKER` (not `SECURITY DEFINER`)? (022 migration converts them)
- [ ] Is there any table with RLS enabled but no policies? (this blocks all access, which is safe but may break things)
- [ ] Test: can an anon Supabase client write to engagement tables directly? (should fail)

### 2.2 Route Protection

For each route category, verify auth enforcement:

| Route Pattern                | Expected Protection                                 | Check                                                   |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `/api/v1/*`                  | API key validation + rate limiting via `handler.ts` | Verify key is required, rate limits enforced            |
| `/api/admin/*`               | Bearer token + admin wallet check                   | Verify both server-side, not just AdminAuthGate         |
| `/api/auth/*`                | Public (nonce/wallet/logout)                        | Verify no sensitive data leaked without auth            |
| `/api/engagement/*`          | Authenticated user (Bearer token)                   | Verify writes require valid session                     |
| `/api/inngest`               | Inngest signing key verification                    | Verify SDK validates signature header                   |
| `/api/admin/integrity/alert` | CRON_SECRET Bearer token                            | Verify secret checked before any action                 |
| `/api/telegram/webhook`      | Telegram webhook secret                             | Verify `X-Telegram-Bot-Api-Secret-Token` header checked |
| `/my-gov/*` pages            | Session cookie via middleware                       | Verify redirect to homepage if unauthenticated          |

**Critical checks:**

- [ ] List ALL routes without auth → verify each is intentionally public
- [ ] Check for routes that accept user input without validation
- [ ] Verify no route handler uses `supabaseAdmin` (service role) for operations that should respect RLS

### 2.3 CSRF Protection

- [ ] State-changing routes using Bearer tokens → immune to CSRF (browser doesn't auto-send Authorization headers)
- [ ] State-changing routes using cookies only → need CSRF tokens or SameSite=Strict
- [ ] Check: does any POST/PATCH/DELETE route rely solely on the `governada_session` cookie for auth?
- [ ] The wallet auth flow (nonce → sign → submit) is inherently CSRF-resistant (requires wallet interaction)

---

## Phase 3: API Security

### 3.1 Rate Limiting

Read `lib/api/handler.ts`, `lib/api/rateLimit.ts`, and `lib/api/withRouteHandler.ts`.

**Verify rate limiting coverage:**

| Layer                    | Implementation                                  | Check                                                                                    |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Public API (`/api/v1/*`) | Upstash sliding window, key by API key ID or IP | Verify tier limits: public (100/hr), pro (10k/day), business (100k/day)                  |
| Internal routes          | Upstash + in-memory fallback                    | Verify in-memory has max-size limit to prevent memory exhaustion                         |
| Auth endpoints           | Rate limited?                                   | Verify nonce + wallet auth endpoints have aggressive rate limiting (prevent brute force) |
| Engagement endpoints     | Rate limited?                                   | Verify sentiment/concern/endorsement endpoints limit per-user per-epoch                  |
| Admin endpoints          | Rate limited?                                   | Verify admin routes have at least basic rate limiting                                    |

**Critical checks:**

- [ ] What happens when Upstash Redis is unreachable? (should fail closed → 429)
- [ ] Is the in-memory fallback bounded? (max entries, eviction policy)
- [ ] Can an attacker exhaust rate limit quota for a legitimate user? (key isolation)
- [ ] Are rate limit headers returned? (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)

### 3.2 Input Validation

Read `lib/api/schemas/` for Zod schemas.

**Verify validation coverage:**

- [ ] Every route accepting query params validates them (allowlist, not blocklist)
- [ ] Every route accepting body params uses Zod `.parse()` or `.safeParse()`
- [ ] Sort/order parameters use allowlists (not arbitrary column names → SQL injection via Supabase)
- [ ] Pagination params have max limits (prevent massive queries)
- [ ] String inputs have length limits
- [ ] No route constructs SQL directly (all via Supabase client with parameterized queries)

**Test for injection vectors:**

- [ ] Supabase `.select()` with user-controlled column names → should be hardcoded
- [ ] Supabase `.filter()` / `.eq()` with user input → parameterized by default, but verify
- [ ] Any string concatenation in database queries? (search for template literals with user input in Supabase calls)

### 3.3 API Key Security

Read `lib/api/keys.ts`.

**Verify:**

- [ ] Keys are hashed (SHA-256) before storage — raw keys never stored
- [ ] Key format (`ds_live_*`) is validated on creation and lookup
- [ ] Key lookup is timing-safe (constant-time comparison of hashes)
- [ ] Revoked/expired keys are rejected
- [ ] Key creation is admin-only
- [ ] Usage logging doesn't store the raw key

### 3.4 CORS Configuration

Read `middleware.ts` for CORS headers.

**Verify:**

- [ ] `/api/v1/*` has `Access-Control-Allow-Origin: *` (intentional — public API)
- [ ] Non-v1 API routes do NOT have permissive CORS
- [ ] `Access-Control-Allow-Methods` is restricted to necessary methods
- [ ] `Access-Control-Allow-Headers` is restricted (no wildcard)
- [ ] Preflight requests (OPTIONS) are handled correctly

---

## Phase 4: Data Protection

### 4.1 Secrets Management

**Verify each secret is properly handled:**

| Secret                | Location        | Check                                                           |
| --------------------- | --------------- | --------------------------------------------------------------- |
| `SESSION_SECRET`      | Server env only | Never in NEXT_PUBLIC, never logged, sufficient entropy          |
| `SUPABASE_SECRET_KEY` | Server env only | Only used in `supabaseAdmin` client, never exposed to client    |
| `INNGEST_SIGNING_KEY` | Server env only | Used by Inngest SDK for webhook verification                    |
| `CRON_SECRET`         | Server env only | Used for cron endpoint auth                                     |
| `ADMIN_WALLETS`       | Server env only | Wallet addresses (public on-chain, but admin list is sensitive) |
| `ANTHROPIC_API_KEY`   | Server env only | AI service key, never exposed                                   |
| `TELEGRAM_BOT_TOKEN`  | Server env only | Bot authentication                                              |
| `SLACK_WEBHOOK_URL`   | Server env only | Webhook URLs contain auth tokens                                |
| Supabase anon key     | `NEXT_PUBLIC_*` | Safe — RLS protects data                                        |
| Sentry DSN            | `NEXT_PUBLIC_*` | Safe — DSN is not a secret                                      |
| PostHog key           | `NEXT_PUBLIC_*` | Safe — analytics key is public                                  |

**Critical checks:**

- [ ] `git log --all -p -- '*.env*'` returns nothing (no secrets ever committed)
- [ ] `.env.local` is in `.gitignore`
- [ ] No hardcoded secrets in source code (grep for `sk_`, `key_`, `secret`, `token` in non-env files)
- [ ] Railway deployment uses environment variables (not build-time injection)

### 4.2 PII & Privacy

**Data classification:**

| Data Type                             | Sensitivity           | Storage                                      | Check                                                        |
| ------------------------------------- | --------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Wallet addresses                      | Low (public on-chain) | `users.wallet_address`, `user_wallets`       | Public by design, but aggregation creates behavioral profile |
| Governance votes                      | Low (public on-chain) | `drep_votes`, `spo_votes`                    | Public data, sourced from Koios                              |
| Engagement signals (sentiment, flags) | Medium                | `citizen_sentiment`, `citizen_concern_flags` | Linked to wallet address — reveals governance opinions       |
| Notification preferences              | Medium                | `notification_preferences`                   | Reveals communication channels                               |
| Civic identity (milestones, streaks)  | Medium                | `citizen_milestones`, engagement history     | Reveals engagement depth                                     |
| Session tokens                        | High                  | Redis + cookies                              | Must not be leaked in logs or error reports                  |
| API keys                              | High                  | `api_keys` (hashed)                          | Raw keys must never be retrievable                           |

**Critical checks:**

- [ ] Sentry error reports don't contain wallet addresses or session tokens (check Sentry scrubbing config)
- [ ] PostHog events don't contain PII beyond wallet address (check event payloads in `analytics.ts` or event calls)
- [ ] Server logs don't contain session tokens or API keys
- [ ] Supabase audit logs are enabled for sensitive tables
- [ ] Data retention: is there a policy for how long engagement data is kept?

### 4.3 Data Integrity Protection

**Verify data can't be poisoned:**

- [ ] Engagement writes (sentiment, flags, endorsements) go through authenticated API routes with rate limiting
- [ ] Score calculation uses only data from the sync pipeline (not user-submitted data directly)
- [ ] Sync pipeline validates data from Koios (Zod schemas on external data)
- [ ] Snapshot tables are append-only (no UPDATE/DELETE from API routes)
- [ ] Admin writes to scoring data require admin auth + audit trail

---

## Phase 5: Wallet & Transaction Security

### 5.1 CIP-30 Integration

Read `utils/wallet.tsx` and verify:

- [ ] Wallet connection uses standard CIP-30 API (`cardano.*` browser extension)
- [ ] `signData()` uses proper hex encoding (UTF-8 → hex, not bech32)
- [ ] Wallet selection handles multiple installed wallets
- [ ] Disconnection properly clears all wallet state

### 5.2 Transaction Construction (when built)

Note: Vote casting (CIP-95/CIP-100) may not be fully implemented yet. If built, verify:

- [ ] Transaction construction uses MeshJS, not manual CBOR
- [ ] User reviews transaction details before signing (amount, destination, metadata)
- [ ] No transaction is constructed that moves ADA (governance votes don't transfer funds)
- [ ] CIP-100 rationale metadata is constructed correctly (valid JSON-LD)
- [ ] Transaction submission goes to a reliable submit endpoint (not a single point of failure)

### 5.3 Delegation Safety

For Quick Match → delegation flow:

- [ ] Delegation transaction only changes DRep delegation, doesn't touch staking
- [ ] User is shown clear confirmation of what delegation means (funds stay in wallet)
- [ ] Delegation can be changed at any time (no lock-in messaging)
- [ ] Failed delegation transactions show clear error + retry path

---

## Phase 6: Infrastructure Hardening

### 6.1 Security Headers

Read `next.config.ts` headers configuration.

**Verify each header:**

| Header                      | Expected Value                                 | Check                     |
| --------------------------- | ---------------------------------------------- | ------------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HSTS enforced for 2 years |
| `X-Frame-Options`           | `DENY`                                         | Prevents clickjacking     |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevents MIME sniffing    |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Limits referrer leakage   |
| `Permissions-Policy`        | Camera, microphone, geolocation disabled       | Restricts browser APIs    |
| `Content-Security-Policy`   | See detailed check below                       | Controls resource loading |

### 6.2 CSP Analysis

Read the CSP header in `next.config.ts` directive by directive:

| Directive         | Current Value                          | Risk     | Recommendation                                                                          |
| ----------------- | -------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `default-src`     | `'self'`                               | Low      | Correct baseline                                                                        |
| `script-src`      | `'self' 'unsafe-inline' 'unsafe-eval'` | **High** | Required for PostHog/Sentry, but enables XSS. Migrate to nonce-based CSP when possible. |
| `style-src`       | `'self' 'unsafe-inline'`               | Medium   | Required for Tailwind CSS runtime. Acceptable.                                          |
| `img-src`         | Check                                  | Low      | Should allow Supabase storage, Cloudflare, ipfs gateways                                |
| `connect-src`     | Check                                  | Low      | Should allow Supabase, PostHog, Sentry, Koios, Inngest                                  |
| `object-src`      | `'none'`                               | None     | Correct                                                                                 |
| `frame-ancestors` | `'none'`                               | None     | Correct — blocks embedding                                                              |

**Critical checks:**

- [ ] Is CSP in enforce mode or report-only? (report-only = no actual protection)
- [ ] Can `unsafe-inline` be replaced with nonces for scripts?
- [ ] Is there a CSP violation reporting endpoint configured?

### 6.3 Dependency Audit

Run and analyze:

```bash
npm audit
```

**Check critical dependencies:**

| Package                 | Risk Area        | Check                                                                  |
| ----------------------- | ---------------- | ---------------------------------------------------------------------- |
| `@meshsdk/core` (beta)  | Wallet security  | Is it the latest stable? Any known CVEs? Beta in production is a risk. |
| `@supabase/supabase-js` | Data access      | Latest version? Known issues?                                          |
| `jose`                  | JWT handling     | Latest version? Algorithm support up to date?                          |
| `zod`                   | Input validation | Latest version? Any bypass issues?                                     |
| `inngest`               | Job execution    | Signing key rotation support?                                          |
| `next`                  | Framework        | Latest version? Known SSR vulnerabilities?                             |

**Critical checks:**

- [ ] `npm audit` shows zero high/critical vulnerabilities
- [ ] No dependencies with known supply chain compromises
- [ ] Lock file (`package-lock.json`) is committed and matches `package.json`
- [ ] No postinstall scripts that execute arbitrary code from unpinned sources

### 6.4 Deployment Security

**Railway configuration:**

- [ ] Environment variables are set via Railway dashboard (not in Dockerfile)
- [ ] Docker image doesn't contain `.env.local` or any secrets
- [ ] Health check endpoint exists (doesn't expose sensitive info)
- [ ] Build logs don't contain secrets (Railway build has no env vars — by design)
- [ ] Auto-deploy from `main` means all code on main is production code — branch protection enforced?

**Cloudflare configuration:**

- [ ] SSL/TLS is Full (Strict) — not Flexible
- [ ] DNSSEC enabled
- [ ] Bot protection rules active (if available)
- [ ] DDoS protection settings appropriate
- [ ] No overly permissive page rules

**Inngest security:**

- [ ] Signing key is rotated periodically
- [ ] Event key is separate from signing key
- [ ] Functions cannot be triggered by unauthenticated requests
- [ ] Function execution environment is isolated (Inngest Cloud handles this)

### 6.5 Error Handling & Information Leakage

**Verify errors don't leak implementation details:**

- [ ] API error responses use generic messages (not stack traces, SQL errors, or internal paths)
- [ ] Sentry captures full errors server-side but doesn't expose them to clients
- [ ] 404/500 pages don't reveal technology stack or internal routes
- [ ] Validation errors return field-level detail (helpful) but not schema structure (TMI)
- [ ] Database errors are caught and wrapped before reaching the client

---

## Phase 7: Engagement Anti-Gaming

Governada's engagement mechanisms are a unique attack surface. If sentiment, endorsements, or concern flags can be gamed, the intelligence engine is poisoned.

### 7.1 Anti-Spam Measures

For each engagement mechanism, verify:

| Mechanism                            | Anti-Gaming Check                                                           |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Proposal sentiment (Yes/No/Not sure) | One vote per user per proposal? Rate limited per epoch? Stake-weighted?     |
| Priority signals                     | One signal per user per cycle? Rate limited?                                |
| Concern flags                        | One flag per user per proposal? Threshold-based surfacing (not raw counts)? |
| Impact tags                          | One tag per user per project? Only for funded projects?                     |
| Endorsements                         | One per user per entity? Conditional endorsements validated?                |
| Citizen questions                    | Deduplication? Rate limited per user? Aggregation before surfacing?         |
| Citizen assemblies                   | Random sampling verified? Sybil resistance?                                 |

### 7.2 Credibility System

Read citizen credibility scoring:

- [ ] How is credibility calculated? Is it gameable?
- [ ] Does credibility weight engagement signals appropriately?
- [ ] Can a new account immediately have maximum influence?
- [ ] Is credibility based on verifiable on-chain behavior (not self-reported)?

### 7.3 Sybil Resistance

- [ ] Each wallet address = one identity (no multi-account manipulation)
- [ ] Stake-weighting prevents low-stake spam accounts from dominating signals
- [ ] Quorum thresholds prevent small groups from triggering concern flags or priority shifts
- [ ] Is there a minimum stake requirement for engagement participation?

---

## Phase 8: Scoring (5 dimensions, 10 pts each = 50 total)

### SEC1: Authentication & Session Security (10 pts)

| Score | Anchor                                                                                                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Basic auth exists but nonce/session management has known vulnerabilities, no revocation                                                                                             |
| 4-6   | Wallet auth with signature verification, JWT sessions with expiry, basic admin auth                                                                                                 |
| 7-8   | Nonce replay protection, session revocation via Redis+DB, admin auth with server-side enforcement, httpOnly+Secure+SameSite cookies, all auth flows tested against attack scenarios |
| 9-10  | Hardware wallet support, session binding to device fingerprint, admin auth with MFA or multisig, comprehensive auth audit trail, pen-tested by external team                        |

### SEC2: Authorization & Access Control (10 pts)

| Score | Anchor                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Inconsistent route protection, RLS not comprehensive, client-side-only auth gates                                                                                                                                   |
| 4-6   | RLS on core tables, route auth via middleware/handlers, basic CORS                                                                                                                                                  |
| 7-8   | RLS on ALL tables with explicit policies, every route's auth requirement documented and enforced server-side, CSRF protection on cookie-auth routes, views use SECURITY INVOKER, zero unintentionally public routes |
| 9-10  | Automated RLS policy testing in CI, route auth coverage verified by tests, least-privilege enforced everywhere, auth bypass testing automated, access control matrix documented and audited                         |

### SEC3: API & Input Security (10 pts)

| Score | Anchor                                                                                                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | No rate limiting, minimal input validation, SQL injection possible                                                                                                                                                                      |
| 4-6   | Rate limiting on public API, Zod validation on most routes, parameterized queries                                                                                                                                                       |
| 7-8   | Rate limiting on ALL endpoint categories (public, internal, auth, admin, engagement), all inputs validated with Zod, bounded in-memory fallback, rate limit headers returned, API keys hashed and revocable, timing-safe key comparison |
| 9-10  | Adaptive rate limiting (increases limits for trusted clients, decreases on abuse), WAF rules for common attack patterns, API abuse detection and automatic blocking, comprehensive input fuzzing in CI                                  |

### SEC4: Data Protection & Privacy (10 pts)

| Score | Anchor                                                                                                                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Secrets in code or logs, PII exposed in error reports, no data classification                                                                                                                                                     |
| 4-6   | Secrets in env vars, basic log sanitization, RLS protects sensitive tables                                                                                                                                                        |
| 7-8   | All secrets properly managed (never logged, never in client), Sentry scrubs PII, PostHog events sanitized, data classified by sensitivity, engagement data integrity protected by auth+rate limiting, snapshot tables append-only |
| 9-10  | Data retention policy enforced, privacy impact assessment completed, user data export/deletion capability, encryption at rest for sensitive tables, third-party data processor agreements documented                              |

### SEC5: Infrastructure & Dependency Security (10 pts)

| Score | Anchor                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1-3   | No security headers, outdated dependencies with known CVEs, CSP missing                                                                                                                                                                    |
| 4-6   | Basic security headers (HSTS, X-Frame-Options), CSP in report-only mode, npm audit has no critical issues                                                                                                                                  |
| 7-8   | Full security header suite, CSP enforced (even with unsafe-inline caveat), zero high/critical npm audit findings, lock file committed, deployment doesn't expose secrets, Cloudflare SSL Full Strict, error responses don't leak internals |
| 9-10  | Nonce-based CSP (no unsafe-inline), automated dependency updates with security scanning, DNSSEC enabled, pen-test report from external firm, incident response plan documented, security monitoring with alerting                          |

---

## Phase 9: Pre-Launch Security Checklist

A pass/fail checklist for launch readiness. Every item must pass before public launch.

### Critical (Launch Blockers)

- [ ] **Wallet auth flow is secure**: nonce replay protection works, signature verification is correct, session creation is sound
- [ ] **Session hijacking mitigated**: httpOnly + Secure + SameSite cookies, JWT revocation works
- [ ] **Admin access is locked**: server-side enforcement, admin wallet list correct, no bypass possible
- [ ] **RLS covers all tables**: no table without explicit policies, anon writes blocked on all sensitive tables
- [ ] **API rate limiting works**: rate limits enforced, fail-closed on Redis failure, auth endpoints rate limited
- [ ] **No secrets in code/logs**: `git log` clean, no NEXT_PUBLIC secrets, Sentry scrubs tokens
- [ ] **Input validation on all routes**: Zod schemas, parameterized queries, no raw user input in DB calls
- [ ] **Security headers active**: HSTS, X-Frame-Options, X-Content-Type-Options, CSP (even report-only)
- [ ] **npm audit clean**: zero high/critical vulnerabilities
- [ ] **Engagement anti-spam**: one vote per user per item, rate limited, stake-weighted where appropriate

### Important (Fix Within 30 Days of Launch)

- [ ] **CSP enforced** (not just report-only) with nonce-based scripts where possible
- [ ] **CSRF protection** on any cookie-only auth routes
- [ ] **In-memory rate limiter bounded** (max entries + eviction)
- [ ] **Telegram token generation** uses `crypto.randomUUID()` not `Math.random()`
- [ ] **Data retention policy** defined and documented
- [ ] **Sentry PII scrubbing** verified with test data
- [ ] **Cloudflare security settings** reviewed (SSL, DNSSEC, bot protection)

### Recommended (Within 90 Days)

- [ ] **External pen test** commissioned for wallet auth + API security
- [ ] **Automated security scanning** in CI (npm audit, Snyk, or similar)
- [ ] **API key rotation** mechanism documented and tested
- [ ] **Incident response plan** documented (who to contact, what to do, rollback procedures)
- [ ] **Security headers monitoring** (report-uri or similar for CSP violations)
- [ ] **Admin audit trail** — log all admin actions (feature flag changes, manual sync triggers)

---

## Phase 10: Work Plan

For each finding, propose fixes following `docs/strategy/context/work-plan-template.md`.

Categorize each issue:

- **critical** — exploitable vulnerability or launch blocker (P0)
- **auth** — authentication or session security gap (P0-P1)
- **access** — authorization or access control gap (P1)
- **validation** — input validation or injection risk (P1)
- **hardening** — infrastructure or configuration improvement (P2)
- **anti-gaming** — engagement integrity issue (P2)
- **privacy** — data protection or PII handling (P2-P3)
- **monitoring** — observability or alerting gap (P3)

**Key decision prompts for the user:**

- Should an external pen test be commissioned before launch? (strongly recommended)
- Should CSP enforcement be a launch blocker or post-launch fix?
- Should engagement mechanisms require a minimum stake for participation?
- Should admin actions be logged to an immutable audit trail?
- Should the in-memory rate limiter fallback be replaced with a more robust solution?
- Is the current ADMIN_WALLETS env var approach sufficient, or should admin config move to database?

## Recommended Cadence

- **Pre-launch**: Full `/audit-security` — every item in the pre-launch checklist must pass
- **Post-launch (monthly)**: `/audit-security infra` — dependency audit, header check, rate limit review
- **Quarterly**: `/audit-security` full — complete reassessment including new routes and features
- **After any auth/wallet change**: `/audit-security auth wallet` — focused review of changed flows
- **After dependency updates**: `/audit-security infra` — verify no new vulnerabilities introduced
- **After engagement feature changes**: `/audit-security` with focus on anti-gaming
