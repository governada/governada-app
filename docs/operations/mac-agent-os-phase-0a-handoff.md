# Mac Agent OS Phase 0A Handoff

Date: 2026-04-24
Owner: Codex
Scope: Phase 0A reality hygiene only. Broader roadmap phases were not implemented.

## Research Performed

- Read the requested control-plane docs in `governada-brain`: roadmap, system overview, agent operating model, tooling matrix, data boundaries, autonomy policy, plus the auth map at `/Users/tim/dev/governada/governada-brain/agents/system/auth-and-identity.md` and `governada-app/AGENTS.md`.
- Read additional drift targets: `current-state.md`, `milestones.md`, `retrieval-policy.md`, `retrieval-interfaces.md`, BlueCargo agent context and indexing policy, retrieval READMEs, worktree scripts, `docs-doctor`, `session-doctor`, and `gh-auth-status`.
- Ran `npm run session:guard`, `npm run session:doctor`, `npm run docs:doctor`, `npm run gh:auth-status`, and `npm run auth:doctor`.
- Checked Governada and BlueCargo retrieval wrappers, index timestamps, metadata chunk counts, and vault files newer than indexes.
- Checked local tool availability for repo, retrieval, auth, browser testing, and local model claims.

## Current Local Reality

- `session:guard` passed before Phase 0A edits.
- `session:doctor` passed before Phase 0A edits, with 13 registered worktrees and no dirty or gone-upstream registered worktrees. During PR #901 closeout, `session:doctor` reports 14 registered worktrees because it also sees an external detached Codex worktree at `/Users/tim/.codex/worktrees/f78c/governada-app`.
- `docs:doctor` failed before Phase 0A edits because `build-manifest.md` had an Inngest count of 57 instead of 59, the manifest was older than `ultimate-vision.md`, and the generated registry index was stale.
- `gh:auth-status` succeeded with repo context `governada/governada-app` and a 1Password token source, but its old implementation printed the raw `gh auth status` output, including a token-like masked line.
- PR #901 exposed an auth-runtime gap after CI passed: Codex Desktop sandboxing may block 1Password desktop IPC even when the same `op read` succeeds outside the sandbox. This is an execution-boundary issue, not a reason to switch to global `gh auth login`, raw tokens, generic GitHub remotes, or BlueCargo credentials.
- During the PR #901 closeout update, `gh:auth-status` and `auth:doctor` both reported the same blocked desktop 1Password lane from Codex. The shared wrapper now redacts secret references and times out deterministically instead of hanging or printing the full `op://...` reference.
- The current Governada auth map lives at `/Users/tim/dev/governada/governada-brain/agents/system/auth-and-identity.md`. It defines desktop 1Password as the human-present lane and assigns sandbox-compatible autonomous auth design to Phase 0B / Phase 0.5.
- Governada retrieval runs through `/Users/tim/dev/governada/governada-retrieval/gr`; live metadata has 278 chunks. The index was built at 2026-04-23 18:55:47 -0400. `governada-brain/agents/system/roadmap.md` is newer than that index.
- BlueCargo retrieval runs through `/Users/tim/dev/bluecargo/bluecargo-retrieval/br`; live metadata has 41 chunks. The index was built at 2026-04-22 00:39:35 -0400 and no BlueCargo vault markdown was newer than the index during this check.
- Shell `PATH` did not expose `gr`, `gr_task`, `br`, or `br_task`; absolute wrappers are present and executable.
- `governada-brain`, `governada-retrieval`, and `bluecargo-retrieval` were not Git repositories during this check.
- Local tools observed: Node v25.9.0, npm 11.12.1, git 2.53.0, gh 2.90.0, op 2.34.0, Python 3.14.4 globally, ripgrep 15.1.0, and `@playwright/test` 1.59.1. LM Studio and `lms` exist, but the LM Studio server was off. Ollama, Open WebUI app, and Hammerspoon were not found.

## Worktree Classification

