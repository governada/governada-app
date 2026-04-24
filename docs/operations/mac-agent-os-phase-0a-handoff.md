# Mac Agent OS Phase 0A Handoff

Date: 2026-04-24
Owner: Codex
Scope: Phase 0A reality hygiene only. Broader roadmap phases were not implemented.

## Research Performed

- Read the requested control-plane docs in `governada-brain`: roadmap, system overview, agent operating model, tooling matrix, data boundaries, autonomy policy, plus `governada-app/AGENTS.md`.
- Read additional drift targets: `current-state.md`, `milestones.md`, `retrieval-policy.md`, `retrieval-interfaces.md`, BlueCargo agent context and indexing policy, retrieval READMEs, worktree scripts, `docs-doctor`, `session-doctor`, and `gh-auth-status`.
- Ran `npm run session:guard`, `npm run session:doctor`, `npm run docs:doctor`, and `npm run gh:auth-status`.
- Checked Governada and BlueCargo retrieval wrappers, index timestamps, metadata chunk counts, and vault files newer than indexes.
- Checked local tool availability for repo, retrieval, auth, browser testing, and local model claims.

## Current Local Reality

- `session:guard` passed before Phase 0A edits.
- `session:doctor` passed before Phase 0A edits, with 13 registered worktrees and no dirty or gone-upstream registered worktrees. After creating this Phase 0A worktree, `session:doctor` reports 15 registered worktrees because it also sees an external detached Codex worktree at `/Users/tim/.codex/worktrees/f78c/governada-app`.
- `docs:doctor` failed before Phase 0A edits because `build-manifest.md` had an Inngest count of 57 instead of 59, the manifest was older than `ultimate-vision.md`, and the generated registry index was stale.
- `gh:auth-status` succeeded with repo context `governada/governada-app` and a 1Password token source, but its old implementation printed the raw `gh auth status` output, including a token-like masked line.
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
| `claude/vigorous-euclid-f7df65`    | `.claude/worktrees/vigorous-euclid-f7df65`       | merged/prunable | Clean, exactly at main during this check.                                       |
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
- `scripts/session-doctor.js` now reports orphaned `.claude/worktrees/*` directories as advisories.
- `docs/strategy/context/build-manifest.md` now records 59 Inngest functions.
- `docs/strategy/context/registry/_index.generated.md` was regenerated.
- This durable handoff note records current reality for Phase 0B.

## Validation Plan

- `npm run docs:doctor`
- `npm run session:doctor`
- `npm run session:guard`
- `npm run gh:auth-status`
- `npm run registry:index:check`
- `npm run agent:validate`

## Validation Results

- `npm run docs:doctor`: pass after manifest and registry refresh.
- `npm run registry:index:check`: pass.
- `npm run gh:auth-status`: pass; output no longer includes token-like `gh auth status` lines.
- `npm run session:doctor`: pass as a diagnostic command; reports the current dirty Phase 0A worktree, 15 registered worktrees, and one orphaned `.claude/worktrees` directory.
- `npm run agent:validate`: pass.
- `npm run format:check`: pass after formatting this handoff note.
- Final strict `npm run session:guard`: run after committing this change set so the dirty-current-worktree warning can clear.

## Phase 0B Recommended Scope

- Decide and implement durability/versioning for `governada-brain`, `governada-retrieval`, and `bluecargo-retrieval`, or record accepted loss risk explicitly.
- Add a retrieval doctor that reports wrapper availability, PATH exposure, index timestamp, chunk count, vault files newer than index, and domain-policy drift.
- Reconcile BlueCargo retrieval policy across `retrieval-policy.md`, `autonomy-policy.md`, `bluecargo-context.md`, `retrieval-interfaces.md`, and `tooling-matrix.md`.
- Replace `.env.local` worktree copying with a 1Password-backed local injection/reference path.
- Add a capability registry entry for LM Studio as installed but inactive/unproven; keep Ollama, Open WebUI, and Hammerspoon marked unavailable until installed and tested.

## Copy/Paste Prompt For Next Agent

Use this prompt verbatim to start Phase 0B with a fresh agent:

```text
You are taking over Phase 0B: Brain, Retrieval, and Control-Plane Reliability for the Mac Agent Operating System initiative.

Start by reading:
- /Users/tim/dev/governada/governada-app/docs/operations/mac-agent-os-phase-0a-handoff.md
- /Users/tim/dev/governada/governada-brain/agents/system/roadmap.md
- /Users/tim/dev/governada/governada-brain/agents/system/system-overview.md
- /Users/tim/dev/governada/governada-brain/agents/system/agent-operating-model.md
- /Users/tim/dev/governada/governada-brain/agents/system/tooling-matrix.md
- /Users/tim/dev/governada/governada-brain/agents/system/data-boundaries.md
- /Users/tim/dev/governada/governada-brain/agents/build-system/autonomy-policy.md
- /Users/tim/dev/governada/governada-app/AGENTS.md

Do not broaden into provider parity, model collaboration, desktop automation, source-of-truth vault writeback, or broader roadmap phases.

Phase 0B goal:
Make the brain, retrieval, and control-plane layer reliable enough that future agents can trust the doctors and handoff packets before doing deeper implementation.

Use the Phase 0A handoff as primary current-state evidence. Refresh reality where it is cheap and important, especially for drift-prone checks.

Required first checks:
- npm run session:guard
- npm run session:doctor
- npm run docs:doctor
- npm run gh:auth-status
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

Recommended work slices:
1. Decide with Tim whether governada-brain, governada-retrieval, and bluecargo-retrieval should be Git-versioned now or have accepted local-loss risk documented.
2. Add a retrieval/control-plane doctor that reports wrapper availability, PATH exposure, index timestamp, chunk count, vault files newer than index, and policy drift.
3. Reconcile BlueCargo retrieval policy drift across retrieval-policy.md, autonomy-policy.md, bluecargo-context.md, retrieval-interfaces.md, and tooling-matrix.md.
4. Update durable ops notes and/or roadmap current reality after checks and fixes.

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
