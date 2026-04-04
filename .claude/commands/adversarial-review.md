Adversarial post-build review: a hostile critique of both the code AND the live UI/UX. Assumes the build is wrong until proven otherwise.

## Input

Argument: `$ARGUMENTS` — Optional: scope qualifier (e.g., "discover page", "matching flow", "PR #630"). Defaults to reviewing all changes on the current branch vs main.

## Phase 1: Scope Detection

Determine what changed:

```bash
git diff --name-only origin/main...HEAD
```

From the diff, identify:

1. **Changed routes/pages** — these get visual review
2. **Changed API routes** — these get behavioral review
3. **Changed libs/utils** — these get logic review
4. **Changed components** — these get both code + visual review

If `$ARGUMENTS` specifies a scope, filter to that scope only.

## Phase 1.5: Integration Surface Discovery

After identifying changed files, the agent MUST also identify **integration surfaces** — routes and components that CONSUME the changed code but weren't themselves changed.

For each changed lib/hook/component:

1. Grep for imports of the changed module across the codebase
2. Trace those imports to the page routes that render them
3. Add those routes to the UX agent's test list

**Example**: If `lib/intelligence/streamAdvisor.ts` changed, grep for `streamAdvisor` → find `SenecaThread.tsx`, `SenecaConversation.tsx`, `SynapticBriefPanel.tsx` → trace to routes `/`, `/g`, `/workspace` → UX agent must test all three.

This prevents the critical failure mode where changed code is correct in isolation but breaks at integration points.

## Phase 1.6: Feature Journey Mapping

When `$ARGUMENTS` names a feature (e.g., "Seneca", "matching", "globe"):

1. Identify ALL routes where that feature appears (grep for component/hook names)
2. Map the full user journey across surfaces (e.g., homepage → /g → click node → panel → Seneca)
3. Add the full journey to the UX agent's test plan, not just individual pages

## Phase 2: Launch Two Parallel Adversarial Agents

Launch BOTH simultaneously. They operate independently and must not pull punches.

### Agent A: Code Adversary (general-purpose, no browser needed)

Prompt template:

> You are a hostile code reviewer. Your job is to find problems, not praise. Assume every change is subtly broken until you prove otherwise.
>
> Review these files changed on the current branch vs main: [file list]
>
> For EACH file, read it fully, then attack:
>
> **Correctness**: Does this actually work for all inputs? Edge cases? Empty states? Null/undefined? Race conditions? What happens when the API returns unexpected data?
>
> **Security**: Auth bypass? Injection? Data leakage? Missing RLS? Unvalidated inputs? IDOR? Can a malicious user craft a request that breaks this?
>
> **Performance**: N+1 queries? Unbounded loops? Missing pagination? Expensive operations in render paths? Memory leaks in effects/subscriptions?
>
> **Regression risk**: Does this change break any existing behavior? Are there callers/consumers that expect the old interface? Missing backward compatibility?
>
> **Architecture smell**: Is this in the right place? Does it duplicate existing patterns? Is there a simpler way? Does it introduce coupling that will hurt later?
>
> **Production failure modes**: What happens when Supabase is down? When Redis times out? When the Koios API returns 500? When the user's network is slow?
>
> **Elegance**: Is the code concise and expressive? Are there repeated blocks that should be a shared helper? Verbose conditionals that could be simplified? Unnecessary intermediate variables? Loops that could be a map/filter/reduce? Overly defensive checks that obscure intent? Code should read like it was written by someone who cares about craft — not just "works" but "works cleanly." Flag code that a senior engineer would rewrite on sight.
>
> DO NOT review formatting or naming conventions. DO focus on structural elegance — repeated patterns, unnecessary verbosity, missed abstractions, and code that's harder to read than it needs to be. Every finding must identify a concrete improvement, not just "could be cleaner."
>
> Output format:
>
> ### Critical (will break in production)
>
> - **[file:line]** — [problem]. Consequence: [what breaks]. Fix: [specific fix]
>
> ### High (will cause user-visible issues)
>
> - **[file:line]** — [problem]. Consequence: [what degrades]. Fix: [specific fix]
>
> ### Medium (technical debt that compounds)
>
> - **[file:line]** — [problem]. Consequence: [what it leads to]. Fix: [specific fix]
>
> ### Elegance (code that works but doesn't read well)
>
> - **[file:line]** — [what's inelegant]. Better: [concise rewrite or approach]
>
> ### Looks Solid
>
> - [Explicitly list what you verified and found correct — this is required]
>
> ### Verdict
>
> SHIP / SHIP WITH FIXES / BLOCK — [one-line justification]

### Agent B: UX Adversary (general-purpose, uses Claude Preview)

Prompt template:

> You are a hostile UX reviewer testing a local dev build. Your job is to find every visual bug, broken interaction, and confusing experience. Assume the UI is broken until you prove otherwise.
>
> **Start the dev server:**
>
> 1. Use `preview_start` with name "dev" to start the local server. Note the port from the response.
> 2. Wait for the server to be ready: run `npm run preview:ready -- http://localhost:<port>`. Wait until it reports ready or times out.
> 3. **CRITICAL**: Do NOT let the browser load the homepage (`/`) first — the Globe (Three.js/R3F) will hang the headless browser. Navigate to a safe page first:
>    ```js
>    // via preview_eval — use the port from preview_start
>    window.location.href = 'http://localhost:<port>/governance';
>    ```
> 4. Take a `preview_screenshot` to verify the page rendered. If you get a timeout, the Globe may have loaded — stop the server, restart, and navigate to `/governance` immediately.
>
> **Pages that hang the headless browser** (skip or test last):
>
> - `/` (homepage) — Globe/Three.js. Test non-Globe pages first, then try homepage only if needed.
> - `/g/*` — Globe constellation view. Same issue.
>
> **Authenticate for each persona:**
> Many pages are auth-gated. Before testing, authenticate using the dev mock auth endpoint. Use `preview_eval`:
>
> ```js
> // Use preview_eval to authenticate (NO await — use .then()):
> fetch('/api/auth/dev-mock', {
>   method: 'POST',
>   headers: { 'Content-Type': 'application/json' },
>   body: JSON.stringify({ persona: 'citizen' }), // or 'drep', 'spo', 'cc', 'citizen-delegated', 'anonymous'
> })
>   .then((r) => r.json())
>   .then((data) => {
>     localStorage.setItem('governada_session', data.sessionToken);
>     if (data.segmentOverride) {
>       sessionStorage.setItem(
>         'governada_segment',
>         JSON.stringify({
>           address: data.address,
>           ...data.segmentOverride,
>         }),
>       );
>     }
>   });
> ```
>
> Then reload with `preview_eval`: `window.location.reload()`
>
> **Which personas to test per route:**
>
> - `/workspace/*`, `/you/*` — test as `drep`, `spo`, `citizen` (these are auth-gated, test that non-operators see appropriate messaging)
> - `/governance/*`, `/discover/*`, `/pulse/*` — test as `anonymous` first (most common), then `citizen`
> - `/pool/*` — test as `spo`
> - `/drep/*` — test as `drep` and `citizen`
> - All other public pages — test as `anonymous`
>
> If a page redirects or shows "connect wallet" when anonymous, that's expected for auth-gated routes. Note it but don't flag as broken unless the redirect itself is broken.
>
> **Pages to test:** [list of changed page routes derived from Phase 1]
>
> For EACH page:
>
> 1. **Navigate**: Use `preview_eval` with `window.location.href = 'http://localhost:<port>/[route]'` (use the port from `preview_start`). Then take a `preview_snapshot` to verify content loaded before screenshotting. If the page has heavy client components, you may need to wait — use `preview_eval` with `new Promise(r => setTimeout(r, 3000)).then(() => 'ready')` first.
> 2. **Visual audit** (screenshot):
>    - Layout broken? Overlapping elements? Cut-off text? Scrollbar issues?
>    - Empty states — does it look intentional or broken when there's no data?
>    - Loading states — does it flash, jump, or show skeleton correctly?
>    - Spacing/alignment — anything visually off?
>    - Dark mode rendering — contrast issues? Invisible text? Missing borders?
> 3. **Structural audit** (preview_snapshot):
>    - Are interactive elements accessible? Proper roles/labels?
>    - Missing alt text? Unlabeled buttons?
>    - Tab order logical?
>    - Are there hidden elements that shouldn't be visible?
> 4. **Interaction audit** (preview_click + preview_screenshot):
>    - Click every button/link visible on the page. Does it do what you'd expect?
>    - Do modals/drawers open and close cleanly?
>    - Do hover states exist on interactive elements? (use preview_eval for hover)
>    - Does the back button work after navigation?
> 5. **Responsive audit**:
>    - Use `preview_resize` with preset "mobile" — screenshot. Is it usable?
>    - Use `preview_resize` with preset "tablet" — screenshot. Layout intact?
>    - Reset to desktop after.
> 6. **Console/Network audit**:
>    - `preview_console_logs` with level "error" — any runtime errors?
>    - `preview_network` with filter "failed" — any failed API calls?
>
> DO NOT evaluate aesthetic taste. Focus on things that are objectively broken, confusing, or inaccessible. Every finding must include a screenshot reference (which page, what you see).
>
> Output format:
>
> ### Broken (users will see this and think the app is broken)
>
> - **[route]** — [problem]. Screenshot: [described]. Impact: [who's affected]
>
> ### Degraded (works but feels wrong)
>
> - **[route]** — [problem]. Screenshot: [described]. Impact: [who's affected]
>
> ### Responsive Failures
>
> - **[route] @ [viewport]** — [problem]. Screenshot: [described]
>
> ### Console/Network Errors
>
> - **[route]** — [error message]. Likely cause: [hypothesis]
>
> ### Passed Inspection
>
> - [Explicitly list pages/interactions that looked correct — required]
>
> ### Verdict
>
> SHIP / SHIP WITH FIXES / BLOCK — [one-line justification]

## Phase 3: Synthesis

After both agents return, synthesize into a unified report:

### Adversarial Review: [scope]

**Overall Verdict**: SHIP / SHIP WITH FIXES / BLOCK

**Code Adversary Verdict**: [verdict + summary]
**UX Adversary Verdict**: [verdict + summary]

**Critical/Blocking Issues** (must fix before shipping):

- [merged and deduplicated from both agents]

**High Priority** (fix before or immediately after shipping):

- [merged list]

**Medium** (track for follow-up):

- [merged list]

**What's Solid** (no changes needed):

- [merged from both agents]

If either agent returned BLOCK, the overall verdict is BLOCK. If either returned SHIP WITH FIXES, the overall is SHIP WITH FIXES at best.

## Phase 4: Fix or Ship Decision

Present the synthesis. If BLOCK or SHIP WITH FIXES:

- List the specific fixes needed
- Ask: "Should I fix these now, or ship as-is and track as follow-ups?"
- If fixing: make the changes, re-run preflight, amend the commit

If SHIP:

- Say so and move on

## Rules

- Both agents MUST find something wrong. If an agent returns zero findings, it didn't look hard enough — note this in the synthesis as a review quality concern.
- The UX agent MUST take screenshots. Findings without visual evidence are downgraded.
- Neither agent should pad with minor style nits to seem thorough — only real problems.
- The code agent reads files directly. The UX agent uses Preview tools exclusively (not Chrome).
- The UX agent MUST test auth-gated pages using `/api/auth/dev-mock`. Requires `DEV_MOCK_AUTH=true` in `.env.local`.
- For auth-gated pages, test as the most relevant persona (e.g., `/workspace` as `drep`). Test at least 2 personas per auth-gated route if time permits.
- This command does NOT deploy. It reviews what's ready to deploy. Use `/ship` after.
- **Entity type coverage**: When reviewing any list/directory/discovery interface, the UX agent MUST test ALL entity types (DReps, proposals, pools, CC members), not just one. Entity types often have different code paths and data shapes. Bugs hide in the less-common types.
- **Interaction depth minimum**: On every tested page, the UX agent MUST: (1) click at least 3 interactive elements, (2) test at least 2 entity types if the page shows a list, (3) verify that navigation links resolve (not 404), (4) test any cross-surface bridge (e.g., does Seneca affect the globe?).
- **Production verification**: If the user specifies `--prod` or says to review in production, the UX agent should use Chrome MCP (`mcp__Claude_in_Chrome__*` tools) on the production URL instead of Preview tools. Adapt the test plan accordingly.
- **Integration surface testing is mandatory**: The UX agent MUST test routes identified in Phase 1.5 (integration surfaces), not just routes that changed directly. Skipping integration surfaces is the #1 cause of missed bugs.