| Branch                             | Path                                             | Classification  | Notes                                                                           |
| ---------------------------------- | ------------------------------------------------ | --------------- | ------------------------------------------------------------------------------- |
| `main`                             | `/Users/tim/dev/governada/governada-app`         | keep            | Shared checkout; clean; stays on `main`.                                        |
| `(detached)`                       | `/Users/tim/.codex/worktrees/f78c/governada-app` | keep            | Clean, exactly at main; appears Codex-managed and outside `.claude/worktrees/`. |
| `codex/phase-0a-reality-hygiene`   | `.claude/worktrees/phase-0a-reality-hygiene`     | active          | Current Phase 0A worktree.                                                      |
| `claude/amazing-tu-f1cc0e`         | `.claude/worktrees/amazing-tu-f1cc0e`            | unknown         | Clean, unmerged local work; no upstream in local branch metadata.               |
| `codex/auth-hardening`             | `.claude/worktrees/auth-hardening`               | active          | Clean, unmerged, has upstream branch.                                           |
| `fix/dockerfile-npm11-only`        | `.claude/worktrees/dockerfile-npm11`             | unknown         | Clean, unmerged local work; related npm 11 branch history exists.               |
| `codex/inngest-security-followup`  | `.claude/worktrees/inngest-security-followup`    | active          | Clean, unmerged, has upstream branch.                                           |
| `fix/lockfile-drift-npm10`         | `.claude/worktrees/lockfile-refresh`             | unknown         | Clean, one local commit relative to main; no upstream in local branch metadata. |
| `feat/node24-lts`                  | `.claude/worktrees/node24-lts`                   | active          | Clean, one local commit ahead of main.                                          |
| `feat/obsidian-runbook`            | `.claude/worktrees/obsidian-runbook`             | active          | Clean, three local commits ahead of main.                                       |
| `fix/restore-894-deps`             | `.claude/worktrees/restore-894`                  | unknown         | Clean, one local commit relative to main; no upstream in local branch metadata. |
| `claude/serene-liskov-38d43a`      | `.claude/worktrees/serene-liskov-38d43a`         | merged/prunable | Clean, no commits ahead of main.                                                |
| `claude/upbeat-liskov-8f594e`      | `.claude/worktrees/upbeat-liskov-8f594e`         | merged/prunable | Clean, no commits ahead of main.                                                |
| `claude/xenodochial-agnesi-ec1509` | `.claude/worktrees/xenodochial-agnesi-ec1509`    | unknown         | Clean, one local commit ahead and behind main.                                  |

Additional stale directory: `.claude/worktrees/auth-cookie-cleanup` is not registered by `git worktree list`; its `.git` pointer references `/Users/tim/governada-app/.git/worktrees/auth-cookie-cleanup`. Treat as unknown/orphaned and do not delete without Tim confirming ownership.

## Drift Found

- `retrieval-policy.md` and `autonomy-policy.md` still say BlueCargo is not indexed; live wrappers, `retrieval-interfaces.md`, `tooling-matrix.md`, and retrieval execution show BlueCargo v1 exists locally.
- `bluecargo-brain/agents/bluecargo-context.md` still says retrieval is not enabled, and that stale statement is included in the BlueCargo index.
- `current-state.md` says Governada has about 93 indexed chunks; live metadata has 278.
- `governada-retrieval/README.md` still lists adding BlueCargo retrieval as a next step.
- `tooling-matrix.md` gives a portable absolute wrapper example for Governada only.
- `scripts/new-worktree.mjs` and `scripts/sync-worktree.mjs` copy `.env.local` into worktrees; this should be replaced with a 1Password-backed reference/injection flow in a later slice.

## Phase 0A Fixes Applied

- `scripts/gh-auth-status.js` now verifies GitHub API auth and repo access without calling `gh auth status`, avoiding token-like output.
- `scripts/lib/gh-auth.js` now bounds `op read`, redacts token-like strings and `op://...` references from auth failures, names desktop IPC/authorization timeout as the likely blocked lane, and prefers the configured 1Password reference over ambient raw GitHub token env.
- `npm run auth:doctor` now reports the repo-pinned Governada GitHub lane, verifies the 1Password reference without printing it, classifies Codex sandbox desktop-IPC failure explicitly, and only runs child `gh` checks after the 1Password lane is ready.
- `scripts/repair-gh-auth.mjs` no longer points agents at `gh auth login`; it directs them back through `auth:doctor` and the repo-scoped 1Password lane.
- `scripts/session-doctor.js` now reports orphaned `.claude/worktrees/*` directories as advisories.
- `docs/strategy/context/build-manifest.md` now records 59 Inngest functions.
- `docs/strategy/context/registry/_index.generated.md` was regenerated.
- This durable handoff note records current reality for Phase 0B.

## Validation Plan

- `npm run docs:doctor`
- `npm run session:doctor`
- `npm run session:guard`
- `npm run gh:auth-status`
- `npm run auth:doctor`
- `npm run registry:index:check`
- `npm run agent:validate`

## Validation Results

