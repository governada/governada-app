# Hotfix

The user said "hotfix." Treat this as expedited scope, not permission to bypass the governed ship path.

Use the normal worktree, PR, CI, chat-approved merge, and deploy-verification flow from `AGENTS.md` and `.agents/skills/ship/SKILL.md`. Direct pushes to `main` are not a normal agent path.

## Sequence

1. Create/sync a focused hotfix worktree unless one already exists.
2. Root-cause the bug before changing code.
3. Keep the diff minimal and directly tied to the incident.
4. Run targeted verification plus `npm run agent:validate`.
5. Commit with a `fix:` prefix.
6. Publish through `npm run github:ship`.
7. Create/update/ready the PR through `npm run github:pr-write`.
8. Run `npm run ci:watch`, `npm run pre-merge-check -- <PR#>`, and `npm run github:merge-doctor -- --pr <PR#> --expected-head <sha>`.
9. Pause for Tim's exact `github.merge` approval.
10. Merge through `npm run github:merge`.
11. Let the merge wrapper complete deploy verification.

**CRITICAL:** Do not report a hotfix as complete until production verification passes or a named blocker remains.

## Emergency Bypass

Only use a direct-main or platform rollback path when Tim explicitly approves an emergency bypass with the exact action, repo/project, and reason. Auth/security, scoring, migrations, production data, secret, billing/admin, branch protection, Railway deploy mutation, or GitHub App permission changes require explicit approval even in a hotfix.