- `npm run docs:doctor`: pass after manifest and registry refresh.
- `npm run registry:index:check`: pass.
- `npm run gh:auth-status`: no longer emits token-like `gh auth status` output. In current Codex runs it can still block on 1Password desktop IPC / authorization timeout, including after sandbox escalation, and emits a deterministic redacted error.
- `npm run auth:doctor`: diagnostic block in the Codex sandbox because 1Password desktop IPC is unavailable from this process, then skips child `gh` checks. Output does not print raw tokens or the full `op://...` reference. This is the PR #901 auth-runtime finding to carry into Phase 0B.
- `npm run session:doctor`: pass as a diagnostic command; reports the current dirty Phase 0A worktree, 14 registered worktrees, and one orphaned `.claude/worktrees` directory.
- Final strict `npm run session:guard`: pass after committing the auth-runtime closeout; worktree clean, no stashes, no dirty or gone-upstream registered worktrees. Advisories remain for 14 open worktrees and one orphaned `.claude/worktrees` directory.
- `npm run agent:validate`: pass.
- `npm run format:check`: pass after formatting this handoff note.

## Review Gate v0

- Review gate tier: foundational auth/runtime/harness work. Minimum one independent review; preferred two perspectives when available.
- Reviewers requested: fresh read-only Codex code/runtime reviewer, plus fresh read-only policy/boundary reviewer as the Claude Code fallback because managed Claude review is not wired in this session.
- Prompts/focus used: code/runtime review focused on auth-runtime regressions, token/reference leakage, sandbox/escalation behavior, GitHub wrapper correctness, and Phase 0A scope creep. Policy/boundary review focused on policy consistency, auth-boundary correctness, Governada/BlueCargo isolation, Phase 0A vs Phase 0B scope, and handoff quality.
- Review result summary: initial merge posture was blocked because both reviews found important auth-diagnostic gaps and the handoff lacked an explicit review-gate record.
- Findings fixed:
  - Raw token env could satisfy or distort `auth:doctor`; `auth:doctor` now blocks when `GH_TOKEN` or `GITHUB_TOKEN` is present.
  - `gh:auth-status` could report a 1Password reference while `runGh` used an ambient raw token; the shared auth helper now resolves the configured 1Password reference whenever present and overrides ambient raw token env for child `gh`.
  - `op://...` reference redaction stopped at whitespace; the shared redactor now covers references with spaces up to quotes or line breaks.
  - `auth:doctor` classified authorization timeout less specifically than the shared helper; it now treats authorization timeout as the desktop IPC lane.
  - Review Gate v0 metadata was missing from the handoff; this section records the tier, reviewers, prompts, findings, deferments, and merge posture.
- Validation after fixes: `node --check` passed for the changed auth scripts; redactor smoke test removed full `op://...`, GitHub PAT, and `gh*` token-shaped strings; raw-token `auth:doctor` simulation blocked; `docs:doctor` and `agent:validate` passed. `gh:auth-status` remains blocked in the current Codex run by the documented 1Password desktop IPC / authorization timeout lane.
- Findings deferred:
  - Managed Claude Code Review is not confirmed wired; Phase 0B / Phase 0.5 should add review tools to the capability registry before making managed review automatic.
  - The Codex-to-1Password desktop IPC blocker is not solved in Phase 0A; it is documented as the durable Phase 0B auth-runtime design problem.
- Safe to merge: code/runtime and policy Review Gate v0 findings are fixed, but hold merge until the final review-gate commit is pushed, CI passes, and Tim explicitly accepts the documented Phase 0B auth-runtime deferment if local `pre-merge-check`/merge wrappers still block on desktop IPC. Do not merge through a bypassed auth path.

## Phase 0B Recommended Scope

- Decide and implement durability/versioning for `governada-brain`, `governada-retrieval`, and `bluecargo-retrieval`, or record accepted loss risk explicitly.
- Use `/Users/tim/dev/governada/governada-brain/agents/system/auth-and-identity.md` as the auth/identity control-plane source and reconcile implementation details back to it.
- Design the durable sandbox-compatible autonomous auth lane; do not treat desktop 1Password IPC as sufficient for unattended Codex work.
- Add an auth capability registry entry covering owner, operation classes, account/vault boundary, verification command, fallback, and revocation path.
- Add a retrieval doctor that reports wrapper availability, PATH exposure, index timestamp, chunk count, vault files newer than index, and domain-policy drift.
- Reconcile BlueCargo retrieval policy across `retrieval-policy.md`, `autonomy-policy.md`, `bluecargo-context.md`, `retrieval-interfaces.md`, and `tooling-matrix.md`.
- Replace `.env.local` worktree copying with a 1Password-backed local injection/reference path.
- Evaluate GitHub App installation tokens vs a narrow 1Password service account vs an interim fine-grained PAT; do not implement a new auth lane until Tim approves the chosen design.
- Add a capability registry entry for LM Studio as installed but inactive/unproven; keep Ollama, Open WebUI, and Hammerspoon marked unavailable until installed and tested.

## Copy/Paste Prompt For Next Agent

Use this prompt verbatim to start Phase 0B with a fresh agent:

```text
You are taking over Phase 0B: Brain, Retrieval, and Control-Plane Reliability for the Mac Agent Operating System initiative.

Start by reading:
- /Users/tim/dev/governada/governada-app/docs/operations/mac-agent-os-phase-0a-handoff.md
- /Users/tim/dev/governada/governada-brain/agents/system/auth-and-identity.md
- /Users/tim/dev/governada/governada-brain/agents/system/roadmap.md
- /Users/tim/dev/governada/governada-brain/agents/system/system-overview.md
- /Users/tim/dev/governada/governada-brain/agents/system/agent-operating-model.md
- /Users/tim/dev/governada/governada-brain/agents/system/tooling-matrix.md
- /Users/tim/dev/governada/governada-brain/agents/system/data-boundaries.md
- /Users/tim/dev/governada/governada-brain/agents/build-system/autonomy-policy.md
- /Users/tim/dev/governada/governada-app/AGENTS.md

Do not broaden into provider parity, model collaboration, desktop automation, source-of-truth vault writeback, or broader roadmap phases.

Phase 0B goal:
Make the brain, retrieval, auth-runtime, and control-plane layer reliable enough that future agents can trust the doctors and handoff packets before doing deeper implementation.

Use the Phase 0A handoff as primary current-state evidence. Refresh reality where it is cheap and important, especially for drift-prone checks.

Phase 0A auth-runtime finding:
Codex Desktop sandboxing may block 1Password desktop IPC even when `op read` succeeds outside the sandbox. Preserve 1Password as the source of truth. Do not bypass this with global `gh auth login`, raw-token fallbacks, generic GitHub remotes, or cross-domain credentials.

Required first checks:
- npm run session:guard
- npm run session:doctor
- npm run docs:doctor
- npm run gh:auth-status
- npm run auth:doctor
- Governada retrieval wrapper/index status
- BlueCargo retrieval wrapper/index status
- Git/versioning status for governada-brain, governada-retrieval, and bluecargo-retrieval
- Drift between roadmap, current-state, milestones, retrieval-policy, tooling-matrix, data-boundaries, autonomy-policy, and BlueCargo agent context

Boundaries:
- Do not initialize Git in governada-brain or retrieval projects without Tim's explicit approval.
- Do not move, delete, or cloud-sync vault or retrieval files without approval.
- Do not merge Governada and BlueCargo retrieval indexes.
- Do not change .env.local or secret flow in this phase unless Tim explicitly approves the exact design.
- Treat BlueCargo retrieval as local-only until docs and policy say otherwise.
- Do not implement service accounts, GitHub App auth, or a new token lane until the Phase 0B design is explicit and Tim approves it.

Recommended work slices:
1. Decide with Tim whether governada-brain, governada-retrieval, and bluecargo-retrieval should be Git-versioned now or have accepted local-loss risk documented.
2. Extend the auth-runtime design from auth-and-identity.md into an implementation plan: sandbox-compatible autonomous lane, auth capability registry, operation classes, approval posture, fallback, and revocation path.
3. Decide between GitHub App installation tokens, a narrow 1Password service account, and an interim fine-grained PAT for the first autonomous GitHub lane.
4. Replace .env.local worktree copying with a 1Password-backed reference/injection design, then implement only after approval.
5. Add a retrieval/control-plane doctor that reports wrapper availability, PATH exposure, index timestamp, chunk count, vault files newer than index, and policy drift.
6. Reconcile BlueCargo retrieval policy drift across retrieval-policy.md, autonomy-policy.md, bluecargo-context.md, retrieval-interfaces.md, and tooling-matrix.md.
7. Update durable ops notes and/or roadmap current reality after checks and fixes.

Before implementing, output:
- Research Performed
- Current Local Reality
- Blockers
- Advisories
- Drift Found
- Assumptions Closed
- Open Questions For Tim
- Proposed Phase 0B Work Slices
- Validation Plan

At the end, produce a handoff packet for Phase 0.5 or the next Phase 0B slice. The handoff must include a section titled "Copy/Paste Prompt For Next Agent" with a literal fenced prompt Tim can paste into a fresh agent.
```
